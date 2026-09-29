import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../apps/api/dist/app.js';
import { initDatabase, closeDatabase, getDb, users, sessions, userMfa } from '../../packages/database/dist/index.js';
import { importFixtures } from '../../packages/fixture-importer/dist/index.js';
import { DETERMINISTIC_SESSIONS } from '../../packages/shared/dist/index.js';
import { computeTotp } from '../../apps/api/dist/lib/totp.js';
import { sanitizeHtml, sanitizeText, sanitizeUrl } from '../../apps/api/dist/lib/sanitize.js';

let app: FastifyInstance;

describe('Upgrade 7: Security, Observability & MFA Test Suite', () => {
  beforeAll(async () => {
    const db = await initDatabase({
      pgliteDir: './data/test_inspect',
    });
    await importFixtures(db, { fixturePath: './fixtures.json' });
    await db.delete(userMfa);
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase();
  });

  describe('Security Headers & CSRF Protection', () => {
    it('should include strict security headers on all responses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/public/projects',
      });

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should block cross-origin state mutations with CSRF_ORIGIN_MISMATCH', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/events/evt_01/projects',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.PARTICIPANT}`,
          origin: 'http://malicious-attacker-site.com',
        },
        payload: {
          title: 'Malicious Injected Project',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error.code).toBe('CSRF_ORIGIN_MISMATCH');
    });

    it('should block mismatched double-submit CSRF tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/events/evt_01/projects',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.PARTICIPANT}; csrf_token=expected_csrf_123`,
          'x-csrf-token': 'wrong_csrf_456',
        },
        payload: {
          title: 'Tampered Token Project',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error.code).toBe('CSRF_TOKEN_MISMATCH');
    });
  });

  describe('Content Sanitization (XSS Prevention)', () => {
    it('should sanitize dangerous HTML tags and script injections', () => {
      const dirty = '<script>alert("xss")</script><p>Hello <b>World</b></p><iframe src="evil.com"></iframe>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('<iframe>');
      expect(clean).toContain('Hello <b>World</b>');
    });

    it('should strip inline javascript: protocols and on* event handlers', () => {
      const dirty = '<a href="javascript:alert(1)" onclick="stealCookies()">Click me</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('javascript:');
      expect(clean).not.toContain('onclick=');
    });

    it('should validate URLs allowing only http: and https:', () => {
      expect(sanitizeUrl('https://dogfood.org')).toBe('https://dogfood.org');
      expect(sanitizeUrl('http://localhost:8080')).toBe('http://localhost:8080');
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeUrl('data:text/html,evil')).toBeNull();
    });
  });

  describe('Two-Factor Authentication (TOTP MFA)', () => {
    let totpSecret: string;
    let backupCodes: string[];

    it('should return MFA disabled initially for organizer', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/mfa/status',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.enabled).toBe(false);
      expect(body.hasBackupCodes).toBe(false);
    });

    it('should setup TOTP secret and 8 backup codes', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/setup',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.secret).toBeDefined();
      expect(body.uri).toContain('otpauth://totp/');
      expect(Array.isArray(body.backupCodes)).toBe(true);
      expect(body.backupCodes.length).toBe(8);

      totpSecret = body.secret;
      backupCodes = body.backupCodes;
    });

    it('should reject enabling MFA with invalid TOTP code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/enable',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
        payload: {
          code: '000000',
          secret: totpSecret,
          backupCodes,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error.code).toBe('INVALID_MFA_CODE');
    });

    it('should successfully enable MFA with computed current TOTP code', async () => {
      const currentStep = Math.floor(Date.now() / 1000 / 30);
      const validCode = computeTotp(totpSecret, currentStep);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/enable',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
        payload: {
          code: validCode,
          secret: totpSecret,
          backupCodes,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);

      // Verify status now enabled
      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/mfa/status',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });
      const status = statusRes.json();
      expect(status.enabled).toBe(true);
      expect(status.backupCodesRemaining).toBe(8);
    });

    it('should verify login using a single-use backup code and consume it', async () => {
      // Find organizer user id
      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });
      const userId = statusRes.json().user.id;

      const codeToUse = backupCodes[0];
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/verify',
        payload: {
          userId,
          code: codeToUse,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.valid).toBe(true);
      expect(body.usedBackupCode).toBe(true);
      expect(body.remainingBackupCodes).toBe(7);

      // Re-using the same backup code must now fail
      const reuseRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/verify',
        payload: {
          userId,
          code: codeToUse,
        },
      });
      expect(reuseRes.statusCode).toBe(400);
    });

    it('should disable MFA with valid code', async () => {
      const currentStep = Math.floor(Date.now() / 1000 / 30);
      const validCode = computeTotp(totpSecret, currentStep);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/disable',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
        payload: {
          code: validCode,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('In-App Notifications Infrastructure', () => {
    let createdNotificationId: string;

    it('should create and retrieve user notification', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/test',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
        payload: {
          type: 'DEADLINE_WARNING',
          title: 'Submissions Closing Soon',
          body: 'Submissions will close in 2 hours.',
        },
      });

      expect(createRes.statusCode).toBe(200);
      const createBody = createRes.json();
      expect(createBody.success).toBe(true);
      expect(createBody.notification.id).toBeDefined();
      createdNotificationId = createBody.notification.id;

      // Check unread count
      const countRes = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications/unread-count',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });
      expect(countRes.statusCode).toBe(200);
      expect(countRes.json().count).toBeGreaterThan(0);
    });

    it('should list notifications and mark single as read', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications?limit=10',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(listRes.statusCode).toBe(200);
      const listBody = listRes.json();
      expect(Array.isArray(listBody.items)).toBe(true);
      expect(listBody.total).toBeGreaterThan(0);

      // Mark single as read
      const markRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/notifications/${createdNotificationId}/read`,
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(markRes.statusCode).toBe(200);
      expect(markRes.json().success).toBe(true);
    });

    it('should mark all notifications as read', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/read-all',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const countRes = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications/unread-count',
        headers: {
          cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
        },
      });
      expect(countRes.json().count).toBe(0);
    });
  });

  describe('Observability, Metrics & Health Probes', () => {
    it('GET /api/v1/health should return healthy status and database latency', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('healthy');
      expect(body.database.connected).toBe(true);
      expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/v1/ready should return ready: true', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/ready',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().ready).toBe(true);
    });

    it('GET /api/v1/metrics should return JSON metrics schema', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/metrics',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.requests).toBeDefined();
      expect(body.requests.total).toBeGreaterThan(0);
      expect(body.database.connected).toBe(true);
      expect(body.jobs).toBeDefined();
    });

    it('GET /api/v1/metrics?format=prometheus should return valid Prometheus exposition format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/metrics?format=prometheus',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.body).toContain('# HELP dogfood_requests_total');
      expect(res.body).toContain('dogfood_uptime_seconds');
      expect(res.body).toContain('dogfood_db_connected 1');
    });
  });
});
