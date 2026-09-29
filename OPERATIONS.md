# Operations & Runbook — DOGFOOD 2026

## 1. Runtime Overview

DOGFOOD 2026 is designed for zero-fuss single-node deployment via Docker Compose or native Node.js.

### Production Topology:
- **`proxy`**: Caddy web server (Port 8080) serving static React SPA assets and reverse-proxying `/api/*` requests.
- **`api`**: Fastify Node.js LTS backend (Port 8080 internal) executing application logic and normalization calculations.
- **`db`**: PostgreSQL 17 database container with persistent data volume.

---

## 2. Deployment Instructions

### 2.1 One-Command Startup
To start the entire platform with seeded fixture data:

```bash
docker compose up -d
```

Check service status:
```bash
docker compose ps
```

View real-time logs:
```bash
docker compose logs -f api
```

### 2.2 Native Local Execution
For development or bare-metal execution:
```bash
# Set environment variables
export DATABASE_URL="postgresql://dogfood:dogfood@localhost:5432/dogfood" # or unset for zero-config embedded PGlite
export PORT=8080
export HOST=0.0.0.0

# Install dependencies and build
pnpm install
pnpm build

# Start API server
pnpm start
```

---

## 3. Startup Lifecycle & Idempotency

When the Fastify API boots up, it executes the following initialization sequence:

```text
1. Connect to PostgreSQL (or embedded PGlite store).
2. Run database schema migrations (`CREATE TABLE IF NOT EXISTS`).
3. Compute SHA-256 hash of `fixtures.json`.
4. Check `fixture_imports` table:
   - If hash matches previous import: Skip re-seeding to prevent duplicates.
   - If new or changed: Execute transactional import (`importFixtures`).
5. Provision/verify deterministic acceptance accounts and session tokens.
6. Print acceptance headers to stdout.
7. Start Fastify HTTP listener on `PORT`.
8. Mark `/api/v1/ready` as healthy.
```

---

## 4. Health & Readiness Probes

### Health Check (Liveness Probe)
```http
GET /api/v1/health
```
- **Returns**: `200 OK`
- **Payload**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-28T00:00:00.000Z",
    "uptime": 124.5,
    "version": "1.0.0"
  }
  ```

### Readiness Check (Readiness Probe)
```http
GET /api/v1/ready
```
- **Checks**: Database connection connectivity and migration readiness.
- **Returns**: `200 OK` when database query succeeds; `503 Service Unavailable` otherwise.

---

## 5. Environment Variables Reference

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `PORT` | `8080` | Port for the API server listener |
| `HOST` | `0.0.0.0` | Network binding interface |
| `DATABASE_URL` | None | PostgreSQL connection string. If omitted, uses embedded PGlite |
| `CORS_ORIGIN` | `http://localhost:8080` | Allowed CORS origins (comma-separated or single URL) |
| `STORAGE_PATH` | `./data/uploads` | Directory for uploaded project assets and thumbnails |
| `LOG_LEVEL` | `info` | Pino logging level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) |

---

## 6. Backup & Disaster Recovery

### 6.1 Database Backup
Create a compressed SQL dump of the running database:
```bash
docker compose exec db pg_dump -U dogfood -d dogfood -F c -b -v -f /var/lib/postgresql/data/dogfood_backup.dump
docker cp $(docker compose ps -q db):/var/lib/postgresql/data/dogfood_backup.dump ./dogfood_backup.dump
```

### 6.2 Database Restore
Restore from backup dump:
```bash
docker cp ./dogfood_backup.dump $(docker compose ps -q db):/var/lib/postgresql/data/dogfood_backup.dump
docker compose exec db pg_restore -U dogfood -d dogfood -v -c /var/lib/postgresql/data/dogfood_backup.dump
```

### 6.3 Data Portability (Full Event Archive)
Organizers can export full event data without platform lock-in:
```bash
# Export results CSV
curl -H "Cookie: session=dogfood_org_session_token_2026" \
  http://localhost:8080/api/v1/events/evt_01/export/results.csv > results.csv

# Export full event JSON
curl -H "Cookie: session=dogfood_org_session_token_2026" \
  http://localhost:8080/api/v1/events/evt_01/export/full.json > event-full.json
```

---

## 7. Logging & Observability

DOGFOOD utilizes Pino for high-performance structured JSON logging. Every log entry includes:
- `requestId`: Correlation ID across request lifecycle.
- `method`: HTTP verb (`GET`, `POST`, `PATCH`, `DELETE`).
- `url`: Path and query parameters.
- `statusCode`: HTTP response code.
- `responseTime`: Request execution latency in milliseconds.
- `userId`: Authenticated user UUID (when authenticated).

Sensitive fields such as passwords, session cookies, and authorization tokens are strictly redacted from logs.
