import { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb, projects, tracks, teams, events } from '@dogfood/database';
import { config } from '../../config/index.js';

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/public/config
  app.get('/config', async () => {
    return {
      appMode: config.appMode,
      demoEnabled: config.appMode === 'demo',
      version: '1.0.0',
    };
  });

  // GET /api/v1/public/projects
  app.get('/projects', async (request, reply) => {
    const db = getDb();

    // Query projects joined with tracks and teams
    const rows = await db
      .select({
        id: projects.id,
        sourceId: projects.sourceId,
        sourceType: projects.sourceType,
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
        trackId: tracks.id,
        trackName: tracks.name,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(projects)
      .leftJoin(tracks, eq(projects.trackId, tracks.id))
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .orderBy(desc(projects.submittedAt));

    return reply.status(200).send(rows);
  });

  // GET /api/v1/public/events
  app.get('/events', async (request, reply) => {
    const db = getDb();
    const allEvents = await db
      .select({
        id: events.id,
        sourceId: events.sourceId,
        slug: events.slug,
        name: events.name,
        description: events.description,
        submissionDeadline: events.submissionDeadline,
        status: events.status,
        resultsPublished: events.resultsPublished,
      })
      .from(events);

    return reply.status(200).send(allEvents);
  });
}
