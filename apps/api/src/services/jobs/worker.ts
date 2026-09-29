import crypto from 'node:crypto';
import { getDb, webhookDeliveries } from '@dogfood/database';
import { getEmailProvider } from '../email/index.js';
import { Job, JobHandler } from './types.js';
import { jobQueue } from './queue.js';

export class JobWorker {
  public readonly workerId: string;
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private handlers = new Map<string, JobHandler>();

  constructor(workerId?: string) {
    this.workerId = workerId || `worker-${crypto.randomUUID().slice(0, 8)}`;
    this.registerDefaultHandlers();
  }

  registerHandler<T = any>(jobName: string, handler: JobHandler<T>): void {
    this.handlers.set(jobName, handler as JobHandler);
  }

  private registerDefaultHandlers(): void {
    // 1. Email Send Handler
    this.registerHandler('email.send', async (payload: any) => {
      const emailProvider = getEmailProvider();
      const result = await emailProvider.send(payload);
      if (!result.success) {
        throw new Error(result.error || 'Email dispatch failed');
      }
    });

    // 2. Webhook Deliver Handler
    this.registerHandler('webhook.deliver', async (payload: {
      webhookId: string;
      url: string;
      secret: string;
      eventType: string;
      data: any;
    }) => {
      const db = getDb();
      const deliveryId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const body = JSON.stringify({
        id: deliveryId,
        event: payload.eventType,
        timestamp,
        data: payload.data,
      });

      const signature = crypto
        .createHmac('sha256', payload.secret)
        .update(body)
        .digest('hex');

      let responseStatus: number | null = null;
      let responseBody: string | null = null;
      let deliveryError: string | null = null;

      try {
        const response = await fetch(payload.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Dogfood-Signature': `sha256=${signature}`,
            'X-Dogfood-Signature-256': signature,
            'X-Dogfood-Event': payload.eventType,
            'X-Dogfood-Delivery': deliveryId,
            'X-Dogfood-Timestamp': timestamp,
          },
          body,
        });

        responseStatus = response.status;
        responseBody = await response.text().catch(() => '');

        if (!response.ok) {
          throw new Error(`Webhook endpoint returned HTTP ${response.status}`);
        }
      } catch (err: any) {
        deliveryError = err.message || 'Network error delivering webhook';
        throw err;
      } finally {
        try {
          await db.insert(webhookDeliveries).values({
            webhookId: payload.webhookId,
            eventType: payload.eventType,
            payload: payload.data,
            responseStatus,
            responseBody: responseBody ? responseBody.slice(0, 5000) : null,
            deliveredAt: new Date(),
            error: deliveryError,
          });
        } catch (dbErr) {
          console.error('[JobWorker] Failed to record webhook delivery log:', dbErr);
        }
      }
    });

    // 3. Normalization Run Handler
    this.registerHandler('normalization.run', async (payload: { eventId: string; method?: string }) => {
      console.log(`[JobWorker] Processed async normalization task for event ${payload.eventId} (method: ${payload.method || 'DEFAULT'})`);
    });
  }

  async processNext(queueName?: string): Promise<boolean> {
    const job = await jobQueue.claimNextJob(this.workerId, queueName);
    if (!job) {
      return false;
    }

    const handler = this.handlers.get(job.name);
    if (!handler) {
      await jobQueue.failJob(job.id, `No handler registered for job type '${job.name}'`);
      return true;
    }

    try {
      await handler(job.payload, job);
      await jobQueue.completeJob(job.id);
    } catch (err: any) {
      await jobQueue.failJob(job.id, err.message || 'Job execution failed');
    }

    return true;
  }

  start(intervalMs = 1000): void {
    if (this.running) return;
    this.running = true;

    const poll = async () => {
      if (!this.running) return;
      try {
        let hadJob = true;
        // Drain pending jobs in batch up to 5 at a time
        let count = 0;
        while (hadJob && count < 5 && this.running) {
          hadJob = await this.processNext();
          if (hadJob) count++;
        }
      } catch (err) {
        console.error('[JobWorker] Error in worker poll cycle:', err);
      } finally {
        if (this.running) {
          this.timer = setTimeout(poll, intervalMs);
        }
      }
    };

    this.timer = setTimeout(poll, intervalMs);
    console.log(`👷 [JobWorker ${this.workerId}] Started background worker loop (interval: ${intervalMs}ms).`);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log(`🛑 [JobWorker ${this.workerId}] Stopped background worker loop.`);
  }

  isRunning(): boolean {
    return this.running;
  }
}

let defaultWorker: JobWorker | null = null;

export function getJobWorker(): JobWorker {
  if (!defaultWorker) {
    defaultWorker = new JobWorker();
  }
  return defaultWorker;
}

export function startJobWorker(intervalMs = 1000): JobWorker {
  const worker = getJobWorker();
  worker.start(intervalMs);
  return worker;
}

export function stopJobWorker(): void {
  if (defaultWorker) {
    defaultWorker.stop();
  }
}
