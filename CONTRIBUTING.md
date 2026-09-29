# Contributing to DOGFOOD

Thank you for your interest in contributing to DOGFOOD — the auditable, open-source hackathon management platform! We welcome contributions from developers, designers, organizers, and security researchers worldwide.

Please take a moment to review this document before submitting issues or pull requests.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md). Please treat everyone with respect, kindness, and professionalism.

---

## Core Architecture Principles

When contributing to DOGFOOD, keep these core non-negotiable principles in mind:

1. **Deterministic & Auditable Judging**: We never use black-box AI to determine winners. Judging rubrics, scoring weights, normalization algorithms (mean-shrinkage), and rank calculations must be mathematically reproducible.
2. **Challenge & Fixture Compatibility**: The deterministic fixture dataset (`fixtures.json`), `.dogfood.toml`, and the `run.py` acceptance test suite must continue to pass 100% at all times.
3. **Zero Mandatory External SaaS**: Self-hosted and demo deployments must run completely offline via `docker compose up` with PostgreSQL and local disk storage. External SaaS (S3, SMTP, OAuth, Sentry) must be optional provider abstractions.
4. **Strict Multi-Tenant Isolation**: Never rely on client-supplied organization or event IDs. All authorization queries must verify organization memberships and event roles directly in PostgreSQL.

---

## Workspace Structure

DOGFOOD is organized as a lightweight pnpm monorepo:

```
├── apps/
│   ├── api/                  # Fastify REST API, auth, jobs worker, database migrations
│   └── web/                  # React 18 + Vite + TailwindCSS frontend
├── packages/
│   ├── database/             # PostgreSQL schema, migrations, connection pool (PGlite & pg)
│   ├── judging-engine/       # Pure mathematical judging, normalization, and ranking engine
│   ├── fixture-importer/     # Fixture loader & challenge seeder
│   └── shared/               # Shared TypeScript schemas, types, and constants
├── infrastructure/
│   ├── caddy/                # Production Caddy reverse proxy & TLS config
│   └── docker/               # Multi-stage Dockerfiles
├── tests/
│   ├── api/                  # Fastify inject API integration tests
│   └── unit/                 # Pure unit tests (judging-engine, security, math)
└── docs/                     # Production migration and deployment documentation
```

---

## Local Development Setup

### Prerequisites

- **Node.js**: v20 LTS or later
- **pnpm**: v9 or later (`corepack enable pnpm`)
- **Python 3.10+**: for running the acceptance checker (`run.py`)
- **Docker & Docker Compose**: for containerized testing

### 1. Install Dependencies

```bash
git clone https://github.com/dogfood-hackathon/dogfood.git
cd dogfood
pnpm install
```

### 2. Configure Environment

Copy the example environment configuration:

```bash
cp .env.example .env
```

For standard local development, default values in `.env.example` run against local storage and console email delivery without external setup.

### 3. Start the Development Servers

```bash
pnpm dev
```

- API server: `http://localhost:8080`
- Web frontend: `http://localhost:5173`

---

## Testing & Quality Assurance

Before submitting any Pull Request, ensure that all test suites and typechecks pass cleanly:

### Run Unit and Integration Tests

```bash
pnpm test
```

### Build All Workspaces

```bash
pnpm build
```

### Run Acceptance Test Suite

To verify challenge compatibility:

```bash
# Ensure API is running on http://localhost:8080
python run.py .dogfood.toml
```

All claimed tiers (T1 and T2) must pass with 0 failures.

---

## Submitting Pull Requests

1. **Fork the repository** and create your branch from `main`:
   ```bash
   git checkout -b feature/my-enhancement
   ```
2. **Write clean, typed code**:
   - Provide unit or API tests for new endpoints, schemas, or mathematical logic.
   - Update documentation under `docs/` when introducing configuration options or architecture changes.
3. **Commit Messages**:
   - Use clear, descriptive commit messages:
     - `feat: add bradley-terry pairwise ranking to judging engine`
     - `fix: prevent duplicate review submission on rapid clicks`
     - `docs: update backup and restore procedure for multi-tenant deployments`
4. **Submit your Pull Request** with a summary of changes, test results, and any relevant issue references.

---

## Security Vulnerabilities

If you discover a potential security vulnerability, please do NOT file a public GitHub issue. Follow our responsible disclosure guidelines documented in [SECURITY.md](./SECURITY.md).
