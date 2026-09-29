import { FastifyInstance } from 'fastify';
import { eq, or, desc, and } from 'drizzle-orm';
import {
  getDb,
  events,
  projects,
  reviews,
  users,
  tracks,
  teams,
  judgeAssignments,
  normalizationRuns,
  projectResults,
  judgeStatistics,
  projectCoverage,
} from '@dogfood/database';
import { authorize } from '../../policies/index.js';
import { isUuid } from '../../lib/uuid.js';

export async function integrityRoutes(app: FastifyInstance): Promise<void> {
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

  // GET /api/v1/events/:eventId/judging/progress
  app.get('/:eventId/judging/progress', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    const db = getDb();

    const totalProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.eventId, eventRec.id));

    const allAssignments = await db
      .select()
      .from(judgeAssignments)
      .where(eq(judgeAssignments.eventId, eventRec.id));

    const submittedReviews = await db
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.eventId, eventRec.id), eq(reviews.status, 'SUBMITTED'))
      );

    const reviewsPerProject = new Map<string, number>();
    for (const r of submittedReviews) {
      reviewsPerProject.set(r.projectId, (reviewsPerProject.get(r.projectId) || 0) + 1);
    }

    let completedProjects = 0;
    let underReviewedProjects = 0;
    let unreviewedProjects = 0;

    for (const p of totalProjects) {
      const count = reviewsPerProject.get(p.id) || 0;
      if (count >= 3) {
        completedProjects++;
      } else if (count > 0) {
        underReviewedProjects++;
      } else {
        unreviewedProjects++;
      }
    }

    const targetReviews = totalProjects.length * 3;
    const progressPercent =
      targetReviews > 0
        ? Math.min(100, Math.round((submittedReviews.length / targetReviews) * 100))
        : 100;

    return reply.status(200).send({
      totalProjects: totalProjects.length,
      targetReviews,
      completedReviews: submittedReviews.length,
      assignedReviews: allAssignments.length,
      progressPercent,
      completedProjects,
      underReviewedProjects,
      unreviewedProjects,
    });
  });

  // GET /api/v1/events/:eventId/judging/integrity (Centerpiece Dashboard)
  app.get('/:eventId/judging/integrity', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const eventRec = await findEvent(eventId);
    if (!eventRec) {
      return reply.status(404).send({
        error: { code: 'EVENT_NOT_FOUND', message: `Event '${eventId}' not found.` },
      });
    }

    const db = getDb();

    // 1. Latest Normalization Run
    const [latestRun] = await db
      .select()
      .from(normalizationRuns)
      .where(eq(normalizationRuns.eventId, eventRec.id))
      .orderBy(desc(normalizationRuns.createdAt))
      .limit(1);

    // 2. Judge Calibration Table
    let judgeCalibration: any[] = [];
    if (latestRun) {
      const stats = await db
        .select({
          judgeUserId: judgeStatistics.judgeUserId,
          reviewCount: judgeStatistics.reviewCount,
          completionRate: judgeStatistics.completionRate,
          mean: judgeStatistics.mean,
          median: judgeStatistics.median,
          variance: judgeStatistics.variance,
          standardDeviation: judgeStatistics.standardDeviation,
          minimum: judgeStatistics.minimum,
          maximum: judgeStatistics.maximum,
          observedBias: judgeStatistics.observedBias,
          adjustedBias: judgeStatistics.adjustedBias,
          shrinkageFactor: judgeStatistics.shrinkageFactor,
          flags: judgeStatistics.flags,
          displayName: users.displayName,
          email: users.email,
          sourceId: users.sourceId,
        })
        .from(judgeStatistics)
        .innerJoin(users, eq(judgeStatistics.judgeUserId, users.id))
        .where(eq(judgeStatistics.normalizationRunId, latestRun.id));

      judgeCalibration = stats;
    }

    // 3. Project Coverage & Disagreement Warnings
    let projectWarnings: any[] = [];
    let coverageSummary = {
      complete: 0,
      underReviewed: 0,
      unreviewed: 0,
      overReviewed: 0,
      highDisagreementCount: 0,
    };

    if (latestRun) {
      const coverageRows = await db
        .select({
          projectId: projectCoverage.projectId,
          actualReviews: projectCoverage.actualReviews,
          targetReviews: projectCoverage.targetReviews,
          coverageRatio: projectCoverage.coverageRatio,
          coverageStatus: projectCoverage.coverageStatus,
          isHighDisagreement: projectCoverage.isHighDisagreement,
          scoreRange: projectCoverage.scoreRange,
          title: projects.title,
          sourceId: projects.sourceId,
          trackName: tracks.name,
          normalizedAverage: projectResults.normalizedAverage,
        })
        .from(projectCoverage)
        .innerJoin(projects, eq(projectCoverage.projectId, projects.id))
        .leftJoin(tracks, eq(projects.trackId, tracks.id))
        .leftJoin(
          projectResults,
          and(
            eq(projectResults.projectId, projectCoverage.projectId),
            eq(projectResults.normalizationRunId, latestRun.id)
          )
        )
        .where(eq(projectCoverage.normalizationRunId, latestRun.id));

      for (const row of coverageRows) {
        if (row.coverageStatus === 'COMPLETE') coverageSummary.complete++;
        else if (row.coverageStatus === 'UNDER_REVIEWED') coverageSummary.underReviewed++;
        else if (row.coverageStatus === 'UNREVIEWED') coverageSummary.unreviewed++;
        else if (row.coverageStatus === 'OVER_REVIEWED') coverageSummary.overReviewed++;

        if (row.isHighDisagreement) {
          coverageSummary.highDisagreementCount++;
        }

        if (row.isHighDisagreement || row.coverageStatus === 'UNDER_REVIEWED' || row.coverageStatus === 'UNREVIEWED') {
          projectWarnings.push(row);
        }
      }
    }

    // 4. Duplicate Detection Alerts
    const duplicateProjects = await db
      .select({
        id: projects.id,
        sourceId: projects.sourceId,
        title: projects.title,
        teamId: projects.teamId,
        teamName: teams.name,
        repositoryUrl: projects.repositoryUrl,
        duplicateStatus: projects.duplicateStatus,
        duplicateOf: projects.duplicateOf,
      })
      .from(projects)
      .leftJoin(teams, eq(projects.teamId, teams.id))
      .where(
        and(
          eq(projects.eventId, eventRec.id),
          or(
            eq(projects.duplicateStatus, 'SUSPECTED'),
            eq(projects.duplicateStatus, 'CONFIRMED')
          )
        )
      );

    // Fetch original projects for duplicates
    const originalIds = duplicateProjects.map((d: any) => d.duplicateOf).filter(Boolean) as string[];
    let originalProjectsMap = new Map<string, any>();
    if (originalIds.length > 0) {
      const originals = await db
        .select({
          id: projects.id,
          sourceId: projects.sourceId,
          title: projects.title,
          submittedAt: projects.submittedAt,
        })
        .from(projects);
      originalProjectsMap = new Map(originals.map((o: any) => [o.id, o]));
    }

    const duplicatesFormatted = duplicateProjects.map((d: any) => ({
      ...d,
      originalProject: d.duplicateOf ? originalProjectsMap.get(d.duplicateOf) : null,
    }));

    // 5. Normalization Summary
    let normalizationSummary: any = null;
    if (latestRun) {
      const rankedProjects = await db
        .select({
          title: projects.title,
          sourceId: projects.sourceId,
          rawAverage: projectResults.rawAverage,
          normalizedAverage: projectResults.normalizedAverage,
          rawRank: projectResults.rawRank,
          normalizedRank: projectResults.normalizedRank,
          rankShift: projectResults.rankShift,
        })
        .from(projectResults)
        .innerJoin(projects, eq(projectResults.projectId, projects.id))
        .where(eq(projectResults.normalizationRunId, latestRun.id))
        .orderBy(projectResults.normalizedRank);

      if (rankedProjects.length > 0) {
        const rawLeader = [...rankedProjects].sort((a: any, b: any) => a.rawRank - b.rawRank)[0];
        const normalizedLeader = rankedProjects[0];
        const maxShift = rankedProjects.reduce(
          (max: any, p: any) => (Math.abs(p.rankShift) > Math.abs(max.rankShift) ? p : max),
          rankedProjects[0]
        );

        const shifts = rankedProjects.map((p: any) => Math.abs(p.rankShift)).sort((a: any, b: any) => a - b);
        const medianShift = shifts[Math.floor(shifts.length / 2)] || 0;

        normalizationSummary = {
          runId: latestRun.id,
          algorithm: latestRun.algorithm,
          parameters: latestRun.parameters,
          createdAt: latestRun.createdAt,
          rawLeader,
          normalizedLeader,
          largestRankShift: maxShift,
          medianRankShift: medianShift,
        };
      }
    }

    return reply.status(200).send({
      eventId: eventRec.id,
      coverageSummary,
      judgeCalibration,
      projectWarnings,
      duplicates: duplicatesFormatted,
      normalizationSummary,
    });
  });
}
