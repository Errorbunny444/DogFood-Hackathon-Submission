import { FastifyInstance } from 'fastify';
import { eq, or, desc } from 'drizzle-orm';
import { getDb, auditEvents, events, users } from '@dogfood/database';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../policies/index.js';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  async function findEvent(eventIdOrSourceId: string) {
    const db = getDb();
    const [eventRec] = await db
      .select()
      .from(events)
      .where(or(eq(events.id, eventIdOrSourceId), eq(events.sourceId, eventIdOrSourceId)))
      .limit(1);
    return eventRec;
  }

  // GET /api/v1/events/:eventId/audit-logs
  app.get(
    '/:eventId/audit-logs',
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
          action: 'AUDIT.VIEW',
          resource: { type: 'EVENT', eventId: eventRec.id },
        })
      ) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Only organizers can view audit logs.' },
        });
      }

      const db = getDb();
      const logs = await db
        .select({
          id: auditEvents.id,
          action: auditEvents.action,
          resourceType: auditEvents.resourceType,
          resourceId: auditEvents.resourceId,
          requestId: auditEvents.requestId,
          metadata: auditEvents.metadata,
          createdAt: auditEvents.createdAt,
          actorUserId: auditEvents.actorUserId,
          actorDisplayName: users.displayName,
          actorEmail: users.email,
        })
        .from(auditEvents)
        .leftJoin(users, eq(auditEvents.actorUserId, users.id))
        .where(eq(auditEvents.eventId, eventRec.id))
        .orderBy(desc(auditEvents.createdAt))
        .limit(100);

      return reply.status(200).send(logs);
    }
  );
}
