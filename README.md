# NeighbourShare

A community-driven platform that allows neighbours to **lend, borrow, and trade** physical items and services using a trust-based, QR-verified exchange system and a **Community Time Credit** economy.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Core System Concepts](#core-system-concepts)
  - [Users & Trust](#users--trust)
  - [Items & Listings](#items--listings)
  - [Transactions & State Machine](#transactions--state-machine)
  - [QR Digital Handshake](#qr-digital-handshake)
  - [Community Time Credits](#community-time-credits)
  - [Dispute Resolution](#dispute-resolution)
  - [Admin Dashboard](#admin-dashboard)
- [Project Structure](#project-structure)
- [Running Locally](#running-locally)
  - [Option A: Docker (Recommended)](#option-a-docker-recommended)
  - [Option B: Manual Setup](#option-b-manual-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)

---

## Overview

NeighbourShare enables verified community members to:

- List physical items (tools, appliances, etc.) or skills/services for borrowing or swapping
- Negotiate trades directly or open listings to offers
- Execute exchanges via a secure **QR-code Digital Handshake** that timestamps item hand-off and return
- Earn **Community Time Credits** for responsible sharing, which increase their neighbourhood trust score
- Raise and resolve disputes with a structured admin workflow

---

## Architecture

```
+--------------------------------------------------+
|              Nginx (Port 80 / 443)               |
|           Reverse proxy / Static files           |
+---------------+------------------+---------------+
                |                  |
      +---------v--------+  +------v---------+
      |  React Frontend  |  |  Django API    |
      |  Vite / React 18 |  |  (Port 8000)   |
      |  (Port 3000)     |  |                |
      +------------------+  +-------+--------+
                                    |
              +---------------------+-------------------+
              |                     |                   |
      +-------v------+  +-----------v-----+  +----------v---------+
      |  PostgreSQL  |  |     Redis       |  |  Celery Workers    |
      |  + PostGIS   |  |  Cache / Broker |  |  + Celery Beat     |
      |  (Port 5432) |  |  (Port 6379)   |  |  (Async tasks)     |
      +--------------+  +-----------------+  +--------------------+
```

All services are orchestrated via **Docker Compose**. In development you can also run the backend directly using SQLite with no PostGIS required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, React Router v6, Tailwind CSS |
| **Map / Location** | Leaflet + React Leaflet, Nominatim (OpenStreetMap geocoding) |
| **Backend** | Django 4.2, Django REST Framework |
| **Auth** | JWT (SimpleJWT) — 15-min access tokens, 7-day rotating refresh tokens |
| **Database** | PostgreSQL 15 + PostGIS 3.3 (geospatial queries) |
| **Task Queue** | Celery 5 + Redis (workers for credit awards, dispute flags, QR cleanup) |
| **Cache / Sessions** | Redis (production) / Django LocMemCache (development) |
| **QR Codes** | HMAC-SHA256 signed, single-use tokens stored in Redis with 30-min TTL |
| **Containerisation** | Docker + Docker Compose |
| **Reverse Proxy** | Nginx |

---

## Core System Concepts

### Users & Trust

Every user must complete a **3-step verified registration** before they can lend or borrow:

| Step | What happens |
|---|---|
| `0` | Account created (email + password) |
| `1` | Profile details saved |
| `2` | National ID verified (SHA-256 hashed — never stored in plaintext) |
| `3` | Home address geocoded via Nominatim |

Each user has a `trust_score` (float) that starts at **50** upon ID verification and grows with every successful exchange. Trust score growth is handled asynchronously by Celery after a transaction closes.

---

### Items & Listings

Listings support two types:

- **Physical Item** — a borrowable object
- **Skill / Service** — a time-based service offered by a neighbour

Every item has:

- A **tier** (`tier_1` / `tier_2` / `tier_3`) reflecting exchange scale
- A **trade type**: specific trade request, open to offers, or community credit only
- A **geospatial location** (PostGIS `PointField`) enabling proximity-based search
- An **availability calendar** (JSON) for scheduling
- A `time_credits_per_day` rate used to calculate how many credits a borrow is worth

Items are automatically located at the owner's home address when no explicit location is given.

---

### Transactions & State Machine

Every borrow/trade goes through a strict **state machine** enforced in `backend/transactions/state.py`:

```
PENDING --> AGREED --> ACTIVE --> ITEM_OUT --> ITEM_RETURNED --> CLOSED
   |           |          |           |               |
   +-----------+----------+-----------+---------------+--------> DISPUTED --> CLOSED
```

| State | Meaning |
|---|---|
| `PENDING` | Borrower has requested the item |
| `AGREED` | Lender has accepted the request |
| `ACTIVE` | Both parties are ready for the handoff |
| `ITEM_OUT` | QR handshake confirmed; item is with the borrower |
| `ITEM_RETURNED` | QR return scan confirmed; item is back with the lender |
| `CLOSED` | Transaction complete; time credits awarded asynchronously |
| `DISPUTED` | Either party raised a dispute; admin is flagged automatically |

Every state change is **append-only** — a `TransactionEvent` record is written for each transition, providing a full audit trail.

---

### QR Digital Handshake

The handshake ensures both parties physically meet and confirm the exchange. Each QR token is:

1. **HMAC-SHA256 signed** using the Django `SECRET_KEY`
2. **Time-limited** — expires after 30 minutes
3. **Single-use** — stored in Redis as `unused` and atomically set to `used` on first scan, preventing replay attacks

**Handoff flow:**
1. Lender generates a QR code at handoff
2. Borrower scans it → both `lender_scanned_handoff` and `borrower_scanned_handoff` are set → state transitions to `ITEM_OUT`

**Return flow:**
1. Either party generates a return QR code
2. Other party scans it → both return scan flags are set → state transitions to `ITEM_RETURNED`

Item condition is recorded as text at both handoff and return to support dispute evidence.

---

### Community Time Credits

Instead of money, NeighbourShare uses **time credits** as its trust currency:

- Credits are calculated as: `time_credits_per_day × number_of_days`
- On `CLOSED`, a Celery task (`award_time_credits`) adds to trust scores:
  - **Lender** receives `total_credits × 0.5`
  - **Borrower** receives `total_credits × 0.3`
- Ratings use a **blind reveal** system — both parties submit independently, and ratings are made visible simultaneously (or auto-revealed after 72 hours by a scheduled Celery task)

---

### Dispute Resolution

When a transaction enters `DISPUTED`:

1. A `DisputeResolution` record is created automatically
2. A Celery task (`flag_for_admin_review`) writes a `TransactionEvent` and alerts the admin queue
3. Admin staff can assign a reviewer, collect evidence, and set an outcome:

| Outcome | Description |
|---|---|
| `LENDER_FAVOR` | Credits/resolution in the lender's favour |
| `BORROWER_FAVOR` | Credits/resolution in the borrower's favour |
| `SPLIT_CREDITS` | Equitable split |
| `CANCELLED` | Transaction voided |
| `ESCALATED_EXTERNAL` | Referred outside the platform |

Pending transactions older than 24 hours are **automatically expired** to `DISPUTED` by the `check_expired_transactions` Celery Beat periodic task.

---

### Admin Dashboard

Available at `/admin/*` (requires `is_staff = true`). The React frontend communicates with `/api/admin/` endpoints providing:

- **User management** — view, activate/deactivate, inspect profiles and trust scores
- **Dispute queue** — review open disputes, assign reviewers, record outcomes
- **Platform stats** — overview of active transactions, listings, and user verification status

---

## Project Structure

```
NeighbourShare/
├── backend/
│   ├── neighbourshare/         # Django project root
│   │   ├── settings.py         # All app configuration
│   │   ├── celery.py           # Celery app & task routing
│   │   ├── urls.py             # Top-level URL includes
│   │   └── gis_mock.py         # Graceful fallback when GDAL is not installed
│   ├── users/                  # Custom User model, UserProfile, auth & profile views
│   ├── items/                  # Item & ItemImage models, listing CRUD views
│   ├── transactions/           # Core exchange logic
│   │   ├── models.py           # Transaction, TransactionEvent, Rating, DisputeResolution
│   │   ├── state.py            # TransactionStateMachine
│   │   ├── qr.py               # HMAC token generation & single-use verification
│   │   └── tasks.py            # Celery async tasks (credits, disputes, QR cleanup)
│   ├── admin_dashboard/        # Staff-only API views for user & dispute management
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env                    # Local dev environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Registration/   # Multi-step registration wizard + login
│   │   │   ├── ItemSearch/     # Browse and search listings by location/category
│   │   │   ├── ItemDetail/     # View, create, and edit listings
│   │   │   ├── Transaction/    # Transaction detail view and QR scanner
│   │   │   ├── Profile/        # User profile & public profile views
│   │   │   ├── Admin/          # Admin dashboard UI
│   │   │   └── Layout/         # Navbar and Footer
│   │   ├── context/            # AuthContext (JWT storage & silent token refresh)
│   │   ├── api/                # Axios client with auth interceptors
│   │   └── App.jsx             # Route definitions (protected & public routes)
│   ├── package.json
│   ├── vite.config.mjs
│   └── .env                    # Frontend environment variables
│
├── docker-compose.yml          # Full multi-service orchestration
├── nginx.conf                  # Reverse proxy configuration
└── init-db.sh                  # Initialises PostGIS extension in the Docker DB
```

---

## Running Locally

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — for Option A
- **or** Python 3.11+ and Node.js 18+ — for Option B

---

### Option A: Docker (Recommended)

Starts all services — API, frontend, database, Redis, Celery workers, and Nginx.

**1. Clone the repository**

```bash
git clone <repo-url>
cd NeighbourShare
```

**2. Create a root `.env` file** (Docker Compose reads this to configure all services)

```env
SECRET_KEY=your-secret-key-change-me
DEBUG=True
POSTGRES_DB=neighbourshare
POSTGRES_USER=neighbourshare
POSTGRES_PASSWORD=neighbourshare
```

**3. Build and start all services**

```bash
docker-compose up --build
```

**4. Access the application**

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api |
| Django Admin | http://localhost:8000/admin |
| Via Nginx | http://localhost |

**5. Create a superuser (optional)**

```bash
docker-compose exec api python manage.py createsuperuser
```

---

### Option B: Manual Setup

Uses **SQLite** for easy local development — no PostgreSQL or PostGIS installation needed.

#### Backend

**1. Create and activate a virtual environment**

```bash
cd backend

python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

**2. Install dependencies**

```bash
pip install -r requirements.txt
```

**3. Configure the environment**

The `backend/.env` file is already set up for SQLite development:

```env
DEBUG=True
SECRET_KEY=django-insecure-dev-key-change-me-in-production-abc123xyz
USE_SQLITE=True
```

> **Note:** When `USE_SQLITE=True`, the PostGIS geospatial backend is not used, so location-based proximity search is disabled. All other features work normally.

**4. Apply migrations and start the server**

```bash
python manage.py migrate
python manage.py createsuperuser   # optional — required for admin access
python manage.py runserver
```

The API is available at **http://localhost:8000/api**

> **Optional — Celery:** To run background tasks locally you need Redis. Once installed, run:
> ```bash
> celery -A neighbourshare worker -l info
> ```

---

#### Frontend

**1. Install dependencies**

```bash
cd frontend
npm install
```

**2. Check environment variables** (`frontend/.env` is already configured)

```env
VITE_API_URL=http://localhost:8000/api
VITE_NOMINATIM_URL=https://nominatim.openstreetmap.org
```

**3. Start the dev server**

```bash
npm run dev
```

The frontend is available at **http://localhost:5173**

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | *(required)* | Django secret key — change in production |
| `DEBUG` | `False` | Enables debug mode and verbose error pages |
| `USE_SQLITE` | `False` | Use SQLite instead of PostgreSQL (local dev only) |
| `POSTGRES_DB` | `neighbourshare` | PostgreSQL database name |
| `POSTGRES_USER` | `neighbourshare` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `neighbourshare` | PostgreSQL password |
| `POSTGRES_HOST` | `db` | DB host — use `localhost` when running manually |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection URL |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated allowed hosts |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |
| `SITE_URL` | `http://localhost:8000` | Base URL used for payment callbacks |
| `ECOCASH_API_URL` | *(sandbox)* | EcoCash payment gateway URL |
| `ECOCASH_MERCHANT_ID` | — | EcoCash merchant credentials |
| `ECOCASH_API_KEY` | — | EcoCash API key |
| `GDAL_LIBRARY_PATH` | — | Windows only: path to `gdal308.dll` |
| `GEOS_LIBRARY_PATH` | — | Windows only: path to `geos_c.dll` |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |
| `VITE_NOMINATIM_URL` | Nominatim geocoding base URL |

---

## API Reference

All endpoints are prefixed with `/api/`.

| Prefix | App | Description |
|---|---|---|
| `/api/auth/` | `users` | Register, login, logout, token refresh |
| `/api/users/` | `users` | Profile management, trust scores, public profiles |
| `/api/items/` | `items` | List, create, update, and delete item listings |
| `/api/transactions/` | `transactions` | Create requests, state transitions, QR scan, ratings, disputes |
| `/api/admin/` | `admin_dashboard` | Staff-only: user management and dispute resolution |
| `/api/health/` | — | Health check endpoint used by Docker Compose |
| `/admin/` | Django | Built-in Django admin UI |

**Authentication** uses `Bearer` tokens in the `Authorization` header. Access tokens expire after **15 minutes**. Use the refresh endpoint to obtain a new one — refresh tokens rotate on every use and are blacklisted after rotation.

---

## Running Tests

### Backend

```bash
cd backend
pytest
```

With coverage report:

```bash
pytest --cov=. --cov-report=html
```

Test files are co-located with each Django app:

- `items/tests.py`
- `transactions/tests.py`, `tests_qr.py`, `tests_state.py`

### Frontend

```bash
cd frontend
npm test
```

Test files are in `src/__tests__/`.
