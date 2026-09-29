import { FastifyInstance } from 'fastify';
import { eq, or, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  getDb,
  events,
  projects,
  teams,
  teamMembers,
  teamInvites,
  users,
  auditEvents,
} from '@dogfood/database';
import { createTeamSchema, inviteTeamMemberSchema } from '@dogfood/shared';
import { requireAuth } from '../../middleware/auth.js';
import { isUuid } from '../../lib/uuid.js';

export async function teamRoutes(app: FastifyInstance): Promise<void> {
  // Helper to check if a team has already submitted a project
  async function isTeamLocked(teamId: string): Promise<boolean> {
    const db = getDb();
    const [sub] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.teamId, teamId), eq(projects.status, 'SUBMITTED')))
      .limit(1);
    return Boolean(sub);
  }

  // POST /api/v1/events/:eventId/teams
  app.post(
    '/:eventId/teams',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const parse = createTeamSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid team name.',
            details: parse.error.issues,
          },
        });
      }

      const db = getDb();
      const user = request.user!;

      const eventCondition = isUuid(eventId)
        ? or(eq(events.id, eventId), eq(events.sourceId, eventId))
        : eq(events.sourceId, eventId);

      const [eventRec] = await db
        .select()
        .from(events)
        .where(eventCondition)
        .limit(1);

      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'EVENT_NOT_FOUND', message: 'Event not found.' },
        });
      }

      const slug = parse.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const [team] = await db
        .insert(teams)
        .values({
          eventId: eventRec.id,
          name: parse.data.name,
          slug,
          createdBy: user.id,
        })
        .returning();

      // Creator is OWNER
      await db.insert(teamMembers).values({
        teamId: team.id,
        userId: user.id,
        role: 'OWNER',
      });

      await db.insert(auditEvents).values({
        eventId: eventRec.id,
        actorUserId: user.id,
        action: 'TEAM.CREATED',
        resourceType: 'TEAM',
        resourceId: team.id,
      });

      return reply.status(201).send(team);
    }
  );

  // Helper handler for GET team
  const handleGetTeam = async (request: any, reply: any) => {
    const { teamId } = request.params as { teamId: string };
    const db = getDb();

    const teamCondition = isUuid(teamId)
      ? or(eq(teams.id, teamId), eq(teams.sourceId, teamId))
      : eq(teams.sourceId, teamId);

    const [team] = await db
      .select()
      .from(teams)
      .where(teamCondition)
      .limit(1);

    if (!team) {
      return reply.status(404).send({
        error: { code: 'TEAM_NOT_FOUND', message: 'Team not found.' },
      });
    }

    const members = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, team.id));

    const locked = await isTeamLocked(team.id);

    return reply.status(200).send({
      team,
      isLocked: locked,
      members,
    });
  };

  app.get('/:teamId', handleGetTeam);
  app.get('/teams/:teamId', handleGetTeam);

  // Helper handler for POST invite
  const handleCreateInvite = async (request: any, reply: any) => {
    const { teamId } = request.params as { teamId: string };
    const parse = inviteTeamMemberSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid invite email.',
          details: parse.error.issues,
        },
      });
    }

    const db = getDb();
    const user = request.user!;

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return reply.status(404).send({
        error: { code: 'TEAM_NOT_FOUND', message: 'Team not found.' },
      });
    }

    // Check if team is locked due to submitted project
    if ((await isTeamLocked(team.id)) && user.globalRole !== 'ADMIN') {
      return reply.status(409).send({
        error: {
          code: 'TEAM_LOCKED',
          message: 'Cannot invite new members after project has been submitted.',
        },
      });
    }

    // Check if user is member of this team
    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(
        and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, user.id))
      )
      .limit(1);

    if (!membership && user.globalRole !== 'ADMIN') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Only team members can invite.' },
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invite] = await db
      .insert(teamInvites)
      .values({
        teamId: team.id,
        email: parse.data.email,
        token,
        expiresAt,
      })
      .returning();

    return reply.status(201).send({
      inviteId: invite.id,
      token: invite.token,
      inviteUrl: `/invites/${invite.token}`,
    });
  };

  app.post('/:teamId/invites', { preHandler: [requireAuth] }, handleCreateInvite);
  app.post('/teams/:teamId/invites', { preHandler: [requireAuth] }, handleCreateInvite);

  // Helper handler for accept invite
  const handleAcceptInvite = async (request: any, reply: any) => {
    const { token } = request.params as { token: string };
    const db = getDb();
    const user = request.user!;

    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.token, token),
          eq(teamInvites.status, 'PENDING')
        )
      )
      .limit(1);

    if (!invite || new Date() > new Date(invite.expiresAt)) {
      return reply.status(400).send({
        error: { code: 'INVALID_TOKEN', message: 'Invite token is invalid or expired.' },
      });
    }

    if ((await isTeamLocked(invite.teamId)) && user.globalRole !== 'ADMIN') {
      return reply.status(409).send({
        error: {
          code: 'TEAM_LOCKED',
          message: 'Cannot join team after project has been submitted.',
        },
      });
    }

    await db.insert(teamMembers).values({
      teamId: invite.teamId,
      userId: user.id,
      role: 'MEMBER',
    });

    await db
      .update(teamInvites)
      .set({ status: 'ACCEPTED' })
      .where(eq(teamInvites.id, invite.id));

    return reply.status(200).send({ success: true, teamId: invite.teamId });
  };

  app.post('/team-invites/:token/accept', { preHandler: [requireAuth] }, handleAcceptInvite);
  app.post('/invites/:token/accept', { preHandler: [requireAuth] }, handleAcceptInvite);
  app.post('/:token/accept', { preHandler: [requireAuth] }, handleAcceptInvite);

  // Helper handler for remove member
  const handleRemoveMember = async (request: any, reply: any) => {
    const { teamId, userId } = request.params as {
      teamId: string;
      userId: string;
    };
    const db = getDb();
    const actor = request.user!;

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return reply.status(404).send({
        error: { code: 'TEAM_NOT_FOUND', message: 'Team not found.' },
      });
    }

    if ((await isTeamLocked(team.id)) && actor.globalRole !== 'ADMIN') {
      return reply.status(409).send({
        error: {
          code: 'TEAM_LOCKED',
          message: 'Cannot remove members after project has been submitted.',
        },
      });
    }

    // Fetch all team members
    const allMembers = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, team.id));

    const targetMember = allMembers.find((m: any) => m.userId === userId);
    if (!targetMember) {
      return reply.status(404).send({
        error: { code: 'MEMBER_NOT_FOUND', message: 'User is not a member of this team.' },
      });
    }

    const actorMember = allMembers.find((m: any) => m.userId === actor.id);
    const isSelf = actor.id === userId;
    const isTeamOwner = actorMember?.role === 'OWNER';
    const isOrganizer = actor.eventRoles.get(team.eventId) === 'ORGANIZER';
    const isAdmin = actor.globalRole === 'ADMIN';

    if (!isSelf && !isTeamOwner && !isOrganizer && !isAdmin) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to remove this member.',
        },
      });
    }

    // If the target member is OWNER, ensure they are not the sole OWNER if other members exist
    if (targetMember.role === 'OWNER') {
      const ownerCount = allMembers.filter((m: any) => m.role === 'OWNER').length;
      if (ownerCount <= 1 && allMembers.length > 1) {
        return reply.status(400).send({
          error: {
            code: 'CANNOT_LEAVE_AS_ONLY_OWNER',
            message: 'You must transfer team ownership before leaving.',
          },
        });
      }
    }

    await db
      .delete(teamMembers)
      .where(
        and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId))
      );

    await db.insert(auditEvents).values({
      eventId: team.eventId,
      actorUserId: actor.id,
      action: isSelf ? 'TEAM.MEMBER_LEFT' : 'TEAM.MEMBER_REMOVED',
      resourceType: 'TEAM',
      resourceId: team.id,
      metadata: { removedUserId: userId },
    });

    return reply.status(200).send({
      success: true,
      removedUserId: userId,
    });
  };

  app.delete('/:teamId/members/:userId', { preHandler: [requireAuth] }, handleRemoveMember);
  app.delete('/teams/:teamId/members/:userId', { preHandler: [requireAuth] }, handleRemoveMember);

  // Helper handler for transfer ownership
  const handleTransferOwnership = async (request: any, reply: any) => {
    const { teamId } = request.params as { teamId: string };
    const { newOwnerUserId } = (request.body || {}) as {
      newOwnerUserId?: string;
    };

    if (!newOwnerUserId) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'newOwnerUserId is required.',
        },
      });
    }

    const db = getDb();
    const actor = request.user!;

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return reply.status(404).send({
        error: { code: 'TEAM_NOT_FOUND', message: 'Team not found.' },
      });
    }

    const allMembers = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, team.id));

    const actorMember = allMembers.find((m: any) => m.userId === actor.id);
    const isTeamOwner = actorMember?.role === 'OWNER';
    const isOrganizer = actor.eventRoles.get(team.eventId) === 'ORGANIZER';
    const isAdmin = actor.globalRole === 'ADMIN';

    if (!isTeamOwner && !isOrganizer && !isAdmin) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Only the current team owner or event organizer can transfer ownership.',
        },
      });
    }

    const targetMember = allMembers.find((m: any) => m.userId === newOwnerUserId);
    if (!targetMember) {
      return reply.status(404).send({
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Target user is not a member of this team.',
        },
      });
    }

    // Demote current owner to MEMBER if actor was owner
    if (actorMember && actorMember.role === 'OWNER') {
      await db
        .update(teamMembers)
        .set({ role: 'MEMBER' })
        .where(
          and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, actor.id))
        );
    }

    // Promote target member to OWNER
    await db
      .update(teamMembers)
      .set({ role: 'OWNER' })
      .where(
        and(
          eq(teamMembers.teamId, team.id),
          eq(teamMembers.userId, newOwnerUserId)
        )
      );

    await db.insert(auditEvents).values({
      eventId: team.eventId,
      actorUserId: actor.id,
      action: 'TEAM.OWNERSHIP_TRANSFERRED',
      resourceType: 'TEAM',
      resourceId: team.id,
      metadata: { previousOwnerId: actor.id, newOwnerUserId },
    });

    return reply.status(200).send({
      success: true,
      teamId: team.id,
      ownerId: newOwnerUserId,
    });
  };

  app.patch('/:teamId/owner', { preHandler: [requireAuth] }, handleTransferOwnership);
  app.patch('/teams/:teamId/owner', { preHandler: [requireAuth] }, handleTransferOwnership);
}
