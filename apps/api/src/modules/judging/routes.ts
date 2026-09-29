import { FastifyInstance } from 'fastify';
import { eq, and, or, inArray } from 'drizzle-orm';
import {
  getDb,
  events,
  projects,
  tracks,
  teams,
  rubrics,
  rubricCriteria,
  judgeProfiles,
  judgeAssignments,
  reviews,
  reviewScores,
  users,
  judgeTrackPreferences,
  judgeConflicts,
  auditEvents,
  eventMemberships,
} from '@dogfood/database';
import crypto from 'node:crypto';
import {
  autoAssignJudges,
  calculateRawReviewScore,
} from '@dogfood/judging-engine';
import {
  updateReviewSchema,
  autoAssignSchema,
  inviteJudgeSchema,
  declareConflictSchema,
  setTrackPreferencesSchema,
} from '@dogfood/shared';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../policies/index.js';

export async function judgingRoutes(app: FastifyInstance): Promise<void> {
  // Helper to find event
  async function findEvent(eventIdOrSourceId: string) {
    const db = getDb();
    const [eventRec] = await db
      .select()
      .from(events)
      .where(or(eq(events.id, eventIdOrSourceId), eq(events.sourceId, eventIdOrSourceId)))
      .limit(1);
    return eventRec;
  }

  // GET /api/v1/judge/assignments (Current logged-in judge's assigned projects)
  app.get('/assignments', { preHandler: [requireAuth] }, async (request, reply) => {
    const db = getDb();
    const user = request.user!;

    // Query assignments for current judge
    const assignments = await db
      .select({
        assignmentId: judgeAssignments.id,
        status: judgeAssignments.status,
        assignedAt: judgeAssignments.assignedAt,
        projectId: projects.id,
        projectSourceId: projects.sourceId,
        title: projects.title,
        tagline: projects.tagline,
        summary: projects.summary,
        repositoryUrl: projects.repositoryUrl,
        demoUrl: projects.demoUrl,
        videoUrl: projects.videoUrl,
        trackId: tracks.id,
        trackName: tracks.name,
      })
      .from(judgeAssignments)
      .innerJoin(projects, eq(judgeAssignments.projectId, projects.id))
      .leftJoin(tracks, eq(projects.trackId, tracks.id))
      .where(eq(judgeAssignments.judgeUserId, user.id));

    // Also get existing reviews by this judge
    const existingReviews = await db
      .select({
        reviewId: reviews.id,
        projectId: reviews.projectId,
        status: reviews.status,
        rawScore: reviews.rawScore,
      })
      .from(reviews)
      .where(eq(reviews.judgeUserId, user.id));

    const reviewMap = new Map<string, any>(existingReviews.map((r: any) => [r.projectId, r]));

    const result = assignments.map((a: any) => {
      const rev = reviewMap.get(a.projectId);
      return {
        ...a,
        reviewId: rev?.reviewId || null,
        reviewStatus: rev?.status || 'PENDING',
        rawScore: rev?.rawScore || null,
      };
    });

    return reply.status(200).send(result);
  });

  // GET /api/v1/judge/reviews/:reviewId
  app.get('/reviews/:reviewId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string };
    const db = getDb();
    const user = request.user!;

    const [reviewRec] = await db
      .select({
        id: reviews.id,
        eventId: reviews.eventId,
        projectId: reviews.projectId,
        judgeUserId: reviews.judgeUserId,
        rubricId: reviews.rubricId,
        status: reviews.status,
        rawScore: reviews.rawScore,
        overallComment: reviews.overallComment,
        submittedAt: reviews.submittedAt,
        projectTitle: projects.title,
        projectSummary: projects.summary,
        projectDescription: projects.description,
        repositoryUrl: projects.repositoryUrl,
        demoUrl: projects.demoUrl,
        videoUrl: projects.videoUrl,
      })
      .from(reviews)
      .innerJoin(projects, eq(reviews.projectId, projects.id))
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!reviewRec) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Review not found.' },
      });
    }

    // Judge isolation check: Only author or organizer/admin
    const isAllowed =
      user.globalRole === 'ADMIN' ||
      user.id === reviewRec.judgeUserId ||
      user.eventRoles.get(reviewRec.eventId) === 'ORGANIZER';

    if (!isAllowed) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: "You cannot access another judge's review.",
        },
      });
    }

    // Fetch rubric criteria
    const criteria = await db
      .select()
      .from(rubricCriteria)
      .where(eq(rubricCriteria.rubricId, reviewRec.rubricId))
      .orderBy(rubricCriteria.position);

    // Fetch existing scores
    const existingScores = await db
      .select()
      .from(reviewScores)
      .where(eq(reviewScores.reviewId, reviewRec.id));

    const scoresMap = new Map<string, any>(existingScores.map((s: any) => [s.criterionId, s]));

    const criteriaWithScores = criteria.map((c: any) => {
      const s = scoresMap.get(c.id);
      return {
        ...c,
        currentScore: s ? s.score : null,
        comment: s ? s.comment : '',
      };
    });

    return reply.status(200).send({
      review: reviewRec,
      criteria: criteriaWithScores,
    });
  });

  // PUT /api/v1/judge/reviews/:reviewId (Autosave review draft)
  app.put('/reviews/:reviewId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string };
    const parse = updateReviewSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid score payload.',
          details: parse.error.issues,
        },
      });
    }

    const db = getDb();
    const user = request.user!;

    const [reviewRec] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!reviewRec) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Review not found.' },
      });
    }

    if (reviewRec.judgeUserId !== user.id && user.globalRole !== 'ADMIN') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'You can only edit your own reviews.' },
      });
    }

    // Fetch rubric criteria for weighting
    const criteria = await db
      .select()
      .from(rubricCriteria)
      .where(eq(rubricCriteria.rubricId, reviewRec.rubricId));

    const criteriaWeights = criteria.map((c: any) => ({
      criterionId: c.id,
      weight: c.weight,
    }));

    const rawScore = calculateRawReviewScore(parse.data.scores, criteriaWeights);

    // Upsert individual criterion scores
    for (const sc of parse.data.scores) {
      const [existing] = await db
        .select()
        .from(reviewScores)
        .where(
          and(
            eq(reviewScores.reviewId, reviewRec.id),
            eq(reviewScores.criterionId, sc.criterionId)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(reviewScores)
          .set({ score: sc.score, comment: sc.comment || '' })
          .where(eq(reviewScores.id, existing.id));
      } else {
        await db.insert(reviewScores).values({
          reviewId: reviewRec.id,
          criterionId: sc.criterionId,
          score: sc.score,
          comment: sc.comment || '',
        });
      }
    }

    // Update review header
    const [updated] = await db
      .update(reviews)
      .set({
        rawScore,
        overallComment: parse.data.overallComment ?? reviewRec.overallComment,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewRec.id))
      .returning();

    return reply.status(200).send(updated);
  });

  // POST /api/v1/judge/reviews/:reviewId/submit (Submit final review)
  app.post('/reviews/:reviewId/submit', { preHandler: [requireAuth] }, async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string };
    const db = getDb();
    const user = request.user!;

    const [reviewRec] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!reviewRec) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Review not found.' },
      });
    }

    if (reviewRec.judgeUserId !== user.id && user.globalRole !== 'ADMIN') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'You can only submit your own review.' },
      });
    }

    const [submitted] = await db
      .update(reviews)
      .set({
        status: 'SUBMITTED',
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewRec.id))
      .returning();

    // Update assignment status
    await db
      .update(judgeAssignments)
      .set({ status: 'COMPLETED' })
      .where(
        and(
          eq(judgeAssignments.judgeUserId, user.id),
          eq(judgeAssignments.projectId, reviewRec.projectId)
        )
      );

    // Audit Event
    await db.insert(auditEvents).values({
      eventId: reviewRec.eventId,
      actorUserId: user.id,
      action: 'REVIEW.SUBMITTED',
      resourceType: 'REVIEW',
      resourceId: reviewRec.id,
      metadata: { rawScore: submitted.rawScore },
    });

    return reply.status(200).send(submitted);
  });

  // POST /api/v1/events/:eventId/judging/auto-assign (Organizer Auto-Assignment)
  app.post(
    '/:eventId/judging/auto-assign',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      if (
        !authorize({
          actor: request.user,
          action: 'JUDGING.AUTO_ASSIGN',
          resource: { type: 'EVENT', eventId: eventRec.id },
        })
      ) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Only organizers can assign judges.' },
        });
      }

      const parse = autoAssignSchema.safeParse(request.body || {});
      const options = parse.success
        ? parse.data
        : {
            targetReviewsPerProject: 3,
            maxWorkloadPerJudge: 15,
            respectTrackPreferences: true,
            preventConflicts: true,
          };

      const db = getDb();

      // Fetch projects
      const eventProjects = await db
        .select({
          id: projects.id,
          trackId: projects.trackId,
          teamId: projects.teamId,
        })
        .from(projects)
        .where(eq(projects.eventId, eventRec.id));

      // Fetch judges
      const judgeUsers = await db
        .select({
          userId: users.id,
          maxWorkload: judgeProfiles.maxWorkload,
        })
        .from(users)
        .innerJoin(judgeProfiles, eq(users.id, judgeProfiles.userId))
        .where(eq(judgeProfiles.eventId, eventRec.id));

      const judgeIds = judgeUsers.map((j: any) => j.userId);
      if (judgeIds.length === 0) {
        return reply.status(400).send({
          error: { code: 'NO_JUDGES', message: 'No registered judges for this event.' },
        });
      }

      // Fetch track preferences
      const trackPrefs = await db
        .select()
        .from(judgeTrackPreferences)
        .where(eq(judgeTrackPreferences.eventId, eventRec.id));

      // Fetch conflicts
      const conflicts = await db
        .select()
        .from(judgeConflicts)
        .where(eq(judgeConflicts.eventId, eventRec.id));

      // Fetch existing assignments
      const existing = await db
        .select()
        .from(judgeAssignments)
        .where(eq(judgeAssignments.eventId, eventRec.id));

      const assignableJudges = judgeUsers.map((j: any) => ({
        userId: j.userId,
        preferredTrackIds: trackPrefs
          .filter((tp: any) => tp.judgeUserId === j.userId)
          .map((tp: any) => tp.trackId),
        conflictedTeamIds: conflicts
          .filter((c: any) => c.judgeUserId === j.userId && c.teamId)
          .map((c: any) => c.teamId!),
        conflictedProjectIds: conflicts
          .filter((c: any) => c.judgeUserId === j.userId && c.projectId)
          .map((c: any) => c.projectId!),
        maxCapacity: j.maxWorkload || options.maxWorkloadPerJudge,
      }));

      const newAssignments = autoAssignJudges(
        eventProjects.map((p: any) => ({
          id: p.id,
          trackId: p.trackId || undefined,
          teamId: p.teamId || undefined,
        })),
        assignableJudges,
        existing.map((e: any) => ({ judgeUserId: e.judgeUserId, projectId: e.projectId })),
        {
          targetReviewsPerProject: options.targetReviewsPerProject,
          maxCapacityPerJudge: options.maxWorkloadPerJudge,
          respectTrackPreferences: options.respectTrackPreferences,
          preventConflicts: options.preventConflicts,
        }
      );

      // Save new assignments in DB
      for (const a of newAssignments) {
        await db
          .insert(judgeAssignments)
          .values({
            eventId: eventRec.id,
            judgeUserId: a.judgeUserId,
            projectId: a.projectId,
            status: 'ASSIGNED',
          })
          .onConflictDoNothing();
      }

      // Audit event
      await db.insert(auditEvents).values({
        eventId: eventRec.id,
        actorUserId: request.user?.id,
        action: 'JUDGE.AUTO_ASSIGNED',
        resourceType: 'ASSIGNMENTS',
        metadata: { newAssignmentsCount: newAssignments.length },
      });

      return reply.status(200).send({
        success: true,
        assignedCount: newAssignments.length,
        assignments: newAssignments,
      });
    }
  );

  // POST /api/v1/events/:eventId/judges/invite (Organizer Invites Judge)
  app.post(
    '/:eventId/judges/invite',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      if (
        !authorize({
          actor: request.user,
          action: 'EVENT.MANAGE',
          resource: { type: 'EVENT', eventId: eventRec.id },
        })
      ) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Only organizers can invite judges.' },
        });
      }

      const parse = inviteJudgeSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid judge invitation data.',
            details: parse.error.issues,
          },
        });
      }

      const db = getDb();
      const email = parse.data.email.toLowerCase().trim();
      let displayName = parse.data.displayName;

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      let judgeUserId: string;

      if (existingUser) {
        judgeUserId = existingUser.id;
        displayName = existingUser.displayName;
      } else {
        const dummyHash = crypto.randomBytes(32).toString('hex');
        const [newUser] = await db
          .insert(users)
          .values({
            email,
            displayName: displayName || email.split('@')[0],
            passwordHash: dummyHash,
            globalRole: 'USER',
            status: 'ACTIVE',
          })
          .returning();
        judgeUserId = newUser.id;
        displayName = newUser.displayName;
      }

      // Upsert judge profile
      const [existingProfile] = await db
        .select()
        .from(judgeProfiles)
        .where(
          and(
            eq(judgeProfiles.eventId, eventRec.id),
            eq(judgeProfiles.userId, judgeUserId)
          )
        )
        .limit(1);

      if (existingProfile) {
        await db
          .update(judgeProfiles)
          .set({ maxWorkload: parse.data.maxWorkload })
          .where(eq(judgeProfiles.id, existingProfile.id));
      } else {
        await db.insert(judgeProfiles).values({
          eventId: eventRec.id,
          userId: judgeUserId,
          maxWorkload: parse.data.maxWorkload,
        });
      }

      // Upsert event membership
      const [existingMem] = await db
        .select()
        .from(eventMemberships)
        .where(
          and(
            eq(eventMemberships.eventId, eventRec.id),
            eq(eventMemberships.userId, judgeUserId)
          )
        )
        .limit(1);

      if (!existingMem) {
        await db.insert(eventMemberships).values({
          eventId: eventRec.id,
          userId: judgeUserId,
          role: 'JUDGE',
        });
      } else if (existingMem.role !== 'JUDGE' && existingMem.role !== 'ORGANIZER') {
        await db
          .update(eventMemberships)
          .set({ role: 'JUDGE' })
          .where(eq(eventMemberships.id, existingMem.id));
      }

      await db.insert(auditEvents).values({
        eventId: eventRec.id,
        actorUserId: request.user?.id,
        action: 'JUDGE.INVITED',
        resourceType: 'JUDGE',
        resourceId: judgeUserId,
        metadata: { email, maxWorkload: parse.data.maxWorkload },
      });

      return reply.status(201).send({
        success: true,
        judge: {
          userId: judgeUserId,
          email,
          displayName,
          maxWorkload: parse.data.maxWorkload,
        },
      });
    }
  );

  // GET /api/v1/events/:eventId/judges (Organizer Lists Judges)
  app.get(
    '/:eventId/judges',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      if (
        !authorize({
          actor: request.user,
          action: 'EVENT.MANAGE',
          resource: { type: 'EVENT', eventId: eventRec.id },
        })
      ) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Only organizers can view judges roster.' },
        });
      }

      const db = getDb();
      const judges = await db
        .select({
          userId: users.id,
          displayName: users.displayName,
          email: users.email,
          maxWorkload: judgeProfiles.maxWorkload,
          bio: judgeProfiles.bio,
          profileCreatedAt: judgeProfiles.createdAt,
        })
        .from(judgeProfiles)
        .innerJoin(users, eq(judgeProfiles.userId, users.id))
        .where(eq(judgeProfiles.eventId, eventRec.id));

      const allPrefs = await db
        .select()
        .from(judgeTrackPreferences)
        .where(eq(judgeTrackPreferences.eventId, eventRec.id));

      const allAssignments = await db
        .select()
        .from(judgeAssignments)
        .where(eq(judgeAssignments.eventId, eventRec.id));

      const allConflicts = await db
        .select()
        .from(judgeConflicts)
        .where(eq(judgeConflicts.eventId, eventRec.id));

      const result = judges.map((j: any) => ({
        ...j,
        preferredTrackIds: allPrefs
          .filter((p: any) => p.judgeUserId === j.userId)
          .map((p: any) => p.trackId),
        assignedCount: allAssignments.filter((a: any) => a.judgeUserId === j.userId).length,
        conflictCount: allConflicts.filter((c: any) => c.judgeUserId === j.userId).length,
      }));

      return reply.status(200).send(result);
    }
  );

  // GET /api/v1/events/:eventId/judge/preferences (Judge's Track Preferences)
  app.get(
    '/:eventId/judge/preferences',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      const db = getDb();
      const prefs = await db
        .select()
        .from(judgeTrackPreferences)
        .where(
          and(
            eq(judgeTrackPreferences.eventId, eventRec.id),
            eq(judgeTrackPreferences.judgeUserId, request.user!.id)
          )
        );

      return reply.status(200).send({
        trackIds: prefs.map((p: any) => p.trackId),
      });
    }
  );

  // PUT /api/v1/events/:eventId/judge/preferences (Judge Sets Track Preferences)
  app.put(
    '/:eventId/judge/preferences',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      const parse = setTrackPreferencesSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid track preferences.',
            details: parse.error.issues,
          },
        });
      }

      const db = getDb();
      const userId = request.user!.id;

      // Clear existing preferences
      await db
        .delete(judgeTrackPreferences)
        .where(
          and(
            eq(judgeTrackPreferences.eventId, eventRec.id),
            eq(judgeTrackPreferences.judgeUserId, userId)
          )
        );

      // Insert new preferences
      for (const trackId of parse.data.trackIds) {
        await db
          .insert(judgeTrackPreferences)
          .values({
            eventId: eventRec.id,
            judgeUserId: userId,
            trackId,
          })
          .onConflictDoNothing();
      }

      return reply.status(200).send({
        success: true,
        trackIds: parse.data.trackIds,
      });
    }
  );

  // GET /api/v1/events/:eventId/judge/conflicts (List Conflicts)
  app.get(
    '/:eventId/judge/conflicts',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      const db = getDb();
      const user = request.user!;
      const isOrganizer =
        user.globalRole === 'ADMIN' ||
        user.eventRoles.get(eventRec.id) === 'ORGANIZER';

      const condition = isOrganizer
        ? eq(judgeConflicts.eventId, eventRec.id)
        : and(
            eq(judgeConflicts.eventId, eventRec.id),
            eq(judgeConflicts.judgeUserId, user.id)
          );

      const conflicts = await db
        .select({
          id: judgeConflicts.id,
          judgeUserId: judgeConflicts.judgeUserId,
          eventId: judgeConflicts.eventId,
          teamId: judgeConflicts.teamId,
          projectId: judgeConflicts.projectId,
          reason: judgeConflicts.reason,
          projectTitle: projects.title,
          teamName: teams.name,
        })
        .from(judgeConflicts)
        .leftJoin(projects, eq(judgeConflicts.projectId, projects.id))
        .leftJoin(teams, eq(judgeConflicts.teamId, teams.id))
        .where(condition);

      return reply.status(200).send(conflicts);
    }
  );

  // POST /api/v1/events/:eventId/judge/conflicts (Declare Conflict + AUTO-UNASSIGN)
  app.post(
    '/:eventId/judge/conflicts',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      const parse = declareConflictSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid conflict declaration payload.',
            details: parse.error.issues,
          },
        });
      }

      if (!parse.data.projectId && !parse.data.teamId) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one of projectId or teamId must be provided.',
          },
        });
      }

      const db = getDb();
      const user = request.user!;

      const [newConflict] = await db
        .insert(judgeConflicts)
        .values({
          eventId: eventRec.id,
          judgeUserId: user.id,
          projectId: parse.data.projectId || null,
          teamId: parse.data.teamId || null,
          reason: parse.data.reason || 'Conflict of interest',
        })
        .returning();

      // AUTO-UNASSIGN: If judge was assigned to this project or any project belonging to this team, remove assignment!
      let unassignedCount = 0;
      if (parse.data.projectId) {
        const deleted = await db
          .delete(judgeAssignments)
          .where(
            and(
              eq(judgeAssignments.eventId, eventRec.id),
              eq(judgeAssignments.judgeUserId, user.id),
              eq(judgeAssignments.projectId, parse.data.projectId)
            )
          )
          .returning();
        unassignedCount += deleted.length;
      }

      if (parse.data.teamId) {
        const teamProjects = await db
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.teamId, parse.data.teamId));

        for (const p of teamProjects) {
          const deleted = await db
            .delete(judgeAssignments)
            .where(
              and(
                eq(judgeAssignments.eventId, eventRec.id),
                eq(judgeAssignments.judgeUserId, user.id),
                eq(judgeAssignments.projectId, p.id)
              )
            )
            .returning();
          unassignedCount += deleted.length;
        }
      }

      await db.insert(auditEvents).values({
        eventId: eventRec.id,
        actorUserId: user.id,
        action: 'JUDGE.CONFLICT_DECLARED',
        resourceType: 'CONFLICT',
        resourceId: newConflict.id,
        metadata: {
          projectId: parse.data.projectId,
          teamId: parse.data.teamId,
          unassignedCount,
        },
      });

      return reply.status(201).send({
        success: true,
        conflict: newConflict,
        unassignedCount,
      });
    }
  );

  // DELETE /api/v1/events/:eventId/judge/conflicts/:conflictId (Remove Conflict)
  app.delete(
    '/:eventId/judge/conflicts/:conflictId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId, conflictId } = request.params as {
        eventId: string;
        conflictId: string;
      };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      const db = getDb();
      const user = request.user!;

      const [conflict] = await db
        .select()
        .from(judgeConflicts)
        .where(
          and(
            eq(judgeConflicts.id, conflictId),
            eq(judgeConflicts.eventId, eventRec.id)
          )
        )
        .limit(1);

      if (!conflict) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Conflict not found.' },
        });
      }

      const isOwner = conflict.judgeUserId === user.id;
      const isOrganizer =
        user.globalRole === 'ADMIN' ||
        user.eventRoles.get(eventRec.id) === 'ORGANIZER';

      if (!isOwner && !isOrganizer) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'You cannot remove this conflict.' },
        });
      }

      await db.delete(judgeConflicts).where(eq(judgeConflicts.id, conflict.id));

      return reply.status(200).send({ success: true, conflictId });
    }
  );
}
