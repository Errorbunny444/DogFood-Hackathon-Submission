import { FastifyInstance } from 'fastify';
import { eq, or, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  getDb,
  events,
  webhooks,
  webhookDeliveries,
  auditEvents,
} from '@dogfood/database';
import { createWebhookSchema } from '@dogfood/shared';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../policies/index.js';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  async function findEvent(eventIdOrSourceId: string) {
    const db = getDb();
    const [eventRec] = await db
      .select()
      .from(events)
      .where(or(eq(events.id, eventIdOrSourceId), eq(events.sourceId, eventIdOrSourceId)))
      .limit(1);
    return eventRec;
  }

  // GET /api/v1/events/:eventId/webhooks
  app.get(
    '/:eventId/webhooks',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      if (
        !authorize({
          actor: request.user,
          action: 'EVENT.MANAGE',
          resource: { type: 'EVENT', eventId: eventRec.id },
        })
      ) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
      }

      const db = getDb();
      const hooks = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.eventId, eventRec.id))
        .orderBy(desc(webhooks.createdAt));

      return reply.status(200).send(hooks);
    }
  );

  // POST /api/v1/events/:eventId/webhooks
  app.post(
    '/:eventId/webhooks',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      if (
        !authorize({
          actor: request.user,
          action: 'EVENT.MANAGE',
          resource: { type: 'EVENT', eventId: eventRec.id },
        })
      ) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
      }

      const parse = createWebhookSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid webhook data.', details: parse.error.issues },
        });
      }

      const db = getDb();
      const [newHook] = await db
        .insert(webhooks)
        .values({
          eventId: eventRec.id,
          url: parse.data.url,
          events: parse.data.events,
          secret: parse.data.secret,
          active: parse.data.active,
        })
        .returning();

      return reply.status(201).send(newHook);
    }
  );

  // GET /api/v1/events/:eventId/webhooks/:webhookId/deliveries
  app.get(
    '/:eventId/webhooks/:webhookId/deliveries',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { webhookId } = request.params as { webhookId: string };
      const db = getDb();
      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(50);

      return reply.status(200).send(deliveries);
    }
  );
}
