export interface ProjectDisagreementMetric {
  projectId: string;
  reviewCount: number;
  minScore: number;
  maxScore: number;
  scoreRange: number;
  variance: number;
  standardDeviation: number;
  isHighDisagreement: boolean;
}

export function calculateProjectDisagreement(
  projectId: string,
  scores: number[]
): ProjectDisagreementMetric {
  if (scores.length < 2) {
    const single = scores[0] || 0;
    return {
      projectId,
      reviewCount: scores.length,
      minScore: single,
      maxScore: single,
      scoreRange: 0,
      variance: 0,
      standardDeviation: 0,
      isHighDisagreement: false,
    };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const minScore = sorted[0];
  const maxScore = sorted[sorted.length - 1];
  const scoreRange = maxScore - minScore;

  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const variance =
    sorted.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / sorted.length;
  const standardDeviation = Math.sqrt(variance);

  // High disagreement: range >= 1.5 or stdDev >= 0.75
  const isHighDisagreement = scoreRange >= 1.5 || standardDeviation >= 0.75;

  return {
    projectId,
    reviewCount: scores.length,
    minScore,
    maxScore,
    scoreRange,
    variance,
    standardDeviation,
    isHighDisagreement,
  };
}
