# REST API Reference — DOGFOOD 2026

Base URL:
```text
http://localhost:8080/api/v1
```

Interactive OpenAPI documentation is available at:
```text
http://localhost:8080/api/v1/docs
```

---

## 1. Authentication & Session Headers

Authentication uses server-side sessions via HttpOnly cookies:
```http
Cookie: session=<session_token>
```

For non-interactive API access and automated testing, deterministic session tokens are available:
- **Organizer**: `Cookie: session=dogfood_org_session_token_2026`
- **Judge A**: `Cookie: session=dogfood_judge_a_session_token_2026`
- **Judge B**: `Cookie: session=dogfood_judge_b_session_token_2026`
- **Participant**: `Cookie: session=dogfood_participant_session_token_2026`

---

## 2. Standard Error Envelope

All non-2xx responses return a consistent error envelope:
```json
{
  "error": {
    "code": "SUBMISSION_DEADLINE_PASSED",
    "message": "The submission deadline has passed. Submissions are closed.",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "details": null
  }
}
```

---

## 3. Endpoints

### 3.1 Authentication
#### `POST /auth/login`
- **Body**: `{ "email": "user@example.com", "password": "password" }`
- **Returns**: `200 OK` + `Set-Cookie: session=...`

#### `POST /auth/logout`
- **Returns**: `200 OK` (clears cookie)

#### `GET /auth/me`
- **Returns**: `200 OK` with user profile and event-scoped roles.

---

### 3.2 Public Endpoints
#### `GET /public/projects`
- **Access**: Public
- **Description**: Returns all projects for the active event. Used by acceptance checkers and gallery views.
- **Returns**: Array of project objects:
  ```json
  [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "sourceId": "prj_01",
      "title": "Glass Signal",
      "tagline": "Real-time edge telemetry aggregation",
      "summary": "...",
      "repositoryUrl": "https://github.com/sample/glass-signal",
      "demoUrl": "https://glass-signal.example.com",
      "trackName": "Developer Tools",
      "teamName": "Team Echo"
    }
  ]
  ```

---

### 3.3 Projects & Submissions
#### `POST /events/:eventId/projects`
- **Access**: Participant / Team Member
- **Description**: Submits a new project for an event.
- **Behavior**: Strictly checks `event.submission_deadline`. If current time is past the deadline, returns `409 Conflict` with `SUBMISSION_DEADLINE_PASSED`.

#### `PATCH /projects/:projectId`
- **Access**: Project Owner (before deadline)
- **Description**: Updates project fields. Rejects with `409 Conflict` if deadline has passed.

#### `POST /projects/:projectId/submit`
- **Access**: Project Owner (before deadline)
- **Description**: Finalizes project state to `SUBMITTED`.

---

### 3.4 Judging & Score Isolation
#### `GET /judges/:judgeId/scores`
- **Access**:
  - `ADMIN` -> `200 OK`
  - Event `ORGANIZER` -> `200 OK`
  - Authenticated Judge requesting their own `:judgeId` -> `200 OK`
  - Judge requesting another judge's scores -> `403 Forbidden`
  - Participant requesting scores -> `403 Forbidden`
- **Description**: Returns the scores submitted by the specified judge. Crucial for judge isolation.

#### `GET /judge/assignments`
- **Access**: Judge
- **Description**: Returns the list of projects assigned to the calling judge for evaluation.

#### `GET /judge/reviews/:reviewId`
- **Access**: Assigned Judge or Organizer
- **Description**: Fetches review draft and criterion scores.

#### `PUT /judge/reviews/:reviewId`
- **Access**: Assigned Judge
- **Description**: Autosaves draft scores and qualitative comments.

#### `POST /judge/reviews/:reviewId/submit`
- **Access**: Assigned Judge
- **Description**: Submits the final review, computing weighted score $R_{jp}$.

---

### 3.5 Organizer Integrity Center
#### `GET /events/:eventId/judging/integrity`
- **Access**: Organizer / Admin
- **Description**: Returns the complete integrity status:
  - Overall coverage percentage
  - Projects completed vs. under-reviewed vs. unreviewed
  - Judge calibration matrix (means, variances, biases, `CONSTANT_SCORER` flags)
  - Projects with high disagreement ($\Delta \ge 1.5$)
  - Suspected duplicate submissions

#### `POST /events/:eventId/judging/auto-assign`
- **Access**: Organizer
- **Description**: Executes the deterministic greedy workload balancing algorithm to assign judges to projects.

---

### 3.6 Normalization & Results
#### `POST /events/:eventId/normalization/runs`
- **Access**: Organizer
- **Description**: Executes a transactional normalization run using Empirical Bayes shrinkage mean-centering.

#### `GET /events/:eventId/results`
- **Access**: Public (if published) or Organizer (draft preview)
- **Description**: Returns ranked leaderboard with both raw and normalized scores, review counts, and rank shift indicators ($\Delta$).

#### `POST /events/:eventId/results/publish`
- **Access**: Organizer
- **Description**: Toggles official publication state of results to the public.

---

### 3.7 Community Voting
#### `GET /events/:eventId/ballot`
- **Access**: Public
- **Description**: Returns candidate projects in a deterministic seeded shuffle order based on voter hash and event ID. Preserves identical order across refreshes.

#### `POST /events/:eventId/votes`
- **Access**: Public / Authenticated (1 vote per session/hash)
- **Body**: `{ "projectId": "<uuid>" }`
- **Behavior**: Records vote immutably in `community_votes`. Rejects subsequent votes from same voter hash with `409 Conflict` (`ALREADY_VOTED`).

---

### 3.8 Data Exports
#### `GET /events/:eventId/export/results.csv`
- **Access**: Organizer / Admin
- **Description**: Generates downloadable CSV of final results.
- **Format**:
  ```csv
  project_id,source_id,title,track,raw_score,normalized_score,review_count,normalized_rank,rank_shift
  ```

#### `GET /events/:eventId/export/full.json`
- **Access**: Organizer
- **Description**: Comprehensive JSON export containing event metadata, tracks, teams, projects, rubrics, reviews, and audit history.
