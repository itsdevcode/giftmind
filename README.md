# GiftMind

> **Turn Memories Into Meaningful Gifts.**

An open-source AI-powered gifting platform that helps users discover thoughtful gift ideas and transform personal memories into beautiful digital keepsakes.

Developed for **Hacktoberfest 2026 Week 2** following production-grade software engineering standards.

---

## 🚀 Features: Implemented vs Planned

To ensure engineering transparency and integrity, features are strictly categorized by implementation status:

### Implemented (Phase 1: Production Foundation & Phase 2: Auth and Gift Management)
- [x] **Monorepo Architecture**: Clean separation between `backend/`, `frontend/`, `docs/`, and container infrastructure.
- [x] **FastAPI Application Factory**: Structured configuration with `pydantic-settings`, async lifespan management, CORS filtering, and centralized error handling.
- [x] **Health Check Endpoint**: Available at `GET /health` returning `{ "status": "ok", "service": "giftmind-api" }`.
- [x] **Database Engine & Session Layer**: SQLAlchemy 2.x async engine with `asyncpg`, connection pooling, and dependency injection (`get_db`).
- [x] **Alembic Async Migrations**: Migration environment wired to application settings and `Base.metadata` autogeneration.
- [x] **Authentication & Token Management**:
  - Argon2id password hashing via `argon2-cffi`.
  - Short-lived JWT access tokens and long-lived refresh tokens stored server-side with SHA-256 hash.
  - HttpOnly and SameSite cookie transport for refresh tokens with rotation and revocation protection.
  - Double-Submit CSRF cookie verification on state-changing endpoints.
  - Endpoints: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/users/me`.
- [x] **Recipient CRUD & Ownership Isolation**:
  - Full CRUD operations with strict tenant isolation scoped to authenticated `user_id`.
  - Paginated list endpoints with deterministic ordering.
  - Endpoints: `POST /api/v1/recipients`, `GET /api/v1/recipients`, `GET /api/v1/recipients/{id}`, `PUT /api/v1/recipients/{id}`, `DELETE /api/v1/recipients/{id}`.
- [x] **Gift Project Management**:
  - Full CRUD operations with foreign key integrity to user and recipient.
  - Recipient ownership verification and budget constraint validation (`budget_min >= 0`, `budget_max >= budget_min`).
  - Endpoints: `POST /api/v1/gift-projects`, `GET /api/v1/gift-projects`, `GET /api/v1/gift-projects/{id}`, `PUT /api/v1/gift-projects/{id}`, `DELETE /api/v1/gift-projects/{id}`.
- [x] **Next.js 14 App Router Frontend**: TypeScript in strict mode, responsive Tailwind CSS dark-theme layout, and centralized API client.
- [x] **CI Pipeline**: GitHub Actions workflow running backend tests, Ruff linting, frontend linting, strict type checks, and Next.js production builds.

### Planned (Future Phases — Do Not Use Prematurely)
- [ ] **Phase 3 — Memory & Preference Engine**: Memory ingestion, tagging, and preference vector search.
- [ ] **Phase 3 — AI Gift Recommendations**: Open-weight model integration (Gemma) via an Ollama-compatible inference adapter.
- [ ] **Phase 4 — Keepsake & Story Generation**: AI narrative generation turning curated memories into personalized gift books.
- [ ] **Phase 4 — PDF Generation & Digital Keepsakes**: High-fidelity export of keepsakes for physical or digital delivery.
- [ ] **Phase 5 — Private Object Storage**: S3-compatible asset storage for personal photos and memories.

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

### API Reference & Examples (Phase 2)

#### 1. Authentication (`/api/v1/auth`)

- **`POST /api/v1/auth/register`**
  - **Request Body**:
    ```json
    {
      "name": "Alex Mercer",
      "email": "alex@example.com",
      "password": "StrongPassword123!"
    }
    ```
  - **Response (201 Created)**:
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "bearer",
      "expires_at": "2026-10-17T02:05:00Z",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Alex Mercer",
        "email": "alex@example.com",
        "is_active": true,
        "created_at": "2026-10-17T01:50:00Z",
        "updated_at": "2026-10-17T01:50:00Z"
      },
      "csrf_token": "c7b744d081..."
    }
    ```
  - **Set-Cookie Headers**:
    - `giftmind_refresh_token=<token>; Path=/api/v1/auth; HttpOnly; SameSite=Lax`
    - `giftmind_csrf_token=<token>; Path=/; SameSite=Lax`

- **`POST /api/v1/auth/login`**
  - **Request Body**:
    ```json
    {
      "email": "alex@example.com",
      "password": "StrongPassword123!"
    }
    ```
  - **Response (200 OK)**: Token response with fresh access token and HttpOnly refresh cookie.

- **`POST /api/v1/auth/refresh`**
  - **Headers**: `x-csrf-token: <csrf_token>`
  - **Cookies**: `giftmind_refresh_token=<token>`
  - **Response (200 OK)**: Rotates refresh token, revoking prior token, and returns fresh access token.

- **`POST /api/v1/auth/logout`**
  - **Headers**: `x-csrf-token: <csrf_token>`
  - **Cookies**: `giftmind_refresh_token=<token>`
  - **Response (200 OK)**: `{ "status": "logged_out" }` (revokes refresh token and clears auth cookies).

- **`GET /api/v1/users/me`**
  - **Headers**: `Authorization: Bearer <access_token>`
  - **Response (200 OK)**: Authenticated user profile (`UserRead`).

---

#### 2. Recipient Management (`/api/v1/recipients`)
All recipient endpoints require `Authorization: Bearer <access_token>`.

- **`POST /api/v1/recipients`**
  - **Request Body**:
    ```json
    {
      "name": "Sarah Connor",
      "relationship": "Mom",
      "interests": ["Gardening", "Sci-Fi", "Espresso"],
      "notes": "Loves vintage tea sets and mystery novels."
    }
    ```
  - **Response (201 Created)**: Returns created recipient entity with assigned UUID and timestamps.

- **`GET /api/v1/recipients?limit=20&offset=0`**
  - **Response (200 OK)**:
    ```json
    {
      "items": [
        {
          "id": "e96b9f2e-bf73-45bb-b3b3-8ec23c4a243f",
          "user_id": "550e8400-e29b-41d4-a716-446655440000",
          "name": "Sarah Connor",
          "relationship": "Mom",
          "interests": ["Gardening", "Sci-Fi", "Espresso"],
          "notes": "Loves vintage tea sets and mystery novels.",
          "created_at": "2026-10-17T01:50:00Z",
          "updated_at": "2026-10-17T01:50:00Z"
        }
      ],
      "total": 1,
      "limit": 20,
      "offset": 0
    }
    ```

- **`GET /api/v1/recipients/{id}`**: Retrieve single recipient (returns 404 if not owned by current user).
- **`PUT /api/v1/recipients/{id}`**: Update recipient details.
- **`DELETE /api/v1/recipients/{id}`**: Delete recipient (204 No Content).

---

#### 3. Gift Project Management (`/api/v1/gift-projects`)
All gift project endpoints require `Authorization: Bearer <access_token>`.

- **`POST /api/v1/gift-projects`**
  - **Request Body**:
    ```json
    {
      "recipient_id": "e96b9f2e-bf73-45bb-b3b3-8ec23c4a243f",
      "title": "60th Birthday Surprise",
      "occasion": "Birthday",
      "occasion_date": "2026-11-15",
      "budget_min": "50.00",
      "budget_max": "150.00",
      "currency": "USD",
      "status": "draft"
    }
    ```
  - **Response (201 Created)**: Returns created gift project. Rejects `budget_max < budget_min` with 422 and non-owned recipients with 404.

- **`GET /api/v1/gift-projects?limit=20&offset=0`**
  - **Response (200 OK)**: Paginated gift projects owned strictly by the authenticated user.

- **`GET /api/v1/gift-projects/{id}`**: Retrieve project (404 on cross-user access).
- **`PUT /api/v1/gift-projects/{id}`**: Update project details, occasion, budgets, or status (`draft`, `in_progress`, `completed`).
- **`DELETE /api/v1/gift-projects/{id}`**: Delete gift project (204 No Content).

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
