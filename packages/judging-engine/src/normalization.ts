import { RawReviewItem, calculateJudgeStatistics, JudgeStatResult } from './statistics.js';

export interface NormalizedReviewResult {
  reviewId: string;
  judgeUserId: string;
  projectId: string;
  rawScore: number;
  judgeMean: number;
  globalMean: number;
  observedBias: number;
  shrinkageFactor: number;
  adjustedBias: number;
  normalizedScore: number;
}

export interface ProjectScoreResult {
  projectId: string;
  rawAverage: number;
  normalizedAverage: number;
  reviewCount: number;
  rawRank: number;
  normalizedRank: number;
  rankShift: number;
}

export interface NormalizationRunOutput {
  globalMean: number;
  shrinkageK: number;
  judgeStats: Map<string, JudgeStatResult>;
  normalizedReviews: NormalizedReviewResult[];
  projectScores: Map<string, ProjectScoreResult>;
}

/**
 * Normalizes judge reviews using mean-centering with shrinkage.
 *
 * S_p = 1/m sum_{j=1}^m N_{jp}
 * where N_{jp} = clamp(R_{jp} - hat{b}_j, 1, 5)
 * hat{b}_j = lambda_j * (mu_j - mu_g)
 * lambda_j = n_j / (n_j + k)
 */
export function runJudgingNormalization(
  reviews: RawReviewItem[],
  projectIds: string[],
  shrinkageK: number = 5,
  minClamp: number = 1.0,
  maxClamp: number = 5.0,
  assignedCounts: Map<string, number> = new Map()
): NormalizationRunOutput {
  if (reviews.length === 0) {
    const emptyJudgeStats = new Map<string, JudgeStatResult>();
    const emptyProjects = new Map<string, ProjectScoreResult>();
    for (const pid of projectIds) {
      emptyProjects.set(pid, {
        projectId: pid,
        rawAverage: 0,
        normalizedAverage: 0,
        reviewCount: 0,
        rawRank: 0,
        normalizedRank: 0,
        rankShift: 0,
      });
    }
    return {
      globalMean: 0,
      shrinkageK,
      judgeStats: emptyJudgeStats,
      normalizedReviews: [],
      projectScores: emptyProjects,
    };
  }

  // 1. Calculate global mean mu_g across all completed reviews
  const totalRawSum = reviews.reduce((acc, r) => acc + r.rawScore, 0);
  const globalMean = totalRawSum / reviews.length;

  // 2. Calculate judge statistics and shrinkage
  const judgeStats = calculateJudgeStatistics(
    reviews,
    globalMean,
    shrinkageK,
    assignedCounts
  );

  // 3. Calculate normalized review scores
  const normalizedReviews: NormalizedReviewResult[] = [];
  const projectReviewsMap = new Map<
    string,
    { raw: number[]; norm: number[] }
  >();

  for (const pid of projectIds) {
    projectReviewsMap.set(pid, { raw: [], norm: [] });
  }

  for (const r of reviews) {
    const stats = judgeStats.get(r.judgeUserId);
    const judgeMean = stats ? stats.mean : globalMean;
    const observedBias = stats ? stats.observedBias : 0;
    const shrinkageFactor = stats ? stats.shrinkageFactor : 0;
    const adjustedBias = stats ? stats.adjustedBias : 0;

    // N_{jp} = clamp(R_{jp} - \hat{b}_j)
    const rawVal = r.rawScore;
    const unconstrainedNorm = rawVal - adjustedBias;
    const normalizedScore = Math.min(maxClamp, Math.max(minClamp, unconstrainedNorm));

    normalizedReviews.push({
      reviewId: r.reviewId,
      judgeUserId: r.judgeUserId,
      projectId: r.projectId,
      rawScore: rawVal,
      judgeMean,
      globalMean,
      observedBias,
      shrinkageFactor,
      adjustedBias,
      normalizedScore,
    });

    const projData = projectReviewsMap.get(r.projectId) || { raw: [], norm: [] };
    projData.raw.push(rawVal);
    projData.norm.push(normalizedScore);
    projectReviewsMap.set(r.projectId, projData);
  }

  // 4. Calculate project averages
  const projectScores = new Map<string, ProjectScoreResult>();
  const rawList: { id: string; avg: number }[] = [];
  const normList: { id: string; avg: number }[] = [];

  for (const [pid, data] of projectReviewsMap.entries()) {
    const m = data.raw.length;
    const rawAverage = m > 0 ? data.raw.reduce((a, b) => a + b, 0) / m : 0;
    const normalizedAverage = m > 0 ? data.norm.reduce((a, b) => a + b, 0) / m : 0;

    rawList.push({ id: pid, avg: rawAverage });
    normList.push({ id: pid, avg: normalizedAverage });

    projectScores.set(pid, {
      projectId: pid,
      rawAverage,
      normalizedAverage,
      reviewCount: m,
      rawRank: 0,
      normalizedRank: 0,
      rankShift: 0,
    });
  }

  // Sort and assign ranks (higher score = lower rank number, rank 1 is highest)
  rawList.sort((a, b) => b.avg - a.avg || a.id.localeCompare(b.id));
  normList.sort((a, b) => b.avg - a.avg || a.id.localeCompare(b.id));

  for (let i = 0; i < rawList.length; i++) {
    const item = projectScores.get(rawList[i].id);
    if (item) item.rawRank = i + 1;
  }

  for (let i = 0; i < normList.length; i++) {
    const item = projectScores.get(normList[i].id);
    if (item) {
      item.normalizedRank = i + 1;
      // rankShift: positive means improved rank (e.g. was 7, now 3 -> shift +4)
      item.rankShift = item.rawRank - item.normalizedRank;
    }
  }

  return {
    globalMean,
    shrinkageK,
    judgeStats,
    normalizedReviews,
    projectScores,
  };
}
