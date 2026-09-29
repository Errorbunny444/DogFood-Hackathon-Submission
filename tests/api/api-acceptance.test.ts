import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../apps/api/dist/app.js';
import { initDatabase, closeDatabase } from '../../packages/database/dist/index.js';
import { importFixtures } from '../../packages/fixture-importer/dist/index.js';
import { DETERMINISTIC_SESSIONS } from '../../packages/shared/dist/index.js';

let app: FastifyInstance;

describe('API Acceptance & Security Suite', () => {
  beforeAll(async () => {
    const db = await initDatabase({
      pgliteDir: './data/test_inspect',
    });
    await importFixtures(db, { fixturePath: './fixtures.json' });
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase();
  });

  it('T1.1: gallery is public without authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/public/projects',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('T1.2: project from fixtures is shown in public gallery', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/public/projects',
    });
    const text = res.body.toLowerCase();
    // One of first 3 fixture projects is 'Glass Signal'
    expect(text).toContain('glass signal');
  });

  it('T1.3: closed event refuses late submissions with 4xx', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/evt_01/projects',
      headers: {
        cookie: `session=${DETERMINISTIC_SESSIONS.PARTICIPANT}`,
      },
      payload: {
        title: 'dogfood-late-submission-probe',
        summary: 'probe',
      },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    const body = res.json();
    expect(body.error.code).toBe('SUBMISSION_DEADLINE_PASSED');
  });

  it('T2.1: judge A can see own scores', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/judges/jdg_01/scores',
      headers: {
        cookie: `session=${DETERMINISTIC_SESSIONS.JUDGE_A}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.judgeSourceId).toBe('jdg_01');
    expect(body.reviews).toBeDefined();
  });

  it("T2.2: judge B cannot see judge A's scores (403 Forbidden)", async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/judges/jdg_01/scores',
      headers: {
        cookie: `session=${DETERMINISTIC_SESSIONS.JUDGE_B}`,
      },
    });
    expect([401, 403]).toContain(res.statusCode);
  });

  it('T2.3: participant is blocked from judge scores (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/judges/jdg_01/scores',
      headers: {
        cookie: `session=${DETERMINISTIC_SESSIONS.PARTICIPANT}`,
      },
    });
    expect([401, 403]).toContain(res.statusCode);
  });

  it('T2.4: organizer can export results as CSV', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/events/evt_01/export/results.csv',
      headers: {
        cookie: `session=${DETERMINISTIC_SESSIONS.ORGANIZER}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const firstLine = res.body.split('\n')[0];
    expect(firstLine).toContain(',');
    expect(firstLine).toContain('project_id');
  });
});
