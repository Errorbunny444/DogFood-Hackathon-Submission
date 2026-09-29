# DOGFOOD 2026 — Official Acceptance Report

**Event**: DOGFOOD 2026 — 72-Hour Developer-Tools Hackathon  
**Organizer**: Hackathon Raptors  
**Concept**: *"Build the platform that will judge you."*  
**Evaluation Window**: September 28, 2026 (18:00 UTC) – October 8, 2026  
**Final Announcement**: October 9, 2026  
**Repository**: [github.com/dogfood-hackathon/dogfood](https://github.com/dogfood-hackathon/dogfood)  
**License**: OSI-Approved MIT License  
**Report Generated**: September 29, 2026  
**Target Platform URL**: `http://localhost:8080` (or `http://localhost:5173` for Vite dev)  

---

## 1. Executive Summary

This report documents the verification and compliance of the **DOGFOOD 2026** hackathon submission and judging platform against the pre-published challenge specification and automated acceptance runner (`run.py`).

| Acceptance Criteria | Requirement | Status | Verification Engine |
| :--- | :--- | :---: | :--- |
| **Tier 1 (T1)** | Public Gallery, Fixture Ingestion, Strict Deadline Locking | **PASS** | `python run.py .dogfood.toml` |
| **Tier 2 (T2)** | Isolated Judge Portal, Blind Scoring, Access Control, CSV Export | **PASS** | `python run.py .dogfood.toml` |
| **Unit & Integration Suite** | 82 Tests across 9 Modular Test Suites | **PASS** | Vitest v3.2.7 |
| **Zero-Dependency Run** | Single-command offline boot (`docker compose up`) | **PASS** | Docker Compose / Caddy / Fastify / Postgres 17 |
| **OSI Open Source** | Permissive, community-standard open-source license | **PASS** | MIT License (`LICENSE`) |

---

## 2. Automated Challenge Acceptance Suite (`run.py`)

The official challenge acceptance checker was executed against the running portal at `http://localhost:8080`.

### Execution Command
```bash
python run.py .dogfood.toml
```

### Raw Output Log
```text
DOGFOOD 2026 acceptance report
portal: http://localhost:8080
claimed: T1 T2
fixtures: fixtures.json

T1  gallery is public ................. PASS
T1  project from fixtures shown ....... PASS
T1  closed event refuses submissions .. PASS
T2  judge sees own scores ............. PASS
T2  judge cannot see peer scores ...... PASS
T2  participant blocked ............... PASS
T2  csv export works .................. PASS

claimed T1 T2, verified T1 T2
```

### Breakdown of Verified Invariants

#### Tier 1 Invariants (Public Gallery & Deadline Enforcement)
1. **Gallery is Public (`GET /api/v1/public/projects`)**:
   - Returns HTTP 200 without requiring any authentication cookie or session header.
   - Unauthenticated visitors can view all approved competition submissions.
2. **Project from Fixtures Shown (`fixtures.json`)**:
   - Verifies that project titles and descriptions from `fixtures.json` (e.g., `prj_01`: *"Smart Admissions Predictor"*) are ingested and queryable.
3. **Closed Event Refuses Submissions (`POST /api/v1/events/evt_01/projects`)**:
   - The platform strictly rejects submissions to closed events (`evt_01` with `SUBMISSIONS_CLOSED` status or past `submission_deadline`) with HTTP 403 / 400.

#### Tier 2 Invariants (Judge Isolation, Access Control & CSV Export)
1. **Judge Sees Own Scores (`GET /api/v1/judges/jdg_01/scores`)**:
   - Authenticated with Judge A session cookie (`dogfood_judge_a_session_token_2026`).
   - Successfully returns all criteria scores and private notes submitted by Judge A.
2. **Judge Cannot See Peer Scores (Blind Isolation)**:
   - When Judge B (`jdg_02`) queries `/api/v1/judges/jdg_01/scores`, the request is strictly blocked, or when Judge A inspects projects, scores from other judges are completely hidden at the SQL query layer (`where(and(eq(reviews.judgeId, user.id)))`).
   - Prevents anchor bias and collusion during the judging period.
3. **Participant Blocked from Judge Portal**:
   - A participant (`dogfood_participant_session_token_2026`) attempting to access `/api/v1/judges/jdg_01/scores` or submit a review receives HTTP 403 Forbidden.
4. **CSV Export Works (`GET /api/v1/events/evt_01/export/results.csv`)**:
   - Organizers can download a structured CSV with normalized scores, track details, team names, and audit statistics.
   - Non-organizers attempting to access the export endpoint receive HTTP 403 Forbidden.

---

## 3. Comprehensive Unit & Integration Test Suite

In addition to `run.py`, the platform maintains 82 automated Vitest tests covering edge cases, mathematical normalization, security policies, multi-tenancy, and background jobs.

### Execution Command
```bash
pnpm test
```

### Test Results Summary
```text
 RUN  v3.2.7 C:/Users/acer/Downloads/DogFood

 ✓ tests/api/production-flows.test.ts (5 tests)
 ✓ tests/api/organizations.test.ts (5 tests)
 ✓ tests/api/infrastructure-jobs-storage.test.ts (11 tests)
 ✓ tests/api/event-wizard-state-machine.test.ts (6 tests)
 ✓ tests/api/api-keys-oauth-webhooks.test.ts (11 tests)
 ✓ tests/api/auth.test.ts (7 tests)
 ✓ tests/api/security-observability.test.ts (19 tests)
 ✓ tests/api/api-acceptance.test.ts (7 tests)
 ✓ tests/unit/judging-engine.test.ts (11 tests)

 Test Files  9 passed (9)
      Tests  82 passed (82)
   Duration  11.24s
```

### Test Suite Descriptions

| Test Suite File | Tests | Focus Area |
| :--- | :---: | :--- |
| `tests/unit/judging-engine.test.ts` | 11 | Empirical Bayes shrinkage normalization, constant scorer ($\sigma=0$) handling, weighted rubrics, tie-breaking |
| `tests/api/api-acceptance.test.ts` | 7 | Local execution of the exact T1 & T2 acceptance requirements |
| `tests/api/security-observability.test.ts` | 19 | Rate limiting, Prometheus metrics, health checks, audit logging, input validation, CSRF/XSS |
| `tests/api/auth.test.ts` | 7 | Argon2id password hashing, TOTP MFA RFC 6238, session lifecycle, password reset |
| `tests/api/api-keys-oauth-webhooks.test.ts` | 11 | API key generation & hashing, HMAC-SHA256 webhooks, OAuth token flows |
| `tests/api/event-wizard-state-machine.test.ts` | 6 | Event lifecycle transitions (`DRAFT` $\to$ `ACTIVE` $\to$ `SUBMISSIONS_CLOSED` $\to$ `JUDGING` $\to$ `COMPLETED`) |
| `tests/api/infrastructure-jobs-storage.test.ts` | 11 | Local disk storage, S3 adapter, persistent PostgreSQL background job worker |
| `tests/api/organizations.test.ts` | 5 | Multi-tenant organization scoping, membership invitations, role authorization |
| `tests/api/production-flows.test.ts` | 5 | End-to-end user journeys from registration to project submission to scoring and CSV export |

---

## 4. Zero-Dependency Local Run Verification

The challenge requires: *"The entire project must boot up locally using a single command: `docker compose up`. It has to function perfectly without any external hosted services or network connectivity."*

### Verification Steps
1. **Network Disconnection Check**:
   - The stack requires no external API keys, external CDNs, or cloud-hosted database connections.
   - PostgreSQL 17 runs as a containerized database within the internal Docker network.
   - Caddy compiles and serves frontend static assets locally.
   - Fastify handles API requests with embedded fallback support.
2. **Boot Command**:
   ```bash
   docker compose up --build
   ```
3. **Ports & Endpoints**:
   - `http://localhost:8080`: Main Web Application & Reverse Proxy
   - `http://localhost:8080/api/v1/health`: System Health Check (`{"status":"ok"}`)
   - `http://localhost:8080/api/v1/public/projects`: Public Gallery Endpoint
   - `http://localhost:8080/api/v1/export/results.csv`: Organizer Export

---

## 5. Compliance & Certification Statement

We certify that:
1. The platform was created, architected, and validated within the official 72-hour DOGFOOD 2026 hackathon window.
2. The submission strictly adheres to the Hackathon Raptors system blueprint and data schema.
3. All code is published under an OSI-approved open-source license ([MIT](LICENSE)).
4. The team stands fully prepared to defend every architectural and algorithmic decision outlined in [ARCHITECTURE_DEFENSE.md](ARCHITECTURE_DEFENSE.md).
