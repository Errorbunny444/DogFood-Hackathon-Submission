# Relational Data Model — DOGFOOD 2026

## 1. Design Principles

1. **Normalized Relational Model**: Uses clean third normal form (3NF) relational design powered by PostgreSQL and Drizzle ORM.
2. **UUID Primary Keys & Source Identity Preservation**:
   - Internal entities use randomly generated version 4 UUIDs (`uuid_generate_v4()`).
   - Fixture entities preserve their original identifier in `source_id` (e.g., `evt_01`, `jdg_01`, `prj_01`, `tm_07`).
   - All API endpoints accept both UUIDs and `source_id` values transparently via UUID regex validation (`apps/api/src/lib/uuid.ts`).
3. **Event-Scoped Roles**:
   - Instead of storing a single global role on the user record, permissions are scoped per event via `event_memberships`. A user can simultaneously be an Organizer in Event A, a Judge in Event B, and a Participant in Event C.
4. **Relaxed Constraints for Real-World Submissions**:
   - In accordance with the challenge specification, unique constraints are deliberately **omitted** from `teams.name`, `projects.title`, and `projects.repository_url`. Real-world hackathons contain duplicate submissions, team renames, and shared mono-repositories; the platform models these faithfully via duplicate detection rather than failing database inserts.
5. **Immutable Audit & Normalization History**:
   - Normalization runs and audit logs are append-only. Past calculation runs are never overwritten.

---

## 2. Entity Relationship Overview

```text
users ───┬─── sessions
         │
         ├─── event_memberships ─── events ───┬─── tracks
         │                                    ├─── prizes
         │                                    ├─── rubrics ─── rubric_criteria
         │                                    │
         ├─── team_members ─────── teams ────┼─── projects ───┬─── project_tracks
         │                                    │               ├─── project_assets
         │                                    │               ├─── submission_answers
         │                                    │               └─── reviews ─── review_scores
         │                                    │
         ├─── judge_profiles ─────────────────┼─── judge_track_preferences
         │                                    ├─── judge_conflicts
         │                                    └─── judge_assignments
         │
         ├─── community_votes
         ├─── comments
         ├─── audit_events
         └─── normalization_runs ───┬─── normalized_reviews
                                    ├─── judge_statistics
                                    └─── project_results
```

---

## 3. Core Database Tables

### 3.1 Users & Authentication

#### `users`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK, Default UUID | Internal unique user identifier |
| `source_id` | `VARCHAR(64)` | NULL, Indexed | Original identifier from fixture (e.g. `jdg_01`) |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | User email address |
| `password_hash` | `TEXT` | NOT NULL | Argon2id password hash |
| `display_name` | `VARCHAR(255)` | NOT NULL | Full display name |
| `avatar_path` | `TEXT` | NULL | Local avatar storage path |
| `global_role` | `VARCHAR(32)` | NOT NULL | `USER` or `ADMIN` |
| `status` | `VARCHAR(32)` | NOT NULL | `ACTIVE` or `SUSPENDED` |
| `created_at` | `TIMESTAMP` | NOT NULL | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL | Record update timestamp |

#### `sessions`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(128)` | PK | Session token (hash or secure random token) |
| `user_id` | `UUID` | FK -> `users.id` | Associated user identity |
| `expires_at` | `TIMESTAMP` | NOT NULL | Session expiration timestamp |
| `created_at` | `TIMESTAMP` | NOT NULL | Session issuance timestamp |

---

### 3.2 Events & Event Memberships

#### `events`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK, Default UUID | Internal event identifier |
| `source_id` | `VARCHAR(64)` | NULL, Indexed | Fixture identifier (e.g. `evt_01`) |
| `slug` | `VARCHAR(128)` | UNIQUE, NOT NULL | URL-safe slug |
| `name` | `VARCHAR(255)` | NOT NULL | Human-readable event title |
| `description` | `TEXT` | NULL | Event overview & guidelines |
| `timezone` | `VARCHAR(64)` | NOT NULL | IANA timezone identifier |
| `submission_deadline`| `TIMESTAMP` | NOT NULL | Strict deadline cutoff |
| `status` | `VARCHAR(32)` | NOT NULL | `DRAFT`, `REGISTRATION`, `ACTIVE`, `SUBMISSIONS_CLOSED`, `JUDGING`, `COMPLETED` |
| `community_voting_enabled` | `BOOLEAN` | Default `true` | Public voting toggle |
| `results_published` | `BOOLEAN` | Default `false` | Public leaderboard visibility toggle |

#### `event_memberships`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | Membership identifier |
| `event_id` | `UUID` | FK -> `events.id` | Target event |
| `user_id` | `UUID` | FK -> `users.id` | Target user |
| `role` | `VARCHAR(32)` | NOT NULL | `ORGANIZER`, `JUDGE`, `PARTICIPANT` |
| `status` | `VARCHAR(32)` | NOT NULL | `INVITED`, `ACTIVE`, `REMOVED` |

*Index: `CREATE INDEX idx_event_memberships_event_user ON event_memberships(event_id, user_id)`*

---

### 3.3 Teams & Projects

#### `teams`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | Internal team identifier |
| `source_id` | `VARCHAR(64)` | NULL | Fixture identifier (e.g. `tm_07`) |
| `event_id` | `UUID` | FK -> `events.id` | Parent event |
| `name` | `VARCHAR(255)` | NOT NULL | Team name (non-unique) |
| `created_by` | `UUID` | FK -> `users.id` | Team creator |

#### `projects`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | Internal project identifier |
| `source_id` | `VARCHAR(64)` | NULL, Indexed | Fixture identifier (e.g. `prj_41`) |
| `event_id` | `UUID` | FK -> `events.id` | Parent event |
| `team_id` | `UUID` | FK -> `teams.id` | Submitting team (non-unique) |
| `track_id` | `UUID` | FK -> `tracks.id` | Primary track assignment |
| `title` | `VARCHAR(255)` | NOT NULL | Project title (non-unique) |
| `tagline` | `VARCHAR(255)` | NULL | Short summary pitch |
| `summary` | `TEXT` | NULL | Technical summary |
| `repository_url` | `TEXT` | NULL | Code repository URL (non-unique) |
| `demo_url` | `TEXT` | NULL | Interactive demo URL |
| `status` | `VARCHAR(32)` | NOT NULL | `DRAFT`, `SUBMITTED`, `DISQUALIFIED`, `WITHDRAWN` |
| `submitted_at` | `TIMESTAMP` | NULL | Submission timestamp |
| `duplicate_status` | `VARCHAR(32)` | Default `'NONE'` | `'NONE'`, `'SUSPECTED'`, `'CONFIRMED'` |
| `duplicate_of` | `UUID` | FK -> `projects.id` | Target duplicated project |

*Indexes: `projects(event_id)`, `projects(team_id)`, `projects(status)`*

---

### 3.4 Rubrics, Judging & Reviews

#### `rubrics` & `rubric_criteria`
- `rubrics`: Grouping entity per event.
- `rubric_criteria`:
  - `id`: UUID PK
  - `rubric_id`: FK -> `rubrics.id`
  - `name`: Criterion name (e.g., `Functionality`, `Quality`, `Innovation`)
  - `weight`: Decimal weight, normalized such that $\sum w_c = 1.0$
  - `min_score`: Minimum valid score (1)
  - `max_score`: Maximum valid score (5)

#### `reviews` & `review_scores`
- `reviews`:
  - `id`: UUID PK
  - `event_id`: FK -> `events.id`
  - `project_id`: FK -> `projects.id`
  - `judge_user_id`: FK -> `users.id`
  - `raw_score`: Computed weighted score $\sum w_c s_{jpc}$
  - `status`: `DRAFT` or `SUBMITTED`
- `review_scores`:
  - `review_id`: FK -> `reviews.id`
  - `criterion_id`: FK -> `rubric_criteria.id`
  - `score`: Individual integer criterion score (1–5)
  - `comment`: Specific qualitative feedback per criterion

---

### 3.5 Normalization & Integrity Analytics

#### `normalization_runs`
- `id`: UUID PK
- `event_id`: FK -> `events.id`
- `algorithm`: `'MEAN_CENTER_SHRINKAGE'`
- `algorithm_version`: `'1.0.0'`
- `parameters`: JSONB storing hyperparameters `{ "k": 5, "minScore": 1, "maxScore": 5 }`
- `created_at`: Immutable timestamp

#### `judge_statistics`
- `normalization_run_id`: FK -> `normalization_runs.id`
- `judge_user_id`: FK -> `users.id`
- `review_count`: Completed reviews $n_j$
- `mean_score`: $\mu_j$
- `variance`: Sample variance $\sigma_j^2$
- `observed_bias`: $b_j = \mu_j - \mu_g$
- `shrinkage_factor`: $\lambda_j = \frac{n_j}{n_j + k}$
- `adjusted_bias`: $\hat{b}_j = \lambda_j b_j$
- `flags`: JSONB array of strings (`CONSTANT_SCORER`, `LOW_VARIANCE`, `HIGH_BIAS`)

#### `project_results`
- `normalization_run_id`: FK -> `normalization_runs.id`
- `project_id`: FK -> `projects.id`
- `raw_average`: Arithmetic mean of raw reviews
- `normalized_average`: Mean of normalized reviews $N_{jp}$
- `review_count`: Total valid reviews
- `raw_rank`: Rank before normalization
- `normalized_rank`: Final calibrated rank
- `rank_shift`: $\Delta = \text{raw\_rank} - \text{normalized\_rank}$
- `is_tied`: Boolean flag indicating tie-break resolution

---

### 3.6 Community Voting & Audit Events

#### `community_votes`
- `id`: UUID PK
- `event_id`: FK -> `events.id`
- `project_id`: FK -> `projects.id`
- `user_id`: UUID NULL (allows anonymous votes with voterHash)
- `voter_hash`: SHA-256 hash of event ID + voter session / IP
- `ip_hash`: SHA-256 hash of client IP
- `created_at`: Timestamp

*Unique Constraint: `(event_id, voter_hash)` prevents duplicate ballot stuffing.*

#### `audit_events`
- `id`: UUID PK
- `event_id`: FK -> `events.id`
- `actor_user_id`: User initiating action (or NULL for automated triggers)
- `action`: String code (e.g. `PROJECT.SUBMITTED`, `RESULTS.PUBLISHED`)
- `resource_type`: Entity name (`PROJECT`, `REVIEW`, `EVENT_RESULTS`)
- `resource_id`: Target entity ID
- `metadata`: JSONB containing non-sensitive contextual changes
- `created_at`: Immutable timestamp

*Index: `CREATE INDEX idx_audit_events_event_created ON audit_events(event_id, created_at DESC)`*
