# Self-Hosting DOGFOOD 2026

DOGFOOD is designed from the ground up to be fully self-hostable with zero external SaaS dependencies. All features — including user onboarding, multi-tenant organizations, judging normalization, and background jobs — function completely on commodity hardware.

---

## 1. Architecture Overview

In self-hosted mode (`APP_MODE=selfhosted`), DOGFOOD operates as a lightweight modular monolith:

```
                  ┌──────────────────────┐
                  │    Caddy Proxy       │
                  │  (TLS & Static Web)  │
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │   Fastify Backend    │
                  │   & In-Process Job   │
                  │       Worker         │
                  └──────────┬───────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
      ┌──────────▼───────────┐ ┌─────────▼─────────┐
      │  PostgreSQL 17       │ │ Persistent Uploads│
      │  (Data & Job Queue)  │ │ (Local Volume)    │
      └──────────────────────┘ └───────────────────┘
```

---

## 2. Key Differences in Self-Hosted Mode

1. **No Persona Switcher**: The interactive fixture persona bar is disabled on both backend and frontend. Users log in through real, authenticated user accounts.
2. **Deterministic Fixture Isolation**: Fixture records are not seeded unless explicitly requested (`SEED_DEMO_DATA=true`).
3. **Local Storage**: Uploaded logos, project screenshots, and assets are stored in the local volume (`/data/uploads`) with path traversal protection.
4. **Console or SMTP Email**: Supports standard SMTP relays (or console logging for offline local networks).
5. **Full Administrative Control**: You own all databases, encryption keys, and judge calibration audit trails.

---

## 3. Quick Start (5 Minutes)

```bash
# 1. Clone repository
git clone https://github.com/dogfood-hackathon/dogfood.git
cd dogfood

# 2. Configure .env
cp .env.example .env

# 3. Start stack
docker compose up -d

# 4. Open portal
# Navigate to http://localhost:8080
```

---

## 4. Maintenance & Routine Operations

### Checking System Health
```bash
curl -s http://localhost:8080/api/v1/health | jq .
```

### Viewing Logs
```bash
# API logs
docker compose logs -f api

# Caddy logs
docker compose logs -f proxy

# Database logs
docker compose logs -f db
```

### Backing Up
```bash
./scripts/backup.sh ./backups
```
See [BACKUPS.md](./BACKUPS.md) for full backup and disaster recovery details.
