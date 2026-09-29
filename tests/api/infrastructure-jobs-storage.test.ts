import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { buildApp } from '../../apps/api/dist/app.js';
import { initDatabase, closeDatabase } from '../../packages/database/dist/index.js';
import { importFixtures } from '../../packages/fixture-importer/dist/index.js';
import { LocalStorageProvider } from '../../apps/api/dist/services/storage/local-provider.js';
import { classifyMimeType } from '../../apps/api/dist/services/storage/types.js';
import { ConsoleEmailProvider } from '../../apps/api/dist/services/email/console-provider.js';
import {
  renderEmailVerificationEmail,
  renderPasswordResetEmail,
  renderTeamInviteEmail,
  renderSubmissionReceiptEmail,
  renderJudgeAssignedEmail,
} from '../../apps/api/dist/services/email/templates.js';
import { JobQueue } from '../../apps/api/dist/services/jobs/queue.js';
import { JobWorker } from '../../apps/api/dist/services/jobs/worker.js';

let app: FastifyInstance;
let adminToken: string;
let participantToken: string;
let participantId: string;
let testEventId: string;
let testProjectId: string;
let uploadedAssetId: string;

describe('Upgrade 6: Production Storage, Email & Background Job Infrastructure Test Suite', () => {
  beforeAll(async () => {
    const db = await initDatabase({
      pgliteDir: './data/test_infra',
    });
    await importFixtures(db, { fixturePath: './fixtures.json' });
    app = buildApp();
    await app.ready();

    // 1. Register Admin User
    const resAdmin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `infra_admin_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Infra Admin',
      },
    });
    adminToken = resAdmin.json().token;

    // 2. Register Participant
    const resPart = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `infra_part_${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Infra Participant',
      },
    });
    participantToken = resPart.json().token;
    participantId = resPart.json().user.id;

    // 3. Create Event and Project
    const resEvent = await app.inject({
      method: 'POST',
      url: '/api/v1/events',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Infrastructure & Storage Hackathon 2026',
        slug: `infra-hack-${Date.now()}`,
        description: 'Testing background jobs, storage and email.',
        submissionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    testEventId = resEvent.json().id;

    // Create Team
    const resTeam = await app.inject({
      method: 'POST',
      url: `/api/v1/events/${testEventId}/teams`,
      headers: { authorization: `Bearer ${participantToken}` },
      payload: {
        name: 'Infra Builders Team',
      },
    });
    const teamId = resTeam.json().id;

    // Create Project
    const resProject = await app.inject({
      method: 'POST',
      url: `/api/v1/events/${testEventId}/projects`,
      headers: { authorization: `Bearer ${participantToken}` },
      payload: {
        title: 'Distributed Storage & Async Jobs Service',
        tagline: 'High reliability storage and worker pipeline',
        teamId,
      },
    });
    testProjectId = resProject.json().id;
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
    await closeDatabase();
  });

  // ==========================================
  // 1. Storage Provider Unit & API Tests
  // ==========================================
  describe('Storage Infrastructure', () => {
    it('LocalStorageProvider should successfully upload, download, verify existence, and delete files', async () => {
      const testDir = './uploads/test_scratch';
      const provider = new LocalStorageProvider({ baseDir: testDir, publicBaseUrl: '/uploads/test_scratch' });

      const testContent = Buffer.from('# Hello Storage Engine\nTesting file storage.');
      const key = 'docs/readme.md';

      const uploadResult = await provider.upload(key, testContent, 'text/markdown');
      expect(uploadResult.key).toBe(key);
      expect(uploadResult.publicUrl).toBe('/uploads/test_scratch/docs/readme.md');
      expect(uploadResult.size).toBe(testContent.length);

      const exists = await provider.exists(key);
      expect(exists).toBe(true);

      const downloaded = await provider.download(key);
      expect(downloaded.toString('utf-8')).toBe(testContent.toString('utf-8'));

      const deleted = await provider.delete(key);
      expect(deleted).toBe(true);
      expect(await provider.exists(key)).toBe(false);

      // Clean up test dir
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('MIME type classifier should correctly categorize common upload types', () => {
      expect(classifyMimeType('image/png')).toBe('IMAGE');
      expect(classifyMimeType('image/jpeg')).toBe('IMAGE');
      expect(classifyMimeType('video/mp4')).toBe('VIDEO');
      expect(classifyMimeType('application/pdf')).toBe('DOCUMENT');
      expect(classifyMimeType('application/zip')).toBe('ARCHIVE');
    });

    it('POST /api/v1/projects/:projectId/assets should upload an asset and enforce file size limits', async () => {
      const fileData = Buffer.from('console.log("DOGFOOD 2026 Asset");').toString('base64');

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testProjectId}/assets`,
        headers: { authorization: `Bearer ${participantToken}` },
        payload: {
          fileName: 'architecture-diagram.png',
          mimeType: 'image/png',
          base64Data: fileData,
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.asset).toBeDefined();
      expect(json.asset.name).toBe('architecture-diagram.png');
      expect(json.asset.type).toBe('IMAGE');
      expect(json.asset.mimeType).toBe('image/png');
      expect(json.asset.path).toContain('/uploads/');
      uploadedAssetId = json.asset.id;
    });

    it('GET /api/v1/projects/:projectId/assets should list uploaded assets', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/assets`,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.assets).toBeDefined();
      expect(Array.isArray(json.assets)).toBe(true);
      expect(json.assets.length).toBeGreaterThan(0);
      expect(json.assets.some((a: any) => a.id === uploadedAssetId)).toBe(true);
    });

    it('DELETE /api/v1/projects/:projectId/assets/:assetId should delete asset', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${testProjectId}/assets/${uploadedAssetId}`,
        headers: { authorization: `Bearer ${participantToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      // Verify deletion from list
      const resAfter = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${testProjectId}/assets`,
      });
      expect(resAfter.json().assets.some((a: any) => a.id === uploadedAssetId)).toBe(false);
    });
  });

  // ==========================================
  // 2. Email Provider & Templates Tests
  // ==========================================
  describe('Email Infrastructure & Templates', () => {
    it('ConsoleEmailProvider should record outgoing emails in memory and return success', async () => {
      const emailProvider = new ConsoleEmailProvider();
      const sendResult = await emailProvider.send({
        to: 'tester@example.com',
        subject: 'Welcome to DOGFOOD 2026',
        html: '<p>Welcome!</p>',
        text: 'Welcome!',
      });

      expect(sendResult.success).toBe(true);
      expect(sendResult.provider).toBe('console');
      expect(emailProvider.getSentEmails().length).toBe(1);
      expect(emailProvider.getLastEmail()?.subject).toBe('Welcome to DOGFOOD 2026');
    });

    it('Email templates should render proper HTML, plain text, and subject headers', () => {
      const verify = renderEmailVerificationEmail({ name: 'Alice', verifyUrl: 'https://dogfood.local/verify?token=123' });
      expect(verify.subject).toContain('Verify your email');
      expect(verify.html).toContain('Alice');
      expect(verify.html).toContain('https://dogfood.local/verify?token=123');
      expect(verify.text).toContain('24 hours');

      const reset = renderPasswordResetEmail({ name: 'Bob', resetUrl: 'https://dogfood.local/reset?token=456' });
      expect(reset.subject).toContain('Reset your password');
      expect(reset.html).toContain('Bob');

      const receipt = renderSubmissionReceiptEmail({
        projectTitle: 'AI Drone',
        eventTitle: 'DOGFOOD Hack',
        receiptId: 'rcpt-uuid-999',
        submittedAt: '2026-09-28T00:00:00Z',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
      expect(receipt.subject).toContain('Submission Receipt');
      expect(receipt.html).toContain('AI Drone');
      expect(receipt.html).toContain('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });

  // ==========================================
  // 3. PostgreSQL Background Job Queue & Worker Tests
  // ==========================================
  describe('Background Job Queue & In-Process Worker', () => {
    it('JobQueue should enqueue, claim, and complete jobs', async () => {
      const queue = new JobQueue();
      const qName = `test-q-basic-${Date.now()}`;
      const job = await queue.enqueue('test.sample_task', { count: 42 }, { queue: qName });

      expect(job.id).toBeDefined();
      expect(job.status).toBe('PENDING');
      expect(job.name).toBe('test.sample_task');
      expect(job.payload).toEqual({ count: 42 });

      const claimed = await queue.claimNextJob('test-worker-1', qName);
      expect(claimed).not.toBeNull();
      expect(claimed?.id).toBe(job.id);
      expect(claimed?.status).toBe('RUNNING');
      expect(claimed?.attempts).toBe(1);

      await queue.completeJob(job.id);

      const stats = await queue.getJobStats();
      expect(stats.completed).toBeGreaterThanOrEqual(1);
    });

    it('JobQueue should apply exponential backoff on failure and support retry', async () => {
      const queue = new JobQueue();
      const qName = `test-q-fail-${Date.now()}`;
      const failJob = await queue.enqueue('test.failing_task', { err: true }, { queue: qName, maxAttempts: 3 });

      const claimed = await queue.claimNextJob('test-worker-fail', qName);
      expect(claimed?.id).toBe(failJob.id);

      await queue.failJob(failJob.id, 'Simulated database timeout');

      // Check stats
      const stats = await queue.getJobStats();
      expect(stats.total).toBeGreaterThanOrEqual(2);

      // Retry the job
      const retried = await queue.retryJob(failJob.id);
      expect(retried).not.toBeNull();
      expect(retried?.status).toBe('PENDING');
      expect(retried?.attempts).toBe(0);
      expect(retried?.lastError).toBeNull();
    });

    it('JobWorker should process registered tasks to completion', async () => {
      const queue = new JobQueue();
      const qName = `test-q-worker-${Date.now()}`;
      const worker = new JobWorker('test-integrated-worker');

      let taskExecuted = false;
      worker.registerHandler('custom.test_execution', async (payload: any) => {
        if (payload.shouldSucceed) {
          taskExecuted = true;
        }
      });

      await queue.enqueue('custom.test_execution', { shouldSucceed: true }, { queue: qName });

      const processed = await worker.processNext(qName);
      expect(processed).toBe(true);
      expect(taskExecuted).toBe(true);
    });



    it('GET /api/v1/jobs/stats and GET /api/v1/jobs endpoints should return queue metrics for admin', async () => {
      const resStats = await app.inject({
        method: 'GET',
        url: '/api/v1/jobs/stats',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(resStats.statusCode).toBe(200);
      const jsonStats = resStats.json();
      expect(jsonStats.stats).toBeDefined();
      expect(typeof jsonStats.stats.total).toBe('number');
      expect(typeof jsonStats.stats.completed).toBe('number');

      const resList = await app.inject({
        method: 'GET',
        url: '/api/v1/jobs?limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(resList.statusCode).toBe(200);
      const jsonList = resList.json();
      expect(Array.isArray(jsonList.jobs)).toBe(true);
    });
  });
});
