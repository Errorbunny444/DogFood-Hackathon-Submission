export interface RankableProject {
  projectId: string;
  normalizedAverage: number;
  rawAverage: number;
  reviewCount: number;
  functionalityScore?: number;
  innovationScore?: number;
  submittedAt?: string;
}

export interface RankedProjectResult extends RankableProject {
  rank: number;
  rawRank: number;
  rankShift: number;
  isTied: boolean;
  tieReason?: string;
}

/**
 * Deterministically ranks projects with comprehensive multi-level tie-breaking.
 */
export function rankProjects(
  projects: RankableProject[],
  rawAverages: Map<string, number> = new Map()
): RankedProjectResult[] {
  // Sort with tie-breaking
  const sorted = [...projects].sort((a, b) => {
    // 1. Normalized overall score (descending)
    const scoreDiff = b.normalizedAverage - a.normalizedAverage;
    if (Math.abs(scoreDiff) > 0.0001) {
      return scoreDiff;
    }

    // 2. Functionality / Technical score if available (descending)
    if (
      a.functionalityScore !== undefined &&
      b.functionalityScore !== undefined &&
      Math.abs(b.functionalityScore - a.functionalityScore) > 0.0001
    ) {
      return b.functionalityScore - a.functionalityScore;
    }

    // 3. Innovation score if available (descending)
    if (
      a.innovationScore !== undefined &&
      b.innovationScore !== undefined &&
      Math.abs(b.innovationScore - a.innovationScore) > 0.0001
    ) {
      return b.innovationScore - a.innovationScore;
    }

    // 4. Review coverage / review count (descending)
    if (b.reviewCount !== a.reviewCount) {
      return b.reviewCount - a.reviewCount;
    }

    // 5. Earlier submission date if available
    if (a.submittedAt && b.submittedAt && a.submittedAt !== b.submittedAt) {
      return a.submittedAt.localeCompare(b.submittedAt);
    }

    // 6. Deterministic tie-break by project ID
    return a.projectId.localeCompare(b.projectId);
  });

  // Calculate raw ranks for comparison
  const rawSorted = [...projects].sort((a, b) => {
    const rawA = rawAverages.get(a.projectId) ?? a.rawAverage;
    const rawB = rawAverages.get(b.projectId) ?? b.rawAverage;
    return rawB - rawA || a.projectId.localeCompare(b.projectId);
  });
  const rawRankMap = new Map<string, number>();
  rawSorted.forEach((p, idx) => rawRankMap.set(p.projectId, idx + 1));

  const results: RankedProjectResult[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = sorted[i - 1];
    const next = sorted[i + 1];

    const rawRank = rawRankMap.get(current.projectId) ?? i + 1;
    const normRank = i + 1;

    let isTied = false;
    let tieReason: string | undefined;

    if (
      (prev && Math.abs(prev.normalizedAverage - current.normalizedAverage) < 0.0001) ||
      (next && Math.abs(next.normalizedAverage - current.normalizedAverage) < 0.0001)
    ) {
      isTied = true;
      tieReason = 'Identical normalized score broke by secondary criteria';
    }

    results.push({
      ...current,
      rank: normRank,
      rawRank,
      rankShift: rawRank - normRank,
      isTied,
      tieReason,
    });
  }

  return results;
}
