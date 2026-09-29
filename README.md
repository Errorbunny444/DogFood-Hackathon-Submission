# DOGFOOD 2026 — Industrial-Grade Hackathon Management Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-black.svg)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791.svg)](https://www.postgresql.org/)
[![Acceptance: T1 & T2 Passed](https://img.shields.io/badge/Acceptance-T1%20%26%20T2%20PASS-brightgreen.svg)](acceptance-report.txt)

> **"Build the platform that will judge you."**  
> *Official submission for the DOGFOOD 2026 Hackathon, organized by Hackathon Raptors.*  
> **Coding Phase**: Concluded September 28, 2026 (18:00 UTC) | **Judging Window**: Sept 28 – Oct 8, 2026 | **Winners**: Oct 9, 2026

DOGFOOD is an open-source, production-grade platform for running developer hackathons, university competitions, and corporate innovation challenges. It operates seamlessly as a single-node self-hosted deployment or as a multi-tenant cloud SaaS.

Unlike simple form-submission tools, DOGFOOD treats **fairness, judge isolation, and mathematical scoring calibration** as first-class domain problems. Every outcome can be explained, audited, reproduced, exported, and defended.

---

## 📦 Required Submission Package Deliverables

In strict accordance with the Hackathon Raptors challenge submission requirements:

| # | Submission Deliverable | Documentation Link | Status |
| :-: | :--- | :--- | :-: |
| **1** | **Functional Codebase (Zero-Dependency)** | Boot via `docker compose up` | **100% COMPLETE** |
| **2** | **Architecture Notes & System Design** | [ARCHITECTURE.md](ARCHITECTURE.md) | **100% COMPLETE** |
| **3** | **Data Model & Judging Math** | [DATA-MODEL.md](DATA-MODEL.md) & [JUDGING.md](JUDGING.md) | **100% COMPLETE** |
| **4** | **Automated Acceptance Report** | [ACCEPTANCE_REPORT.md](ACCEPTANCE_REPORT.md) (`T1` & `T2` PASS) | **100% COMPLETE** |
| **5** | **5-Minute Demo Video Walkthrough Guide** | [DEMO_GUIDE.md](DEMO_GUIDE.md) (Timestamped Script) | **100% COMPLETE** |
| **6** | **"Vibe Coding" Architectural Defense** | [ARCHITECTURE_DEFENSE.md](ARCHITECTURE_DEFENSE.md) | **100% COMPLETE** |
| **7** | **OSI-Approved Open-Source License** | [LICENSE](LICENSE) (Official MIT License) | **100% COMPLETE** |

---

## 🎮 Live "Click & Play" Demo for Evaluators & Judges

To evaluate the platform immediately with **zero configuration or signup friction**, we built the **Instant Demo Persona Switcher** directly into the platform banner:

### 1. Launch with One Command (Offline-Ready)
```bash
docker compose up
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser (or `http://localhost:5173` in local dev).

### 2. 5-Click Role Verification Walkthrough
| Role Button | Target URL | What to Test ("Click & Play") | Invariant Proven |
| :--- | :--- | :--- | :--- |
| **`Visitor`** | `/gallery` & `/voting` | Search projects, filter by track, open demo sandboxes, and vote. | Public unauthenticated access |
| **`Participant (Lucas)`** | `/participant` | View team registration, edit project submission draft, and view certificate. | Participant workspace isolation |
| **`Judge A (Tomas)`** | `/judge` | Open assigned project, adjust weighted rubric sliders (1–5), save private notes. | Rubric scoring & queue management |
| **`Judge B (Wei)`** | `/judge` | Open the same project and observe that **Judge A's scores are completely invisible**. | **Backend Blind Isolation** |
| **`Organizer`** | `/organizer` | Click **"Run Normalization (Empirical Bayes)"**, inspect rank shifts, and click **"Download CSV"**. | Mathematical bias calibration |

*(For cloud deployment, this repository includes [`render.yaml`](render.yaml) for instant 1-click deployment on Render.com).*

---

## 🌟 Key Features & Capabilities

### 1. Mathematical Judging Engine & Integrity Center
- **Strict Judge Isolation**: Reviewers evaluate submissions through isolated blind portals with zero cross-judge score leakage.
- **Empirical Bayes Normalization**: Normalizes scores across harsh and lenient judges using mean-shrinkage ($\lambda_j = \frac{n_j}{n_j + 5}$) without overpenalizing judges who reviewed only a few projects.
- **Constant Scorer Detection**: Automatically flags zero-variance constant scorers ($\sigma = 0$) and calibration outliers without numerical failure.
- **Bradley-Terry Pairwise Ranking**: Pure mathematical package supporting pairwise head-to-head comparisons.
- **Immutable Result Provenance**: Historical algorithm versions (`mean-shrinkage-v1`) record exact input reviews, parameters, and timestamps.
- **Organizer Publication Gate**: Results remain strictly confidential until competition organizers review, approve, and officially publish them.

### 2. Multi-Tenant Organizations & Scoped Routing
- **Organization Hierarchy**: Support for universities, companies, accelerators, and developer communities.
- **Clean Route Architecture**: Human-friendly URLs (`/o/:orgSlug/e/:eventSlug`) backed by immutable internal UUIDs.
- **PostgreSQL Tenant Isolation**: Centralized database-level policy checks prevent cross-tenant parameter tampering.
- **Independent Roles**: Decoupled organization roles (`OWNER`, `ADMIN`, `MEMBER`) and event roles (`ORGANIZER`, `JUDGE`, `PARTICIPANT`).

### 3. Production Participant & Team Workflow
- **Flexible Team Management**: Solo registrations or customizable team sizes with invite workflows.
- **Rich Media Submissions**: Validated logo, gallery screenshots, document uploads, and external video URLs.
- **Synthetic Fixture Sandboxing**: Differentiates fixture sample projects from real submissions, protecting users from dummy external URLs with internal sandboxes.
- **Automated Demo Reachability**: Background health checks monitor live demo uptime and response times.

### 4. Enterprise-Grade Security & Authentication
- **Password Security**: Argon2id password hashing.
- **Two-Factor Authentication (MFA)**: RFC 6238 TOTP with cryptographic single-use backup recovery codes.
- **Server-Side Sessions**: Stored in PostgreSQL with session ID rotation and "Sign out all devices" revocation.
- **Security Headers & CSRF**: Content Security Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and SameSite cookie isolation.
- **Content Sanitization**: Automatic sanitization of rich-text markdown descriptions to eliminate stored XSS.

### 5. Pluggable Infrastructure (Zero Cloud Lock-In)
- **Storage Abstraction**: `LocalStorageProvider` for single-node Docker; `S3CompatibleStorageProvider` for AWS S3, Cloudflare R2, or MinIO.
- **Email Abstraction**: `ConsoleEmailProvider` (dev/testing), `SMTPEmailProvider` (self-hosted), or hosted transactional email adapters.
- **PostgreSQL Background Jobs**: Built-in persistent job queue with exponential backoff retries — no Redis or Kafka required.
- **Webhooks & API Keys**: Granular API keys with prefix/hash storage and HMAC-SHA256 signed webhook delivery.

---

## ⚙️ Application Operating Modes

DOGFOOD supports three first-class operating modes configured via `APP_MODE`:

| Feature | `APP_MODE=demo` | `APP_MODE=selfhosted` | `APP_MODE=cloud` |
| :--- | :---: | :---: | :---: |
| **Target Audience** | Evaluation & Acceptance testing | Universities, clubs, private VPS | Hosted multi-tenant SaaS |
| **Fixture Seeding** | Automatic from `fixtures.json` | Disabled by default | Disabled |
| **Persona Switcher** | Enabled in UI | **Strictly Disabled** | **Strictly Disabled** |
| **Acceptance Sessions** | Hardcoded fixture cookies valid | Disabled | Disabled |
| **User Onboarding** | Optional | Full registration & MFA | Full registration & MFA |
| **Storage Provider** | Local filesystem | Local or S3-compatible | S3 / Cloudflare R2 |
| **Email Provider** | Console / Mock | SMTP server | Transactional email provider |
| **Custom Domains** | Disabled | Optional reverse proxy | Automated TLS routing |

---

## 🚀 Quickstart

### Option 1: Docker Compose (Self-Hosted / Demo)

Clone the repository and launch the containerized stack (Caddy, Fastify API, React SPA, and PostgreSQL):

```bash
git clone https://github.com/dogfood-hackathon/dogfood.git
cd dogfood
docker compose up
```

Open your browser:
- **Web Portal**: [http://localhost:8080](http://localhost:8080)
- **API Health**: [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health)
- **System Metrics**: [http://localhost:8080/api/v1/metrics](http://localhost:8080/api/v1/metrics)

### Option 2: Local Development Setup

Prerequisites: Node.js 20+ LTS, pnpm 9+, Python 3.10+.

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Build monorepo packages
pnpm build

# 3. Run unit and integration tests
pnpm test

# 4. Start development servers
pnpm dev
```

The API starts on port `8080` and the Vite frontend on port `5173`.

---

## 🧪 Acceptance Checker Execution

DOGFOOD guarantees 100% backward compatibility with the original challenge acceptance runner:

```bash
python run.py .dogfood.toml
```

Output:
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

## 📐 Architecture Overview

```text
                                 Public Internet
                                        │
                                        ▼
                             Caddy Reverse Proxy (HTTPS)
                               /                 \
                              /                   \
                   Static React 18 SPA      Fastify API (/api/v1/*)
                                                    │
                 ┌──────────────────┬───────────────┴──────────────┬──────────────────┐
                 ▼                  ▼                              ▼                  ▼
           Authentication     Tenant Isolation              Judging Engine       Storage Provider
           (Argon2id, MFA)    (Org Memberships)           (@dogfood/judging)     (Local Disk / S3)
                 │                  │                              │                  │
                 └──────────────────┼──────────────────────────────┴──────────────────┘
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
                 PostgreSQL 17            Background Worker
             (Data, Sessions, Jobs)      (Retries, Webhooks)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for full architectural documentation.

---

## 🔑 Key Environment Variables

Copy `.env.example` to `.env` to configure your instance:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `APP_MODE` | `demo` | Operating mode (`demo`, `selfhosted`, `cloud`) |
| `PORT` | `8080` | HTTP listen port for API backend |
| `APP_URL` | `http://localhost:8080` | Public URL for link generation and CORS |
| `DATABASE_URL` | *embedded PGlite* | PostgreSQL connection string (`postgres://...`) |
| `SESSION_SECRET` | *dev-secret* | Cryptographic salt for cookie sessions (min 32 chars) |
| `STORAGE_PROVIDER` | `local` | Upload storage backend (`local` or `s3`) |
| `EMAIL_PROVIDER` | `console` | Email delivery service (`console` or `smtp`) |
| `SEED_DEMO_DATA` | `true` (demo) | Explicitly controls fixture seeding at startup |

See [.env.example](.env.example) for all optional variables including S3, SMTP, OAuth, and Sentry.

---

## 📚 Documentation Directory

- **Deployment Guides**:
  - [Single VPS Deployment (Docker Compose + Caddy)](docs/deployment/VPS.md)
  - [Production Self-Hosted Guide](docs/deployment/SELF_HOSTED.md)
  - [Multi-Tenant Cloud Deployment](docs/deployment/CLOUD.md)
  - [Database & Storage Backup / Restore Procedures](docs/deployment/BACKUPS.md)
  - [Zero-Downtime Migration & Upgrade Runbook](docs/deployment/UPGRADES.md)
- **Architecture & Security**:
  - [System Architecture](ARCHITECTURE.md)
  - [Database Schema & Data Model](DATA-MODEL.md)
  - [Judging Engine & Mathematical Calibration](JUDGING.md)
  - [Threat Model & Security Mitigations](THREAT-MODEL.md)
  - [Operational Procedures](OPERATIONS.md)
  - [REST API Specification](API.md)
  - [Production Migration Record](docs/PRODUCTION-MIGRATION.md)
  - [Public Beta Readiness Checklist](docs/BETA-CHECKLIST.md)

---

## 📦 Standalone Judging Engine Package

The core mathematical calibration algorithms have been extracted into an independent, zero-dependency package:

```
packages/judging-engine/   # @dogfood/judging-engine
```

Provides pure functions for:
- Weighted rubric scoring
- Mean-shrinkage Bayesian normalization
- Constant-scorer variance detection
- Rank-shift attribution
- Bradley-Terry pairwise comparisons

See [packages/judging-engine/README.md](packages/judging-engine/README.md) for API usage and integration examples.

---

## 🤝 Community & Contributing

- **Contributing**: Please review [CONTRIBUTING.md](CONTRIBUTING.md) for code style, workspace guidelines, and pull request procedures.
- **Security Policy**: Read [SECURITY.md](SECURITY.md) for vulnerability disclosure guidelines.
- **Code of Conduct**: We adhere to the [Contributor Covenant](CODE_OF_CONDUCT.md).
- **Changelog**: All releases and historical migrations are tracked in [CHANGELOG.md](CHANGELOG.md).

---

## 🛡️ License

DOGFOOD 2026 is open-source software licensed under the [MIT License](LICENSE).
