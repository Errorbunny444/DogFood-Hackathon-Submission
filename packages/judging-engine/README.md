# @dogfood/judging-engine

> Pure mathematical and statistical calibration engine for hackathon judging, rubric score normalization, and reproducible rankings.

Part of the **DOGFOOD 2026** Open-Source Hackathon Platform.

Zero database, framework, or UI dependencies. Inputs are plain typed objects; outputs are deterministic typed results.

---

## Features & Modules

1. **`weighted-score`**: Criterion score calculation with linear rubric weightings and percentage normalization.
2. **`statistics`**: Sample mean, median, sample variance, standard deviation, and anomaly flag detection (e.g. constant scorer, high harshness, high leniency).
3. **`normalization`**: Empirical Bayes shrinkage mean-centering algorithm ($\lambda_j = \frac{n_j}{n_j + m}$) eliminating judge severity biases without distorting small sample sizes.
4. **`coverage`**: Project review coverage calculation, target ratio validation, and under-reviewed flag detection.
5. **`disagreement`**: Multi-judge inter-rater disagreement detection identifying projects with high variance across criteria.
6. **`ranking`**: Deterministic sorting with rank shift computation and tie resolution rules.
7. **`pairwise`**: Bradley-Terry probabilistic maximum likelihood ranking model for head-to-head project comparisons.
8. **`assignment`**: Load-balanced judge-to-project allocation engine with conflict of interest avoidance and track preference optimization.

---

## Installation

```bash
pnpm add @dogfood/judging-engine
# or
npm install @dogfood/judging-engine
```

---

## Quick Example

```typescript
import {
  calculateWeightedReviewScore,
  normalizeReviews,
  rankProjects,
  rankPairwiseProjects
} from '@dogfood/judging-engine';

// 1. Calculate weighted score for a review
const score = calculateWeightedReviewScore([
  { score: 4.5, weight: 0.4 },
  { score: 5.0, weight: 0.3 },
  { score: 3.5, weight: 0.3 },
]);

// 2. Normalize reviews across judges with Empirical Bayes shrinkage
const result = normalizeReviews(rawReviews, {
  shrinkageM: 5,
  minReviewCount: 1,
});

console.log(result.projectResults);
```

---

## License

MIT © DOGFOOD Contributors
