import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../apps/api/dist/app.js';
import { initDatabase, closeDatabase } from '../../packages/database/dist/index.js';
import { importFixtures } from '../../packages/fixture-importer/dist/index.js';

let app: FastifyInstance;
const testEmail = `alice_${Date.now()}@hackathon.org`;

describe('Upgrade 2: Real User Onboarding & Auth Test Suite', () => {
  beforeAll(async () => {
    const db = await initDatabase({
      pgliteDir: './data/test_auth',
    });
    await importFixtures(db, { fixturePath: './fixtures.json' });
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase();
  });

  it('rejects registration with short password (< 8 chars)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'shortpass@example.com',
        password: 'short',
        displayName: 'Short Password User',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBeDefined();
  });

  it('successfully registers a new real user and sets session cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: testEmail,
        password: 'SuperSecurePassword123!',
        displayName: 'Alice Developer',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.displayName).toBe('Alice Developer');
    expect(body.user.globalRole).toBe('USER');

    // Cookie check
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toContain('session=');
  });

  it('rejects duplicate registration with identical email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: testEmail,
        password: 'AnotherPassword456!',
        displayName: 'Alice Duplicate',
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('authenticates with correct credentials and returns session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: 'SuperSecurePassword123!',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe(testEmail);
  });

  it('rejects login with wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: 'WrongPassword!',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('non-enumerating forgot-password returns 200 for both existing and non-existing email', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'nonexistent@example.com' },
    });
    expect(res1.statusCode).toBe(200);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: testEmail },
    });
    expect(res2.statusCode).toBe(200);
    const body2 = res2.json();
    expect(body2.resetToken).toBeDefined();

    // Now reset password using the demo token
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: body2.resetToken,
        newPassword: 'BrandNewPassword789!',
      },
    });
    expect(resetRes.statusCode).toBe(200);

    // Verify login with new password works
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: 'BrandNewPassword789!',
      },
    });
    expect(loginRes.statusCode).toBe(200);
  });

  it('updates profile and fetches me with bio and verification status', async () => {
    // Login to get session
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: 'BrandNewPassword789!',
      },
    });
    const token = loginRes.json().token;

    // Update profile
    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/profile',
      headers: { cookie: `session=${token}` },
      payload: {
        displayName: 'Alice Senior Eng',
        bio: 'Full-stack distributed systems engineer',
      },
    });
    expect(updateRes.statusCode).toBe(200);

    // Fetch me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie: `session=${token}` },
    });
    expect(meRes.statusCode).toBe(200);
    const meBody = meRes.json();
    expect(meBody.user.displayName).toBe('Alice Senior Eng');
    expect(meBody.user.bio).toBe('Full-stack distributed systems engineer');
    expect(Array.isArray(meBody.user.identities)).toBe(true);
  });
});
