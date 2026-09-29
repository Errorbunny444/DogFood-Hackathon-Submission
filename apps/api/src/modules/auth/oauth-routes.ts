import { FastifyPluginAsync } from 'fastify';
import { getDb, authIdentities, users, auditEvents } from '@dogfood/database';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../../middleware/auth.js';

export const oauthRoutes: FastifyPluginAsync = async (app) => {
  // 1. List Linked Identities
  app.get('/identities', { preHandler: [requireAuth] }, async (request) => {
    const db = getDb();
    const identities = await db
      .select({
        id: authIdentities.id,
        provider: authIdentities.provider,
        providerUserId: authIdentities.providerUserId,
        providerEmail: authIdentities.providerEmail,
        createdAt: authIdentities.createdAt,
      })
      .from(authIdentities)
      .where(eq(authIdentities.userId, request.user!.id));

    return { identities };
  });

  // 2. Link External OAuth Identity (GitHub / Google)
  app.post('/link', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as {
      provider: 'GITHUB' | 'GOOGLE';
      providerUserId: string;
      providerEmail?: string;
    };

    if (!body?.provider || !['GITHUB', 'GOOGLE'].includes(body.provider)) {
      return reply.status(400).send({
        error: { code: 'INVALID_PROVIDER', message: 'Provider must be GITHUB or GOOGLE.' },
      });
    }

    if (!body.providerUserId) {
      return reply.status(400).send({
        error: { code: 'INVALID_PROVIDER_USER_ID', message: 'providerUserId is required.' },
      });
    }

    const db = getDb();

    // Check if identity already attached to another user
    const [existing] = await db
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, body.provider),
          eq(authIdentities.providerUserId, body.providerUserId)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.userId === request.user!.id) {
        return { success: true, message: 'Identity already linked to your account.' };
      }
      return reply.status(409).send({
        error: { code: 'IDENTITY_ALREADY_LINKED', message: 'This external account is already linked to another user.' },
      });
    }

    const [linked] = await db
      .insert(authIdentities)
      .values({
        userId: request.user!.id,
        provider: body.provider,
        providerUserId: body.providerUserId,
        providerEmail: body.providerEmail || request.user!.email,
      })
      .returning();

    // Audit Event
    await db.insert(auditEvents).values({
      actorUserId: request.user!.id,
      action: 'OAUTH_IDENTITY_LINKED',
      resourceType: 'auth_identity',
      resourceId: linked.id,
      requestId: request.requestId,
      metadata: { provider: body.provider, providerUserId: body.providerUserId },
    });

    return reply.status(201).send({
      success: true,
      identity: linked,
    });
  });

  // 3. Unlink External OAuth Identity
  app.delete('/identities/:provider', { preHandler: [requireAuth] }, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const upperProvider = provider.toUpperCase();

    if (!['GITHUB', 'GOOGLE'].includes(upperProvider)) {
      return reply.status(400).send({
        error: { code: 'INVALID_PROVIDER', message: 'Provider must be GITHUB or GOOGLE.' },
      });
    }

    const db = getDb();

    // Check that user has a password or other identity to prevent lockout
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, request.user!.id))
      .limit(1);

    const identities = await db
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.userId, request.user!.id));

    const hasPassword = !!user?.passwordHash && user.passwordHash !== '!locked';
    const remainingIdentities = identities.filter((i: any) => i.provider !== upperProvider);

    if (!hasPassword && remainingIdentities.length === 0) {
      return reply.status(400).send({
        error: {
          code: 'CANNOT_UNLINK_ONLY_AUTH_METHOD',
          message: 'Cannot unlink your only login method. Please set a password first.',
        },
      });
    }

    const [deleted] = await db
      .delete(authIdentities)
      .where(
        and(
          eq(authIdentities.userId, request.user!.id),
          eq(authIdentities.provider, upperProvider)
        )
      )
      .returning();

    if (!deleted) {
      return reply.status(404).send({
        error: { code: 'IDENTITY_NOT_FOUND', message: `No linked '${upperProvider}' identity found.` },
      });
    }

    // Audit Event
    await db.insert(auditEvents).values({
      actorUserId: request.user!.id,
      action: 'OAUTH_IDENTITY_UNLINKED',
      resourceType: 'auth_identity',
      resourceId: deleted.id,
      requestId: request.requestId,
      metadata: { provider: upperProvider },
    });

    return { success: true, message: `${upperProvider} unlinked.` };
  });
};
