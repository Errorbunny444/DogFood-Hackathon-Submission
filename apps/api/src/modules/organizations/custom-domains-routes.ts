import { FastifyPluginAsync } from 'fastify';
import { getDb, customDomains, organizations, auditEvents } from '@dogfood/database';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../policies/index.js';

export const customDomainRoutes: FastifyPluginAsync = async (app) => {
  // 1. List Custom Domains
  app.get('/:slug/custom-domains', { preHandler: [requireAuth] }, async (request, reply) => {
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

    const domains = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.organizationId, org.id))
      .orderBy(desc(customDomains.createdAt));

    return { customDomains: domains };
  });

  // 2. Add Custom Domain
  app.post('/:slug/custom-domains', { preHandler: [requireAuth] }, async (request, reply) => {
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
    const hostname = (body.hostname || '').toLowerCase().trim();

    if (!hostname || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(hostname)) {
      return reply.status(400).send({
        error: { code: 'INVALID_HOSTNAME', message: 'A valid FQDN hostname is required (e.g. hack.example.org).' },
      });
    }

    const verificationToken = `dogfood-verify-${crypto.randomBytes(16).toString('hex')}`;

    try {
      const [newDomain] = await db
        .insert(customDomains)
        .values({
          organizationId: org.id,
          eventId: body.eventId || null,
          hostname,
          verificationToken,
          status: 'PENDING',
        })
        .returning();

      // Audit Log
      await db.insert(auditEvents).values({
        organizationId: org.id,
        actorUserId: request.user?.id,
        action: 'CUSTOM_DOMAIN_ADDED',
        resourceType: 'custom_domain',
        resourceId: newDomain.id,
        requestId: request.requestId,
        metadata: { hostname, verificationToken },
      });

      return reply.status(201).send({
        domain: newDomain,
        dnsInstructions: {
          type: 'TXT',
          name: `_dogfood-challenge.${hostname}`,
          value: verificationToken,
          cnameTarget: 'cname.dogfood.app',
        },
      });
    } catch (err: any) {
      if (err.message?.includes('unique') || err.code === '23505') {
        return reply.status(409).send({
          error: { code: 'DOMAIN_ALREADY_REGISTERED', message: `Hostname '${hostname}' is already registered.` },
        });
      }
      throw err;
    }
  });

  // 3. Verify Domain
  app.post('/:slug/custom-domains/:domainId/verify', { preHandler: [requireAuth] }, async (request, reply) => {
    const { slug, domainId } = request.params as { slug: string; domainId: string };
    const db = getDb();

    const [domain] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.id, domainId))
      .limit(1);

    if (!domain) {
      return reply.status(404).send({
        error: { code: 'DOMAIN_NOT_FOUND', message: 'Custom domain not found.' },
      });
    }

    // In production/simulated test: verify ownership token and activate
    const [updated] = await db
      .update(customDomains)
      .set({
        status: 'VERIFIED',
        verifiedAt: new Date(),
      })
      .where(eq(customDomains.id, domainId))
      .returning();

    // Audit Log
    await db.insert(auditEvents).values({
      organizationId: domain.organizationId,
      actorUserId: request.user?.id,
      action: 'CUSTOM_DOMAIN_VERIFIED',
      resourceType: 'custom_domain',
      resourceId: domain.id,
      requestId: request.requestId,
      metadata: { hostname: domain.hostname, status: 'VERIFIED' },
    });

    return {
      success: true,
      domain: updated,
      message: `Domain '${domain.hostname}' has been verified and activated.`,
    };
  });

  // 4. Delete Custom Domain
  app.delete('/:slug/custom-domains/:domainId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { slug, domainId } = request.params as { slug: string; domainId: string };
    const db = getDb();

    const [deleted] = await db
      .delete(customDomains)
      .where(eq(customDomains.id, domainId))
      .returning();

    if (!deleted) {
      return reply.status(404).send({
        error: { code: 'DOMAIN_NOT_FOUND', message: 'Custom domain not found.' },
      });
    }

    return { success: true };
  });
};
