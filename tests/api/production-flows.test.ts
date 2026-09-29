import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../apps/api/dist/app.js';
import { initDatabase, closeDatabase } from '../../packages/database/dist/index.js';
import { importFixtures } from '../../packages/fixture-importer/dist/index.js';

let app: FastifyInstance;
let organizerToken: string;
let participant1Token: string;
let participant2Token: string;
let judgeToken: string;
let participant1Id: string;
let participant2Id: string;
let judgeId: string;

let flowsJudgeEmail: string;

describe('Upgrade 5: Production Team, Submission & Judging Flows Test Suite', () => {
  beforeAll(async () => {
    const db = await initDatabase({
      pgliteDir: './data/test_flows',
    });
    await importFixtures(db, { fixturePath: './fixtures.json' });
    app = buildApp();
    await app.ready();

    // 1. Register Organizer
    const resOrg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `flows_org_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Flows Organizer',
      },
    });
    organizerToken = resOrg.json().token;

    // 2. Register Participant 1
    const resP1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `flows_p1_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Alice Lead',
      },
    });
    participant1Token = resP1.json().token;
    participant1Id = resP1.json().user.id;

    // 3. Register Participant 2
    const resP2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `flows_p2_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Bob Dev',
      },
    });
    participant2Token = resP2.json().token;
    participant2Id = resP2.json().user.id;

    // 4. Register Judge
    flowsJudgeEmail = `flows_judge_${Date.now()}@example.com`;
    const resJ = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: flowsJudgeEmail,
        password: 'Password123!',
        displayName: 'Judge Judy',
      },
    });
    judgeToken = resJ.json().token;
    judgeId = resJ.json().user.id;
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase();
  });

  let eventId: string;
  let track1Id: string;
  let track2Id: string;
  let requiredQuestionId: string;
  let optionalQuestionId: string;
  let teamId: string;
  let projectId: string;

  it('sets up an active event with tracks, questions, and team', async () => {
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Create event via wizard
    const resEvent = await app.inject({
      method: 'POST',
      url: '/api/v1/events/wizard',
      headers: { cookie: `session=${organizerToken}` },
      payload: {
        name: 'Production Flow Hackathon',
        slug: `flows-event-${Date.now()}`,
        description: 'Testing team, submission and judging pipelines',
        submissionDeadline: deadline,
        initialStatus: 'DRAFT',
        tracks: [
          { name: 'Core AI', description: 'Artificial Intelligence' },
          { name: 'Infrastructure', description: 'Systems & DevOps' },
        ],
        prizes: [{ name: 'Grand Prize', amount: '$5,000' }],
        rubric: {
          name: 'Standard Evaluation',
          criteria: [
            { name: 'Impact', weight: 0.6, minScore: 1, maxScore: 5 },
            { name: 'Execution', weight: 0.4, minScore: 1, maxScore: 5 },
          ],
        },
        submissionQuestions: [
          {
            question: 'What is your public GitHub repo URL?',
            type: 'URL',
            required: true,
          },
          {
            question: 'Select primary tech stack:',
            type: 'SELECT',
            options: ['Node.js', 'Python', 'Rust', 'Go'],
            required: false,
          },
        ],
      },
    });

    expect(resEvent.statusCode).toBe(201);
    eventId = resEvent.json().event.id;
    track1Id = resEvent.json().tracks[0].id;
    track2Id = resEvent.json().tracks[1].id;
    requiredQuestionId = resEvent.json().submissionQuestions[0].id;
    optionalQuestionId = resEvent.json().submissionQuestions[1].id;

    // Transition event to ACTIVE so teams and submissions are accepted
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/events/${eventId}/status`,
      headers: { cookie: `session=${organizerToken}` },
      payload: { status: 'REGISTRATION' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/events/${eventId}/status`,
      headers: { cookie: `session=${organizerToken}` },
      payload: { status: 'ACTIVE' },
    });

    // Participant 1 creates Team
    const resTeam = await app.inject({
      method: 'POST',
      url: `/api/v1/events/${eventId}/teams`,
      headers: { cookie: `session=${participant1Token}` },
      payload: { name: 'Alpha Builders' },
    });
    expect(resTeam.statusCode).toBe(201);
    teamId = resTeam.json().id;
  });

  it('manages team membership: invite, accept, transfer ownership, and leave protections', async () => {
    // 1. Participant 1 invites Participant 2
    const resInvite = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/invites`,
      headers: { cookie: `session=${participant1Token}` },
      payload: { email: 'bob@example.com' },
    });
    expect(resInvite.statusCode).toBe(201);
    const token = resInvite.json().token;

    // 2. Participant 2 accepts invite
    const resAccept = await app.inject({
      method: 'POST',
      url: `/api/v1/team-invites/${token}/accept`,
      headers: { cookie: `session=${participant2Token}` },
    });
    expect(resAccept.statusCode).toBe(200);

    // Verify 2 members in team
    const resGetTeam = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}`,
    });
    expect(resGetTeam.statusCode).toBe(200);
    expect(resGetTeam.json().members).toHaveLength(2);

    // 3. Participant 1 attempts to leave as sole owner -> should be blocked
    const resBlockedLeave = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${teamId}/members/${participant1Id}`,
      headers: { cookie: `session=${participant1Token}` },
    });
    expect(resBlockedLeave.statusCode).toBe(400);
    expect(resBlockedLeave.json().error.code).toBe('CANNOT_LEAVE_AS_ONLY_OWNER');

    // 4. Participant 1 transfers ownership to Participant 2
    const resTransfer = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}/owner`,
      headers: { cookie: `session=${participant1Token}` },
      payload: { newOwnerUserId: participant2Id },
    });
    expect(resTransfer.statusCode).toBe(200);
    expect(resTransfer.json().ownerId).toBe(participant2Id);

    // Verify Participant 2 is now OWNER and Participant 1 is MEMBER
    const resCheckTeam = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}`,
    });
    const p2Member = resCheckTeam.json().members.find((m: any) => m.userId === participant2Id);
    const p1Member = resCheckTeam.json().members.find((m: any) => m.userId === participant1Id);
    expect(p2Member.role).toBe('OWNER');
    expect(p1Member.role).toBe('MEMBER');
  });

  it('handles custom questions, answers autosave, and required question validation upon submission', async () => {
    // Create draft project
    const resDraft = await app.inject({
      method: 'POST',
      url: `/api/v1/events/${eventId}/projects`,
      headers: { cookie: `session=${participant2Token}` },
      payload: {
        title: 'Project Nebula',
        summary: 'Cloud-native distributed pipeline',
        teamId,
        trackId: track1Id,
      },
    });
    expect(resDraft.statusCode).toBe(201);
    projectId = resDraft.json().id;

    // Verify initial answers (empty)
    const resInitialAnswers = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/answers`,
    });
    expect(resInitialAnswers.statusCode).toBe(200);
    expect(resInitialAnswers.json()).toHaveLength(2);
    expect(resInitialAnswers.json()[0].answer).toBeNull();

    // Attempt to submit project without answering required question -> fails with 400
    const resFailedSubmit = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/submit`,
      headers: { cookie: `session=${participant2Token}` },
    });
    expect(resFailedSubmit.statusCode).toBe(400);
    expect(resFailedSubmit.json().error.code).toBe('MISSING_REQUIRED_QUESTIONS');

    // Save custom answers (autosave)
    const resSave = await app.inject({
      method: 'PUT',
      url: `/api/v1/projects/${projectId}/answers`,
      headers: { cookie: `session=${participant2Token}` },
      payload: {
        answers: [
          { questionId: requiredQuestionId, answer: 'https://github.com/example/nebula' },
          { questionId: optionalQuestionId, answer: 'Rust' },
        ],
      },
    });
    expect(resSave.statusCode).toBe(200);
    expect(resSave.json().savedCount).toBe(2);

    // Verify saved answers
    const resGetAnswers = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/answers`,
    });
    expect(resGetAnswers.statusCode).toBe(200);
    const answers = resGetAnswers.json();
    const reqAns = answers.find((a: any) => a.questionId === requiredQuestionId);
    expect(reqAns.answer).toBe('https://github.com/example/nebula');

    // Submit project successfully with cryptographic receipt
    const resSubmit = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/submit`,
      headers: { cookie: `session=${participant2Token}` },
    });
    expect(resSubmit.statusCode).toBe(200);
    const submitBody = resSubmit.json();
    expect(submitBody.status).toBe('SUBMITTED');
    expect(submitBody.receipt).toBeDefined();
    expect(submitBody.receipt.receiptId).toBeDefined();
    expect(submitBody.receipt.sha256).toHaveLength(64);
    expect(submitBody.receipt.projectTitle).toBe('Project Nebula');
  });

  it('enforces team lock after project submission', async () => {
    // Attempt to invite new member after project submission -> 409 TEAM_LOCKED
    const resLockedInvite = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/invites`,
      headers: { cookie: `session=${participant2Token}` },
      payload: { email: 'charlie@example.com' },
    });
    expect(resLockedInvite.statusCode).toBe(409);
    expect(resLockedInvite.json().error.code).toBe('TEAM_LOCKED');

    // Attempt to remove member after project submission -> 409 TEAM_LOCKED
    const resLockedRemove = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${teamId}/members/${participant1Id}`,
      headers: { cookie: `session=${participant2Token}` },
    });
    expect(resLockedRemove.statusCode).toBe(409);
    expect(resLockedRemove.json().error.code).toBe('TEAM_LOCKED');
  });

  it('supports judge invitation, track preferences, conflict declaration, and auto-unassignment', async () => {
    // 1. Organizer invites Judge
    const resInviteJudge = await app.inject({
      method: 'POST',
      url: `/api/v1/events/${eventId}/judges/invite`,
      headers: { cookie: `session=${organizerToken}` },
      payload: {
        email: 'invited_judge@example.com',
        displayName: 'Invited Expert',
        maxWorkload: 12,
      },
    });
    expect(resInviteJudge.statusCode).toBe(201);
    expect(resInviteJudge.json().judge.email).toBe('invited_judge@example.com');
    expect(resInviteJudge.json().judge.maxWorkload).toBe(12);

    // Also register our existing registered judge for this event
    await app.inject({
      method: 'POST',
      url: `/api/v1/events/${eventId}/judges/invite`,
      headers: { cookie: `session=${organizerToken}` },
      payload: {
        email: flowsJudgeEmail,
        displayName: 'Judge Judy',
        maxWorkload: 10,
      },
    });

    // 2. Organizer lists judges roster
    const resJudgesList = await app.inject({
      method: 'GET',
      url: `/api/v1/events/${eventId}/judges`,
      headers: { cookie: `session=${organizerToken}` },
    });
    expect(resJudgesList.statusCode).toBe(200);
    expect(resJudgesList.json().length).toBeGreaterThanOrEqual(2);

    // 3. Judge sets track preferences
    const resSetPref = await app.inject({
      method: 'PUT',
      url: `/api/v1/events/${eventId}/judge/preferences`,
      headers: { cookie: `session=${judgeToken}` },
      payload: { trackIds: [track1Id] },
    });
    expect(resSetPref.statusCode).toBe(200);
    expect(resSetPref.json().trackIds).toContain(track1Id);

    // Verify track preferences retrieval
    const resGetPref = await app.inject({
      method: 'GET',
      url: `/api/v1/events/${eventId}/judge/preferences`,
      headers: { cookie: `session=${judgeToken}` },
    });
    expect(resGetPref.statusCode).toBe(200);
    expect(resGetPref.json().trackIds).toContain(track1Id);

    // 4. Organizer auto-assigns judges
    const resAssign = await app.inject({
      method: 'POST',
      url: `/api/v1/events/${eventId}/judging/auto-assign`,
      headers: { cookie: `session=${organizerToken}` },
      payload: {
        targetReviewsPerProject: 2,
        maxWorkloadPerJudge: 10,
        respectTrackPreferences: true,
        preventConflicts: true,
      },
    });
    expect(resAssign.statusCode).toBe(200);

    // 5. Judge declares conflict of interest with project -> AUTO-UNASSIGNS
    const resConflict = await app.inject({
      method: 'POST',
      url: `/api/v1/events/${eventId}/judge/conflicts`,
      headers: { cookie: `session=${judgeToken}` },
      payload: {
        projectId,
        reason: 'Mentored this team previously',
      },
    });
    expect(resConflict.statusCode).toBe(201);
    const conflictId = resConflict.json().conflict.id;

    // Verify conflict listed
    const resConflicts = await app.inject({
      method: 'GET',
      url: `/api/v1/events/${eventId}/judge/conflicts`,
      headers: { cookie: `session=${judgeToken}` },
    });
    expect(resConflicts.statusCode).toBe(200);
    expect(resConflicts.json()).toHaveLength(1);
    expect(resConflicts.json()[0].projectTitle).toBe('Project Nebula');

    // 6. Judge removes conflict
    const resDelConflict = await app.inject({
      method: 'DELETE',
      url: `/api/v1/events/${eventId}/judge/conflicts/${conflictId}`,
      headers: { cookie: `session=${judgeToken}` },
    });
    expect(resDelConflict.statusCode).toBe(200);
    expect(resDelConflict.json().success).toBe(true);
  });
});
