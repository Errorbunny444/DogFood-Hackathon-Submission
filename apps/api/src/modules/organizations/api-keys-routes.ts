import { FastifyPluginAsync } from 'fastify';
import { getDb, apiKeys, organizations, auditEvents } from '@dogfood/database';
import { eq, and, desc } from 'drizzle-orm';
import { generateApiKey } from '../../lib/api-keys.js';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../policies/index.js';

export const organizationApiKeyRoutes: FastifyPluginAsync = async (app) => {
  // 1. List Organization API Keys
  app.get('/:slug/api-keys', { preHandler: [requireAuth] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const db = getDb();

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!org) {
      return reply.status(404).send({
        error: { code: 'ORGANIZATION_NOT_FOUND', message: `Organization '${slug}' not found.` },
      });
    }

    if (!authorize({ actor: request.user, action: 'ORG.MANAGE', resource: { type: 'ORGANIZATION', orgSlug: slug, orgId: org.id } })) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Admin or Owner privileges required.' } });
    }

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        tokenPrefix: apiKeys.tokenPrefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, org.id))
      .orderBy(desc(apiKeys.createdAt));

    return { apiKeys: keys };
  });

  // 2. Create API Key
  app.post('/:slug/api-keys', { preHandler: [requireAuth] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const db = getDb();

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!org) {
      return reply.status(404).send({
        error: { code: 'ORGANIZATION_NOT_FOUND', message: `Organization '${slug}' not found.` },
      });
    }

    if (!authorize({ actor: request.user, action: 'ORG.MANAGE', resource: { type: 'ORGANIZATION', orgSlug: slug, orgId: org.id } })) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Admin or Owner privileges required.' } });
    }

    const body = (request.body as any) || {};
    const name = body.name?.trim() || 'Default API Key';
    const scopes = Array.isArray(body.scopes) && body.scopes.length > 0
      ? body.scopes
      : ['events:read', 'projects:read', 'judging:read'];

    const cleanTag = slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7);
    const { token, prefix, tokenHash } = generateApiKey(cleanTag);

    const [newKey] = await db
      .insert(apiKeys)
      .values({
        organizationId: org.id,
        name,
        tokenHash,
        tokenPrefix: prefix,
        scopes,
        createdBy: request.user?.id,
      })
      .returning();

    // Audit Log
    await db.insert(auditEvents).values({
      organizationId: org.id,
      actorUserId: request.user?.id,
      action: 'API_KEY_CREATED',
      resourceType: 'api_key',
      resourceId: newKey.id,
      requestId: request.requestId,
      metadata: { name, tokenPrefix: prefix, scopes },
    });

    return reply.status(201).send({
      apiKey: {
        id: newKey.id,
        name: newKey.name,
        tokenPrefix: newKey.tokenPrefix,
        scopes: newKey.scopes,
        createdAt: newKey.createdAt.toISOString(),
      },
      secretToken: token, // Full secret token returned ONLY upon creation
    });
  });

  // 3. Revoke API Key
  app.delete('/:slug/api-keys/:keyId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { slug, keyId } = request.params as { slug: string; keyId: string };
    const db = getDb();

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!org) {
      return reply.status(404).send({
        error: { code: 'ORGANIZATION_NOT_FOUND', message: `Organization '${slug}' not found.` },
      });
    }

    if (!authorize({ actor: request.user, action: 'ORG.MANAGE', resource: { type: 'ORGANIZATION', orgSlug: slug, orgId: org.id } })) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Admin or Owner privileges required.' } });
    }

    const [deleted] = await db
      .delete(apiKeys)
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.organizationId, org.id)
        )
      )
      .returning();

    if (!deleted) {
      return reply.status(404).send({
        error: { code: 'API_KEY_NOT_FOUND', message: 'API key not found.' },
      });
    }

    // Audit Log
    await db.insert(auditEvents).values({
      organizationId: org.id,
      actorUserId: request.user?.id,
      action: 'API_KEY_REVOKED',
      resourceType: 'api_key',
      resourceId: keyId,
      requestId: request.requestId,
      metadata: { name: deleted.name, tokenPrefix: deleted.tokenPrefix },
    });

    return { success: true, message: 'API key revoked.' };
  });
};
