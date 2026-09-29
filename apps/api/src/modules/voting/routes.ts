import { FastifyInstance } from 'fastify';
import { eq, or, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  getDb,
  events,
  projects,
  communityVotes,
  auditEvents,
} from '@dogfood/database';
import { castVoteSchema } from '@dogfood/shared';

// Deterministic Pseudo-Random Number Generator (PRNG) using Mulberry32
function seededRandom(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert string seed to 32-bit integer
function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

// Deterministic Fisher-Yates shuffle
function seededShuffle<T>(array: T[], seedStr: string): T[] {
  const prng = seededRandom(stringToSeed(seedStr));
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function votingRoutes(app: FastifyInstance): Promise<void> {
  async function findEvent(eventIdOrSourceId: string) {
    const db = getDb();
    const [eventRec] = await db
      .select()
      .from(events)
      .where(or(eq(events.id, eventIdOrSourceId), eq(events.sourceId, eventIdOrSourceId)))
      .limit(1);
    return eventRec;
  }

  // GET /api/v1/events/:eventId/ballot (STABLE RANDOMIZED BALLOT)
  app.get('/:eventId/ballot', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
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
        repositoryUrl: projects.repositoryUrl,
        demoUrl: projects.demoUrl,
      })
      .from(projects)
      .where(
        and(eq(projects.eventId, eventRec.id), eq(projects.status, 'SUBMITTED'))
      );

    // Compute stable voter identity
    const voterId =
      request.user?.id ||
      request.ip ||
      request.headers['user-agent'] ||
      'anonymous';
    const seedString = `${eventRec.id}:${voterId}`;

    // Deterministic shuffle
    const randomizedProjects = seededShuffle(eventProjects, seedString);

    // Check if voter has already voted
    const voterHash = crypto.createHash('sha256').update(seedString).digest('hex');
    const [existingVote] = await db
      .select()
      .from(communityVotes)
      .where(
        and(
          eq(communityVotes.eventId, eventRec.id),
          eq(communityVotes.voterHash, voterHash)
        )
      )
      .limit(1);

    return reply.status(200).send({
      eventId: eventRec.id,
      hasVoted: !!existingVote,
      votedProjectId: existingVote?.projectId || null,
      projects: randomizedProjects,
    });
  });

  // POST /api/v1/events/:eventId/votes (Cast vote with anti-abuse protection)
  app.post('/:eventId/votes', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    if (!eventRec.communityVotingEnabled) {
      return reply.status(403).send({
        error: {
          code: 'VOTING_DISABLED',
          message: 'Community voting is currently disabled for this event.',
        },
      });
    }

    const parse = castVoteSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid vote selection.' },
      });
    }

    const db = getDb();
    const voterId =
      request.user?.id ||
      request.ip ||
      request.headers['user-agent'] ||
      'anonymous';
    const voterHash = crypto
      .createHash('sha256')
      .update(`${eventRec.id}:${voterId}`)
      .digest('hex');
    const ipHash = crypto
      .createHash('sha256')
      .update(request.ip || '127.0.0.1')
      .digest('hex');

    // Check duplicate vote
    const [existing] = await db
      .select()
      .from(communityVotes)
      .where(
        and(
          eq(communityVotes.eventId, eventRec.id),
          eq(communityVotes.voterHash, voterHash)
        )
      )
      .limit(1);

    if (existing) {
      return reply.status(409).send({
        error: {
          code: 'ALREADY_VOTED',
          message: 'You have already cast a community vote for this event.',
        },
      });
    }

    const [vote] = await db
      .insert(communityVotes)
      .values({
        eventId: eventRec.id,
        projectId: parse.data.projectId,
        userId: request.user?.id || null,
        voterHash,
        ipHash,
      })
      .returning();

    await db.insert(auditEvents).values({
      eventId: eventRec.id,
      actorUserId: request.user?.id || null,
      action: 'VOTE.CAST',
      resourceType: 'COMMUNITY_VOTE',
      resourceId: vote.id,
      metadata: { projectId: parse.data.projectId },
    });

    return reply.status(201).send({ success: true, voteId: vote.id });
  });
}
