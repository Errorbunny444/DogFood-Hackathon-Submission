export interface RawReviewItem {
  reviewId: string;
  judgeUserId: string;
  projectId: string;
  rawScore: number;
}

export interface JudgeStatResult {
  judgeUserId: string;
  reviewCount: number;
  assignedCount: number;
  completionRate: number;
  mean: number;
  median: number;
  variance: number;
  standardDeviation: number;
  min: number;
  max: number;
  observedBias: number;
  adjustedBias: number;
  shrinkageFactor: number;
  flags: string[];
}

/**
 * Calculates mathematical and behavioral statistics for each judge.
 */
export function calculateJudgeStatistics(
  reviews: RawReviewItem[],
  globalMean: number,
  shrinkageK: number = 5,
  assignedCounts: Map<string, number> = new Map()
): Map<string, JudgeStatResult> {
  const reviewsByJudge = new Map<string, RawReviewItem[]>();

  for (const r of reviews) {
    const list = reviewsByJudge.get(r.judgeUserId) || [];
    list.push(r);
    reviewsByJudge.set(r.judgeUserId, list);
  }

  // Also include judges who were assigned but have 0 completed reviews
  for (const [judgeId, count] of assignedCounts.entries()) {
    if (!reviewsByJudge.has(judgeId)) {
      reviewsByJudge.set(judgeId, []);
    }
  }

  const results = new Map<string, JudgeStatResult>();

  for (const [judgeId, judgeReviews] of reviewsByJudge.entries()) {
    const n = judgeReviews.length;
    const scores = judgeReviews.map((r) => r.rawScore).sort((a, b) => a - b);
    const assigned = assignedCounts.get(judgeId) || n;
    const completionRate = assigned > 0 ? n / assigned : 1.0;

    if (n === 0) {
      results.set(judgeId, {
        judgeUserId: judgeId,
        reviewCount: 0,
        assignedCount: assigned,
        completionRate: 0,
        mean: globalMean,
        median: globalMean,
        variance: 0,
        standardDeviation: 0,
        min: 0,
        max: 0,
        observedBias: 0,
        adjustedBias: 0,
        shrinkageFactor: 0,
        flags: ['LOW_COMPLETION'],
      });
      continue;
    }

    const sum = scores.reduce((acc, s) => acc + s, 0);
    const mean = sum / n;

    // Median
    const mid = Math.floor(n / 2);
    const median = n % 2 === 0 ? (scores[mid - 1] + scores[mid]) / 2 : scores[mid];

    // Variance (population variance)
    const variance =
      scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    const min = scores[0];
    const max = scores[n - 1];

    const observedBias = mean - globalMean;
    const shrinkageFactor = n / (n + shrinkageK);
    const adjustedBias = shrinkageFactor * observedBias;

    const flags: string[] = [];

    // Constant scorer check: variance is 0 (or all scores identical)
    if (variance < 0.00001) {
      flags.push('CONSTANT_SCORER');
    } else if (standardDeviation < 0.25 && n >= 3) {
      flags.push('LOW_VARIANCE');
    }

    if (Math.abs(observedBias) > 0.75) {
      flags.push('HIGH_BIAS');
    }

    if (Math.abs(observedBias) > 1.25) {
      flags.push('POSSIBLE_OUTLIER');
    }

    if (completionRate < 0.75 && assigned >= 3) {
      flags.push('LOW_COMPLETION');
    }

    results.set(judgeId, {
      judgeUserId: judgeId,
      reviewCount: n,
      assignedCount: assigned,
      completionRate,
      mean,
      median,
      variance,
      standardDeviation,
      min,
      max,
      observedBias,
      adjustedBias,
      shrinkageFactor,
      flags,
    });
  }

  return results;
}
