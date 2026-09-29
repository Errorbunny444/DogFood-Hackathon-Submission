/**
 * Pairwise Comparison & Bradley-Terry Ranking Engine
 * Provides pure mathematical models for pairwise project evaluations.
 */

export interface PairwiseComparison {
  projectAId: string;
  projectBId: string;
  winnerId: string | null; // null represents a tie
  weight?: number;
}

export interface PairwiseProjectRating {
  projectId: string;
  wins: number;
  losses: number;
  ties: number;
  totalComparisons: number;
  winRate: number;
  bradleyTerryScore: number;
  rank: number;
}

/**
 * Computes Bradley-Terry maximum likelihood ratings using iterative convergence.
 * Bradley-Terry model: P(i beats j) = gamma_i / (gamma_i + gamma_j)
 */
export function computeBradleyTerryRatings(
  projectIds: string[],
  comparisons: PairwiseComparison[],
  options: { maxIterations?: number; tolerance?: number } = {}
): Map<string, number> {
  const maxIterations = options.maxIterations || 100;
  const tolerance = options.tolerance || 1e-6;

  const n = projectIds.length;
  if (n === 0) return new Map();

  // Initialize gamma parameters equally
  const gamma = new Map<string, number>();
  for (const id of projectIds) {
    gamma.set(id, 1.0);
  }

  // Pre-aggregate wins and head-to-head match counts
  const wins = new Map<string, number>();
  const matches = new Map<string, Map<string, number>>();

  for (const id of projectIds) {
    wins.set(id, 0.5); // Add small Laplace smoothing to prevent division by zero
    matches.set(id, new Map());
  }

  for (const comp of comparisons) {
    const w = comp.weight || 1.0;
    const { projectAId: a, projectBId: b, winnerId } = comp;

    if (!gamma.has(a) || !gamma.has(b)) continue;

    const aMatches = matches.get(a)!;
    aMatches.set(b, (aMatches.get(b) || 0) + w);

    const bMatches = matches.get(b)!;
    bMatches.set(a, (bMatches.get(a) || 0) + w);

    if (winnerId === a) {
      wins.set(a, wins.get(a)! + w);
    } else if (winnerId === b) {
      wins.set(b, wins.get(b)! + w);
    } else {
      // Tie: split win weight
      wins.set(a, wins.get(a)! + w * 0.5);
      wins.set(b, wins.get(b)! + w * 0.5);
    }
  }

  // Iterative MM algorithm
  for (let iter = 0; iter < maxIterations; iter++) {
    const nextGamma = new Map<string, number>();
    let maxDelta = 0;

    for (const i of projectIds) {
      const wI = wins.get(i)!;
      let denominator = 0;
      const iMatches = matches.get(i)!;

      for (const [j, nIJ] of iMatches.entries()) {
        const sumGamma = gamma.get(i)! + gamma.get(j)!;
        if (sumGamma > 0) {
          denominator += nIJ / sumGamma;
        }
      }

      const updated = denominator > 0 ? wI / denominator : gamma.get(i)!;
      nextGamma.set(i, updated);
    }

    // Normalize so geometric mean or sum = 1
    const sumNext = Array.from(nextGamma.values()).reduce((sum, v) => sum + v, 0);
    for (const [id, val] of nextGamma.entries()) {
      const normalized = (val / sumNext) * n;
      const delta = Math.abs(normalized - gamma.get(id)!);
      if (delta > maxDelta) maxDelta = delta;
      gamma.set(id, normalized);
    }

    if (maxDelta < tolerance) {
      break;
    }
  }

  return gamma;
}

/**
 * Evaluates pairwise comparisons and ranks all projects deterministically.
 */
export function rankPairwiseProjects(
  projectIds: string[],
  comparisons: PairwiseComparison[]
): PairwiseProjectRating[] {
  const stats = new Map<string, { wins: number; losses: number; ties: number; total: number }>();

  for (const id of projectIds) {
    stats.set(id, { wins: 0, losses: 0, ties: 0, total: 0 });
  }

  for (const comp of comparisons) {
    const { projectAId: a, projectBId: b, winnerId } = comp;
    if (stats.has(a) && stats.has(b)) {
      stats.get(a)!.total++;
      stats.get(b)!.total++;

      if (winnerId === a) {
        stats.get(a)!.wins++;
        stats.get(b)!.losses++;
      } else if (winnerId === b) {
        stats.get(b)!.wins++;
        stats.get(a)!.losses++;
      } else {
        stats.get(a)!.ties++;
        stats.get(b)!.ties++;
      }
    }
  }

  const btRatings = computeBradleyTerryRatings(projectIds, comparisons);

  const ratings: PairwiseProjectRating[] = projectIds.map((projectId) => {
    const s = stats.get(projectId)!;
    const winRate = s.total > 0 ? (s.wins + 0.5 * s.ties) / s.total : 0;
    const btScore = Math.round((btRatings.get(projectId) || 1.0) * 1000) / 1000;

    return {
      projectId,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      totalComparisons: s.total,
      winRate: Math.round(winRate * 1000) / 1000,
      bradleyTerryScore: btScore,
      rank: 0,
    };
  });

  // Sort by Bradley-Terry score descending, break ties with winRate and wins
  ratings.sort((a, b) => {
    if (b.bradleyTerryScore !== a.bradleyTerryScore) {
      return b.bradleyTerryScore - a.bradleyTerryScore;
    }
    if (b.winRate !== a.winRate) {
      return b.winRate - a.winRate;
    }
    return b.wins - a.wins;
  });

  ratings.forEach((item, index) => {
    item.rank = index + 1;
  });

  return ratings;
}
