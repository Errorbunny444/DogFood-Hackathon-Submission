import { FastifyInstance } from 'fastify';
import { eq, or, and, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  getDb,
  projects,
  projectAssets,
  events,
  tracks,
  teams,
  teamMembers,
  submissionQuestions,
  submissionAnswers,
  auditEvents,
} from '@dogfood/database';
import {
  updateProjectSchema,
  resolveDuplicateSchema,
  saveAnswersSchema,
} from '@dogfood/shared';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../policies/index.js';
import { isUuid } from '../../lib/uuid.js';
import { getStorageProvider, classifyMimeType, ASSET_LIMITS } from '../../services/storage/index.js';

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  async function findProject(projectIdOrSourceId: string) {
    const db = getDb();
    const condition = isUuid(projectIdOrSourceId)
      ? or(eq(projects.id, projectIdOrSourceId), eq(projects.sourceId, projectIdOrSourceId))
      : eq(projects.sourceId, projectIdOrSourceId);
    const [projectRec] = await db
      .select({
        id: projects.id,
        sourceId: projects.sourceId,
        eventId: projects.eventId,
        teamId: projects.teamId,
        trackId: projects.trackId,
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
        sourceType: projects.sourceType,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        trackName: tracks.name,
        teamName: teams.name,
      })
      .from(projects)
      .leftJoin(tracks, eq(projects.trackId, tracks.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .where(condition)
      .limit(1);
    return projectRec;
  }

  async function canEditProject(user: any, project: any): Promise<boolean> {
    if (user.globalRole === 'ADMIN') return true;
    if (user.eventRoles.get(project.eventId) === 'ORGANIZER') return true;
    if (!project.teamId) return false;
    const db = getDb();
    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, user.id)))
      .limit(1);
    return Boolean(membership);
  }

  // GET /api/v1/projects/:projectId
  app.get('/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await findProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: { code: 'PROJECT_NOT_FOUND', message: `Project '${projectId}' not found.` },
      });
    }

    return reply.status(200).send(project);
  });

  // GET /api/v1/projects/:projectId/answers
  app.get('/:projectId/answers', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await findProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: { code: 'PROJECT_NOT_FOUND', message: `Project '${projectId}' not found.` },
      });
    }

    const db = getDb();
    const questions = await db
      .select()
      .from(submissionQuestions)
      .where(eq(submissionQuestions.eventId, project.eventId))
      .orderBy(submissionQuestions.position);

    const existingAnswers = await db
      .select()
      .from(submissionAnswers)
      .where(eq(submissionAnswers.projectId, project.id));

    const answerMap = new Map(existingAnswers.map((a: any) => [a.questionId, a]));

    const response = questions.map((q: any) => ({
      questionId: q.id,
      question: q.question,
      type: q.type,
      options: q.options,
      required: q.required,
      position: q.position,
      answer: (answerMap.get(q.id) as any)?.answer ?? null,
    }));

    return reply.status(200).send(response);
  });

  // PUT /api/v1/projects/:projectId/answers
  app.put(
    '/:projectId/answers',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = await findProject(projectId);
      if (!project) {
        return reply.status(404).send({
          error: { code: 'PROJECT_NOT_FOUND', message: `Project '${projectId}' not found.` },
        });
      }

      const user = request.user!;
      if (!(await canEditProject(user, project))) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'You do not have permission to edit this project.' },
        });
      }

      const db = getDb();
      const [eventRec] = await db
        .select()
        .from(events)
        .where(eq(events.id, project.eventId))
        .limit(1);

      if (eventRec && new Date() > new Date(eventRec.submissionDeadline)) {
        return reply.status(409).send({
          error: {
            code: 'SUBMISSION_DEADLINE_PASSED',
            message: 'Cannot edit answers after submission deadline has passed.',
          },
        });
      }

      const parse = saveAnswersSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid answers payload.',
            details: parse.error.issues,
          },
        });
      }

      for (const item of parse.data.answers) {
        const [existing] = await db
          .select()
          .from(submissionAnswers)
          .where(
            and(
              eq(submissionAnswers.projectId, project.id),
              eq(submissionAnswers.questionId, item.questionId)
            )
          )
          .limit(1);

        if (existing) {
          await db
            .update(submissionAnswers)
            .set({ answer: item.answer })
            .where(eq(submissionAnswers.id, existing.id));
        } else {
          await db.insert(submissionAnswers).values({
            projectId: project.id,
            questionId: item.questionId,
            answer: item.answer,
          });
        }
      }

      return reply.status(200).send({
        success: true,
        savedCount: parse.data.answers.length,
      });
    }
  );

  // PATCH /api/v1/projects/:projectId (Edit before deadline)
  app.patch(
    '/:projectId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = await findProject(projectId);
      if (!project) {
        return reply.status(404).send({
          error: { code: 'PROJECT_NOT_FOUND', message: `Project '${projectId}' not found.` },
        });
      }

      const user = request.user!;
      if (!(await canEditProject(user, project))) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'You do not have permission to edit this project.' },
        });
      }

      const db = getDb();
      const [eventRec] = await db
        .select()
        .from(events)
        .where(eq(events.id, project.eventId))
        .limit(1);

      // Check deadline
      if (eventRec && new Date() > new Date(eventRec.submissionDeadline)) {
        return reply.status(409).send({
          error: {
            code: 'SUBMISSION_DEADLINE_PASSED',
            message: 'Cannot edit project after submission deadline has passed.',
          },
        });
      }

      const parse = updateProjectSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid project update data.',
            details: parse.error.issues,
          },
        });
      }

      const [updated] = await db
        .update(projects)
        .set({
          ...parse.data,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, project.id))
        .returning();

      return reply.status(200).send(updated);
    }
  );

  // POST /api/v1/projects/:projectId/submit (Final Submission with Receipt)
  app.post(
    '/:projectId/submit',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = await findProject(projectId);
      if (!project) {
        return reply.status(404).send({
          error: { code: 'PROJECT_NOT_FOUND', message: `Project '${projectId}' not found.` },
        });
      }

      const user = request.user!;
      if (!(await canEditProject(user, project))) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'You do not have permission to submit this project.' },
        });
      }

      const db = getDb();
      const [eventRec] = await db
        .select()
        .from(events)
        .where(eq(events.id, project.eventId))
        .limit(1);

      // Check deadline
      if (eventRec && new Date() > new Date(eventRec.submissionDeadline)) {
        return reply.status(409).send({
          error: {
            code: 'SUBMISSION_DEADLINE_PASSED',
            message: 'The submission deadline has passed. Submissions are closed.',
          },
        });
      }

      // Check required custom questions
      const requiredQuestions = await db
        .select()
        .from(submissionQuestions)
        .where(
          and(
            eq(submissionQuestions.eventId, project.eventId),
            eq(submissionQuestions.required, true)
          )
        );

      if (requiredQuestions.length > 0) {
        const existingAnswers = await db
          .select()
          .from(submissionAnswers)
          .where(eq(submissionAnswers.projectId, project.id));

        const answeredIds = new Set(
          existingAnswers
            .filter((a: any) => a.answer !== null && a.answer !== undefined && a.answer !== '')
            .map((a: any) => a.questionId)
        );

        const missing = requiredQuestions.filter((q: any) => !answeredIds.has(q.id));
        if (missing.length > 0) {
          return reply.status(400).send({
            error: {
              code: 'MISSING_REQUIRED_QUESTIONS',
              message: `Required questions missing: ${missing.map((m: any) => m.question).join(', ')}`,
              details: missing.map((m: any) => ({ questionId: m.id, question: m.question })),
            },
          });
        }
      }

      const submittedAt = new Date();
      const receiptId = crypto.randomUUID();
      const sha256 = crypto
        .createHash('sha256')
        .update(`${project.id}:${submittedAt.toISOString()}:${project.title}`)
        .digest('hex');

      const receipt = {
        receiptId,
        submittedAt: submittedAt.toISOString(),
        sha256,
        projectTitle: project.title,
      };

      const [submitted] = await db
        .update(projects)
        .set({
          status: 'SUBMITTED',
          submittedAt,
          updatedAt: submittedAt,
        })
        .where(eq(projects.id, project.id))
        .returning();

      await db.insert(auditEvents).values({
        eventId: project.eventId,
        actorUserId: user.id,
        action: 'PROJECT.SUBMITTED',
        resourceType: 'PROJECT',
        resourceId: project.id,
        metadata: { receipt },
      });

      return reply.status(200).send({
        ...submitted,
        receipt,
      });
    }
  );

  // POST /api/v1/projects/:projectId/resolve-duplicate (Organizer decision)
  app.post(
    '/:projectId/resolve-duplicate',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = await findProject(projectId);
      if (!project) {
        return reply.status(404).send({
          error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' },
        });
      }

      if (
        !authorize({
          actor: request.user,
          action: 'EVENT.MANAGE',
          resource: { type: 'EVENT', eventId: project.eventId },
        })
      ) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Only organizers can resolve duplicate status.' },
        });
      }

      const parse = resolveDuplicateSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid duplicate resolution data.' },
        });
      }

      const db = getDb();
      const [updated] = await db
        .update(projects)
        .set({
          duplicateStatus: parse.data.duplicateStatus,
          duplicateOf: parse.data.duplicateOf || null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, project.id))
        .returning();

      await db.insert(auditEvents).values({
        eventId: project.eventId,
        actorUserId: request.user?.id,
        action: 'PROJECT.DUPLICATE_RESOLVED',
        resourceType: 'PROJECT',
        resourceId: project.id,
        metadata: {
          duplicateStatus: parse.data.duplicateStatus,
          duplicateOf: parse.data.duplicateOf,
          reason: parse.data.reason,
        },
      });

      return reply.status(200).send(updated);
    }
  );

  // GET /api/v1/projects/:projectId/assets
  app.get('/:projectId/assets', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await findProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' },
      });
    }

    const db = getDb();
    const assets = await db
      .select()
      .from(projectAssets)
      .where(eq(projectAssets.projectId, project.id))
      .orderBy(desc(projectAssets.createdAt));

    return reply.status(200).send({ assets });
  });

  // POST /api/v1/projects/:projectId/assets
  app.post(
    '/:projectId/assets',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = await findProject(projectId);
      if (!project) {
        return reply.status(404).send({
          error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' },
        });
      }

      if (!(await canEditProject(request.user, project))) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Not authorized to upload assets for this project.' },
        });
      }

      const body = request.body as any;
      if (!body || !body.fileName || !body.base64Data) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: fileName and base64Data.' },
        });
      }

      const rawMime = body.mimeType || 'application/octet-stream';
      const assetCategory = classifyMimeType(rawMime);
      const limit = ASSET_LIMITS[assetCategory];

      const buffer = Buffer.from(body.base64Data, 'base64');
      if (buffer.length > limit.maxSize) {
        return reply.status(400).send({
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File exceeds maximum allowed size for ${assetCategory} (${Math.round(limit.maxSize / (1024 * 1024))}MB).`,
          },
        });
      }

      const safeName = path.basename(body.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageKey = `projects/${project.id}/${Date.now()}-${safeName}`;
      const storageProvider = getStorageProvider();
      const uploadResult = await storageProvider.upload(storageKey, buffer, rawMime);

      const db = getDb();
      const [newAsset] = await db
        .insert(projectAssets)
        .values({
          projectId: project.id,
          uploaderUserId: request.user?.id,
          type: assetCategory,
          name: body.fileName,
          path: uploadResult.publicUrl,
          storageKey: uploadResult.key,
          mimeType: rawMime,
          sizeBytes: buffer.length,
          createdAt: new Date(),
        })
        .returning();

      return reply.status(201).send({ asset: newAsset });
    }
  );

  // DELETE /api/v1/projects/:projectId/assets/:assetId
  app.delete(
    '/:projectId/assets/:assetId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { projectId, assetId } = request.params as { projectId: string; assetId: string };
      const project = await findProject(projectId);
      if (!project) {
        return reply.status(404).send({
          error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' },
        });
      }

      if (!(await canEditProject(request.user, project))) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Not authorized to delete assets for this project.' },
        });
      }

      const db = getDb();
      const [asset] = await db
        .select()
        .from(projectAssets)
        .where(and(eq(projectAssets.id, assetId), eq(projectAssets.projectId, project.id)))
        .limit(1);

      if (!asset) {
        return reply.status(404).send({
          error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found.' },
        });
      }

      if (asset.storageKey) {
        const storageProvider = getStorageProvider();
        await storageProvider.delete(asset.storageKey);
      }

      await db.delete(projectAssets).where(eq(projectAssets.id, asset.id));

      return reply.status(200).send({ success: true, message: 'Asset deleted successfully.' });
    }
  );
}

