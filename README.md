# WindPulse – UK Wind Procurement Intelligence Dashboard

> **AI Tools Disclosure:** This application was built with the assistance of Google Antigravity (an AI coding assistant powered by Gemini). All architecture decisions, data verification (live API inspection), methodology choices, and code review were performed by the developer. The AI accelerated implementation; all engineering judgement and correctness is the developer's responsibility.

---

## Overview

WindPulse helps UK energy utility procurement teams make informed day-ahead electricity purchase decisions by:

1. **Showing the latest wind generation forecasts** available at decision time (live dashboard)
2. **Quantifying forecast accuracy** with MAE, RMSE, bias, and lead-time breakdown so procurement can size a wind uncertainty buffer

**Scope:** National GB wind only. Data exclusively from Elexon BMRS (FUELHH actuals + WINDFOR forecasts). January 2026 decisions.

---

## Directory Structure

```
xwrp7k/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application, all endpoints
│   │   ├── elexon_client.py     # Elexon BMRS API client (httpx, retry logic)
│   │   └── data_processing.py  # Forecast selection, alignment, metrics
│   ├── tests/
│   │   └── test_data_processing.py  # Pytest unit tests (40+ assertions)
│   ├── requirements.txt         # Production dependencies
│   └── requirements-dev.txt    # Dev + test dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardChart.tsx   # Live forecast vs actuals chart
│   │   │   ├── JanuaryCharts.tsx    # January analysis charts
│   │   │   ├── KpiCard.tsx          # Metric summary cards
│   │   │   └── States.tsx           # Loading / error / empty states
│   │   ├── hooks/
│   │   │   └── useApi.ts            # Generic API fetch hook
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx    # Live wind view
│   │   │   └── AnalysisPage.tsx    # Jan 2026 accuracy analysis
│   │   ├── tests/
│   │   │   └── App.test.tsx         # Frontend smoke tests (Vitest)
│   │   ├── api.ts                   # Typed API client
│   │   ├── types.ts                 # TypeScript types (matches backend)
│   │   ├── App.tsx                  # Root component with navigation
│   │   ├── main.tsx                 # React entry point
│   │   └── index.css               # Complete design system (dark theme)
│   ├── package.json
│   ├── vite.config.ts
│   └── vitest.config.ts
├── docker/
│   └── nginx.conf                   # Nginx reverse proxy config
├── Dockerfile                       # Multi-stage (backend + frontend)
├── docker-compose.yml               # One-command local run
├── .env.example                     # Environment variable template
└── README.md
```

---

## Data Sources

| Dataset | Endpoint | Resolution | Description |
|---------|----------|------------|-------------|
| FUELHH  | `data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream` | 30-min | Actual wind generation (MW), filtered to `fuelType=WIND` |
| WINDFOR | `data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream` | 60-min | Published wind forecasts (MW). Each run covers ~72 hours ahead |

Both endpoints support `publishDateTimeFrom` / `publishDateTimeTo` for historical data access (verified by live API inspection on 2026-10-31).

---

## Methodology & Assumptions

### Day-ahead Cutoff (Documented Assumption)
> **Assumption, NOT a verified market rule.** We use **noon UTC (12:00 UTC)** on the day before delivery (D−1) as the decision cutoff. The UK N2EX day-ahead market typically closes around 11:00 UK time, but the exact cutoff varies and is not publicly documented in a machine-readable way. Using noon UTC gives a conservative, well-documented assumption.

### Forecast Selection (No-Leakage)
For each delivery hour H in January 2026:
1. Calculate cutoff = `(delivery_date - 1 day) @ 12:00:00 UTC`
2. Filter WINDFOR records to those with `publishTime <= cutoff`
3. Select the **latest** (most recently published) eligible forecast
4. Records with no eligible forecast are excluded; never zero-filled.

### Resolution Alignment
- FUELHH (30-min) actuals → averaged to hourly intervals to match WINDFOR (60-min)
- Matching is by `startTime` hour boundary (UTC)

### Accuracy Metrics
| Metric | Formula | Sign convention |
|--------|---------|----------------|
| MAE | mean(\|forecast − actual\|) | Unsigned |
| RMSE | √mean((forecast − actual)²) | Unsigned |
| Bias | mean(forecast − actual) | +ve = over-forecast, −ve = under-forecast |

**Procurement implication:** RMSE provides a natural uncertainty buffer estimate. 
A positive bias means wind was over-predicted → thermal procurement should be higher than the forecast gap suggests.
Wind uncertainty is **one input** among many (demand forecast error, network constraints, price signals).

### Timezone
January 2026 = UTC = Europe/London (no BST offset). All timestamps stored and displayed in UTC.

---

## Local Development

### Prerequisites
- Python 3.12+
- Node.js 20+

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

App at `http://localhost:3000`.

---

## Docker (One-Command Run)

```bash
# Build and start both services
docker-compose up --build

# Access the app
open http://localhost:3000

# Stop
docker-compose down
```

Frontend proxies `/api/*` to the backend container via nginx.

---

## Running Tests

### Backend (pytest)
```bash
cd backend
pip install -r requirements-dev.txt
pytest tests/ -v
```

### Frontend (Vitest)
```bash
cd frontend
npm install
npm test
```

---

## Deployed Application

| | |
|--|--|
| **Frontend** | https://windpulse-xwrp7k.vercel.app *(link to be updated after deployment)* |
| **Backend** | Deployed on Railway/Render *(link to be updated)* |
| **Repo** | https://github.com/proghead00/xwrp7k |

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/dashboard` | Latest forecast + 3-day actuals |
| `GET /api/january-analysis` | Full Jan 2026 analysis (cached 1h) |
| `GET /api/forecasts/latest` | Most recent WINDFOR run |
| `GET /api/actuals?days=N` | Recent actuals (1–31 days) |

Full docs: `http://localhost:8000/docs` (Swagger UI).

---

## Limitations & Scope Trade-offs

1. **January 2026 data only** – The accuracy analysis is for January 2026 per the brief. Live dashboard shows current data.
2. **Wind only** – No solar, hydro, or demand-side data.
3. **No demand forecast** – Full procurement quantity requires demand minus all renewables; only wind uncertainty is quantified.
4. **Cutoff is an assumption** – The noon UTC D−1 cutoff is not a verified market rule.
5. **In-process cache** – The 1-hour analysis cache resets on service restart. A Redis cache would be better for production.
6. **No auth** – The API is public; no authentication is required or implemented for this MVP.
7. **API rate limits** – Elexon BMRS does not publish rate limits; the backend fetches on-demand with no pre-computed data store.

---

## Architecture

```
[User Browser]
      │
      ▼
[React/Vite Frontend (Vercel / nginx)]
      │  HTTPS /api/*
      ▼
[FastAPI Backend (Render / Railway)]
      │  HTTPS
      ▼
[Elexon BMRS API]
  FUELHH + WINDFOR
```

Key design decisions:
- **No database** – data is fetched on demand and cached in process memory. January data is ~5MB raw; no persistence needed for MVP.
- **Parallel fetches** – Forecasts and actuals are fetched with `asyncio.gather` to minimize latency.
- **No-leakage guarantee** – The cutoff filter is implemented at the Python layer, not the Elexon API layer, ensuring correctness regardless of API behavior.
- **Separation of concerns** – `elexon_client.py` (network) → `data_processing.py` (logic) → `main.py` (routing). Each layer is independently testable.
