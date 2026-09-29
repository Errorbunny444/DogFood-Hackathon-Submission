import { FastifyInstance } from 'fastify';
import { eq, or, desc } from 'drizzle-orm';
import {
  getDb,
  events,
  projects,
  tracks,
  teams,
  reviews,
  users,
  normalizationRuns,
  projectResults,
  judgeStatistics,
} from '@dogfood/database';
import { authorize } from '../../policies/index.js';
import { isUuid } from '../../lib/uuid.js';

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  // Helper to resolve event
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

  // GET /api/v1/events/:eventId/export/results.csv
  app.get('/:eventId/export/results.csv', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    if (!request.user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const isAllowed = authorize({
      actor: request.user,
      action: 'EVENT.EXPORT',
      resource: { type: 'EVENT', eventId: eventRec.id },
    });

    if (!isAllowed) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Only event organizers can export results.',
        },
      });
    }

    const db = getDb();

    // Find latest normalization run
    const [latestRun] = await db
      .select()
      .from(normalizationRuns)
      .where(eq(normalizationRuns.eventId, eventRec.id))
      .orderBy(desc(normalizationRuns.createdAt))
      .limit(1);

    let rows: any[] = [];
    if (latestRun) {
      rows = await db
        .select({
          projectSourceId: projects.sourceId,
          projectId: projects.id,
          title: projects.title,
          trackName: tracks.name,
          rawAverage: projectResults.rawAverage,
          normalizedAverage: projectResults.normalizedAverage,
          reviewCount: projectResults.reviewCount,
          normalizedRank: projectResults.normalizedRank,
        })
        .from(projectResults)
        .innerJoin(projects, eq(projectResults.projectId, projects.id))
        .leftJoin(tracks, eq(projects.trackId, tracks.id))
        .where(eq(projectResults.normalizationRunId, latestRun.id))
        .orderBy(projectResults.normalizedRank);
    } else {
      // Fallback: list all projects
      rows = await db
        .select({
          projectSourceId: projects.sourceId,
          projectId: projects.id,
          title: projects.title,
          trackName: tracks.name,
          rawAverage: projects.id,
          normalizedAverage: projects.id,
          reviewCount: projects.id,
          normalizedRank: projects.id,
        })
        .from(projects)
        .leftJoin(tracks, eq(projects.trackId, tracks.id))
        .where(eq(projects.eventId, eventRec.id));
    }

    const csvLines = [
      'project_id,title,track,raw_score,normalized_score,review_count,rank',
    ];

    for (const r of rows) {
      const pid = r.projectSourceId || r.projectId;
      const title = `"${(r.title || '').replace(/"/g, '""')}"`;
      const track = `"${(r.trackName || '').replace(/"/g, '""')}"`;
      const raw = typeof r.rawAverage === 'number' ? r.rawAverage.toFixed(2) : '0.00';
      const norm =
        typeof r.normalizedAverage === 'number' ? r.normalizedAverage.toFixed(2) : '0.00';
      const count = typeof r.reviewCount === 'number' ? r.reviewCount : 0;
      const rank = typeof r.normalizedRank === 'number' ? r.normalizedRank : '';

      csvLines.push(`${pid},${title},${track},${raw},${norm},${count},${rank}`);
    }

    const csvData = csvLines.join('\n');
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header(
      'Content-Disposition',
      `attachment; filename="results-${eventRec.slug}.csv"`
    );
    return reply.status(200).send(csvData);
  });

  // GET /api/v1/events/:eventId/export/projects.csv
  app.get('/:eventId/export/projects.csv', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    if (!request.user || !authorize({ actor: request.user, action: 'EVENT.EXPORT', resource: { type: 'EVENT', eventId: eventRec.id } })) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    const db = getDb();
    const rows = await db
      .select({
        sourceId: projects.sourceId,
        id: projects.id,
        title: projects.title,
        track: tracks.name,
        team: teams.name,
        repo: projects.repositoryUrl,
        submittedAt: projects.submittedAt,
        duplicateStatus: projects.duplicateStatus,
      })
      .from(projects)
      .leftJoin(tracks, eq(projects.trackId, tracks.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .where(eq(projects.eventId, eventRec.id));

    const csvLines = [
      'id,title,track,team,repository_url,submitted_at,duplicate_status',
    ];
    for (const r of rows) {
      const id = r.sourceId || r.id;
      const title = `"${(r.title || '').replace(/"/g, '""')}"`;
      const track = `"${(r.track || '').replace(/"/g, '""')}"`;
      const team = `"${(r.team || '').replace(/"/g, '""')}"`;
      const repo = `"${(r.repo || '').replace(/"/g, '""')}"`;
      const date = r.submittedAt ? new Date(r.submittedAt).toISOString() : '';
      csvLines.push(`${id},${title},${track},${team},${repo},${date},${r.duplicateStatus}`);
    }

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header(
      'Content-Disposition',
      `attachment; filename="projects-${eventRec.slug}.csv"`
    );
    return reply.status(200).send(csvLines.join('\n'));
  });

  // GET /api/v1/events/:eventId/export/full.json
  app.get('/:eventId/export/full.json', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    if (!request.user || !authorize({ actor: request.user, action: 'EVENT.EXPORT', resource: { type: 'EVENT', eventId: eventRec.id } })) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Unauthorized' } });
    }

    const db = getDb();
    const eventTracks = await db.select().from(tracks).where(eq(tracks.eventId, eventRec.id));
    const eventTeams = await db.select().from(teams).where(eq(teams.eventId, eventRec.id));
    const eventProjects = await db.select().from(projects).where(eq(projects.eventId, eventRec.id));
    const eventReviews = await db.select().from(reviews).where(eq(reviews.eventId, eventRec.id));

    return reply.status(200).send({
      event: eventRec,
      tracks: eventTracks,
      teams: eventTeams,
      projects: eventProjects,
      reviews: eventReviews,
      exportedAt: new Date().toISOString(),
    });
  });

  // POST /api/v1/events/:eventId/import/archive
  app.post('/:eventId/import/archive', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    if (!request.user || !authorize({ actor: request.user, action: 'EVENT.MANAGE', resource: { type: 'EVENT', eventId: eventRec.id } })) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Organizer privileges required.' } });
    }

    const archive = (request.body as any) || {};
    const db = getDb();

    let importedTracks = 0;
    let importedProjects = 0;

    // Import tracks if provided
    if (Array.isArray(archive.tracks)) {
      for (const t of archive.tracks) {
        if (t.name) {
          await db.insert(tracks).values({
            eventId: eventRec.id,
            name: t.name,
            description: t.description || '',
          });
          importedTracks++;
        }
      }
    }

    // Import projects if provided
    if (Array.isArray(archive.projects)) {
      for (const p of archive.projects) {
        if (p.title) {
          await db.insert(projects).values({
            eventId: eventRec.id,
            title: p.title,
            summary: p.summary || '',
            description: p.description || '',
            repositoryUrl: p.repositoryUrl || null,
            demoUrl: p.demoUrl || null,
            sourceType: 'IMPORTED',
          });
          importedProjects++;
        }
      }
    }

    return reply.status(200).send({
      success: true,
      message: `Imported ${importedTracks} tracks and ${importedProjects} projects.`,
      counts: {
        tracks: importedTracks,
        projects: importedProjects,
      },
    });
  });
}

