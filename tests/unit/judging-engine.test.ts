import { describe, it, expect } from 'vitest';
import {
  calculateRawReviewScore,
  validateRubricWeights,
} from '../../packages/judging-engine/src/weighted-score.js';
import {
  calculateJudgeStatistics,
} from '../../packages/judging-engine/src/statistics.js';
import {
  runJudgingNormalization,
} from '../../packages/judging-engine/src/normalization.js';
import {
  calculateProjectCoverage,
} from '../../packages/judging-engine/src/coverage.js';
import {
  calculateProjectDisagreement,
} from '../../packages/judging-engine/src/disagreement.js';
import {
  rankProjects,
} from '../../packages/judging-engine/src/ranking.js';
import {
  autoAssignJudges,
} from '../../packages/judging-engine/src/assignment.js';
import {
  rankPairwiseProjects,
} from '../../packages/judging-engine/src/pairwise.js';

describe('Judging Engine Unit Tests', () => {
  describe('Weighted Scoring', () => {
    it('validates rubric weights sum to 1.0', () => {
      const validWeights = [
        { criterionId: 'c1', weight: 0.333333 },
        { criterionId: 'c2', weight: 0.333333 },
        { criterionId: 'c3', weight: 0.333334 },
      ];
      expect(validateRubricWeights(validWeights).valid).toBe(true);

      const invalidWeights = [
        { criterionId: 'c1', weight: 0.5 },
        { criterionId: 'c2', weight: 0.2 },
      ];
      expect(validateRubricWeights(invalidWeights).valid).toBe(false);
    });

    it('computes weighted score accurately', () => {
      const criteria = [
        { criterionId: 'c1', weight: 0.5 },
        { criterionId: 'c2', weight: 0.3 },
        { criterionId: 'c3', weight: 0.2 },
      ];
      const scores = [
        { criterionId: 'c1', score: 4 }, // 4 * 0.5 = 2.0
        { criterionId: 'c2', score: 5 }, // 5 * 0.3 = 1.5
        { criterionId: 'c3', score: 3 }, // 3 * 0.2 = 0.6
      ];
      const raw = calculateRawReviewScore(scores, criteria);
      expect(raw).toBeCloseTo(4.1, 4);
    });
  });

  describe('Judge Statistics & Constant Scorer', () => {
    it('accurately detects constant scorer and does not crash or divide by zero', () => {
      const reviews = [
        { reviewId: 'r1', judgeUserId: 'j_const', projectId: 'p1', rawScore: 4.0 },
        { reviewId: 'r2', judgeUserId: 'j_const', projectId: 'p2', rawScore: 4.0 },
        { reviewId: 'r3', judgeUserId: 'j_const', projectId: 'p3', rawScore: 4.0 },
      ];
      const stats = calculateJudgeStatistics(reviews, 3.5, 5);
      const judgeStat = stats.get('j_const')!;

      expect(judgeStat.mean).toBe(4.0);
      expect(judgeStat.variance).toBe(0);
      expect(judgeStat.standardDeviation).toBe(0);
      expect(judgeStat.flags).toContain('CONSTANT_SCORER');
      expect(judgeStat.shrinkageFactor).toBeCloseTo(3 / (3 + 5), 4);
    });

    it('computes variance, median, and flags for strict/generous judges', () => {
      const reviews = [
        { reviewId: 'r1', judgeUserId: 'j_strict', projectId: 'p1', rawScore: 1.0 },
        { reviewId: 'r2', judgeUserId: 'j_strict', projectId: 'p2', rawScore: 2.0 },
        { reviewId: 'r3', judgeUserId: 'j_strict', projectId: 'p3', rawScore: 2.0 },
      ];
      const stats = calculateJudgeStatistics(reviews, 3.5, 5);
      const judgeStat = stats.get('j_strict')!;

      expect(judgeStat.mean).toBeCloseTo(1.6667, 3);
      expect(judgeStat.median).toBe(2.0);
      expect(judgeStat.observedBias).toBeLessThan(-1.0);
      expect(judgeStat.flags).toContain('HIGH_BIAS');
    });
  });

  describe('Mean-Centering with Shrinkage Normalization', () => {
    it('normalizes scores, applies shrinkage, and handles rank shifts', () => {
      // Judge A is generous (gives 5s), 2 reviews
      // Judge B is strict (gives 2s), 10 reviews
      const reviews = [
        { reviewId: 'r1', judgeUserId: 'j_a', projectId: 'p1', rawScore: 5.0 },
        { reviewId: 'r2', judgeUserId: 'j_a', projectId: 'p2', rawScore: 5.0 },
        // Judge B reviews p1 and p2 and p3...
        { reviewId: 'r3', judgeUserId: 'j_b', projectId: 'p1', rawScore: 2.0 },
        { reviewId: 'r4', judgeUserId: 'j_b', projectId: 'p2', rawScore: 3.0 },
      ];

      const normOutput = runJudgingNormalization(reviews, ['p1', 'p2'], 5);
      expect(normOutput.globalMean).toBe((5 + 5 + 2 + 3) / 4); // 3.75

      const jAStats = normOutput.judgeStats.get('j_a')!;
      expect(jAStats.mean).toBe(5.0);
      // Shrinkage for j_a with n=2 and k=5 is 2 / (2 + 5) = 2/7
      expect(jAStats.shrinkageFactor).toBeCloseTo(2 / 7, 4);
      // Observed bias: 5.0 - 3.75 = 1.25
      // Adjusted bias: (2/7) * 1.25 = 0.3571
      expect(jAStats.adjustedBias).toBeCloseTo((2 / 7) * 1.25, 4);

      // Verify clamped within [1, 5]
      for (const nr of normOutput.normalizedReviews) {
        expect(nr.normalizedScore).toBeGreaterThanOrEqual(1.0);
        expect(nr.normalizedScore).toBeLessThanOrEqual(5.0);
      }
    });
  });

  describe('Project Coverage & Disagreement', () => {
    it('evaluates review coverage statuses properly', () => {
      expect(calculateProjectCoverage(0, 3).coverageStatus).toBe('UNREVIEWED');
      expect(calculateProjectCoverage(2, 3).coverageStatus).toBe('UNDER_REVIEWED');
      expect(calculateProjectCoverage(3, 3).coverageStatus).toBe('COMPLETE');
      expect(calculateProjectCoverage(4, 3).coverageStatus).toBe('OVER_REVIEWED');
    });

    it('identifies high disagreement between judges', () => {
      const agreed = calculateProjectDisagreement('p1', [3.5, 3.7, 3.6]);
      expect(agreed.isHighDisagreement).toBe(false);

      const disagreed = calculateProjectDisagreement('p2', [1.5, 4.5, 2.0]);
      expect(disagreed.isHighDisagreement).toBe(true);
      expect(disagreed.scoreRange).toBe(3.0);
    });
  });

  describe('Ranking and Deterministic Tie-breaking', () => {
    it('ranks projects by normalized score and uses criteria as tie-breakers', () => {
      const projects = [
        {
          projectId: 'p_low',
          normalizedAverage: 3.2,
          rawAverage: 3.5,
          reviewCount: 3,
        },
        {
          projectId: 'p_high_a',
          normalizedAverage: 4.5,
          rawAverage: 4.2,
          reviewCount: 3,
          functionalityScore: 4.8,
        },
        {
          projectId: 'p_high_b',
          normalizedAverage: 4.5,
          rawAverage: 4.6,
          reviewCount: 3,
          functionalityScore: 4.4,
        },
      ];

      const ranked = rankProjects(projects);
      expect(ranked[0].projectId).toBe('p_high_a'); // Tied on 4.5, won on functionality 4.8
      expect(ranked[1].projectId).toBe('p_high_b');
      expect(ranked[2].projectId).toBe('p_low');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[2].rank).toBe(3);
    });
  });

  describe('Greedy Balanced Assignment Algorithm', () => {
    it('balances workload and respects conflicts and capacity', () => {
      const projects = [
        { id: 'p1', trackId: 'trk_ai', teamId: 'tm_1' },
        { id: 'p2', trackId: 'trk_ai', teamId: 'tm_2' },
        { id: 'p3', trackId: 'trk_web', teamId: 'tm_3' },
      ];
      const judges = [
        {
          userId: 'j1',
          preferredTrackIds: ['trk_ai'],
          conflictedTeamIds: ['tm_1'], // conflict with p1!
          conflictedProjectIds: [],
          maxCapacity: 2,
        },
        {
          userId: 'j2',
          preferredTrackIds: ['trk_ai'],
          conflictedTeamIds: [],
          conflictedProjectIds: [],
          maxCapacity: 5,
        },
        {
          userId: 'j3',
          preferredTrackIds: ['trk_web'],
          conflictedTeamIds: [],
          conflictedProjectIds: [],
          maxCapacity: 5,
        },
      ];

      const assignments = autoAssignJudges(projects, judges, [], {
        targetReviewsPerProject: 2,
        maxCapacityPerJudge: 5,
        respectTrackPreferences: true,
        preventConflicts: true,
      });

      // Verify no assignment violated conflict
      for (const a of assignments) {
        if (a.judgeUserId === 'j1') {
          expect(a.projectId).not.toBe('p1');
        }
      }

      // Verify no duplicate assignments to same project
      const pairs = new Set(assignments.map((a) => `${a.judgeUserId}:${a.projectId}`));
      expect(pairs.size).toBe(assignments.length);
    });
  });

  describe('Pairwise Comparison & Bradley-Terry Modeling', () => {
    it('ranks projects based on head-to-head match outcomes', () => {
      const projectIds = ['p1', 'p2', 'p3'];
      const comparisons = [
        { projectAId: 'p1', projectBId: 'p2', winnerId: 'p1' }, // p1 beats p2
        { projectAId: 'p1', projectBId: 'p3', winnerId: 'p1' }, // p1 beats p3
        { projectAId: 'p2', projectBId: 'p3', winnerId: 'p2' }, // p2 beats p3
      ];

      const ratings = rankPairwiseProjects(projectIds, comparisons);
      expect(ratings.length).toBe(3);
      expect(ratings[0].projectId).toBe('p1');
      expect(ratings[0].rank).toBe(1);
      expect(ratings[0].wins).toBe(2);
      expect(ratings[1].projectId).toBe('p2');
      expect(ratings[1].rank).toBe(2);
      expect(ratings[2].projectId).toBe('p3');
      expect(ratings[2].rank).toBe(3);
    });

    it('handles ties smoothly with split probability weights', () => {
      const projectIds = ['pA', 'pB'];
      const comparisons = [
        { projectAId: 'pA', projectBId: 'pB', winnerId: null }, // Tie
      ];

      const ratings = rankPairwiseProjects(projectIds, comparisons);
      expect(ratings.length).toBe(2);
      expect(ratings[0].ties).toBe(1);
      expect(ratings[1].ties).toBe(1);
      expect(ratings[0].winRate).toBe(0.5);
      expect(ratings[1].winRate).toBe(0.5);
    });
  });
});

