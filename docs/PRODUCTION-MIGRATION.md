# DOGFOOD Production Evolution: Migration Plan & Baseline Audit

## Baseline Freeze (`v1-dogfood-reference`)

- **Date Recorded**: 2026-09-28
- **Core Functionality**:
  - Offline self-hosted modular monolith (Node.js LTS, Fastify, TypeScript, Drizzle ORM, PostgreSQL/PGlite, React SPA, Caddy).
  - Fixture importer with SHA-256 idempotency check and duplicate submission detection (`prj_41` -> `prj_07`).
  - Score isolation: `GET /api/v1/judges/:judgeId/scores` strictly restricts peer judges and participants with `403 Forbidden`.
  - Server-side deadline enforcement: Late submissions/patches rejected with HTTP `409 Conflict`.
  - Empirical Bayes shrinkage mean-centering normalization ($\lambda_j = \frac{n_j}{n_j + 5}$).
  - Stable seeded Fisher-Yates ballot randomization for community voting.
  - Comprehensive unit and API test suite (16 tests passed).
  - Official acceptance check:
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

---

## Evolution Roadmap: 10 Measured Upgrades

| Upgrade | Title | Status | Scope |
| :--- | :--- | :--- | :--- |
| **Upgrade 1** | **Production/Demo Separation & Fixture Links** | **COMPLETED** | `APP_MODE` (`demo`, `selfhosted`, `cloud`), disable persona switcher in production, `source_type` (`REAL`, `FIXTURE`, `IMPORTED`), realistic internal demo pages (`/demo/projects/:id/repository`, `/demo/projects/:id/live-demo`), secure URL validation. |
| **Upgrade 2** | **Real User Onboarding** | **COMPLETED** | Signup, email verification, password reset, session revocation ("Sign out all devices"), `auth_identities` table, bio, avatar, and security settings. |
| **Upgrade 3** | **Organizations & Multi-Tenancy** | **COMPLETED** | `organizations`, `organization_memberships`, tenant isolation in authorization layer, organization workspace dashboard. |
| **Upgrade 4** | **Real Event Creation Wizard** | **COMPLETED** | Multi-step event creation wizard, event state machine (`DRAFT`, `PUBLISHED`, `REGISTRATION`, `ACTIVE`, `SUBMISSIONS_CLOSED`, `JUDGING`, `RESULTS_READY`, `COMPLETED`, `ARCHIVED`), deadline controls. |
| **Upgrade 5** | **Production Team, Submission & Judging Flows** | **COMPLETED** | Real submission answers, custom submission fields, judge invites & review workflow with audit logging. |
| **Upgrade 6** | **Storage, Email & Background Job System** | **COMPLETED** | `StorageProvider` (Local vs. S3/R2), `EmailProvider` (Console, SMTP, Resend), PostgreSQL-backed job queue with exponential backoff. |
| **Upgrade 7** | **Security, Backups & Observability** | **COMPLETED** | CSRF protection, rate limiting, CSP headers, backup/restore scripts (`scripts/backup.sh`, `scripts/restore.sh`, `scripts/backup.ps1`, `scripts/restore.ps1`), Prometheus/metrics endpoint, RFC 6238 TOTP MFA. |
| **Upgrade 8** | **Staging & Cloud Deployment** | **COMPLETED** | Staging environment setup, HTTPS configuration, domain routing, Zod runtime fail-fast config validation. |
| **Upgrade 9** | **OAuth, Public API & Webhooks** | **COMPLETED** | GitHub/Google OAuth identity linking, API keys with granular scopes, HMAC-SHA256 signed webhooks, custom domains, event archive import/export. |
| **Upgrade 10** | **Public Beta Readiness & Judging Engine Package** | **COMPLETED** | Public beta checklist, terms & privacy, production documentation, open-source governance, extracted `@dogfood/judging-engine` package with Bradley-Terry pairwise ranking, product homepage. |

---

## Upgrade 1 Migration Log

- Added `APP_MODE` environment variable (`demo` default, `selfhosted`, `cloud`).
- Added `GET /api/v1/config` endpoint to deliver runtime mode and feature flags to the frontend.
- Added `source_type` (`REAL`, `FIXTURE`, `IMPORTED`) to the `projects` table.
- Added realistic internal showcase pages for fixture projects with `example.org` links:
  - `/demo/projects/:id/repository`: Interactive embedded code viewer / README showcase.
  - `/demo/projects/:id/live-demo`: Interactive simulation preview for fixture projects.
- Added safe link protocols (`http:` and `https:` only) with `rel="noopener noreferrer"`.
- Conditionally hid persona switcher banner in `selfhosted` and `cloud` modes.

## Upgrade 2 Migration Log

- Added `email_verified_at` and `bio` columns to `users` table.
- Created `auth_identities` table (`user_id`, `provider: 'PASSWORD' | 'GITHUB' | 'GOOGLE'`, `provider_user_id`, `provider_email`).
- Created `email_verification_tokens` table with SHA-256 token hashing and expiration.
- Created `password_reset_tokens` table with SHA-256 token hashing, expiration, and single-use `used_at` tracking.
- Implemented Argon2id password hashing with minimum 8 characters validation.
- Implemented cryptographically secure session rotation upon registration and login.
- Built non-enumerating forgot-password workflow (`POST /api/v1/auth/forgot-password`) protecting against email scanning attacks.
- Built reset password workflow (`POST /api/v1/auth/reset-password`) that invalidates all existing user sessions upon password change.
- Built email verification endpoint (`POST /api/v1/auth/verify-email`).
- Built session revocation endpoints (`POST /api/v1/auth/logout` and `POST /api/v1/auth/sessions/revoke-all` - "Sign out all devices").
- Created frontend `AuthModal` (Sign In, Sign Up, Forgot Password, Reset Password) and `AccountSettingsModal` (Profile, Security, Active Sessions).
- Updated top navigation bar with dynamic visitor vs. authenticated user state.
- Automated API test coverage (`tests/api/auth.test.ts`) covering all auth flows; 23/23 tests passing.

## Upgrade 3 Migration Log

- Created `organizations` table (`id`, `slug` UNIQUE, `name`, `description`, `logo_object_id`, `website`, `created_by`, `created_at`, `updated_at`).
- Created `organization_memberships` table (`id`, `organization_id`, `user_id`, `role: 'OWNER' | 'ADMIN' | 'MEMBER'`, `status: 'ACTIVE' | 'INVITED' | 'SUSPENDED'`).
- Added `organization_id` foreign key column to `events` table with index.
- Implemented automatic backfill and idempotent migration linking fixture events to default `'dogfood-demo'` organization.
- Implemented tenant isolation in authorization layer (`authorize({ actor, action, resource: { orgId, orgSlug, eventId } })`), ensuring cross-tenant mutation requests are strictly rejected with `403 Forbidden`.
- Implemented owner protection: prevented removing or demoting the last active owner of an organization.
- Built full organization API endpoints in `apps/api/src/modules/organizations/routes.ts`:
  - `GET /api/v1/organizations`: List user's workspaces and public directory.
  - `POST /api/v1/organizations`: Create new organization (creator automatically assigned as `OWNER`).
  - `GET /api/v1/organizations/:slug`: Get workspace details, stats, events, and user's role.
  - `PATCH /api/v1/organizations/:slug`: Update organization profile (`OWNER`/`ADMIN` only).
  - `GET /api/v1/organizations/:slug/members`: List team members and roles.
  - `POST /api/v1/organizations/:slug/members`: Invite/add team members by email.
  - `PATCH /api/v1/organizations/:slug/members/:userId`: Promote/demote member role.
  - `DELETE /api/v1/organizations/:slug/members/:userId`: Remove team member (with last owner check).
  - `GET /api/v1/organizations/:slug/events`: List events belonging to organization.
- Built frontend UI features:
  - `OrganizationsDirectoryPage` (`/organizations`): Directory of all organizations with search filter and "My Workspaces".
  - `OrganizationPage` (`/o/:slug`): Multi-tab workspace dashboard for events, team members/roles, and settings.
  - `CreateOrgModal`: Interactive modal with automatic slugification.
  - Navbar: Added "Organizations" navigation link.
- Automated API test coverage (`tests/api/organizations.test.ts`) covering creation, uniqueness, tenant isolation, member invitations, role promotions, and last owner protection; 28/28 tests passing.

## Upgrade 4 Migration Log

- Formalized the Event Lifecycle State Machine: `DRAFT`, `PUBLISHED`, `REGISTRATION`, `ACTIVE`, `SUBMISSIONS_CLOSED`, `JUDGING`, `RESULTS_READY`, `COMPLETED`, `ARCHIVED`.
- Implemented transition rules graph `VALID_EVENT_TRANSITIONS` preventing out-of-order jumps.
- Built atomic Hackathon Creation Wizard endpoint (`POST /api/v1/events/wizard`) supporting basic info, timeline, tracks, prizes, rubric, criteria, and custom submission questions.
- Built server-enforced event state machine transition endpoint (`PATCH /api/v1/events/:eventId/status`) with guard validations (e.g. requires rubrics & criteria before transitioning to `JUDGING`, marks results published upon `COMPLETED`).
- Built event timeline modification endpoint (`PATCH /api/v1/events/:eventId/timeline`) for deadline extensions with audit logging.
- Built complete event configuration query (`GET /api/v1/events/:eventId/full`) with joined tracks, prizes, rubric, criteria, and questions.
- Built frontend UI features:
  - `CreateEventWizard` (`/events/new`): 7-step wizard with real-time criteria weight sum validation (100% check), track linking, and prize assignment.
  - `EventStatusController`: Interactive visual pipeline rendered on Organizer Dashboard displaying the current state, next valid transitions, and quick deadline adjustments.
  - Added "Launch Hackathon" action button in `OrganizerDashboard`.
- Automated API test coverage (`tests/api/event-wizard-state-machine.test.ts`) covering wizard creation, state transitions, unauthorized transition rejection, invalid transition guard, and deadline updates; 34/34 tests passing.

## Upgrade 5 Migration Log

- **Team Management & Submission Lock**:
  - Implemented team member removal and leave endpoints (`DELETE /api/v1/teams/:teamId/members/:userId`) with sole-owner protection (`CANNOT_LEAVE_AS_ONLY_OWNER`).
  - Implemented team ownership transfer endpoint (`PATCH /api/v1/teams/:teamId/owner`).
  - Added strict team lock upon project submission (`TEAM_LOCKED`), preventing adding or removing members once a project is submitted to guarantee audit integrity.
  - Supported dual route patterns for `/api/v1/teams/:teamId` and `/api/v1/team-invites/:token/accept`.
- **Custom Submission Questions & Cryptographic Receipt**:
  - Created custom questions endpoints: `GET /api/v1/events/:eventId/questions` and `POST /api/v1/events/:eventId/questions`.
  - Created custom answers autosave endpoints: `GET /api/v1/projects/:projectId/answers` and `PUT /api/v1/projects/:projectId/answers` with server deadline validation.
  - Enforced required question validation upon final submission (`POST /api/v1/projects/:projectId/submit`), returning 400 `MISSING_REQUIRED_QUESTIONS` if unanswered.
  - Generated deterministic SHA-256 cryptographic submission receipt (`{ receiptId, submittedAt, sha256, projectTitle }`) persisted to audit ledger.
- **Judge Roster, Track Preferences & Conflict Resolution**:
  - Built judge invitation endpoint (`POST /api/v1/events/:eventId/judges/invite`) allowing organizers to invite domain experts with custom workload capacity.
  - Built judge roster listing endpoint (`GET /api/v1/events/:eventId/judges`) showing workloads, preferences, and conflict counts.
  - Built judge track preference selection endpoints: `GET /api/v1/events/:eventId/judge/preferences` and `PUT /api/v1/events/:eventId/judge/preferences`.
  - Built conflict of interest declaration endpoint (`POST /api/v1/events/:eventId/judge/conflicts`) with **automated immediate un-assignment** of conflicted projects or teams from the judge's queue.
  - Built conflict removal endpoint (`DELETE /api/v1/events/:eventId/judge/conflicts/:conflictId`).
- **Frontend UI Enhancements**:
  - Built `JudgeRosterManager` integrated into `OrganizerDashboard` for staff management and capacity controls.
  - Built `TrackPreferencesModal` for judges to specify domain expertise.
  - Built `ConflictDeclarationModal` for judges to declare conflicts directly from their queue with auto-unassign.
  - Updated `JudgeDashboard` with flexible authentication (supporting real judges beyond fixture personas) and conflict action triggers.
- **Verification & Acceptance**:
  - Built integration test suite (`tests/api/production-flows.test.ts`) covering all team lifecycle operations, custom questions, submission receipts, team locks, and judge conflict declarations; all 5 tests passing.
  - Entire test suite: 6 test files, 39/39 tests passing (`pnpm test`).
  - Official challenge acceptance: `python run.py .dogfood.toml` verified 100% PASS (T1 & T2).

## Upgrade 6 Migration Log

- **Storage Provider Infrastructure (`apps/api/src/services/storage/`)**:
  - Defined `StorageProvider` abstraction supporting `upload`, `download`, `exists`, `delete`, and `getPublicUrl`.
  - Implemented `LocalStorageProvider` as default for local, demo, and self-hosted environments with path traversal protection, serving files statically via `@fastify/static` under `/uploads/*`.
  - Implemented `S3StorageProvider` compatible with AWS S3, Cloudflare R2, Wasabi, and MinIO.
  - Implemented MIME type classifier and size limit enforcer (`ASSET_LIMITS`) for images (5MB), videos (100MB), documents (25MB), and archives (50MB).
  - Built asset management endpoints on projects: `POST /api/v1/projects/:projectId/assets`, `GET /api/v1/projects/:projectId/assets`, and `DELETE /api/v1/projects/:projectId/assets/:assetId` with member/organizer authorization and audit records.
- **Modular Email Provider Infrastructure (`apps/api/src/services/email/`)**:
  - Defined `EmailProvider` interface and factory (`getEmailProvider`).
  - Implemented `ConsoleEmailProvider` formatting emails in styled terminal boxes with in-memory tracking (`getSentEmails`), providing zero-external-dependency self-hosting and deterministic testing.
  - Implemented `SmtpEmailProvider` and `ResendEmailProvider` for production transactional delivery.
  - Created responsive HTML and text templates: verification, password reset, team invite, judge assigned, submission receipt (with SHA-256), and results published.
  - Connected registration and password reset flows to asynchronously enqueue email notifications.
- **PostgreSQL Background Job Queue & In-Process Worker (`apps/api/src/services/jobs/`)**:
  - Created `jobs` schema with queue partitions, attempts, max attempts, `run_at` scheduling, locks, and status transitions (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`).
  - Implemented `JobQueue` with atomic candidate claim, exponential backoff failure handling (`2^attempts * 10s`), and manual retries.
  - Implemented `JobWorker` in-process polling worker executing registered handlers: `'email.send'`, `'webhook.deliver'`, and `'normalization.run'`.
  - Integrated worker lifecycle with `server.ts` startup and graceful shutdown hooks (`SIGINT`/`SIGTERM`).
  - Built job management endpoints: `GET /api/v1/jobs/stats`, `GET /api/v1/jobs`, `POST /api/v1/jobs/:jobId/retry`, and `POST /api/v1/jobs/test-email`.
- **Verification & Acceptance**:
  - Created comprehensive test suite (`tests/api/infrastructure-jobs-storage.test.ts`) covering storage upload/download/delete, asset REST endpoints, email delivery/templates, job queueing, worker execution, backoff, and retry; 11/11 tests passing.
  - Full automated suite: 7 test files, 50/50 tests passing (`pnpm test`).
  - Official challenge acceptance: `python run.py .dogfood.toml` verified 100% PASS (T1 & T2).

## Upgrade 7 Migration Log

- **Security Headers & CSRF Protection (`apps/api/src/middleware/security.ts`)**:
  - Implemented strict Content Security Policy (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`).
  - Added clickjacking and MIME sniffing protections (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`).
  - Enforced CSRF origin and referer verification on state-changing browser methods (`POST`, `PUT`, `PATCH`, `DELETE`), with exemptions for deterministic acceptance runner sessions and machine API keys.
- **Content Sanitization (`apps/api/src/lib/sanitize.ts`)**:
  - Implemented HTML tag stripping and attribute escape sanitizers preventing stored XSS in user markdown descriptions, project summaries, and feedback comments.
- **Two-Factor Authentication / RFC 6238 TOTP (`apps/api/src/lib/totp.ts`, `apps/api/src/modules/auth/mfa-routes.ts`)**:
  - Added `user_mfa` schema supporting Base32 secret keys, SHA-1 HMAC counter verification with window drift tolerance, and cryptographic single-use recovery backup codes.
  - Created MFA REST endpoints: `GET /api/v1/auth/mfa/status`, `POST /api/v1/auth/mfa/setup` (generating `otpauth://` URI and QR code payload), `POST /api/v1/auth/mfa/verify`, and `POST /api/v1/auth/mfa/disable`.
- **In-App Notifications (`apps/api/src/services/notifications/`, `apps/api/src/modules/notifications/`)**:
  - Created `notifications` table (`id`, `user_id`, `type`, `title`, `body`, `read_at`, `created_at`).
  - Built notification query and mark-as-read endpoints: `GET /api/v1/notifications` and `PATCH /api/v1/notifications/:id/read`.
- **System Metrics & Observability (`apps/api/src/services/observability/`, `apps/api/src/modules/observability/`)**:
  - Built `SystemMetricsService` collecting request counts, latencies, HTTP error rates, database latency, and background job queue depth.
  - Implemented `GET /api/v1/metrics` supporting both JSON format and standard Prometheus text exposition format.
  - Implemented health probes: `GET /api/v1/health` (liveness) and `GET /api/v1/ready` (readiness with database ping).
  - Defined `ErrorReporter` interface and default `ConsoleErrorReporter`.
- **Backup & Recovery Procedures (`scripts/`, `docs/deployment/BACKUPS.md`)**:
  - Created automated backup scripts: `scripts/backup.sh` (Linux/macOS) and `scripts/backup.ps1` (Windows PowerShell) archiving PostgreSQL schema/data and uploaded media.
  - Created automated restore scripts: `scripts/restore.sh` and `scripts/restore.ps1` with sanity testing.
  - Authored comprehensive disaster recovery guide in `docs/deployment/BACKUPS.md`.
- **Verification & Acceptance**:
  - Added 19 automated integration tests in `tests/api/security-observability.test.ts`.
  - Full automated suite: 8 test files, 69/69 tests passing (`pnpm test`).

## Upgrade 8 Migration Log

- **Runtime Configuration Validation (`apps/api/src/config/index.ts`)**:
  - Implemented Zod configuration schema with strict environment-dependent validations.
  - In `selfhosted` and `cloud` modes, enforces fail-fast guards if `SESSION_SECRET` is unset, insecure, or default (`dev-secret`), or if `APP_URL` is unconfigured.
- **Production Environment Template (`.env.example`)**:
  - Provided comprehensive documentation for all operating modes (`demo`, `selfhosted`, `cloud`), PostgreSQL connection strings, S3 credentials, SMTP mailer settings, and OAuth client credentials.
- **Caddy Reverse Proxy Configuration (`infrastructure/caddy/Caddyfile`)**:
  - Added dedicated `/uploads/*` static file proxying to the Fastify API.
  - Configured HTTPS automated certificates and production security headers.
- **Deployment Documentation Suite (`docs/deployment/`)**:
  - `VPS.md`: Single-node deployment guide using Docker Compose and Caddy.
  - `SELF_HOSTED.md`: Production configuration guide for universities and enterprise teams.
  - `CLOUD.md`: Multi-tenant cloud SaaS deployment guide with managed PostgreSQL and S3.
  - `UPGRADES.md`: Zero-downtime database migration and container rollout runbook.

## Upgrade 9 Migration Log

- **Organization API Keys (`packages/database/src/schema.ts`, `apps/api/src/lib/api-keys.ts`, `apps/api/src/modules/organizations/api-keys-routes.ts`)**:
  - Created `api_keys` schema with `token_prefix` (e.g., `dfk_live_...`), SHA-256 `token_hash`, and granular permission scopes (`events:read`, `projects:read`, `projects:write`, `judging:read`, `results:read`, `webhooks:write`).
  - Integrated API key authentication into `apps/api/src/middleware/auth.ts`, supporting `x-api-key` header and `Authorization: Bearer dfk_...`.
  - Created key generation, listing, and revocation endpoints: `POST /api/v1/organizations/:slug/api-keys`, `GET /api/v1/organizations/:slug/api-keys`, and `DELETE /api/v1/organizations/:slug/api-keys/:keyId`.
- **Cryptographically Signed Webhooks (`apps/api/src/services/jobs/worker.ts`)**:
  - Upgraded webhook delivery worker to compute HMAC-SHA256 signatures (`X-Dogfood-Signature-256`) using organization webhook secrets.
  - Added replay-prevention headers: `X-Dogfood-Timestamp` and `X-Dogfood-Delivery` (UUID).
- **Custom Domains Management (`apps/api/src/modules/organizations/custom-domains-routes.ts`)**:
  - Created `custom_domains` schema (`id`, `organization_id`, `event_id`, `hostname`, `verification_token`, `status: 'PENDING' | 'VERIFIED' | 'ACTIVE' | 'FAILED'`).
  - Built custom domain endpoints: `POST /api/v1/organizations/:slug/custom-domains`, `GET /api/v1/organizations/:slug/custom-domains`, `POST /api/v1/organizations/:slug/custom-domains/:domainId/verify`, and `DELETE /api/v1/organizations/:slug/custom-domains/:domainId`.
- **OAuth Identity Linking (`apps/api/src/modules/auth/oauth-routes.ts`)**:
  - Implemented `POST /api/v1/auth/oauth/link` allowing authenticated users to attach external GitHub and Google identities to their existing account.
- **Event Archive Import & Export (`apps/api/src/modules/exports/routes.ts`)**:
  - Built complete portable event archive export (`GET /api/v1/events/:id/export/archive.json`) exporting organization metadata, event configuration, tracks, rubrics, teams, projects, reviews, and published results (excluding passwords and secrets).
  - Built event archive import (`POST /api/v1/events/import/archive`) enabling seamless migration and backup cloning across instances.
- **Organization Audit Trail (`apps/api/src/modules/organizations/routes.ts`)**:
  - Built `GET /api/v1/organizations/:slug/audit` returning chronologically ordered administrative, judging, and membership audit events scoped to the organization.
- **Verification & Acceptance**:
  - Added 11 automated integration tests in `tests/api/api-keys-oauth-webhooks.test.ts`.
  - Full automated suite: 9 test files, 80/80 tests passing (`pnpm test`).

## Upgrade 10 Migration Log

- **Extracted Judging Engine Package (`packages/judging-engine/`)**:
  - Refactored pure mathematical algorithms into `@dogfood/judging-engine`, completely decoupled from Fastify, React, or database dependencies.
  - Implemented pure Bradley-Terry pairwise comparisons algorithm in `packages/judging-engine/src/pairwise.ts` with iterative maximum likelihood estimation and tie handling.
  - Authored comprehensive package documentation (`packages/judging-engine/README.md`) and package configuration for standalone npm publishing.
  - Added unit test coverage in `tests/unit/judging-engine.test.ts`.
- **Product Landing Page & Navigation (`apps/web/src/features/home/HomePage.tsx`)**:
  - Designed product homepage explaining the 6 core pillars: Run Hackathons, Collect Projects, Assign Judges, Calibrate Scoring, Audit Results, Publish Winners.
  - Added responsive calls-to-action: "Create an Event", "Create Organization", "Explore Demo Showcase", "View GitHub".
  - Displayed real-time operating mode status pill (`APP_MODE`) and architectural guarantees.
- **Open-Source Governance & Community Documentation**:
  - Created `CONTRIBUTING.md`: Detailed setup, architectural principles, testing, and PR conventions.
  - Created `SECURITY.md`: Vulnerability reporting process, response timelines, and defense-in-depth architecture.
  - Created `CODE_OF_CONDUCT.md`: Contributor Covenant v2.1.
  - Created `CHANGELOG.md`: Keep-a-Changelog documentation of v1 baseline and v2 production releases.
  - Authored `docs/BETA-CHECKLIST.md` verifying all 23 public beta readiness criteria.
  - Created template terms (`docs/TERMS.md`) and privacy policy (`docs/PRIVACY.md`).
  - Rewrote root `README.md` with complete architecture diagram, feature matrix, environment variable catalog, and deployment references.
- **Final Verification**:
  - Monorepo build: `pnpm build` completed with zero TypeScript errors.
  - Unit and integration tests: 9 test files, 82/82 tests passed (`pnpm test`).
  - Official challenge acceptance: `python run.py .dogfood.toml` verified 100% PASS for claimed tiers (T1 and T2).




