# GiftMind

> **Turn Memories Into Meaningful Gifts.**

An open-source AI-powered gifting platform that helps users discover thoughtful gift ideas and transform personal memories into beautiful digital keepsakes.

Developed for **Hacktoberfest 2026 Week 2** following production-grade software engineering standards.

---

## 🚀 Features: Implemented vs Planned

To ensure engineering transparency and integrity, features are strictly categorized by implementation status:

### Implemented (Phase 1: Production Foundation)
- [x] **Monorepo Architecture**: Clean separation between `backend/`, `frontend/`, `docs/`, and container infrastructure.
- [x] **FastAPI Application Factory**: Structured configuration with `pydantic-settings`, async lifespan management, CORS filtering, and centralized error handling.
- [x] **Health Check Endpoint**: Available at `GET /health` returning `{ "status": "ok", "service": "giftmind-api" }`.
- [x] **Database Engine & Session Layer**: SQLAlchemy 2.x async engine with `asyncpg`, connection pooling, and dependency injection (`get_db`).
- [x] **Alembic Async Migrations**: Migration environment wired to application settings and `Base.metadata` autogeneration.
- [x] **Next.js 14 App Router Frontend**: TypeScript in strict mode, responsive Tailwind CSS dark-theme layout, and centralized API client.
- [x] **Docker Compose Infrastructure**: Local PostgreSQL 16 service with persistent volume and automated health check.
- [x] **CI Pipeline**: GitHub Actions workflow running backend tests, Ruff linting, frontend linting, strict type checks, and Next.js production builds.

### Planned (Future Phases — Do Not Use Prematurely)
- [ ] **Phase 2 — Memory & Preference Engine**: Memory ingestion, tagging, and preference vector search.
- [ ] **Phase 2 — AI Gift Recommendations**: Open-weight model integration (Gemma) via an Ollama-compatible inference adapter.
- [ ] **Phase 3 — Keepsake & Story Generation**: AI narrative generation turning curated memories into personalized gift books.
- [ ] **Phase 3 — PDF Generation & Digital Keepsakes**: High-fidelity export of keepsakes for physical or digital delivery.
- [ ] **Phase 4 — Authentication & User Profiles**: Secure multi-tenant authentication and private memory vaults.
- [ ] **Phase 4 — Private Object Storage**: S3-compatible asset storage for personal photos and memories.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.12+, FastAPI, Pydantic v2, `pydantic-settings`, SQLAlchemy 2.x (async), `asyncpg`, PostgreSQL 16, Alembic, Ruff, Pytest, HTTPX |
| **Frontend** | Next.js 14 (App Router), TypeScript (Strict Mode), Tailwind CSS v3, React 18, Lucide React |
| **Infrastructure** | Docker Compose, PostgreSQL 16 Alpine, GitHub Actions CI |

---

## 📂 Repository Structure

```
giftmind/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow
├── backend/
│   ├── alembic/                 # Async Alembic migration setup
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   ├── app/
│   │   ├── api/v1/router.py     # Centralized API v1 routing
│   │   ├── core/config.py       # Pydantic-settings application configuration
│   │   ├── db/session.py        # Async engine, sessionmaker, and Base
│   │   ├── models/__init__.py   # Model registry for Alembic discovery
│   │   ├── repositories/        # Future data persistence layer
│   │   ├── schemas/health.py    # Health check schemas
│   │   ├── services/            # Future domain services
│   │   └── main.py              # Application factory & lifespan
│   ├── tests/                   # Backend test suite (Pytest + HTTPX)
│   ├── .env.example             # Documented backend environment template
│   ├── alembic.ini              # Alembic configuration
│   └── pyproject.toml           # Backend dependencies, Ruff, Pytest config
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css      # Design tokens and styles
│   │   │   ├── layout.tsx       # Root layout and metadata
│   │   │   └── page.tsx         # Homepage with roadmap & API health card
│   │   ├── components/          # Shared components
│   │   ├── features/            # Feature modules
│   │   ├── lib/api.ts           # Centralized API client
│   │   └── types/               # TypeScript interfaces
│   ├── .env.example             # Documented frontend environment template
│   ├── package.json             # Frontend scripts and dependencies
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   └── tsconfig.json            # Strict TypeScript configuration
├── docs/
│   └── architecture.md          # Architectural decisions & design
├── docker-compose.yml           # PostgreSQL container setup
├── LICENSE                      # MIT License
└── README.md                    # Project documentation
```

---

## ⚡ Local Development Setup

### Prerequisites
- **Python**: 3.12 or higher
- **Node.js**: 20 or higher (with npm)
- **Docker**: Docker and Docker Compose (or local PostgreSQL 16)

---

### 1. Database Setup (Docker Compose)

Start the local PostgreSQL service:

```bash
docker compose up -d
```

Verify that the database is healthy:

```bash
docker compose ps
```

The database will be accessible on `localhost:5432` with credentials:
- **Database**: `giftmind`
- **User**: `postgres`
- **Password**: `postgres`

---

### 2. Backend Setup

1. Navigate to the backend directory and set up a virtual environment:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -e ".[dev]"
   ```

3. Create the local environment file:
   ```bash
   cp .env.example .env
   ```

4. Verify database migrations:
   ```bash
   alembic check
   ```

5. Run the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

The backend will be available at:
- **API Base**: `http://localhost:8000`
- **Health Check**: `http://localhost:8000/health`
- **Interactive OpenAPI Docs**: `http://localhost:8000/api/v1/docs`

---

### 3. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the local environment file:
   ```bash
   cp .env.example .env.local
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at: `http://localhost:3000`

---

## 🧪 Running Tests & Quality Checks

### Backend Checks
From the `backend/` directory:

```bash
# Run automated tests
pytest

# Run Ruff linter
ruff check app tests

# Run Ruff code format check
ruff format --check app tests
```

### Frontend Checks
From the `frontend/` directory:

```bash
# TypeScript strict type checking
npm run type-check

# ESLint check
npm run lint

# Production build validation
npm run build
```

---

## 📄 License

This project is licensed under the terms of the [MIT License](LICENSE).
