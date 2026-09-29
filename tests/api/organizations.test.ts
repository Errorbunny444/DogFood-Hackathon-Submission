import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../apps/api/dist/app.js';
import { initDatabase, closeDatabase } from '../../packages/database/dist/index.js';
import { importFixtures } from '../../packages/fixture-importer/dist/index.js';

let app: FastifyInstance;
let userAToken: string;
let userBToken: string;
let userAId: string;
let userBId: string;

describe('Upgrade 3: Organizations & Multi-Tenancy Test Suite', () => {
  beforeAll(async () => {
    const db = await initDatabase({
      pgliteDir: './data/test_orgs',
    });
    await importFixtures(db, { fixturePath: './fixtures.json' });
    app = buildApp();
    await app.ready();

    // Register User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `org_owner_a_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Alice OrgOwner',
      },
    });
    userAToken = resA.json().token;
    userAId = resA.json().user.id;

    // Register User B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `org_member_b_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Bob OrgMember',
      },
    });
    userBToken = resB.json().token;
    userBId = resB.json().user.id;
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase();
  });

  it('backfills demo organization for fixture events', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations/dogfood-demo',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.organization.slug).toBe('dogfood-demo');
    expect(body.events.length).toBeGreaterThan(0);
    expect(body.events[0].slug).toBe('sample-hack-2026');
  });

  it('creates an organization and automatically assigns creator as OWNER', async () => {
    const slug = `acme-${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { cookie: `session=${userAToken}` },
      payload: {
        name: 'Acme Innovation Lab',
        slug,
        description: 'Next-generation tech incubator',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.organization.name).toBe('Acme Innovation Lab');
    expect(body.organization.slug).toBe(slug);
    expect(body.membership.role).toBe('OWNER');
    expect(body.membership.status).toBe('ACTIVE');
  });

  it('rejects duplicate organization slug with 409 Conflict', async () => {
    const slug = `dup-slug-${Date.now()}`;
    await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { cookie: `session=${userAToken}` },
      payload: { name: 'First Org', slug },
    });

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { cookie: `session=${userAToken}` },
      payload: { name: 'Second Org', slug },
    });

    expect(res2.statusCode).toBe(409);
    expect(res2.json().error.code).toBe('SLUG_ALREADY_EXISTS');
  });

  it('enforces strict tenant isolation across organizations (User A cannot modify Org B)', async () => {
    const orgBSlug = `beta-org-${Date.now()}`;
    // User B creates Org B
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { cookie: `session=${userBToken}` },
      payload: { name: 'Beta Organization', slug: orgBSlug },
    });
    expect(createRes.statusCode).toBe(201);

    // User A attempts to update Org B settings -> MUST be 403 Forbidden
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgBSlug}`,
      headers: { cookie: `session=${userAToken}` },
      payload: { name: 'Hacked by User A' },
    });

    expect(patchRes.statusCode).toBe(403);
    expect(patchRes.json().error.code).toBe('FORBIDDEN');
  });

  it('manages organization members: invite, update role, and protect last owner', async () => {
    const orgSlug = `team-org-${Date.now()}`;
    await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { cookie: `session=${userAToken}` },
      payload: { name: 'Team Hub', slug: orgSlug },
    });

    // 1. User A invites User B as MEMBER
    const inviteRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgSlug}/members`,
      headers: { cookie: `session=${userAToken}` },
      payload: {
        email: `org_member_b_${userBId}@example.com`,
      },
    });

    // Fetch User B email from me endpoint
    const meB = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: `session=${userBToken}` },
    });
    const userBActualEmail = meB.json().user.email;

    // Add with actual email
    const addRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgSlug}/members`,
      headers: { cookie: `session=${userAToken}` },
      payload: {
        email: userBActualEmail,
        role: 'MEMBER',
      },
    });
    expect(addRes.statusCode).toBe(201);
    expect(addRes.json().membership.role).toBe('MEMBER');

    // 2. User A updates User B to ADMIN
    const updateRoleRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgSlug}/members/${userBId}`,
      headers: { cookie: `session=${userAToken}` },
      payload: { role: 'ADMIN' },
    });
    expect(updateRoleRes.statusCode).toBe(200);
    expect(updateRoleRes.json().membership.role).toBe('ADMIN');

    // 3. Prevent removing the last owner (User A tries to remove themselves)
    const removeOwnerRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgSlug}/members/${userAId}`,
      headers: { cookie: `session=${userAToken}` },
    });
    expect(removeOwnerRes.statusCode).toBe(400);
    expect(removeOwnerRes.json().error.code).toBe('LAST_OWNER');

    // 4. Promote User B to OWNER, then User A can leave
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgSlug}/members/${userBId}`,
      headers: { cookie: `session=${userAToken}` },
      payload: { role: 'OWNER' },
    });

    const leaveRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgSlug}/members/${userAId}`,
      headers: { cookie: `session=${userAToken}` },
    });
    expect(leaveRes.statusCode).toBe(200);
    expect(leaveRes.json().success).toBe(true);
  });
});
