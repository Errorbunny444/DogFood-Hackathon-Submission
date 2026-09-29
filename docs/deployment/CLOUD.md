# Hosted SaaS & Cloud Deployment Guide

DOGFOOD 2026 can be operated as a multi-tenant cloud service (`APP_MODE=cloud`) utilizing managed infrastructure.

---

## 1. Cloud Architecture

```
                  ┌──────────────────────┐
                  │ Cloudflare / CDN     │
                  │ (Anycast TLS & DDoS) │
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │ Load Balancer / Ingress
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
 ┌──────────▼───────────┐          ┌──────────▼───────────┐
 │ API Container Node 1 │          │ API Container Node 2 │
 └──────────┬───────────┘          └──────────┬───────────┘
            │                                 │
            └────────────────┬────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
┌──────────▼───────────┐ ┌───▼────────────┐ ┌──▼─────────────┐
│ Managed PostgreSQL   │ │ S3 / R2 Bucket │ │ Resend / Mail  │
│ (RDS / Aurora / Neon)│ │ (Media Uploads)│ │ (Transactional)│
└──────────────────────┘ └────────────────┘ └────────────────┘
```

---

## 2. Environment Configuration for Cloud

```env
APP_MODE=cloud
NODE_ENV=production
APP_URL=https://dogfood.app
CORS_ORIGIN=https://dogfood.app

# Managed PostgreSQL (e.g. AWS RDS Aurora, Neon, Supabase)
DATABASE_URL=postgresql://app_user:strong_password@ep-cool-db.us-east-1.aws.neon.tech/dogfood?sslmode=require

# Sessions
SESSION_SECRET=strong_64_character_random_hex_string

# Object Storage (Cloudflare R2, AWS S3)
STORAGE_PROVIDER=s3
S3_BUCKET=dogfood-prod-assets
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=r2_access_key
S3_SECRET_ACCESS_KEY=r2_secret_key

# Transactional Delivery
EMAIL_PROVIDER=resend
EMAIL_FROM="DOGFOOD Cloud <notifications@dogfood.app>"
RESEND_API_KEY=re_1234567890abcdef

# Observability
LOG_LEVEL=info
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SEED_DEMO_DATA=false
```

---

## 3. Horizontal Scaling

Because DOGFOOD nodes are stateless:
- **Sessions** are persisted in PostgreSQL.
- **Uploaded media** resides in object storage (S3/R2).
- **Background jobs** use PostgreSQL advisory locks (`SELECT ... FOR UPDATE SKIP LOCKED`).

Multiple API container instances can run concurrently behind any cloud load balancer (AWS ALB, Google Cloud Run, Fly.io, Railway, Kubernetes) with zero distributed cache required.

---

## 4. Custom Domains Routing

In Cloud mode, organizations and hackathon events can attach custom domains (e.g. `hack.mit.edu`).
- The user configures a CNAME record pointing to `cname.dogfood.app`.
- The system generates an ownership verification token.
- Once verified, TLS is provisioned dynamically via Caddy on-demand TLS or Cloudflare SSL for SaaS.
