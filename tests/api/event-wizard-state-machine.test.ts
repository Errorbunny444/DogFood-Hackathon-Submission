import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../apps/api/dist/app.js';
import { initDatabase, closeDatabase } from '../../packages/database/dist/index.js';
import { importFixtures } from '../../packages/fixture-importer/dist/index.js';

let app: FastifyInstance;
let organizerToken: string;
let participantToken: string;

describe('Upgrade 4: Event Creation Wizard & State Machine Test Suite', () => {
  beforeAll(async () => {
    const db = await initDatabase({
      pgliteDir: './data/test_wizard',
    });
    await importFixtures(db, { fixturePath: './fixtures.json' });
    app = buildApp();
    await app.ready();

    // Register Organizer
    const resOrg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `wizard_org_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Wizard Organizer',
      },
    });
    organizerToken = resOrg.json().token;

    // Register Participant
    const resPart = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `wizard_part_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Wizard Participant',
      },
    });
    participantToken = resPart.json().token;
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase();
  });

  let createdEventId: string;
  const eventSlug = `ai-hackathon-${Date.now()}`;

  it('creates complete hackathon via wizard with tracks, prizes, rubric, and questions', async () => {
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/wizard',
      headers: { cookie: `session=${organizerToken}` },
      payload: {
        name: 'Autonomous Agents 2026',
        slug: eventSlug,
        description: 'Building production autonomous agents and tooling.',
        timezone: 'UTC',
        submissionDeadline: deadline,
        initialStatus: 'DRAFT',
        tracks: [
          { name: 'Core Infrastructure', description: 'Agent runtimes and protocols' },
          { name: 'Developer Tools', description: 'IDEs, debuggers, benchmarks' },
        ],
        prizes: [
          { name: 'Grand Champion', amount: '$10,000', description: 'Best overall submission' },
          { name: 'Best Infrastructure', amount: '$5,000', trackIndex: 0 },
        ],
        rubric: {
          name: 'Agent Evaluation Rubric',
          description: 'Standard 4-tier rubric',
          criteria: [
            { name: 'Technical Depth', weight: 0.4, minScore: 1, maxScore: 5 },
            { name: 'Practical Usability', weight: 0.3, minScore: 1, maxScore: 5 },
            { name: 'Innovation & Polish', weight: 0.3, minScore: 1, maxScore: 5 },
          ],
        },
        submissionQuestions: [
          { question: 'Architecture Overview', type: 'TEXTAREA', required: true },
          { question: 'Open Source License', type: 'SELECT', options: ['MIT', 'Apache-2.0', 'GPLv3'] },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.event.name).toBe('Autonomous Agents 2026');
    expect(body.event.slug).toBe(eventSlug);
    expect(body.event.status).toBe('DRAFT');
    expect(body.tracks.length).toBe(2);
    expect(body.prizes.length).toBe(2);
    expect(body.rubric).toBeDefined();
    expect(body.criteria.length).toBe(3);
    expect(body.submissionQuestions.length).toBe(2);

    createdEventId = body.event.id;
  });

  it('fetches full event details with joined tracks, prizes, and rubric', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/events/${createdEventId}/full`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.event.id).toBe(createdEventId);
    expect(body.tracks.length).toBe(2);
    expect(body.prizes.length).toBe(2);
    expect(body.criteria.length).toBe(3);
    expect(body.submissionQuestions.length).toBe(2);
  });

  it('rejects invalid state transitions violating the state machine', async () => {
    // Attempt to jump from DRAFT directly to COMPLETED
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/events/${createdEventId}/status`,
      headers: { cookie: `session=${organizerToken}` },
      payload: { status: 'COMPLETED' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('blocks non-organizers from transitioning event status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/events/${createdEventId}/status`,
      headers: { cookie: `session=${participantToken}` },
      payload: { status: 'PUBLISHED' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('advances event through valid lifecycle transitions (DRAFT -> PUBLISHED -> REGISTRATION -> ACTIVE -> SUBMISSIONS_CLOSED -> JUDGING)', async () => {
    // 1. DRAFT -> PUBLISHED
    const r1 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/events/${createdEventId}/status`,
      headers: { cookie: `session=${organizerToken}` },
      payload: { status: 'PUBLISHED' },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().event.status).toBe('PUBLISHED');

    // 2. PUBLISHED -> REGISTRATION
    const r2 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/events/${createdEventId}/status`,
      headers: { cookie: `session=${organizerToken}` },
      payload: { status: 'REGISTRATION' },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().event.status).toBe('REGISTRATION');

    // 3. REGISTRATION -> ACTIVE
    const r3 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/events/${createdEventId}/status`,
      headers: { cookie: `session=${organizerToken}` },
      payload: { status: 'ACTIVE' },
    });
    expect(r3.statusCode).toBe(200);
    expect(r3.json().event.status).toBe('ACTIVE');

    // 4. ACTIVE -> SUBMISSIONS_CLOSED
    const r4 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/events/${createdEventId}/status`,
      headers: { cookie: `session=${organizerToken}` },
      payload: { status: 'SUBMISSIONS_CLOSED' },
    });
    expect(r4.statusCode).toBe(200);
    expect(r4.json().event.status).toBe('SUBMISSIONS_CLOSED');

    // 5. SUBMISSIONS_CLOSED -> JUDGING
    const r5 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/events/${createdEventId}/status`,
      headers: { cookie: `session=${organizerToken}` },
      payload: { status: 'JUDGING' },
    });
    expect(r5.statusCode).toBe(200);
    expect(r5.json().event.status).toBe('JUDGING');
  });

  it('updates event timeline and deadline', async () => {
    const extendedDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/events/${createdEventId}/timeline`,
      headers: { cookie: `session=${organizerToken}` },
      payload: {
        submissionDeadline: extendedDeadline,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(new Date(body.event.submissionDeadline).toISOString()).toBe(new Date(extendedDeadline).toISOString());
  });
});
