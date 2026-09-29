import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import {
  getDb,
  events,
  certificates,
  users,
  eventMemberships,
  projects,
} from '@dogfood/database';
import { requireAuth } from '../../middleware/auth.js';

export async function certificateRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/events/:eventId/certificates
  app.get(
    '/:eventId/certificates',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const db = getDb();
      const user = request.user!;

      const userCerts = await db
        .select()
        .from(certificates)
        .where(
          and(
            eq(certificates.eventId, eventId),
            eq(certificates.userId, user.id)
          )
        );

      return reply.status(200).send(userCerts);
    }
  );

  // POST /api/v1/events/:eventId/certificates/generate
  app.post(
    '/:eventId/certificates/generate',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const db = getDb();
      const user = request.user!;

      // Check membership
      const [membership] = await db
        .select()
        .from(eventMemberships)
        .where(
          and(
            eq(eventMemberships.eventId, eventId),
            eq(eventMemberships.userId, user.id)
          )
        )
        .limit(1);

      if (!membership) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'You are not registered for this event.' },
        });
      }

      const certType = membership.role === 'JUDGE' ? 'JUDGE' : 'PARTICIPATION';

      // Check if already generated
      const [existing] = await db
        .select()
        .from(certificates)
        .where(
          and(
            eq(certificates.eventId, eventId),
            eq(certificates.userId, user.id),
            eq(certificates.type, certType)
          )
        )
        .limit(1);

      if (existing) {
        return reply.status(200).send(existing);
      }

      const [newCert] = await db
        .insert(certificates)
        .values({
          eventId,
          userId: user.id,
          type: certType,
          recipientName: user.displayName,
          projectTitle: 'DOGFOOD 2026 Submission',
        })
        .returning();

      return reply.status(201).send(newCert);
    }
  );
}
