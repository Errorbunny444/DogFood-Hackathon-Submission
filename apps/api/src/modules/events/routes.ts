import { FastifyInstance } from 'fastify';
import { eq, or, desc, and } from 'drizzle-orm';
import {
  getDb,
  events,
  projects,
  tracks,
  prizes,
  teams,
  teamMembers,
  eventMemberships,
  organizations,
  rubrics,
  rubricCriteria,
  submissionQuestions,
  auditEvents,
} from '@dogfood/database';
import {
  createEventSchema,
  createProjectSchema,
  createTeamSchema,
  eventWizardSchema,
  eventStatusTransitionSchema,
  eventTimelineUpdateSchema,
  VALID_EVENT_TRANSITIONS,
} from '@dogfood/shared';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../policies/index.js';
import { isUuid } from '../../lib/uuid.js';

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  // Helper to find event by UUID or sourceId (e.g. evt_01)
  async function findEvent(eventIdOrSourceId: string) {
    const db = getDb();
    const condition = isUuid(eventIdOrSourceId)
      ? or(eq(events.id, eventIdOrSourceId), eq(events.sourceId, eventIdOrSourceId))
      : eq(events.sourceId, eventIdOrSourceId);
    const [eventRec] = await db
      .select()
      .from(events)
      .where(condition)
      .limit(1);
    return eventRec;
  }

  // GET /api/v1/events
  app.get('/', async (request, reply) => {
    const db = getDb();
    const rows = await db.select().from(events).orderBy(desc(events.createdAt));
    return reply.status(200).send(rows);
  });

  // POST /api/v1/events
  app.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const parse = createEventSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event data.',
          details: parse.error.issues,
        },
      });
    }

    const db = getDb();
    const [newEvent] = await db
      .insert(events)
      .values({
        ...parse.data,
        submissionDeadline: new Date(parse.data.submissionDeadline),
        createdBy: request.user?.id,
      })
      .returning();

    // Assign creator as organizer
    if (request.user) {
      await db.insert(eventMemberships).values({
        eventId: newEvent.id,
        userId: request.user.id,
        role: 'ORGANIZER',
      });
    }

    return reply.status(201).send(newEvent);
  });

  // POST /api/v1/events/wizard - Comprehensive multi-step event creation
  app.post('/wizard', { preHandler: [requireAuth] }, async (request, reply) => {
    const parse = eventWizardSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event wizard configuration.',
          details: parse.error.issues,
        },
      });
    }

    const data = parse.data;
    const db = getDb();

    // Check slug uniqueness
    const [existingSlug] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.slug, data.slug))
      .limit(1);

    if (existingSlug) {
      return reply.status(409).send({
        error: {
          code: 'SLUG_ALREADY_EXISTS',
          message: `An event with slug '${data.slug}' already exists. Please choose a different slug.`,
        },
      });
    }

    // Resolve Organization: If organizationId provided, authorize. Otherwise, assign default org.
    let finalOrgId = data.organizationId;
    if (finalOrgId) {
      const allowed = authorize({
        actor: request.user,
        action: 'ORG.EVENT_CREATE',
        resource: { orgId: finalOrgId },
      });
      if (!allowed) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to create events in this organization.',
          },
        });
      }
    } else {
      // Find user's first owned org or default demo org
      const [demoOrg] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, 'dogfood-demo'))
        .limit(1);
      finalOrgId = demoOrg?.id;
    }

    // 1. Create Event
    const [newEvent] = await db
      .insert(events)
      .values({
        organizationId: finalOrgId || null,
        name: data.name,
        slug: data.slug,
        description: data.description,
        timezone: data.timezone,
        registrationOpensAt: data.registrationOpensAt ? new Date(data.registrationOpensAt) : null,
        registrationClosesAt: data.registrationClosesAt ? new Date(data.registrationClosesAt) : null,
        eventStartsAt: data.eventStartsAt ? new Date(data.eventStartsAt) : null,
        eventEndsAt: data.eventEndsAt ? new Date(data.eventEndsAt) : null,
        submissionDeadline: new Date(data.submissionDeadline),
        judgingStartsAt: data.judgingStartsAt ? new Date(data.judgingStartsAt) : null,
        judgingEndsAt: data.judgingEndsAt ? new Date(data.judgingEndsAt) : null,
        resultsPublishAt: data.resultsPublishAt ? new Date(data.resultsPublishAt) : null,
        communityVotingEnabled: data.communityVotingEnabled,
        commentsEnabled: data.commentsEnabled,
        status: data.initialStatus,
        createdBy: request.user!.id,
      })
      .returning();

    // 2. Assign creator as ORGANIZER
    await db.insert(eventMemberships).values({
      eventId: newEvent.id,
      userId: request.user!.id,
      role: 'ORGANIZER',
      status: 'ACTIVE',
    });

    // 3. Create Tracks
    const createdTracks: any[] = [];
    for (const t of data.tracks) {
      const [trackRec] = await db
        .insert(tracks)
        .values({
          eventId: newEvent.id,
          name: t.name,
          description: t.description || '',
        })
        .returning();
      createdTracks.push(trackRec);
    }

    // 4. Create Prizes
    const createdPrizes: any[] = [];
    for (const p of data.prizes) {
      let linkedTrackId: string | null = null;
      if (p.trackIndex !== undefined && createdTracks[p.trackIndex]) {
        linkedTrackId = createdTracks[p.trackIndex].id;
      }
      const [prizeRec] = await db
        .insert(prizes)
        .values({
          eventId: newEvent.id,
          trackId: linkedTrackId,
          name: p.name,
          description: p.description || '',
          amount: p.amount || null,
        })
        .returning();
      createdPrizes.push(prizeRec);
    }

    // 5. Create Rubric & Criteria
    const [rubricRec] = await db
      .insert(rubrics)
      .values({
        eventId: newEvent.id,
        name: data.rubric.name,
        description: data.rubric.description,
        version: 1,
        active: true,
      })
      .returning();

    const createdCriteria: any[] = [];
    for (let i = 0; i < data.rubric.criteria.length; i++) {
      const c = data.rubric.criteria[i];
      const [critRec] = await db
        .insert(rubricCriteria)
        .values({
          rubricId: rubricRec.id,
          name: c.name,
          key: c.key || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          description: c.description || '',
          weight: c.weight,
          minScore: c.minScore,
          maxScore: c.maxScore,
          position: i,
        })
        .returning();
      createdCriteria.push(critRec);
    }

    // 6. Create Submission Questions
    const createdQuestions: any[] = [];
    for (let i = 0; i < data.submissionQuestions.length; i++) {
      const q = data.submissionQuestions[i];
      const [qRec] = await db
        .insert(submissionQuestions)
        .values({
          eventId: newEvent.id,
          question: q.question,
          type: q.type,
          options: q.options || null,
          required: q.required,
          position: i,
        })
        .returning();
      createdQuestions.push(qRec);
    }

    // Audit log
    await db.insert(auditEvents).values({
      actorUserId: request.user!.id,
      eventId: newEvent.id,
      action: 'EVENT.CREATED',
      resourceType: 'EVENT',
      resourceId: newEvent.id,
      metadata: {
        name: newEvent.name,
        slug: newEvent.slug,
        tracksCount: createdTracks.length,
        criteriaCount: createdCriteria.length,
      },
    });

    return reply.status(201).send({
      event: newEvent,
      tracks: createdTracks,
      prizes: createdPrizes,
      rubric: rubricRec,
      criteria: createdCriteria,
      submissionQuestions: createdQuestions,
    });
  });

  // PATCH /api/v1/events/:eventId/status - State Machine Transitions
  app.patch('/:eventId/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);

    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    const allowed = authorize({
      actor: request.user,
      action: 'EVENT.MANAGE',
      resource: { eventId: eventRec.id, orgId: eventRec.organizationId || undefined },
    });

    if (!allowed) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to transition the status of this event.',
        },
      });
    }

    const parse = eventStatusTransitionSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid status transition input.',
          details: parse.error.issues,
        },
      });
    }

    const currentStatus = eventRec.status as keyof typeof VALID_EVENT_TRANSITIONS;
    const targetStatus = parse.data.status;
    const allowedNextStatuses = VALID_EVENT_TRANSITIONS[currentStatus] || [];

    if (!allowedNextStatuses.includes(targetStatus as any)) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition event from '${currentStatus}' to '${targetStatus}'. Valid target statuses are: ${allowedNextStatuses.join(', ')}.`,
        },
      });
    }

    const db = getDb();

    // Guard: Transition to JUDGING requires at least one active rubric with criteria
    if (targetStatus === 'JUDGING') {
      const eventRubrics = await db
        .select({ id: rubrics.id })
        .from(rubrics)
        .where(and(eq(rubrics.eventId, eventRec.id), eq(rubrics.active, true)));

      if (eventRubrics.length === 0) {
        return reply.status(400).send({
          error: {
            code: 'NO_RUBRICS_CONFIGURED',
            message: 'Cannot begin judging phase without configuring at least one active evaluation rubric.',
          },
        });
      }
    }

    // Guard: Transition to COMPLETED automatically marks results as published
    const resultsPublished = targetStatus === 'COMPLETED' ? true : eventRec.resultsPublished;

    const [updatedEvent] = await db
      .update(events)
      .set({
        status: targetStatus,
        resultsPublished,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventRec.id))
      .returning();

    await db.insert(auditEvents).values({
      actorUserId: request.user!.id,
      eventId: eventRec.id,
      action: 'EVENT.UPDATED',
      resourceType: 'EVENT',
      resourceId: eventRec.id,
      metadata: {
        field: 'status',
        oldStatus: currentStatus,
        newStatus: targetStatus,
        reason: parse.data.reason || null,
      },
    });

    return reply.status(200).send({ event: updatedEvent });
  });

  // PATCH /api/v1/events/:eventId/timeline - Update timelines and deadlines
  app.patch('/:eventId/timeline', { preHandler: [requireAuth] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);

    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    const allowed = authorize({
      actor: request.user,
      action: 'EVENT.MANAGE',
      resource: { eventId: eventRec.id, orgId: eventRec.organizationId || undefined },
    });

    if (!allowed) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to manage this event.' },
      });
    }

    const parse = eventTimelineUpdateSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid timeline data.',
          details: parse.error.issues,
        },
      });
    }

    const db = getDb();
    const updates: any = { updatedAt: new Date() };
    const data = parse.data;

    if (data.registrationOpensAt !== undefined) {
      updates.registrationOpensAt = data.registrationOpensAt ? new Date(data.registrationOpensAt) : null;
    }
    if (data.registrationClosesAt !== undefined) {
      updates.registrationClosesAt = data.registrationClosesAt ? new Date(data.registrationClosesAt) : null;
    }
    if (data.eventStartsAt !== undefined) {
      updates.eventStartsAt = data.eventStartsAt ? new Date(data.eventStartsAt) : null;
    }
    if (data.eventEndsAt !== undefined) {
      updates.eventEndsAt = data.eventEndsAt ? new Date(data.eventEndsAt) : null;
    }
    if (data.submissionDeadline !== undefined) {
      updates.submissionDeadline = new Date(data.submissionDeadline);
    }
    if (data.judgingStartsAt !== undefined) {
      updates.judgingStartsAt = data.judgingStartsAt ? new Date(data.judgingStartsAt) : null;
    }
    if (data.judgingEndsAt !== undefined) {
      updates.judgingEndsAt = data.judgingEndsAt ? new Date(data.judgingEndsAt) : null;
    }
    if (data.resultsPublishAt !== undefined) {
      updates.resultsPublishAt = data.resultsPublishAt ? new Date(data.resultsPublishAt) : null;
    }

    const [updatedEvent] = await db
      .update(events)
      .set(updates)
      .where(eq(events.id, eventRec.id))
      .returning();

    await db.insert(auditEvents).values({
      actorUserId: request.user!.id,
      eventId: eventRec.id,
      action: 'EVENT.DEADLINE_UPDATED',
      resourceType: 'EVENT',
      resourceId: eventRec.id,
      metadata: { changes: parse.data },
    });

    return reply.status(200).send({ event: updatedEvent });
  });

  // GET /api/v1/events/:eventId/full - Full configuration details
  app.get('/:eventId/full', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);

    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    const db = getDb();

    // Fetch tracks
    const eventTracks = await db
      .select()
      .from(tracks)
      .where(eq(tracks.eventId, eventRec.id));

    // Fetch prizes
    const eventPrizes = await db
      .select()
      .from(prizes)
      .where(eq(prizes.eventId, eventRec.id));

    // Fetch rubrics & criteria
    const eventRubrics = await db
      .select()
      .from(rubrics)
      .where(eq(rubrics.eventId, eventRec.id));

    let criteriaList: any[] = [];
    if (eventRubrics.length > 0) {
      criteriaList = await db
        .select()
        .from(rubricCriteria)
        .where(eq(rubricCriteria.rubricId, eventRubrics[0].id))
        .orderBy(rubricCriteria.position);
    }

    // Fetch submission questions
    const questions = await db
      .select()
      .from(submissionQuestions)
      .where(eq(submissionQuestions.eventId, eventRec.id))
      .orderBy(submissionQuestions.position);

    // Organization details if any
    let organization: any = null;
    if (eventRec.organizationId) {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, eventRec.organizationId))
        .limit(1);
      organization = org || null;
    }

    return reply.status(200).send({
      event: eventRec,
      organization,
      tracks: eventTracks,
      prizes: eventPrizes,
      rubric: eventRubrics[0] || null,
      criteria: criteriaList,
      submissionQuestions: questions,
    });
  });

  // GET /api/v1/events/:eventId
  app.get('/:eventId', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Event '${eventId}' not found.`,
        },
      });
    }
    return reply.status(200).send(eventRec);
  });

  // GET /api/v1/events/:eventId/projects
  app.get('/:eventId/projects', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Event '${eventId}' not found.`,
        },
      });
    }

    const db = getDb();
    const eventProjects = await db
      .select({
        id: projects.id,
        sourceId: projects.sourceId,
        title: projects.title,
        tagline: projects.tagline,
        summary: projects.summary,
        description: projects.description,
        repositoryUrl: projects.repositoryUrl,
        demoUrl: projects.demoUrl,
        videoUrl: projects.videoUrl,
        thumbnailPath: projects.thumbnailPath,
        status: projects.status,
        submittedAt: projects.submittedAt,
        duplicateStatus: projects.duplicateStatus,
        duplicateOf: projects.duplicateOf,
        trackId: tracks.id,
        trackName: tracks.name,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(projects)
      .leftJoin(tracks, eq(projects.trackId, tracks.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .where(eq(projects.eventId, eventRec.id))
      .orderBy(desc(projects.submittedAt));

    return reply.status(200).send(eventProjects);
  });

  // POST /api/v1/events/:eventId/projects (SUBMISSION DEADLINE CHECK)
  app.post('/:eventId/projects', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);

    if (!eventRec) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Event '${eventId}' not found.`,
          requestId: request.requestId,
        },
      });
    }

    // SERVER-SIDE DEADLINE ENFORCEMENT
    const now = new Date();
    const deadline = new Date(eventRec.submissionDeadline);

    if (now > deadline) {
      return reply.status(409).send({
        error: {
          code: 'SUBMISSION_DEADLINE_PASSED',
          message: `The submission deadline (${deadline.toISOString()}) has passed. Submissions are closed.`,
          requestId: request.requestId,
        },
      });
    }

    // Validate request body
    const parse = createProjectSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project submission data.',
          details: parse.error.issues,
          requestId: request.requestId,
        },
      });
    }

    const db = getDb();
    const [newProject] = await db
      .insert(projects)
      .values({
        eventId: eventRec.id,
        title: parse.data.title,
        summary: parse.data.summary,
        description: parse.data.description,
        tagline: parse.data.tagline,
        repositoryUrl: parse.data.repositoryUrl,
        demoUrl: parse.data.demoUrl,
        videoUrl: parse.data.videoUrl,
        trackId: parse.data.trackId,
        teamId: parse.data.teamId,
        status: 'SUBMITTED',
        submittedAt: now,
      })
      .returning();

    return reply.status(201).send(newProject);
  });

  // GET /api/v1/events/:eventId/questions (Get event submission questions)
  app.get('/:eventId/questions', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(submissionQuestions)
      .where(eq(submissionQuestions.eventId, eventRec.id))
      .orderBy(submissionQuestions.position);

    return reply.status(200).send(rows);
  });

  // POST /api/v1/events/:eventId/questions (Organizer creates submission question)
  app.post(
    '/:eventId/questions',
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
          error: { code: 'FORBIDDEN', message: 'Only organizers can manage questions.' },
        });
      }

      const { question, type, options, required, position } = (request.body || {}) as any;
      if (!question || !type) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'question and type are required.' },
        });
      }

      const db = getDb();
      const [newQuestion] = await db
        .insert(submissionQuestions)
        .values({
          eventId: eventRec.id,
          question,
          type,
          options: options || null,
          required: Boolean(required),
          position: position ?? 0,
        })
        .returning();

      return reply.status(201).send(newQuestion);
    }
  );

  // POST /api/v1/events/:eventId/teams (Create team in event)
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
      const eventRec = await findEvent(eventId);

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
}
