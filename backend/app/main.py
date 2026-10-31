"""
FastAPI application: Wind Procurement Intelligence Dashboard

Endpoints:
  GET /api/health                 - Health check
  GET /api/dashboard              - Latest forecast + live actuals
  GET /api/january-analysis       - Full January 2026 analysis (cached)
  GET /api/forecasts/latest       - Latest WINDFOR forecast
  GET /api/actuals                - Recent actuals
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .elexon_client import (
    fetch_latest_wind_forecast,
    fetch_wind_actuals,
    fetch_wind_forecasts,
)
from .data_processing import (
    build_january_delivery_hours,
    compute_accuracy_metrics,
    process_actuals,
    select_decision_time_forecasts,
    delivery_day_cutoff,
    parse_iso,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Wind Procurement Intelligence API",
    description="UK day-ahead wind generation forecasting and accuracy analysis",
    version="1.0.0",
)

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,https://uk-wind-procurement.vercel.app,https://xwrp7k.vercel.app",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_cache: dict = {}
CACHE_TTL_SECONDS = 3600

def _cache_valid(key: str) -> bool:
    if key not in _cache:
        return False
    return (datetime.now(timezone.utc) - _cache[key]["ts"]).seconds < CACHE_TTL_SECONDS

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}

@router.get("/forecasts/latest")
async def get_latest_forecast():
    """Return the most recent WINDFOR forecast series."""
    try:
        records = await fetch_latest_wind_forecast()
        if not records:
            raise HTTPException(status_code=503, detail="No forecast data available from Elexon API")
        return {
            "publishTime": records[0]["publishTime"],
            "count": len(records),
            "data": records,
        }
    except Exception as exc:
        logger.exception("Error fetching latest forecast")
        raise HTTPException(status_code=502, detail=f"Elexon API error: {str(exc)}")

@router.get("/actuals")
async def get_actuals(
    days: int = Query(default=7, ge=1, le=31, description="Number of past days to fetch"),
):
    """Return recent FUELHH wind actuals."""
    try:
        now = datetime.now(timezone.utc)
        pub_from = (now - timedelta(days=days)).isoformat().replace("+00:00", "Z")
        pub_to = now.isoformat().replace("+00:00", "Z")
        raw = await fetch_wind_actuals(pub_from, pub_to)
        actuals = process_actuals(raw)
        return {
            "count": len(actuals),
            "data": [{"hour": k, "generation": v} for k, v in sorted(actuals.items())],
        }
    except Exception as exc:
        logger.exception("Error fetching actuals")
        raise HTTPException(status_code=502, detail=f"Elexon API error: {str(exc)}")

@router.get("/january-analysis")
async def get_january_analysis():
    """
    Full January 2026 wind procurement analysis.
    Applies day-ahead cutoff (noon UTC D-1) to select eligible forecasts.
    Computes MAE, RMSE, bias with lead-time breakdown.
    Cached for 1 hour.
    """
    cache_key = "january_2026"
    if _cache_valid(cache_key):
        logger.info("Returning cached January 2026 analysis")
        return _cache[cache_key]["data"]

    try:
        logger.info("Fetching January 2026 data from Elexon API...")
        forecasts_task = fetch_wind_forecasts(
            publish_from="2025-12-30T00:00:00Z",
            publish_to="2026-02-01T00:00:00Z",
        )
        actuals_task = fetch_wind_actuals(
            publish_from="2026-01-01T00:00:00Z",
            publish_to="2026-02-02T00:00:00Z",
        )
        raw_forecasts, raw_actuals = await asyncio.gather(forecasts_task, actuals_task)

        actuals = process_actuals(raw_actuals)
        delivery_hours = build_january_delivery_hours()
        decision_forecasts = select_decision_time_forecasts(raw_forecasts, delivery_hours)
        metrics = compute_accuracy_metrics(decision_forecasts, actuals)
        daily_summary = _build_daily_summary(decision_forecasts, actuals, delivery_hours)

        result = {
            "period": "January 2026",
            "cutoffAssumption": "Noon UTC (12:00 UTC) on D-1: documented assumption, not a verified market rule",
            "timezone": "UTC (January = UTC = Europe/London winter)",
            "dataSource": "Elexon BMRS (FUELHH actuals, WINDFOR forecasts)",
            "units": "MW (megawatts)",
            "metrics": metrics,
            "dailySummary": daily_summary,
            "forecastCount": len(decision_forecasts),
            "actualCount": len(actuals),
            "matchedPairs": metrics["count"],
            "deliveryHoursRequested": len(delivery_hours),
        }

        _cache[cache_key] = {"ts": datetime.now(timezone.utc), "data": result}
        return result

    except Exception as exc:
        logger.exception("Error computing January analysis")
        raise HTTPException(status_code=502, detail=f"Analysis error: {str(exc)}")

def _build_daily_summary(
    forecasts: dict[str, dict],
    actuals: dict[str, float],
    delivery_hours: list[str],
) -> list[dict]:
    daily: dict[str, dict] = {}
    for hour in delivery_hours:
        date_key = hour[:10]
        if date_key not in daily:
            daily[date_key] = {"forecasts": [], "actuals": []}
        if hour in forecasts:
            daily[date_key]["forecasts"].append(forecasts[hour]["generation"])
        if hour in actuals:
            daily[date_key]["actuals"].append(actuals[hour])

    result = []
    for date_key in sorted(daily.keys()):
        day = daily[date_key]
        f_vals = day["forecasts"]
        a_vals = day["actuals"]
        result.append({
            "date": date_key,
            "avgForecast": round(sum(f_vals) / len(f_vals), 1) if f_vals else None,
            "avgActual": round(sum(a_vals) / len(a_vals), 1) if a_vals else None,
            "forecastHours": len(f_vals),
            "actualHours": len(a_vals),
        })
    return result

@router.get("/dashboard")
async def get_dashboard():
    """Dashboard data: latest forecast + recent actuals for live view."""
    try:
        forecast_task = fetch_latest_wind_forecast()
        now = datetime.now(timezone.utc)
        pub_from = (now - timedelta(days=3)).isoformat().replace("+00:00", "Z")
        pub_to = now.isoformat().replace("+00:00", "Z")
        actuals_task = fetch_wind_actuals(pub_from, pub_to)

        raw_forecasts, raw_actuals = await asyncio.gather(forecast_task, actuals_task)

        actuals = process_actuals(raw_actuals)
        actuals_list = [
            {"hour": k, "generation": v}
            for k, v in sorted(actuals.items())
        ]

        return {
            "latestForecast": {
                "publishTime": raw_forecasts[0]["publishTime"] if raw_forecasts else None,
                "data": raw_forecasts,
            },
            "recentActuals": {
                "count": len(actuals_list),
                "data": actuals_list,
            },
            "fetchedAt": now.isoformat(),
        }
    except Exception as exc:
        logger.exception("Error fetching dashboard data")
        raise HTTPException(status_code=502, detail=f"Elexon API error: {str(exc)}")

# Register routes with both /api prefix and root prefix
app.include_router(router, prefix="/api")
app.include_router(router)

# Mount frontend static distribution if present
potential_dist_paths = [
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
    Path(__file__).resolve().parent.parent / "frontend" / "dist",
    Path("/app/frontend/dist"),
    Path("./frontend/dist"),
]

for p in potential_dist_paths:
    if p.exists() and (p / "index.html").exists():
        app.mount("/", StaticFiles(directory=str(p), html=True), name="static")
        break
