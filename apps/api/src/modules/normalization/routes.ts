import { FastifyInstance } from 'fastify';
import { eq, or, desc, and } from 'drizzle-orm';
import {
  getDb,
  events,
  projects,
  reviews,
  users,
  tracks,
  normalizationRuns,
  normalizedReviews,
  projectResults,
  judgeStatistics,
  projectCoverage,
  auditEvents,
} from '@dogfood/database';
import {
  runJudgingNormalization,
  calculateProjectCoverage,
  calculateProjectDisagreement,
} from '@dogfood/judging-engine';
import { runNormalizationSchema } from '@dogfood/shared';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../policies/index.js';
import { isUuid } from '../../lib/uuid.js';

export async function normalizationRoutes(app: FastifyInstance): Promise<void> {
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

  // POST /api/v1/events/:eventId/normalization/runs (Execute Normalization)
  app.post(
    '/:eventId/normalization/runs',
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
          action: 'NORMALIZATION.RUN',
          resource: { type: 'EVENT', eventId: eventRec.id },
        })
      ) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Only event organizers can run score normalization.',
          },
        });
      }

      const parse = runNormalizationSchema.safeParse(request.body || {});
      const shrinkageK = parse.success ? parse.data.shrinkageK : 5;

      const db = getDb();

      // Fetch all submitted reviews for this event
      const submittedReviews = await db
        .select({
          reviewId: reviews.id,
          judgeUserId: reviews.judgeUserId,
          projectId: reviews.projectId,
          rawScore: reviews.rawScore,
        })
        .from(reviews)
        .where(
          and(eq(reviews.eventId, eventRec.id), eq(reviews.status, 'SUBMITTED'))
        );

      const allProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.eventId, eventRec.id));

      const projectIds = allProjects.map((p: any) => p.id);

      // Run judging engine normalization
      const normOutput = runJudgingNormalization(
        submittedReviews.map((r: any) => ({
          reviewId: r.reviewId,
          judgeUserId: r.judgeUserId,
          projectId: r.projectId,
          rawScore: r.rawScore || 0,
        })),
        projectIds,
        shrinkageK
      );

      // Save Normalization Run in Database
      const [normRun] = await db
        .insert(normalizationRuns)
        .values({
          eventId: eventRec.id,
          algorithm: 'MEAN_CENTERING_SHRINKAGE',
          algorithmVersion: '1.0',
          parameters: { shrinkageK },
          createdBy: request.user?.id,
        })
        .returning();

      // Save Normalized Reviews
      for (const nr of normOutput.normalizedReviews) {
        await db.insert(normalizedReviews).values({
          normalizationRunId: normRun.id,
          reviewId: nr.reviewId,
          rawScore: nr.rawScore,
          judgeMean: nr.judgeMean,
          globalMean: nr.globalMean,
          observedBias: nr.observedBias,
          shrinkageFactor: nr.shrinkageFactor,
          adjustedBias: nr.adjustedBias,
          normalizedScore: nr.normalizedScore,
        });
      }

      // Save Judge Statistics
      for (const [jId, jStat] of normOutput.judgeStats.entries()) {
        await db.insert(judgeStatistics).values({
          normalizationRunId: normRun.id,
          judgeUserId: jId,
          reviewCount: jStat.reviewCount,
          completionRate: jStat.completionRate,
          mean: jStat.mean,
          median: jStat.median,
          variance: jStat.variance,
          standardDeviation: jStat.standardDeviation,
          minimum: jStat.min,
          maximum: jStat.max,
          observedBias: jStat.observedBias,
          adjustedBias: jStat.adjustedBias,
          shrinkageFactor: jStat.shrinkageFactor,
          flags: jStat.flags,
        });
      }

      // Save Project Results and Coverage
      const projectScoresMap = new Map<string, number[]>();
      for (const r of submittedReviews) {
        const list = projectScoresMap.get(r.projectId) || [];
        list.push(r.rawScore || 0);
        projectScoresMap.set(r.projectId, list);
      }

      for (const [pId, pScore] of normOutput.projectScores.entries()) {
        await db.insert(projectResults).values({
          normalizationRunId: normRun.id,
          projectId: pId,
          rawAverage: pScore.rawAverage,
          normalizedAverage: pScore.normalizedAverage,
          reviewCount: pScore.reviewCount,
          rawRank: pScore.rawRank,
          normalizedRank: pScore.normalizedRank,
          rankShift: pScore.rankShift,
          isTied: false,
        });

        const rawScores = projectScoresMap.get(pId) || [];
        const coverage = calculateProjectCoverage(pScore.reviewCount, 3);
        const disagreement = calculateProjectDisagreement(pId, rawScores);

        await db.insert(projectCoverage).values({
          normalizationRunId: normRun.id,
          projectId: pId,
          actualReviews: pScore.reviewCount,
          targetReviews: 3,
          coverageRatio: coverage.coverageRatio,
          coverageStatus: coverage.coverageStatus,
          isHighDisagreement: disagreement.isHighDisagreement,
          scoreRange: disagreement.scoreRange,
        });
      }

      // Audit Event
      await db.insert(auditEvents).values({
        eventId: eventRec.id,
        actorUserId: request.user?.id,
        action: 'NORMALIZATION.RUN',
        resourceType: 'NORMALIZATION_RUN',
        resourceId: normRun.id,
        metadata: { shrinkageK, reviewsNormalized: normOutput.normalizedReviews.length },
      });

      return reply.status(201).send({
        success: true,
        runId: normRun.id,
        globalMean: normOutput.globalMean,
        shrinkageK,
        reviewsCount: normOutput.normalizedReviews.length,
        projectsCount: normOutput.projectScores.size,
      });
    }
  );

  // GET /api/v1/events/:eventId/normalization/latest (Normalization Proof)
  app.get('/:eventId/normalization/latest', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    const db = getDb();

    const [latestRun] = await db
      .select()
      .from(normalizationRuns)
      .where(eq(normalizationRuns.eventId, eventRec.id))
      .orderBy(desc(normalizationRuns.createdAt))
      .limit(1);

    if (!latestRun) {
      return reply.status(200).send({
        run: null,
        proof: [],
      });
    }

    // Fetch project results
    const resultsRows = await db
      .select({
        projectId: projectResults.projectId,
        rawAverage: projectResults.rawAverage,
        normalizedAverage: projectResults.normalizedAverage,
        reviewCount: projectResults.reviewCount,
        rawRank: projectResults.rawRank,
        normalizedRank: projectResults.normalizedRank,
        rankShift: projectResults.rankShift,
        title: projects.title,
        projectSourceId: projects.sourceId,
        trackName: tracks.name,
      })
      .from(projectResults)
      .innerJoin(projects, eq(projectResults.projectId, projects.id))
      .leftJoin(tracks, eq(projects.trackId, tracks.id))
      .where(eq(projectResults.normalizationRunId, latestRun.id))
      .orderBy(projectResults.normalizedRank);

    // Fetch normalized reviews
    const normReviewsList = await db
      .select({
        reviewId: normalizedReviews.reviewId,
        projectId: reviews.projectId,
        rawScore: normalizedReviews.rawScore,
        judgeMean: normalizedReviews.judgeMean,
        globalMean: normalizedReviews.globalMean,
        observedBias: normalizedReviews.observedBias,
        shrinkageFactor: normalizedReviews.shrinkageFactor,
        adjustedBias: normalizedReviews.adjustedBias,
        normalizedScore: normalizedReviews.normalizedScore,
        judgeName: users.displayName,
        judgeSourceId: users.sourceId,
      })
      .from(normalizedReviews)
      .innerJoin(reviews, eq(normalizedReviews.reviewId, reviews.id))
      .innerJoin(users, eq(reviews.judgeUserId, users.id))
      .where(eq(normalizedReviews.normalizationRunId, latestRun.id));

    const reviewsByProject = new Map<string, any[]>();
    for (const nr of normReviewsList) {
      const list = reviewsByProject.get(nr.projectId) || [];
      list.push(nr);
      reviewsByProject.set(nr.projectId, list);
    }

    const proof = resultsRows.map((p: any) => ({
      ...p,
      reviews: reviewsByProject.get(p.projectId) || [],
    }));

    return reply.status(200).send({
      run: latestRun,
      proof,
    });
  });
}
