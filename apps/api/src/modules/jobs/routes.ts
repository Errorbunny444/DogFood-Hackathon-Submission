import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/auth.js';
import { jobQueue } from '../../services/jobs/queue.js';
import { JobStatus } from '../../services/jobs/types.js';

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  // Middleware: Only ORGANIZER or ADMIN can inspect/manage background jobs
  app.addHook('preHandler', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    const isAllowed =
      request.user.globalRole === 'ADMIN' ||
      request.user.globalRole === 'ORGANIZER' ||
      Array.from(request.user.eventRoles.values()).includes('ORGANIZER');

    if (!isAllowed) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Admin or Organizer access required' } });
    }
  });

  // GET /api/v1/jobs/stats
  app.get('/stats', async (_request, reply) => {
    const stats = await jobQueue.getJobStats();
    return reply.status(200).send({ stats });
  });

  // GET /api/v1/jobs
  app.get('/', async (request, reply) => {
    const { status, limit, offset } = request.query as {
      status?: JobStatus;
      limit?: string;
      offset?: string;
    };

    const jobsList = await jobQueue.listJobs({
      status,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return reply.status(200).send({ jobs: jobsList });
  });

  // POST /api/v1/jobs/:jobId/retry
  app.post('/:jobId/retry', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const updated = await jobQueue.retryJob(jobId);
    if (!updated) {
      return reply.status(404).send({ error: { code: 'JOB_NOT_FOUND', message: `Job '${jobId}' not found.` } });
    }
    return reply.status(200).send({ success: true, job: updated });
  });

  // POST /api/v1/jobs/test-email (Helper to enqueue a test email)
  app.post('/test-email', async (request, reply) => {
    const { to } = (request.body as any) || {};
    const recipient = to || request.user?.email || 'test@dogfood.local';

    const job = await jobQueue.enqueue('email.send', {
      to: recipient,
      subject: 'Test Notification from DOGFOOD Platform',
      html: '<p>This is a test notification verifying the background job queue & email infrastructure.</p>',
      text: 'This is a test notification verifying the background job queue & email infrastructure.',
    });

    return reply.status(202).send({
      message: 'Email job enqueued successfully.',
      jobId: job.id,
    });
  });
}
