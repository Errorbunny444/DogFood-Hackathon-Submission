# Judging Integrity Engine & Calibration — DOGFOOD 2026

## 1. Executive Summary

Most hackathon software stops at calculating the raw arithmetic mean of submitted scores. In a real-world competitive hackathon with 40+ projects and dozens of volunteer judges, this naive approach fails catastrophically:
- **Harsh vs. Lenient Judges**: A project evaluated by three strict judges will lose to a mediocre project evaluated by three lenient judges.
- **Sparse Review Coverage**: Projects frequently have differing numbers of reviews (e.g., 2 reviews vs. 5 reviews).
- **Constant Scorers**: Some judges score every project identically (e.g., all 3s or all 5s).
- **High Disagreement**: Judges may fundamentally disagree on the quality or feasibility of a project.

The **DOGFOOD Judging Integrity Engine** mathematically solves these biases using **Empirical Bayes shrinkage mean-centering normalization**, statistical calibration, deterministic assignment balancing, and score isolation.

---

## 2. Rubric Scoring Model

Each event defines a weighted rubric $R$. The rubric consists of criteria $c \in \{1, \dots, C\}$ with corresponding non-negative weights $w_c \in (0, 1]$ satisfying:

$$\sum_{c=1}^{C} w_c = 1.0 \quad (\pm 0.001 \text{ numerical tolerance})$$

### 2.1 Raw Review Score
When Judge $j$ scores Project $p$ across criteria $c$ with score $s_{jpc} \in [1, 5]$, the raw weighted score $R_{jp}$ is:

$$R_{jp} = \sum_{c=1}^{C} w_c \cdot s_{jpc}$$

Criterion-level scores and qualitative comments are permanently persisted in `review_scores` and never overwritten by subsequent calculations.

---

## 3. The Assignment Algorithm

Judges are assigned to projects using a **deterministic greedy workload balancing algorithm** (`packages/judging-engine/src/assignment.ts`):

### 3.1 Hard Constraints (Instant Rejection)
1. **Conflict of Interest**: Judge declared a personal or organizational conflict with the project/team.
2. **Duplicate Assignment**: Judge is already assigned to the project.
3. **Hard Capacity Limit**: Judge has reached their maximum assigned project threshold.

### 3.2 Candidate Priority Heuristic
Candidate pairs $(j, p)$ are sorted deterministically by:
1. **Project Under-Coverage**: Projects with fewer assigned reviews are prioritized:
   $$\text{Deficit}_p = \text{TargetReviews} - \text{AssignedReviews}_p$$
2. **Track Expertise**: Judges whose preferred tracks include the project's track receive higher priority.
3. **Judge Workload Balancing**: Judges with fewer current assignments are chosen first.
4. **Deterministic Tie-Breaking**: Lexicographical sort on `(judge_id, project_id)`.

This guarantees that rerunning the auto-assignment produces identical, reproducible assignments.

---

## 4. Normalization Algorithm: Mean-Centering with Shrinkage

Naive Z-score normalization ($Z = \frac{x - \mu}{\sigma}$) is unsuitable for hackathons because:
1. It is mathematically undefined when a judge scores projects identically ($\sigma = 0$, division by zero).
2. It assumes scores follow a normal Gaussian distribution, which fails for small sample sizes ($n_j \le 5$).

Instead, DOGFOOD implements a **Mean-Centering with Empirical Bayes Shrinkage** model.

### 4.1 Step 1: Judge & Population Means
Let $n_j$ be the number of completed reviews by Judge $j$. The judge's sample mean is:

$$\mu_j = \frac{1}{n_j} \sum_{p \in \mathcal{P}_j} R_{jp}$$

Let $N = \sum_j n_j$ be the total completed reviews across all judges. The global population mean is:

$$\mu_g = \frac{1}{N} \sum_{j} \sum_{p \in \mathcal{P}_j} R_{jp}$$

### 4.2 Step 2: Observed Bias
The raw observed bias $b_j$ of Judge $j$ represents their deviation from the overall judge pool:

$$b_j = \mu_j - \mu_g$$

- $b_j > 0$: The judge is systematically more lenient than average.
- $b_j < 0$: The judge is systematically stricter than average.

### 4.3 Step 3: Empirical Bayes Shrinkage
A judge who has completed only $n_j = 2$ reviews may have an observed bias of $+0.8$ simply because they were randomly assigned two outstanding projects. Overcorrecting their scores would unfairly penalize those projects.

We introduce a shrinkage factor $\lambda_j$ based on sample size:

$$\lambda_j = \frac{n_j}{n_j + k}$$

where $k$ is the regularization constant (default $k = 5$).
- When $n_j \to \infty$, $\lambda_j \to 1.0$ (full confidence in bias estimate).
- When $n_j$ is small, $\lambda_j \to 0$ (weak estimate is shrunk toward zero).

### 4.4 Step 4: Adjusted Bias & Normalized Score
The shrinkage-adjusted bias $\hat{b}_j$ is:

$$\hat{b}_j = \lambda_j \cdot b_j = \left( \frac{n_j}{n_j + k} \right) (\mu_j - \mu_g)$$

The normalized review score $N_{jp}$ is obtained by centering and clamping to the valid rubric range $[1.0, 5.0]$:

$$N_{jp} = \text{clamp}(R_{jp} - \hat{b}_j, 1.0, 5.0)$$

### 4.5 Step 5: Final Project Score
The final score $S_p$ for Project $p$ evaluated by $m_p$ judges is:

$$S_p = \frac{1}{m_p} \sum_{j=1}^{m_p} N_{jp}$$

---

## 5. Handling Edge Cases

### 5.1 Constant Scorers ($\sigma = 0$)
In the test fixtures, a judge scores every project with an identical score of $3.00$.
- In our shrinkage mean-centering formula:
  $$\mu_j = 3.00, \quad b_j = 3.00 - \mu_g, \quad \hat{b}_j = \lambda_j b_j$$
  No division by standard deviation occurs. The algorithm remains mathematically sound and robust.
- The Integrity Center calculates sample variance $\sigma_j^2 = 0.0$ and flags the judge as `CONSTANT_SCORER` for organizer inspection.

### 5.2 Unequal Review Coverage
Projects may have differing review counts. The platform computes coverage states:
- `UNREVIEWED`: 0 reviews completed.
- `UNDER_REVIEWED`: $< 3$ reviews (target).
- `COMPLETE`: Exactly target reviews ($\ge 3$).
- `OVER_REVIEWED`: Extra reviews.

The UI displays review counts prominently alongside scores so a score with 2 reviews is never visually equated to a consensus score with 5 reviews.

### 5.3 Judge Disagreement Detection
For each project, the score range is computed:

$$\Delta_p = \max_{j} R_{jp} - \min_{j} R_{jp}$$

If $\Delta_p \ge 1.5$, the project is flagged with `HIGH_DISAGREEMENT` in the Organizer Integrity Center for human review.

---

## 6. Worked Numerical Normalization Proof

### Scenario Setup
- Rubric: Equal weights across criteria. Score range $[1, 5]$.
- Global mean across all completed reviews: $\mu_g = 3.50$.
- Regularization constant: $k = 5$.

### Two Judges
1. **Judge A (Generous Veteran)**:
   - Completed reviews: $n_A = 15$
   - Mean score: $\mu_A = 4.30$
   - Observed bias: $b_A = 4.30 - 3.50 = +0.80$
   - Shrinkage factor:
     $$\lambda_A = \frac{15}{15 + 5} = \frac{15}{20} = 0.75$$
   - Adjusted bias:
     $$\hat{b}_A = 0.75 \times (+0.80) = +0.60$$

2. **Judge B (Harsh Novice)**:
   - Completed reviews: $n_B = 3$
   - Mean score: $\mu_B = 2.70$
   - Observed bias: $b_B = 2.70 - 3.50 = -0.80$
   - Shrinkage factor:
     $$\lambda_B = \frac{3}{3 + 5} = \frac{3}{8} = 0.375$$
   - Adjusted bias:
     $$\hat{b}_B = 0.375 \times (-0.80) = -0.30$$

### Scoring Project X
Suppose Project X is evaluated by both Judge A and Judge B:
- Judge A raw score: $R_{A, X} = 4.50$
- Judge B raw score: $R_{B, X} = 3.20$

**Raw Average**:
$$\bar{R}_X = \frac{4.50 + 3.20}{2} = 3.85$$

**Normalized Calculation**:
- For Judge A:
  $$N_{A, X} = 4.50 - (+0.60) = 3.90$$
- For Judge B:
  $$N_{B, X} = 3.20 - (-0.30) = 3.50$$

**Normalized Project Score**:
$$S_X = \frac{3.90 + 3.50}{2} = 3.70$$

**Interpretation**:
- Judge A's raw 4.5 was deflated by 0.60 because Judge A has a high-confidence generosity bias.
- Judge B's raw 3.2 was inflated by 0.30 because Judge B is strict, but shrunk because Judge B has only 3 reviews.
- The resulting score of **3.70** is an equitable representation of quality adjusted for judge behavior.

---

## 7. Deterministic Tie-Breaking Order

When two projects produce identical normalized average scores ($S_p$), ties are resolved deterministically using this precedence:
1. **Primary**: Highest Normalized Overall Score.
2. **Secondary**: Highest Normalized Functionality / Technical Criterion Score.
3. **Tertiary**: Highest Normalized Innovation Criterion Score.
4. **Quaternary**: Higher Review Coverage Count.
5. **Final**: Lexicographical sort on Project ID (deterministic fallback).
