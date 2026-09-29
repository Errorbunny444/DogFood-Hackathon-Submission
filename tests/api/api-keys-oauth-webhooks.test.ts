import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../apps/api/dist/app.js';
import { initDatabase, closeDatabase, getDb, apiKeys, customDomains } from '../../packages/database/dist/index.js';
import { importFixtures } from '../../packages/fixture-importer/dist/index.js';
import { DETERMINISTIC_SESSIONS } from '../../packages/shared/dist/index.js';

let app: FastifyInstance;

describe('Upgrade 9: API Keys, Custom Domains, OAuth & Event Archives', () => {
  beforeAll(async () => {
    const db = await initDatabase({
      pgliteDir: './data/test_inspect',
    });
    await importFixtures(db, { fixturePath: './fixtures.json' });
    await db.delete(apiKeys);
    await db.delete(customDomains);
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase();
  });

  describe('Scoped Organization API Keys', () => {
    let generatedSecretToken: string;
    let apiKeyId: string;

    it('should create a scoped API key and return secretToken once', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/dogfood-demo/api-keys',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
        payload: {
          name: 'CI/CD Automation Key',
          scopes: ['events:read', 'projects:read', 'projects:write'],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.apiKey).toBeDefined();
      expect(body.apiKey.name).toBe('CI/CD Automation Key');
      expect(body.apiKey.tokenPrefix).toMatch(/^dfk_dogfood_/);
      expect(body.secretToken).toBeDefined();
      expect(body.secretToken).toMatch(/^dfk_dogfood_/);

      generatedSecretToken = body.secretToken;
      apiKeyId = body.apiKey.id;
    });

    it('should list organization API keys without exposing secret token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/dogfood-demo/api-keys',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.apiKeys)).toBe(true);
      expect(body.apiKeys.length).toBeGreaterThan(0);
      expect(body.apiKeys[0].secretToken).toBeUndefined();
      expect(body.apiKeys[0].tokenPrefix).toBeDefined();
    });

    it('should authenticate API requests using the x-api-key header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/dogfood-demo/events',
        headers: {
          'x-api-key': generatedSecretToken,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.events)).toBe(true);
    });

    it('should revoke the API key and deny subsequent authentication', async () => {
      const revokeRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/dogfood-demo/api-keys/${apiKeyId}`,
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(revokeRes.statusCode).toBe(200);
      expect(revokeRes.json().success).toBe(true);

      // Verify revoked key is rejected
      const authRes = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/dogfood-demo/api-keys',
        headers: {
          'x-api-key': generatedSecretToken,
        },
      });

      expect(authRes.statusCode).toBe(401);
    });
  });

  describe('Organization Custom Domains', () => {
    let domainId: string;

    it('should register a custom domain and provide DNS verification instructions', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/dogfood-demo/custom-domains',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
        payload: {
          hostname: 'hack.acme-corp.org',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.domain.hostname).toBe('hack.acme-corp.org');
      expect(body.domain.status).toBe('PENDING');
      expect(body.dnsInstructions.type).toBe('TXT');
      expect(body.dnsInstructions.name).toContain('_dogfood-challenge');

      domainId = body.domain.id;
    });

    it('should verify and activate the custom domain', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/dogfood-demo/custom-domains/${domainId}/verify`,
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.domain.status).toBe('VERIFIED');
    });

    it('should list and delete the custom domain', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/dogfood-demo/custom-domains',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().customDomains.length).toBeGreaterThan(0);

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/dogfood-demo/custom-domains/${domainId}`,
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(delRes.statusCode).toBe(200);
      expect(delRes.json().success).toBe(true);
    });
  });

  describe('OAuth External Identity Linking', () => {
    it('should link GitHub OAuth identity to user account', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/oauth/link',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
        payload: {
          provider: 'GITHUB',
          providerUserId: 'octocat_12345',
          providerEmail: 'octocat@github.com',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.identity.provider).toBe('GITHUB');
    });

    it('should list linked identities and unlink GitHub', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/oauth/identities',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(listRes.statusCode).toBe(200);
      const body = listRes.json();
      expect(body.identities.some((i: any) => i.provider === 'GITHUB')).toBe(true);

      const unlinkRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/oauth/identities/GITHUB',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(unlinkRes.statusCode).toBe(200);
      expect(unlinkRes.json().success).toBe(true);
    });
  });

  describe('Event Archive Export & Import', () => {
    let exportedArchive: any;

    it('should export full event archive without leaking secrets', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/events/evt_01/export/full.json',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(res.statusCode).toBe(200);
      exportedArchive = res.json();
      expect(exportedArchive.event).toBeDefined();
      expect(Array.isArray(exportedArchive.tracks)).toBe(true);
      expect(Array.isArray(exportedArchive.projects)).toBe(true);
      expect(exportedArchive.event.password).toBeUndefined();
    });

    it('should import event archive successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/events/evt_01/import/archive',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
        payload: {
          tracks: [{ name: 'Imported Quantum AI Track', description: 'Quantum computing' }],
          projects: [
            {
              title: 'Quantum Teleportation Engine',
              summary: 'Instant quantum network',
              description: 'Full quantum entanglement protocol',
              repositoryUrl: 'https://github.com/example/quantum',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.counts.tracks).toBe(1);
      expect(body.counts.projects).toBe(1);
    });
  });
});
