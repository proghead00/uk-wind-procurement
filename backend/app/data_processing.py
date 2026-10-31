"""
Data processing: time alignment, forecast selection, accuracy metrics.

Day-ahead cutoff assumption:
  The UK day-ahead electricity market (N2EX / EPEX SPOT) typically closes
  around 11:00 UK time (UTC in winter) the day before delivery.
  We use NOON UTC (D-1 12:00:00Z) as our conservative cutoff assumption.
  This is a documented assumption, NOT a verified market rule.

  Implication: For delivery day D, we only use forecasts published at or
  before (D-1)T12:00:00Z. We then take the LATEST such forecast for each
  delivery hour.

Timezone:
  January is UTC = Europe/London (no BST offset). All times remain UTC.
  If this tool is extended to summer months, UK local time (BST = UTC+1)
  must be applied to the cutoff calculation.

Data resolution mismatch:
  FUELHH actuals: 30-min intervals (MWh per half-hour ≈ MW average)
  WINDFOR forecasts: 60-min intervals

  We align by rounding FUELHH startTime down to the nearest hour
  to match WINDFOR startTime. Both datasets use startTime as the
  beginning of the delivery interval.

Units: generation is in MW for both datasets (instantaneous/average).
"""

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Day-ahead cutoff: noon UTC on D-1 (documented assumption, not verified rule)
CUTOFF_HOUR_UTC = 12  # 12:00:00 UTC


def parse_iso(ts: str) -> datetime:
    """Parse ISO 8601 UTC string to tz-aware datetime."""
    ts = ts.rstrip("Z")
    if "." in ts:
        ts = ts.split(".")[0]
    return datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)


def delivery_day_cutoff(delivery_date_utc: datetime) -> datetime:
    """
    Return the forecast publication cutoff for a given delivery day.
    Cutoff = (delivery_date - 1 day) at CUTOFF_HOUR_UTC:00:00 UTC.
    """
    d_minus_1 = delivery_date_utc.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    return d_minus_1.replace(hour=CUTOFF_HOUR_UTC)


def align_actual_to_hour(actual_start: datetime) -> datetime:
    """Round a 30-min actual startTime down to the nearest hour."""
    return actual_start.replace(minute=0, second=0, microsecond=0)


def process_actuals(raw_actuals: list[dict]) -> dict[str, float]:
    """
    Convert raw FUELHH records to {hour_utc_iso: generation_MW}.
    For each hour, average the two 30-min periods.
    Skips records with None/null generation explicitly (never substitutes zero).
    Returns only hours where at least one actual value exists.
    """
    hourly: dict[str, list[float]] = {}
    missing_count = 0
    for rec in raw_actuals:
        g = rec.get("generation")
        if g is None:
            missing_count += 1
            continue
        start = parse_iso(rec["startTime"])
        hour_key = align_actual_to_hour(start).isoformat()
        hourly.setdefault(hour_key, []).append(float(g))

    if missing_count:
        logger.warning("process_actuals: %d records with null generation skipped", missing_count)

    result = {}
    for hour_key, vals in hourly.items():
        # Normalize: remove timezone suffix so keys are plain 'YYYY-MM-DDTHH:MM:SS'
        normalized = hour_key.replace('+00:00', '').replace('Z', '')
        result[normalized] = sum(vals) / len(vals)

    logger.info("process_actuals: %d hourly actuals", len(result))
    return result


def select_decision_time_forecasts(
    raw_forecasts: list[dict],
    delivery_hours: list[str],
) -> dict[str, dict]:
    """
    For each delivery hour, select the LATEST forecast published at or before
    the day-ahead cutoff for that delivery day.

    Args:
        raw_forecasts: list of WINDFOR records
        delivery_hours: list of ISO hour strings for delivery times to consider

    Returns:
        dict {delivery_hour_iso: {"generation": MW, "publishTime": ..., "leadHours": ...}}
    """
    delivery_set = set(delivery_hours)

    # Build index: delivery_hour -> list of (publishTime, generation)
    # Keys are plain naive ISO strings like '2026-01-01T06:00:00'
    forecast_index: dict[str, list[tuple[datetime, float]]] = {}
    missing_count = 0
    for rec in raw_forecasts:
        g = rec.get("generation")
        if g is None:
            missing_count += 1
            continue
        start = parse_iso(rec["startTime"])
        # WINDFOR is already hourly; normalize to hour boundary (naive key)
        hour_key = start.replace(minute=0, second=0, microsecond=0).replace(tzinfo=None).isoformat()
        if hour_key not in delivery_set:
            continue
        pub_time = parse_iso(rec["publishTime"])
        forecast_index.setdefault(hour_key, []).append((pub_time, float(g)))

    if missing_count:
        logger.warning("select_decision_time_forecasts: %d null generation records skipped", missing_count)

    result = {}
    for hour_key in delivery_hours:
        if hour_key not in forecast_index:
            continue  # No forecast available for this hour

        # hour_key is a naive ISO string; attach UTC timezone for calculations
        delivery_dt = datetime.fromisoformat(hour_key).replace(tzinfo=timezone.utc)
        cutoff = delivery_day_cutoff(delivery_dt)

        # Filter to forecasts published AT OR BEFORE the cutoff
        eligible = [(pub, gen) for pub, gen in forecast_index[hour_key] if pub <= cutoff]

        if not eligible:
            logger.debug("No eligible forecast for %s (cutoff %s)", hour_key, cutoff.isoformat())
            continue

        # Take the LATEST eligible forecast
        latest_pub, latest_gen = max(eligible, key=lambda x: x[0])
        lead_hours = (delivery_dt - latest_pub).total_seconds() / 3600

        result[hour_key] = {
            "generation": latest_gen,
            "publishTime": latest_pub.isoformat(),
            "leadHours": round(lead_hours, 1),
            "cutoff": cutoff.isoformat(),
        }

    logger.info(
        "select_decision_time_forecasts: %d/%d delivery hours have eligible forecasts",
        len(result),
        len(delivery_hours),
    )
    return result


def compute_accuracy_metrics(
    forecasts: dict[str, dict],
    actuals: dict[str, float],
) -> dict:
    """
    Compute MAE, RMSE, Bias and breakdown by lead-time bucket.

    Error sign convention: error = forecast - actual
    - Positive bias = systematic over-forecast (procure LESS than needed)
    - Negative bias = systematic under-forecast (procure MORE than needed)

    Args:
        forecasts: {hour_iso: {"generation": MW, "leadHours": h, ...}}
        actuals:   {hour_iso: generation_MW}

    Returns dict with overall metrics and per-lead-time breakdown.
    """
    errors = []
    paired = []

    for hour, fcast in forecasts.items():
        if hour not in actuals:
            continue
        f_val = fcast["generation"]
        a_val = actuals[hour]
        err = f_val - a_val
        errors.append(err)
        paired.append({
            "hour": hour,
            "forecast": f_val,
            "actual": a_val,
            "error": err,
            "absError": abs(err),
            "leadHours": fcast["leadHours"],
            "publishTime": fcast["publishTime"],
        })

    if not errors:
        return {
            "mae": None, "rmse": None, "bias": None,
            "count": 0, "paired": [],
            "leadTimeBuckets": [],
            "warning": "No matched forecast-actual pairs found.",
        }

    n = len(errors)
    mae = sum(abs(e) for e in errors) / n
    rmse = math.sqrt(sum(e**2 for e in errors) / n)
    bias = sum(errors) / n

    # Lead-time buckets: 12-24h, 24-36h, 36-48h, 48h+
    bucket_defs = [
        ("12-24h", 12, 24),
        ("24-36h", 24, 36),
        ("36-48h", 36, 48),
        ("48h+", 48, 9999),
    ]
    buckets = []
    for label, lo, hi in bucket_defs:
        bucket_errors = [p["error"] for p in paired if lo <= p["leadHours"] < hi]
        if not bucket_errors:
            continue
        buckets.append({
            "label": label,
            "count": len(bucket_errors),
            "mae": sum(abs(e) for e in bucket_errors) / len(bucket_errors),
            "rmse": math.sqrt(sum(e**2 for e in bucket_errors) / len(bucket_errors)),
            "bias": sum(bucket_errors) / len(bucket_errors),
        })

    logger.info("compute_accuracy_metrics: n=%d, MAE=%.1f, RMSE=%.1f, Bias=%.1f", n, mae, rmse, bias)

    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "bias": round(bias, 2),
        "count": n,
        "paired": paired,
        "leadTimeBuckets": buckets,
    }


def build_january_delivery_hours() -> list[str]:
    """
    Build the list of hourly delivery slots for January 2026.
    Returns ISO strings like '2026-01-01T00:00:00'.
    Includes only hours within January 2026 (UTC).
    """
    hours = []
    start = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
    current = start
    while current < end:
        hours.append(current.replace(tzinfo=None).isoformat())
        current += timedelta(hours=1)
    return hours
