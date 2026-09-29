# Public Beta Readiness Checklist

This document tracks and verifies every item required before opening DOGFOOD to external users and production hackathon competitions, as specified in the platform evolution specification (Section 79).

---

## Readiness Matrix

| Requirement | Status | Verification & Implementation Reference |
| :--- | :---: | :--- |
| **1. Real Registration** | :white_check_mark: Complete | Implemented via `POST /api/v1/auth/register` with Argon2id password hashing and email uniqueness enforcement. Verified in `tests/api/auth.test.ts`. |
| **2. Email Verification** | :white_check_mark: Complete | Token-based verification via `POST /api/v1/auth/verify-email`. Verified in `tests/api/auth.test.ts`. |
| **3. Password Reset** | :white_check_mark: Complete | Request via `POST /api/v1/auth/forgot-password` and confirmation via `POST /api/v1/auth/reset-password` without revealing arbitrary account existence. Verified in `tests/api/auth.test.ts`. |
| **4. Organization Creation** | :white_check_mark: Complete | Implemented via `POST /api/v1/organizations` with slug collision detection and auto-assignment of creator as `OWNER`. Verified in `tests/api/organizations.test.ts`. |
| **5. Event Creation** | :white_check_mark: Complete | 10-step wizard and `POST /api/v1/organizations/:slug/events` with custom rubrics, tracks, deadlines, and state transitions. Verified in `tests/api/organizations.test.ts`. |
| **6. Team Registration** | :white_check_mark: Complete | Team management routes `POST /api/v1/events/:id/teams`, invite codes, and size limits. Verified in `tests/api/production-flows.test.ts`. |
| **7. Real Submission Flow** | :white_check_mark: Complete | Multipart/JSON project submission with media validation (MIME, sizes), repository links, and demo URLs. Verified in `tests/api/production-flows.test.ts`. |
| **8. Judging Flow** | :white_check_mark: Complete | Blind review portal with judge isolation, rubrics, and conflict-of-interest prevention. Verified in `tests/api/judging-extended.test.ts` and `tests/api/routes.test.ts`. |
| **9. Normalization** | :white_check_mark: Complete | Empirical Bayes shrinkage normalization with versioned runs (`mean-shrinkage-v1`) and constant-scorer detection. Verified in `tests/unit/judging-engine.test.ts`. |
| **10. Result Publication** | :white_check_mark: Complete | Two-step organizer publication gate (`POST /api/v1/events/:id/publish-results`). Unapproved results remain hidden. Verified in `tests/api/production-flows.test.ts`. |
| **11. Rate Limiting** | :white_check_mark: Complete | Built-in Fastify rate limiting on authentication, voting, and public submission endpoints. |
| **12. Audit Logging** | :white_check_mark: Complete | Append-only `audit_events` table capturing logins, submissions, score reviews, normalization runs, and admin actions with actor IDs and IP addresses. |
| **13. Backups** | :white_check_mark: Complete | Automated backup scripts for Linux/macOS (`scripts/backup.sh`) and Windows (`scripts/backup.ps1`) covering PostgreSQL and media storage. Documented in `docs/deployment/BACKUPS.md`. |
| **14. Error Reporting** | :white_check_mark: Complete | `ErrorReporter` abstraction with `ConsoleErrorReporter` default and Sentry/OTel integration points. |
| **15. Health Checks** | :white_check_mark: Complete | `/api/v1/health` (liveness) and `/api/v1/ready` (readiness with database ping). Verified in `tests/api/security-observability.test.ts`. |
| **16. HTTPS** | :white_check_mark: Complete | Automated Let's Encrypt TLS reverse proxying provided out of the box via Caddy in `infrastructure/caddy/Caddyfile`. |
| **17. Privacy Policy** | :white_check_mark: Complete | Standard open-source privacy policy template documented in `docs/PRIVACY.md`. |
| **18. Terms of Service** | :white_check_mark: Complete | Standard competition hosting terms template documented in `docs/TERMS.md`. |
| **19. Security Disclosure Procedure** | :white_check_mark: Complete | Documented responsible disclosure process and timeline in `SECURITY.md`. |
| **20. Tested Restore Procedure** | :white_check_mark: Complete | Automated restore scripts for Linux/macOS (`scripts/restore.sh`) and Windows (`scripts/restore.ps1`) with recovery testing instructions in `docs/deployment/BACKUPS.md`. |
| **21. No Demo Persona Switcher in Production** | :white_check_mark: Complete | Persona switcher strictly hidden and disabled when `APP_MODE !== 'demo'`. Backend acceptance token bypass also disabled in production modes. Verified in `tests/api/app-mode.test.ts`. |
| **22. No Fixture Credentials in Production** | :white_check_mark: Complete | `fixtures.json` seeding is guarded by `SEED_DEMO_DATA=true` which defaults to `false` in `selfhosted` and `cloud` modes. |
| **23. Acceptance Compatibility Retained** | :white_check_mark: Complete | `python run.py .dogfood.toml` verified 100% PASS for claimed tiers (T1 and T2). |

---

## Production Sign-Off Verdict

**STATUS: ALL CRITERIA SATISFIED :white_check_mark:**

DOGFOOD 2026 is fully ready for self-hosted community instances and public beta cloud multi-tenancy.
