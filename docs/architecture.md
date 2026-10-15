# Architecture Overview — GiftMind

**GiftMind** is an open-source AI-powered gifting platform designed to transform personal memories into thoughtful gift ideas and digital keepsakes.

This document outlines the system architecture established in **Phase 1: Production-Grade Project Foundation**.

---

## 1. Monorepo Organization

```
giftmind/
├── backend/                  # FastAPI Application & Async Engine
│   ├── alembic/              # Async database migration environment
│   ├── app/
│   │   ├── api/v1/           # Versioned API routes & sub-routers
│   │   ├── core/             # Configuration & environment settings
│   │   ├── db/               # Async SQLAlchemy engine, session maker, base
│   │   ├── models/           # Domain models & Alembic metadata registry
│   │   ├── repositories/     # Data persistence abstraction (future phases)
│   │   ├── schemas/          # Pydantic v2 validation contracts
│   │   ├── services/         # Business & domain logic (future phases)
│   │   └── main.py           # Application factory & lifespan
│   ├── tests/                # Automated pytest suite (unit, health, db)
│   ├── alembic.ini           # Migration settings
│   └── pyproject.toml        # Backend dependencies & tool configs
├── frontend/                 # Next.js 14 App Router
│   ├── src/
│   │   ├── app/              # App router pages, layouts, styles
│   │   ├── components/       # Shared UI components
│   │   ├── features/         # Domain feature slices
│   │   ├── lib/              # Centralized API clients and helpers
│   │   └── types/            # TypeScript interfaces
│   ├── package.json          # Frontend dependencies & scripts
│   └── tsconfig.json         # Strict TypeScript configuration
├── docs/                     # System architecture & guidelines
├── .github/workflows/        # Automated CI pipelines
├── docker-compose.yml        # PostgreSQL local development container
├── README.md                 # Project documentation
└── LICENSE                   # MIT License
```

---

## 2. Backend Architecture

### Application Factory & Lifespan
- **Factory Pattern**: `create_app(settings)` enables environment injection, deterministic testing, and isolated instance creation without global state pollution.
- **Async Lifespan Context**: FastAPI `@asynccontextmanager` ensures that connection pools and async resources are cleanly disposed on application shutdown (`close_db_engine()`).
- **Standardized Error Handling**: Unhandled exceptions return a uniform JSON error contract:
  ```json
  {
    "error": {
      "code": "INTERNAL_SERVER_ERROR",
      "message": "Error details (in debug mode) or generic message"
    }
  }
  ```

### Database & Concurrency
- **Asynchronous Driver**: PostgreSQL connectivity via `asyncpg` combined with SQLAlchemy 2.x async engine (`AsyncSession`).
- **Connection Pooling**: Configurable connection pool (`pool_size`, `max_overflow`, `pool_timeout`, `pool_recycle`, `pool_pre_ping`).
- **Lazy Initialization**: No connections are opened during module imports; the engine is initialized lazily or during the application lifespan.
- **Model Registry Strategy**: All domain models are imported into `app.models` so Alembic autogenerate reliably discovers table metadata through `Base.metadata`.

### Migration Strategy
- Alembic `env.py` connects asynchronously using `async_engine_from_config` with `pool.NullPool`.
- Database URLs are dynamically loaded from `app.core.config.get_settings()`, preventing hardcoded credentials.

---

## 3. Frontend Architecture

### Next.js App Router & Strict Mode
- Next.js 14 App Router with React 18, utilizing server and client components cleanly.
- Strict TypeScript configuration (`strict: true`, path alias `@/*`).
- Tailwind CSS v3 for styling with responsive design tokens and dark mode palette.

### Centralized API Client
- Centralized `fetchApi` and `checkBackendHealth` abstractions located in `src/lib/api.ts`.
- Uses `NEXT_PUBLIC_API_URL` with safe default fallback to `http://localhost:8000`.
- Typed errors through `ApiError` with status codes and structured payloads.

---

## 4. Security & Quality Guardrails

1. **Zero Secrets in Source**: All configurations are sourced from `.env` via `pydantic-settings` or Next.js environment variables.
2. **CORS Enforcement**: Allowed origins are restricted by environment configuration (`CORS_ORIGINS`).
3. **Automated Testing & Linting**:
   - Backend: Ruff linting and Pytest test suite covering health check, application initialization, and database connection.
   - Frontend: ESLint, strict TypeScript compiler check (`tsc --noEmit`), and production build verification (`next build`).
4. **CI Automation**: GitHub Actions runs backend tests, Alembic configuration check, frontend linting, type validation, and production build on every push.
