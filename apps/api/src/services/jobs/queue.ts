import crypto from 'node:crypto';
import { eq, and, lte, desc, asc, sql } from 'drizzle-orm';
import { getDb, jobs } from '@dogfood/database';
import { EnqueueOptions, Job, JobStats, JobStatus } from './types.js';

export class JobQueue {
  async enqueue<T = any>(
    name: string,
    payload: T,
    options?: EnqueueOptions
  ): Promise<Job<T>> {
    const db = getDb();
    const id = crypto.randomUUID();
    const runAt = options?.runAt || new Date();
    const maxAttempts = options?.maxAttempts !== undefined ? options.maxAttempts : 5;
    const queue = options?.queue || 'default';

    const [row] = await db
      .insert(jobs)
      .values({
        id,
        queue,
        name,
        payload: payload as any,
        status: 'PENDING',
        attempts: 0,
        maxAttempts,
        runAt,
        createdAt: new Date(),
      })
      .returning();

    return row as Job<T>;
  }

  async claimNextJob(workerId: string, queueName?: string): Promise<Job | null> {
    const db = getDb();
    const now = new Date();

    // Query candidate pending jobs whose scheduled runAt has arrived
    const candidates = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, 'PENDING'),
          lte(jobs.runAt, now),
          queueName ? eq(jobs.queue, queueName) : undefined
        )
      )
      .orderBy(asc(jobs.runAt), asc(jobs.createdAt))
      .limit(1);

    if (!candidates || candidates.length === 0) {
      return null;
    }

    const candidate = candidates[0];

    // Atomically transition from PENDING to RUNNING to prevent race conditions
    const [updated] = await db
      .update(jobs)
      .set({
        status: 'RUNNING',
        lockedAt: now,
        lockedBy: workerId,
        attempts: candidate.attempts + 1,
      })
      .where(
        and(
          eq(jobs.id, candidate.id),
          eq(jobs.status, 'PENDING')
        )
      )
      .returning();

    return (updated as Job) || null;
  }

  async completeJob(jobId: string): Promise<void> {
    const db = getDb();
    await db
      .update(jobs)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(jobs.id, jobId));
  }

  async failJob(jobId: string, errorMessage: string): Promise<void> {
    const db = getDb();
    const [existing] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!existing) return;

    if (existing.attempts < existing.maxAttempts) {
      // Exponential backoff: 2^attempts * 10 seconds (max 1 hour)
      const backoffSeconds = Math.min(3600, Math.pow(2, existing.attempts) * 10);
      const nextRunAt = new Date(Date.now() + backoffSeconds * 1000);

      await db
        .update(jobs)
        .set({
          status: 'PENDING',
          runAt: nextRunAt,
          lastError: errorMessage,
          lockedAt: null,
          lockedBy: null,
        })
        .where(eq(jobs.id, jobId));
    } else {
      await db
        .update(jobs)
        .set({
          status: 'FAILED',
          lastError: errorMessage,
          lockedAt: null,
          lockedBy: null,
        })
        .where(eq(jobs.id, jobId));
    }
  }

  async retryJob(jobId: string): Promise<Job | null> {
    const db = getDb();
    const [updated] = await db
      .update(jobs)
      .set({
        status: 'PENDING',
        attempts: 0,
        runAt: new Date(),
        lastError: null,
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(jobs.id, jobId))
      .returning();

    return (updated as Job) || null;
  }

  async getJobStats(): Promise<JobStats> {
    const db = getDb();
    const all = await db.select({ status: jobs.status }).from(jobs);

    let pending = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;

    for (const j of all) {
      if (j.status === 'PENDING') pending++;
      else if (j.status === 'RUNNING') running++;
      else if (j.status === 'COMPLETED') completed++;
      else if (j.status === 'FAILED') failed++;
    }

    return {
      pending,
      running,
      completed,
      failed,
      total: all.length,
    };
  }

  async listJobs(options?: { status?: JobStatus; limit?: number; offset?: number }): Promise<Job[]> {
    const db = getDb();
    const limit = Math.min(options?.limit || 50, 100);
    const offset = options?.offset || 0;

    let query = db.select().from(jobs);

    if (options?.status) {
      query = query.where(eq(jobs.status, options.status)) as any;
    }

    const rows = await query
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset);

    return rows as Job[];
  }
}

export const jobQueue = new JobQueue();
