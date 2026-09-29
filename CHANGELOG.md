# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-09-29

### Added
- **Application Operating Modes (`APP_MODE`)**:
  - `demo`: Seeds DOGFOOD reference fixtures, enables persona switcher, and supports automated acceptance runner sessions.
  - `selfhosted`: For production deployments; disables persona switcher, enforces real auth, and uses local or S3-compatible storage with SMTP.
  - `cloud`: Multi-tenant hosted SaaS mode with custom domains, production storage, and transactional email.
- **Real User Onboarding & Auth Identities**:
  - Email/password registration and login with Argon2id password hashing.
  - Two-Factor Authentication (RFC 6238 TOTP) with single-use cryptographic recovery backup codes.
  - Email verification, password reset tokens, and "Sign out all devices" session revocation.
  - `auth_identities` table supporting PASSWORD, GITHUB, and GOOGLE provider account linking.
- **Organization Multi-Tenancy & Tenant Isolation**:
  - `organizations` and `organization_memberships` (`OWNER`, `ADMIN`, `MEMBER`).
  - Scoped URL routing (`/o/:orgSlug/e/:eventSlug`).
  - Centralized PostgreSQL authorization (`authorizeOrgMember`).
  - Organization workspace dashboard for events, members, branding, API keys, webhooks, and audit logs.
- **Production Event Lifecycle**:
  - 10-step Event Creation Wizard (Basics, Dates, Tracks, Submission Form, Team Rules, Judging Rubric, Community Voting, Branding, Review, Publish).
  - Explicit backend state machine (`DRAFT`, `PUBLISHED`, `REGISTRATION_OPEN`, `ACTIVE`, `SUBMISSIONS_CLOSED`, `JUDGING`, `RESULTS_READY`, `COMPLETED`, `ARCHIVED`).
- **Production Participant & Team Workflow**:
  - Team creation, joining, invitations, and member limits.
  - Real project submissions with rich media upload validation (file size, MIME types, dimensions).
  - Validated external repository/demo URLs (`http:`, `https:` only, `rel="noopener noreferrer"`).
  - Asynchronous live-demo reachability health checks with response time tracking.
- **Industrial Judging Workflow**:
  - Pure mathematical judging package (`packages/judging-engine`) with deterministic weighted scoring, mean-shrinkage normalization, constant-scorer detection, rank-shift calculations, and Bradley-Terry pairwise ranking.
  - Algorithm versioning (`mean-shrinkage-v1`) guaranteeing immutable result provenance.
  - Organizer review gate before public result publication.
- **Infrastructure Abstractions**:
  - Pluggable `StorageProvider`: `LocalStorageProvider` (for Docker/offline) and `S3CompatibleStorageProvider` (AWS S3, MinIO, Cloudflare R2).
  - Pluggable `EmailProvider`: `ConsoleEmailProvider` (dev/testing), `SMTPEmailProvider` (self-hosted), and hosted SaaS adapters.
  - PostgreSQL-backed persistent job queue with exponential backoff retries (`email.send`, `webhook.deliver`, `demo.health_check`, `export.archive`).
- **Security & Observability**:
  - Content Security Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
  - CSRF origin and double-submit protection.
  - User-generated content sanitization preventing stored XSS.
  - System metrics endpoint `/api/v1/metrics` supporting both JSON and Prometheus format.
  - `/api/v1/health` and `/api/v1/ready` endpoints.
  - In-app notification system (`notifications` table) and REST API.
  - Automated database backup and restore scripts for Linux/macOS (`scripts/backup.sh`, `scripts/restore.sh`) and Windows (`scripts/backup.ps1`, `scripts/restore.ps1`).
- **Developer & Integration Platform**:
  - Organization API keys with HMAC-SHA256 tokens and granular permission scopes (`events:read`, `projects:write`, `judging:read`, etc.).
  - Webhook delivery with cryptographic HMAC-SHA256 signatures (`X-Dogfood-Signature-256`), replay protection timestamps, and delivery event logs.
  - Portable event archive import and export (`GET /events/:id/export/archive.json` and `POST /events/import/archive`).
  - Custom domain verification lifecycle (`PENDING`, `VERIFIED`, `ACTIVE`, `FAILED`).
  - Comprehensive deployment documentation: `docs/deployment/VPS.md`, `SELF_HOSTED.md`, `CLOUD.md`, `BACKUPS.md`, `UPGRADES.md`.

### Changed
- Refactored frontend navigation to include dedicated Product Homepage with 6 core pillars, CTAs, and active mode status.
- Differentiated fixture projects (`source_type = 'FIXTURE'`) from real projects, routing synthetic `example.org` URLs to realistic internal sandbox demo pages.

### Preserved
- 100% backward compatibility with DOGFOOD 2026 challenge fixtures (`fixtures.json`), `.dogfood.toml`, and acceptance checker `run.py` (Tiers T1 and T2 pass).

---

## [1.0.0] - 2026-09-28

### Added
- Baseline DOGFOOD hackathon judging platform reference implementation.
- Weighted rubric scoring, mean-shrinkage normalization, constant-scorer detection, rank shift tracking.
- Public project showcase gallery, community voting, judge isolation, and organizer Integrity Center.
- Deterministic fixture dataset loading via `fixtures.json`.
- Offline `docker compose up` stack with Fastify API, React frontend, and Caddy reverse proxy.
