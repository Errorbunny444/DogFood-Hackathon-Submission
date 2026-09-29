import { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb, comments, users, projects, auditEvents } from '@dogfood/database';
import { createCommentSchema } from '@dogfood/shared';
import { requireAuth } from '../../middleware/auth.js';

export async function commentRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/projects/:projectId/comments
  app.get('/projects/:projectId/comments', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const db = getDb();

    const rows = await db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        userId: users.id,
        displayName: users.displayName,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.projectId, projectId))
      .orderBy(desc(comments.createdAt));

    return reply.status(200).send(rows);
  });

  // POST /api/v1/projects/:projectId/comments
  app.post(
    '/projects/:projectId/comments',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const parse = createCommentSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid comment content.' },
        });
      }

      const db = getDb();
      const user = request.user!;

      const [proj] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!proj) {
        return reply.status(404).send({
          error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found.' },
        });
      }

      const [newComment] = await db
        .insert(comments)
        .values({
          eventId: proj.eventId,
          projectId: proj.id,
          userId: user.id,
          content: parse.data.content,
        })
        .returning();

      return reply.status(201).send({
        ...newComment,
        displayName: user.displayName,
      });
    }
  );
}
