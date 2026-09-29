import { FastifyInstance } from 'fastify';
import { eq, or } from 'drizzle-orm';
import {
  getDb,
  users,
  reviews,
  reviewScores,
  projects,
  rubricCriteria,
} from '@dogfood/database';
import { authorize } from '../../policies/index.js';
import { isUuid } from '../../lib/uuid.js';

export async function judgeRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/judges/:judgeId/scores
  app.get('/:judgeId/scores', async (request, reply) => {
    const { judgeId } = request.params as { judgeId: string };
    const db = getDb();

    // 1. Resolve Target Judge (by UUID or source_id like jdg_01)
    const condition = isUuid(judgeId)
      ? or(eq(users.id, judgeId), eq(users.sourceId, judgeId))
      : eq(users.sourceId, judgeId);

    const [targetJudge] = await db
      .select({
        id: users.id,
        sourceId: users.sourceId,
        displayName: users.displayName,
        email: users.email,
      })
      .from(users)
      .where(condition)
      .limit(1);

    if (!targetJudge) {
      return reply.status(404).send({
        error: {
          code: 'JUDGE_NOT_FOUND',
          message: `Judge with ID or source ID '${judgeId}' not found.`,
          requestId: request.requestId,
        },
      });
    }

    // 2. Authentication Check
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to view judge scores.',
          requestId: request.requestId,
        },
      });
    }

    // 3. Strict Authorization Check (CRITICAL JUDGE ISOLATION)
    // Only Admin, Organizer of the event, or the Judge themselves requesting their own scores are allowed!
    const isAllowed = authorize({
      actor: request.user,
      action: 'JUDGE.VIEW_SCORES',
      resource: {
        type: 'JUDGE_SCORES',
        targetJudgeId: targetJudge.id,
        targetJudgeSourceId: targetJudge.sourceId || undefined,
      },
    });

    if (!isAllowed) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message:
            "Judge isolation policy: You do not have permission to view this judge's private scores.",
          requestId: request.requestId,
        },
      });
    }

    // 4. Fetch Judge's reviews and scores
    const judgeReviews = await db
      .select({
        reviewId: reviews.id,
        projectId: projects.id,
        projectSourceId: projects.sourceId,
        projectTitle: projects.title,
        rawScore: reviews.rawScore,
        overallComment: reviews.overallComment,
        status: reviews.status,
        submittedAt: reviews.submittedAt,
      })
      .from(reviews)
      .innerJoin(projects, eq(reviews.projectId, projects.id))
      .where(eq(reviews.judgeUserId, targetJudge.id));

    // Fetch criteria scores for these reviews
    const reviewIds = judgeReviews.map((r: any) => r.reviewId);
    let scoresList: any[] = [];
    if (reviewIds.length > 0) {
      scoresList = await db
        .select({
          reviewId: reviewScores.reviewId,
          criterionId: rubricCriteria.id,
          criterionName: rubricCriteria.name,
          criterionKey: rubricCriteria.key,
          score: reviewScores.score,
          comment: reviewScores.comment,
        })
        .from(reviewScores)
        .innerJoin(rubricCriteria, eq(reviewScores.criterionId, rubricCriteria.id));
    }

    const scoresByReview = new Map<string, any[]>();
    for (const s of scoresList) {
      const list = scoresByReview.get(s.reviewId) || [];
      list.push(s);
      scoresByReview.set(s.reviewId, list);
    }

    const formattedReviews = judgeReviews.map((r: any) => ({
      ...r,
      scores: scoresByReview.get(r.reviewId) || [],
    }));

    return reply.status(200).send({
      judgeId: targetJudge.id,
      judgeSourceId: targetJudge.sourceId,
      judgeName: targetJudge.displayName,
      email: targetJudge.email,
      reviewsCount: formattedReviews.length,
      reviews: formattedReviews,
    });
  });
}
