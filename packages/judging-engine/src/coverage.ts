export type CoverageStatus =
  | 'UNREVIEWED'
  | 'UNDER_REVIEWED'
  | 'COMPLETE'
  | 'OVER_REVIEWED';

export interface ProjectCoverageMetric {
  projectId: string;
  actualReviews: number;
  targetReviews: number;
  coverageRatio: number;
  coverageStatus: CoverageStatus;
}

export function calculateProjectCoverage(
  actualReviews: number,
  targetReviews: number = 3
): {
  coverageRatio: number;
  coverageStatus: CoverageStatus;
} {
  const coverageRatio = targetReviews > 0 ? actualReviews / targetReviews : 1.0;

  let coverageStatus: CoverageStatus;
  if (actualReviews === 0) {
    coverageStatus = 'UNREVIEWED';
  } else if (actualReviews < targetReviews) {
    coverageStatus = 'UNDER_REVIEWED';
  } else if (actualReviews === targetReviews) {
    coverageStatus = 'COMPLETE';
  } else {
    coverageStatus = 'OVER_REVIEWED';
  }

  return { coverageRatio, coverageStatus };
}
