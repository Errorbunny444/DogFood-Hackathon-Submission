export interface CriterionWeight {
  criterionId: string;
  name?: string;
  weight: number;
}

export interface CriterionScore {
  criterionId: string;
  score: number;
}

/**
 * Validates that criterion weights sum to 1 within numerical tolerance (1e-4).
 */
export function validateRubricWeights(criteria: CriterionWeight[]): {
  valid: boolean;
  sum: number;
  error?: string;
} {
  if (!criteria || criteria.length === 0) {
    return { valid: false, sum: 0, error: 'Rubric must have at least one criterion.' };
  }

  const sum = criteria.reduce((acc, c) => acc + c.weight, 0);
  const isValid = Math.abs(sum - 1.0) < 0.001;

  if (!isValid) {
    return {
      valid: false,
      sum,
      error: `Criterion weights must sum to 1.0 (current sum: ${sum.toFixed(4)}).`,
    };
  }

  return { valid: true, sum };
}

/**
 * Calculates raw review score: R_jp = sum_{c=1}^n w_c * s_{jpc}
 */
export function calculateRawReviewScore(
  scores: CriterionScore[],
  criteria: CriterionWeight[]
): number {
  if (scores.length === 0 || criteria.length === 0) {
    return 0;
  }

  const weightMap = new Map(criteria.map((c) => [c.criterionId, c.weight]));
  let totalScore = 0;
  let totalWeight = 0;

  for (const s of scores) {
    const weight = weightMap.get(s.criterionId);
    if (weight !== undefined) {
      totalScore += s.score * weight;
      totalWeight += weight;
    }
  }

  // If weights don't perfectly equal 1 (e.g. subset evaluated), normalize by total weight
  if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.0001) {
    return totalScore / totalWeight;
  }

  return totalScore;
}
