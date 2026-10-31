"""
Elexon BMRS API Client

Fetches FUELHH (actuals) and WINDFOR (forecasts) data.
Both endpoints support publishDateTimeFrom/publishDateTimeTo for historical data.

Key observations from live API inspection (2026-10-31):
- FUELHH: 30-min resolution, fuelType='WIND', generation in MW
- WINDFOR: hourly resolution, no fuelType filter needed (all wind), generation in MW
- Both support publishDateTimeFrom/publishDateTimeTo for historical date filtering
- /stream endpoint returns raw JSON array (no pagination wrapper)
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
REQUEST_TIMEOUT = 60.0
MAX_RETRIES = 3
RETRY_BACKOFF = 2.0


async def _fetch_stream(
    client: httpx.AsyncClient,
    path: str,
    params: dict,
) -> list[dict]:
    """
    Fetch from an Elexon /stream endpoint with retry logic.
    Returns raw list of records.
    """
    url = f"{BASE_URL}{path}"
    params = {k: v for k, v in params.items() if v is not None}
    params.setdefault("format", "json")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.debug("GET %s params=%s (attempt %d)", url, params, attempt)
            resp = await client.get(url, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return data
            # Non-stream endpoint returns {"data": [...]}
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            logger.warning("Unexpected response shape from %s: %s", url, type(data))
            return []
        except httpx.TimeoutException as exc:
            logger.warning("Timeout on attempt %d for %s: %s", attempt, url, exc)
            if attempt == MAX_RETRIES:
                raise
            await asyncio.sleep(RETRY_BACKOFF * attempt)
        except httpx.HTTPStatusError as exc:
            logger.error(
                "HTTP %d from %s: %s",
                exc.response.status_code,
                url,
                exc.response.text[:200],
            )
            raise
        except Exception as exc:
            logger.error("Unexpected error fetching %s: %s", url, exc)
            raise


async def fetch_wind_actuals(
    publish_from: str,
    publish_to: str,
) -> list[dict]:
    """
    Fetch FUELHH wind actuals for a publish-time range.
    Returns records with fuelType='WIND' only.

    Args:
        publish_from: ISO 8601 UTC, e.g. "2026-01-01T00:00:00Z"
        publish_to:   ISO 8601 UTC, e.g. "2026-02-01T00:00:00Z"
    """
    async with httpx.AsyncClient() as client:
        records = await _fetch_stream(
            client,
            "/datasets/FUELHH/stream",
            {
                "publishDateTimeFrom": publish_from,
                "publishDateTimeTo": publish_to,
            },
        )
    wind = [r for r in records if r.get("fuelType") == "WIND"]
    logger.info(
        "fetch_wind_actuals: %d total records, %d WIND (publish %s – %s)",
        len(records),
        len(wind),
        publish_from,
        publish_to,
    )
    return wind


async def fetch_wind_forecasts(
    publish_from: str,
    publish_to: str,
) -> list[dict]:
    """
    Fetch WINDFOR forecasts for a publish-time range.

    Args:
        publish_from: ISO 8601 UTC
        publish_to:   ISO 8601 UTC
    """
    async with httpx.AsyncClient() as client:
        records = await _fetch_stream(
            client,
            "/datasets/WINDFOR/stream",
            {
                "publishDateTimeFrom": publish_from,
                "publishDateTimeTo": publish_to,
            },
        )
    logger.info(
        "fetch_wind_forecasts: %d records (publish %s – %s)",
        len(records),
        publish_from,
        publish_to,
    )
    return records


async def fetch_latest_wind_forecast() -> list[dict]:
    """Fetch the most recent WINDFOR forecast (for the dashboard live view)."""
    async with httpx.AsyncClient() as client:
        records = await _fetch_stream(
            client,
            "/datasets/WINDFOR/stream",
            {},
        )
    return records
