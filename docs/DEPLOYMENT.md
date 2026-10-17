# Production Deployment Guide — GiftMind

This guide provides practical, production-grade instructions for deploying GiftMind to production environments.

GiftMind consists of:
1. **Frontend**: Next.js App Router (TypeScript, Tailwind CSS)
2. **Backend**: FastAPI (Python 3.12+, SQLAlchemy async, asyncpg)
3. **Database**: Managed PostgreSQL 16 (Neon, Supabase, AWS RDS, or Render Managed Postgres)
4. **AI Inference**: Google Gemini API hosting open-weight Gemma 4 (`gemma-4-26b-a4b-it`)

---

## 1. Architecture & Domain Strategy (Critical)

### The Cross-Domain Cookie Challenge
GiftMind uses **HttpOnly, SameSite cookies** for refresh tokens (`giftmind_refresh_token`) and anti-CSRF cookies (`giftmind_csrf_token`).

Modern browsers (Chrome, Safari, Firefox) aggressively block or drop third-party cookies when the frontend and backend are hosted on completely different root domains (e.g., `giftmind.vercel.app` calling `giftmind-api.onrender.com`). Even with `SameSite=None; Secure`, third-party cookie restrictions (such as Safari ITP and Chrome Privacy Sandbox) cause frequent refresh token loss, resulting in unexpected logouts.

### Recommended Production Architecture: Unified Custom Domain
To ensure 100% reliable cookie handling without third-party cookie blocking, use a single custom root domain with subdomains:

- **Frontend**: `https://giftmind.yourdomain.com` (or `https://yourdomain.com`)
- **Backend API**: `https://api.giftmind.yourdomain.com` (or `https://api.yourdomain.com`)

When frontend and backend share the same parent domain (e.g. `yourdomain.com`):
1. Set `AUTH_COOKIE_DOMAIN=.yourdomain.com` (note the leading dot).
2. Set `AUTH_COOKIE_SAMESITE=lax`.
3. Set `AUTH_COOKIE_SECURE=True`.

Both subdomains now share First-Party cookie context cleanly and reliably.

---

## 2. Managed PostgreSQL Setup

### Requirements
- PostgreSQL 16+
- SSL mode required (`sslmode=require`)
- Connection pooling support (e.g. PgBouncer / Neon connection pooling)

### Setup Steps
1. Create a database instance on your managed provider (Neon, Supabase, or AWS RDS).
2. Note the connection URI. Example:
   ```
   postgresql://giftmind_user:secret_password@ep-cool-db.us-east-1.aws.neon.tech/giftmind?sslmode=require
   ```
3. GiftMind's backend automatically normalizes `postgres://` and `postgresql://` URIs to the asynchronous `postgresql+asyncpg://` dialect upon startup.

### Run Database Migrations in Production
Before starting the API server, execute database migrations:
```bash
# Set production environment variables
export DATABASE_URL="postgresql+asyncpg://giftmind_user:secret_password@host:port/giftmind?sslmode=require"
export APP_ENV="production"
export JWT_SECRET_KEY="<strong-random-32-byte-hex-secret>"
export GOOGLE_API_KEY="<your-google-api-key>"

cd backend
alembic upgrade head
```

Verify migration status:
```bash
alembic current
alembic check
```

---

## 3. Backend Deployment (Render, Railway, or Fly.io)

### Configuration (Render Web Service Example)
- **Environment**: Python 3.12
- **Build Command**: `pip install -e "./backend"`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2`
- **Health Check Path**: `/health`

### Required Backend Environment Variables

| Variable | Description | Production Example |
|---|---|---|
| `APP_ENV` | Application environment (enforces security validations) | `production` |
| `DEBUG` | Disable debug error reflection in responses | `False` |
| `DATABASE_URL` | Async PostgreSQL connection URI | `postgresql+asyncpg://user:pass@host:5432/giftmind?sslmode=require` |
| `DB_POOL_SIZE` | Database connection pool size | `10` |
| `DB_MAX_OVERFLOW` | Maximum pool overflow connections | `20` |
| `DB_POOL_TIMEOUT` | Pool timeout in seconds | `30` |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins | `https://giftmind.yourdomain.com` |
| `JWT_SECRET_KEY` | Min 32-character high-entropy secret for signing JWTs | `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifespan | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifespan | `7` |
| `AUTH_COOKIE_NAME` | Cookie name for refresh token | `giftmind_refresh_token` |
| `AUTH_COOKIE_PATH` | Path scope for refresh cookie | `/api/v1/auth` |
| `AUTH_COOKIE_DOMAIN` | Parent domain for cookie sharing across subdomains | `.yourdomain.com` |
| `AUTH_COOKIE_SECURE` | Enforce HTTPS-only cookie transmission | `True` |
| `AUTH_COOKIE_SAMESITE` | Cookie SameSite mode (`lax` for same parent domain) | `lax` |
| `CSRF_COOKIE_NAME` | CSRF cookie token name | `giftmind_csrf_token` |
| `CSRF_HEADER_NAME` | CSRF verification header | `x-csrf-token` |
| `AI_PROVIDER` | AI inference backend (`google` for hosted Gemma 4) | `google` |
| `GOOGLE_API_KEY` | Server-side Google Gemini API key for Gemma 4 | `AIzaSy...` |
| `GEMMA_MODEL` | Open-weight model hosted on Gemini infrastructure | `gemma-4-26b-a4b-it` |
| `AI_REQUEST_TIMEOUT_SECONDS` | Timeout for AI inference call | `90.0` |

---

## 4. Frontend Deployment (Vercel)

### Configuration
- **Framework Preset**: Next.js
- **Root Directory**: `frontend`
- **Node.js Version**: 20.x or 22.x
- **Build Command**: `next build`
- **Output Directory**: `.next`

### Required Frontend Environment Variables

| Variable | Description | Production Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Full URL to the production backend API | `https://api.giftmind.yourdomain.com` |

---

## 5. Security & Network Hardening

### HTTPS & SSL/TLS
- All production traffic must terminate on TLS 1.3 or TLS 1.2 with secure ciphers.
- Vercel and Render handle SSL certificate issuance (Let's Encrypt) automatically when custom domains are mapped.

### Double-Submit CSRF Protection
- GiftMind enforces Double-Submit CSRF protection on all state-changing endpoints (`POST`, `PUT`, `DELETE`).
- On registration, login, and refresh, the server sets a readable `giftmind_csrf_token` cookie.
- The frontend client reads this cookie and passes it in the `X-CSRF-Token` HTTP header on requests.
- State-changing requests missing or mismatching the token are rejected with `403 Forbidden`.

### Open-Weight Gemma 4 Inference Quotas
- Hosted Gemma 4 (`gemma-4-26b-a4b-it`) via the Google Gemini API has rate limits on the free tier (30 RPM, 16K TPM).
- Set `AI_REQUEST_TIMEOUT_SECONDS=90.0` to accommodate narrative story generation latency.
- For high-volume production, link a billing account in Google AI Studio to unlock higher RPM tiers.

---

## 6. Health Checks, Monitoring & Rollbacks

### Health Check Endpoint
- Path: `GET https://api.giftmind.yourdomain.com/health`
- Expected Response: `200 OK`
  ```json
  {
    "status": "ok",
    "service": "giftmind-api"
  }
  ```

### Rollback Procedure
1. **Frontend**: In the Vercel dashboard, select **Deployments**, locate the last known healthy deployment, and click **Promote to Production** (instant zero-downtime rollback).
2. **Backend**: In Render/Railway, redeploy the previous commit tag or image digest.
3. **Database**: If a migration causes an issue, downgrade using Alembic:
   ```bash
   cd backend
   alembic downgrade -1
   ```
