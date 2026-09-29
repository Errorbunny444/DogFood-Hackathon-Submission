import { FastifyInstance } from 'fastify';
import { eq, or, desc } from 'drizzle-orm';
import {
  getDb,
  events,
  projects,
  tracks,
  teams,
  normalizationRuns,
  projectResults,
  auditEvents,
} from '@dogfood/database';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../policies/index.js';
import { isUuid } from '../../lib/uuid.js';

export async function resultRoutes(app: FastifyInstance): Promise<void> {
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

  // GET /api/v1/events/:eventId/results
  app.get('/:eventId/results', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    // Results Visibility Check
    // If not published, only organizer or admin can preview draft results
    if (!eventRec.resultsPublished) {
      const isOrganizer =
        request.user?.globalRole === 'ADMIN' ||
        (request.user && request.user.eventRoles.get(eventRec.id) === 'ORGANIZER');

      if (!isOrganizer) {
        return reply.status(403).send({
          error: {
            code: 'RESULTS_NOT_PUBLISHED',
            message: 'Results for this event have not been published yet.',
          },
        });
      }
    }

    const db = getDb();

    // Fetch latest normalization run
    const [latestRun] = await db
      .select()
      .from(normalizationRuns)
      .where(eq(normalizationRuns.eventId, eventRec.id))
      .orderBy(desc(normalizationRuns.createdAt))
      .limit(1);

    if (!latestRun) {
      return reply.status(200).send({
        published: eventRec.resultsPublished,
        results: [],
      });
    }

    const rows = await db
      .select({
        projectId: projects.id,
        projectSourceId: projects.sourceId,
        title: projects.title,
        tagline: projects.tagline,
        summary: projects.summary,
        repositoryUrl: projects.repositoryUrl,
        demoUrl: projects.demoUrl,
        trackId: tracks.id,
        trackName: tracks.name,
        teamId: teams.id,
        teamName: teams.name,
        rawAverage: projectResults.rawAverage,
        normalizedAverage: projectResults.normalizedAverage,
        reviewCount: projectResults.reviewCount,
        rawRank: projectResults.rawRank,
        normalizedRank: projectResults.normalizedRank,
        rankShift: projectResults.rankShift,
        isTied: projectResults.isTied,
      })
      .from(projectResults)
      .innerJoin(projects, eq(projectResults.projectId, projects.id))
      .leftJoin(tracks, eq(projects.trackId, tracks.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .where(eq(projectResults.normalizationRunId, latestRun.id))
      .orderBy(projectResults.normalizedRank);

    return reply.status(200).send({
      published: eventRec.resultsPublished,
      runId: latestRun.id,
      algorithm: latestRun.algorithm,
      results: rows,
    });
  });

  // POST /api/v1/events/:eventId/results/publish (Organizer Publish Action)
  app.post(
    '/:eventId/results/publish',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const eventRec = await findEvent(eventId);
      if (!eventRec) {
        return reply.status(404).send({
          error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
        });
      }

      if (
        !authorize({
          actor: request.user,
          action: 'RESULTS.PUBLISH',
          resource: { type: 'EVENT', eventId: eventRec.id },
        })
      ) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Only organizers can publish results.' },
        });
      }

      const db = getDb();
      const newStatus = !eventRec.resultsPublished;

      await db
        .update(events)
        .set({
          resultsPublished: newStatus,
          resultsPublishAt: newStatus ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(events.id, eventRec.id));

      await db.insert(auditEvents).values({
        eventId: eventRec.id,
        actorUserId: request.user?.id,
        action: newStatus ? 'RESULTS.PUBLISHED' : 'RESULTS.UNPUBLISHED',
        resourceType: 'EVENT_RESULTS',
        resourceId: eventRec.id,
      });

      return reply.status(200).send({
        success: true,
        resultsPublished: newStatus,
      });
    }
  );
}
