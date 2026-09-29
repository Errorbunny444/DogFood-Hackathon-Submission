import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import {
  getDb,
  organizations,
  organizationMemberships,
  events,
  users,
  auditEvents,
} from '@dogfood/database';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  addOrganizationMemberSchema,
  updateOrganizationMemberSchema,
} from '@dogfood/shared';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../policies/index.js';
import { organizationApiKeyRoutes } from './api-keys-routes.js';
import { customDomainRoutes } from './custom-domains-routes.js';

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/organizations - List user's organizations and public organizations
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDb();

    if (request.user) {
      // User's memberships
      const userOrgs = await db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          name: organizations.name,
          description: organizations.description,
          logoObjectId: organizations.logoObjectId,
          website: organizations.website,
          role: organizationMemberships.role,
          status: organizationMemberships.status,
          createdAt: organizations.createdAt,
        })
        .from(organizationMemberships)
        .innerJoin(
          organizations,
          eq(organizationMemberships.organizationId, organizations.id)
        )
        .where(
          and(
            eq(organizationMemberships.userId, request.user.id),
            eq(organizationMemberships.status, 'ACTIVE')
          )
        )
        .orderBy(desc(organizations.createdAt));

      return reply.status(200).send({ organizations: userOrgs });
    }

    // Public directory of organizations
    const publicOrgs = await db
      .select({
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
        description: organizations.description,
        website: organizations.website,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .orderBy(desc(organizations.createdAt))
      .limit(50);

    return reply.status(200).send({ organizations: publicOrgs });
  });

  // POST /api/v1/organizations - Create a new organization
  app.post(
    '/',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parse = createOrganizationSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid organization details.',
            details: parse.error.issues,
          },
        });
      }

      const { name, slug, description, website } = parse.data;
      const db = getDb();

      // Check slug uniqueness
      const [existing] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (existing) {
        return reply.status(409).send({
          error: {
            code: 'SLUG_ALREADY_EXISTS',
            message: 'An organization with this slug already exists. Please choose a different slug.',
          },
        });
      }

      // Insert organization
      const [org] = await db
        .insert(organizations)
        .values({
          name,
          slug,
          description: description || '',
          website: website || null,
          createdBy: request.user!.id,
        })
        .returning();

      // Add creator as OWNER
      const [membership] = await db
        .insert(organizationMemberships)
        .values({
          organizationId: org.id,
          userId: request.user!.id,
          role: 'OWNER',
          status: 'ACTIVE',
        })
        .returning();

      // Audit log
      await db.insert(auditEvents).values({
        actorUserId: request.user!.id,
        action: 'ORG.CREATE',
        resourceType: 'ORGANIZATION',
        resourceId: org.id,
        metadata: { name: org.name, slug: org.slug },
      });

      return reply.status(201).send({
        organization: org,
        membership,
      });
    }
  );

  // GET /api/v1/organizations/:slug - Get organization details, stats, events
  app.get('/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const db = getDb();

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!org) {
      return reply.status(404).send({
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: `Organization '${slug}' not found.`,
        },
      });
    }

    // Get member count
    const [memberCountResult] = await db
      .select({ count: count() })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, org.id),
          eq(organizationMemberships.status, 'ACTIVE')
        )
      );

    // Get events for this organization
    const orgEvents = await db
      .select()
      .from(events)
      .where(eq(events.organizationId, org.id))
      .orderBy(desc(events.createdAt));

    // Determine current user's role in this org
    let currentUserRole: string | null = null;
    if (request.user) {
      if (request.user.globalRole === 'ADMIN') {
        currentUserRole = 'OWNER';
      } else {
        currentUserRole = request.user.orgRoles.get(org.id) || null;
      }
    }

    return reply.status(200).send({
      organization: org,
      stats: {
        memberCount: memberCountResult?.count ?? 0,
        eventCount: orgEvents.length,
      },
      events: orgEvents,
      currentUserRole,
    });
  });

  // PATCH /api/v1/organizations/:slug - Update organization settings
  app.patch(
    '/:slug',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { slug } = request.params as { slug: string };
      const db = getDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (!org) {
        return reply.status(404).send({
          error: {
            code: 'ORGANIZATION_NOT_FOUND',
            message: `Organization '${slug}' not found.`,
          },
        });
      }

      // Check authorization
      const allowed = authorize({
        actor: request.user,
        action: 'ORG.MANAGE',
        resource: { orgId: org.id, orgSlug: org.slug },
      });

      if (!allowed) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to manage this organization.',
          },
        });
      }

      const parse = updateOrganizationSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload.',
            details: parse.error.issues,
          },
        });
      }

      const { name, description, website, logoObjectId } = parse.data;

      const [updated] = await db
        .update(organizations)
        .set({
          name: name !== undefined ? name : org.name,
          description: description !== undefined ? description : org.description,
          website: website !== undefined ? (website || null) : org.website,
          logoObjectId: logoObjectId !== undefined ? logoObjectId : org.logoObjectId,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id))
        .returning();

      await db.insert(auditEvents).values({
        actorUserId: request.user!.id,
        action: 'ORG.UPDATE',
        resourceType: 'ORGANIZATION',
        resourceId: org.id,
        metadata: { changes: parse.data },
      });

      return reply.status(200).send({ organization: updated });
    }
  );

  // GET /api/v1/organizations/:slug/members - List organization members
  app.get(
    '/:slug/members',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { slug } = request.params as { slug: string };
      const db = getDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (!org) {
        return reply.status(404).send({
          error: {
            code: 'ORGANIZATION_NOT_FOUND',
            message: `Organization '${slug}' not found.`,
          },
        });
      }

      const allowed = authorize({
        actor: request.user,
        action: 'ORG.VIEW_MEMBERS',
        resource: { orgId: org.id, orgSlug: org.slug },
      });

      if (!allowed) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You must be a member of this organization to view its members.',
          },
        });
      }

      const members = await db
        .select({
          id: organizationMemberships.id,
          userId: organizationMemberships.userId,
          role: organizationMemberships.role,
          status: organizationMemberships.status,
          joinedAt: organizationMemberships.createdAt,
          displayName: users.displayName,
          email: users.email,
          avatarPath: users.avatarPath,
        })
        .from(organizationMemberships)
        .innerJoin(users, eq(organizationMemberships.userId, users.id))
        .where(eq(organizationMemberships.organizationId, org.id))
        .orderBy(desc(organizationMemberships.createdAt));

      return reply.status(200).send({ members });
    }
  );

  // POST /api/v1/organizations/:slug/members - Invite / add member
  app.post(
    '/:slug/members',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { slug } = request.params as { slug: string };
      const db = getDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (!org) {
        return reply.status(404).send({
          error: {
            code: 'ORGANIZATION_NOT_FOUND',
            message: `Organization '${slug}' not found.`,
          },
        });
      }

      const allowed = authorize({
        actor: request.user,
        action: 'ORG.MEMBER_MANAGE',
        resource: { orgId: org.id, orgSlug: org.slug },
      });

      if (!allowed) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to manage members in this organization.',
          },
        });
      }

      const parse = addOrganizationMemberSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid member data.',
            details: parse.error.issues,
          },
        });
      }

      const { email, role } = parse.data;

      // Find user
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!targetUser) {
        return reply.status(404).send({
          error: {
            code: 'USER_NOT_FOUND',
            message: `No registered account found with email '${email}'. Please ask them to sign up first.`,
          },
        });
      }

      // Check if already member
      const [existingMember] = await db
        .select()
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, org.id),
            eq(organizationMemberships.userId, targetUser.id)
          )
        )
        .limit(1);

      if (existingMember) {
        return reply.status(409).send({
          error: {
            code: 'ALREADY_MEMBER',
            message: `'${targetUser.displayName}' is already a member of this organization.`,
          },
        });
      }

      const [membership] = await db
        .insert(organizationMemberships)
        .values({
          organizationId: org.id,
          userId: targetUser.id,
          role,
          status: 'ACTIVE',
        })
        .returning();

      await db.insert(auditEvents).values({
        actorUserId: request.user!.id,
        action: 'ORG.MEMBER_ADD',
        resourceType: 'ORGANIZATION_MEMBERSHIP',
        resourceId: membership.id,
        metadata: {
          orgId: org.id,
          orgSlug: org.slug,
          targetUserId: targetUser.id,
          role,
        },
      });

      return reply.status(201).send({
        membership,
        user: {
          id: targetUser.id,
          displayName: targetUser.displayName,
          email: targetUser.email,
        },
      });
    }
  );

  // PATCH /api/v1/organizations/:slug/members/:userId - Change member role
  app.patch(
    '/:slug/members/:userId',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { slug, userId } = request.params as { slug: string; userId: string };
      const db = getDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (!org) {
        return reply.status(404).send({
          error: {
            code: 'ORGANIZATION_NOT_FOUND',
            message: `Organization '${slug}' not found.`,
          },
        });
      }

      const allowed = authorize({
        actor: request.user,
        action: 'ORG.MEMBER_MANAGE',
        resource: { orgId: org.id, orgSlug: org.slug },
      });

      if (!allowed) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to manage members in this organization.',
          },
        });
      }

      const parse = updateOrganizationMemberSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid role.' },
        });
      }

      const { role } = parse.data;

      const [targetMembership] = await db
        .select()
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, org.id),
            eq(organizationMemberships.userId, userId)
          )
        )
        .limit(1);

      if (!targetMembership) {
        return reply.status(404).send({
          error: { code: 'MEMBERSHIP_NOT_FOUND', message: 'Member not found.' },
        });
      }

      // If demoting an owner, ensure at least one other active owner remains
      if (targetMembership.role === 'OWNER' && role !== 'OWNER') {
        const otherOwners = await db
          .select({ id: organizationMemberships.id })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, org.id),
              eq(organizationMemberships.role, 'OWNER'),
              eq(organizationMemberships.status, 'ACTIVE')
            )
          );

        if (otherOwners.length <= 1) {
          return reply.status(400).send({
            error: {
              code: 'LAST_OWNER',
              message: 'Cannot demote the only owner of the organization. Transfer ownership or assign another owner first.',
            },
          });
        }
      }

      const [updated] = await db
        .update(organizationMemberships)
        .set({ role, updatedAt: new Date() })
        .where(eq(organizationMemberships.id, targetMembership.id))
        .returning();

      await db.insert(auditEvents).values({
        actorUserId: request.user!.id,
        action: 'ORG.MEMBER_ROLE_CHANGE',
        resourceType: 'ORGANIZATION_MEMBERSHIP',
        resourceId: updated.id,
        metadata: {
          orgId: org.id,
          targetUserId: userId,
          oldRole: targetMembership.role,
          newRole: role,
        },
      });

      return reply.status(200).send({ membership: updated });
    }
  );

  // DELETE /api/v1/organizations/:slug/members/:userId - Remove member
  app.delete(
    '/:slug/members/:userId',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { slug, userId } = request.params as { slug: string; userId: string };
      const db = getDb();

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (!org) {
        return reply.status(404).send({
          error: {
            code: 'ORGANIZATION_NOT_FOUND',
            message: `Organization '${slug}' not found.`,
          },
        });
      }

      // Users can remove themselves, or an OWNER/ADMIN can remove others
      const isSelf = request.user!.id === userId;
      const canManage = authorize({
        actor: request.user,
        action: 'ORG.MEMBER_MANAGE',
        resource: { orgId: org.id, orgSlug: org.slug },
      });

      if (!isSelf && !canManage) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to remove members from this organization.',
          },
        });
      }

      const [targetMembership] = await db
        .select()
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, org.id),
            eq(organizationMemberships.userId, userId)
          )
        )
        .limit(1);

      if (!targetMembership) {
        return reply.status(404).send({
          error: { code: 'MEMBERSHIP_NOT_FOUND', message: 'Member not found.' },
        });
      }

      // If removing an OWNER, ensure at least one other active owner remains
      if (targetMembership.role === 'OWNER') {
        const otherOwners = await db
          .select({ id: organizationMemberships.id })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, org.id),
              eq(organizationMemberships.role, 'OWNER'),
              eq(organizationMemberships.status, 'ACTIVE')
            )
          );

        if (otherOwners.length <= 1) {
          return reply.status(400).send({
            error: {
              code: 'LAST_OWNER',
              message: 'Cannot remove the only owner of the organization.',
            },
          });
        }
      }

      await db
        .delete(organizationMemberships)
        .where(eq(organizationMemberships.id, targetMembership.id));

      await db.insert(auditEvents).values({
        actorUserId: request.user!.id,
        action: 'ORG.MEMBER_REMOVE',
        resourceType: 'ORGANIZATION_MEMBERSHIP',
        resourceId: targetMembership.id,
        metadata: {
          orgId: org.id,
          removedUserId: userId,
          role: targetMembership.role,
        },
      });

      return reply.status(200).send({ success: true });
    }
  );

  // GET /api/v1/organizations/:slug/events - Get events belonging to this organization
  app.get('/:slug/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const db = getDb();

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!org) {
      return reply.status(404).send({
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: `Organization '${slug}' not found.`,
        },
      });
    }

    const orgEvents = await db
      .select()
      .from(events)
      .where(eq(events.organizationId, org.id))
      .orderBy(desc(events.createdAt));

    return reply.status(200).send({ events: orgEvents });
  });

  // GET /api/v1/organizations/:slug/audit - Organization audit trail (Section 42)
  app.get('/:slug/audit', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
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

    const logs = await db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        resourceType: auditEvents.resourceType,
        resourceId: auditEvents.resourceId,
        metadata: auditEvents.metadata,
        createdAt: auditEvents.createdAt,
        actorUserId: auditEvents.actorUserId,
        actorName: users.displayName,
        actorEmail: users.email,
      })
      .from(auditEvents)
      .leftJoin(users, eq(auditEvents.actorUserId, users.id))
      .where(eq(auditEvents.organizationId, org.id))
      .orderBy(desc(auditEvents.createdAt))
      .limit(100);

    return reply.status(200).send({ auditLogs: logs });
  });

  // Register API Keys and Custom Domains sub-routes
  app.register(organizationApiKeyRoutes);
  app.register(customDomainRoutes);
}

