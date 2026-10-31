"""
Tests for forecast selection, time alignment, missing data, and metric calculations.
Run with: pytest backend/tests/ -v
"""

import math
import pytest
from datetime import datetime, timedelta, timezone

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.data_processing import (
    parse_iso,
    align_actual_to_hour,
    delivery_day_cutoff,
    process_actuals,
    select_decision_time_forecasts,
    compute_accuracy_metrics,
    build_january_delivery_hours,
    CUTOFF_HOUR_UTC,
)


class TestParseIso:
    def test_basic_utc(self):
        dt = parse_iso("2026-01-15T12:00:00Z")
        assert dt.tzinfo == timezone.utc
        assert dt.year == 2026
        assert dt.month == 1
        assert dt.day == 15
        assert dt.hour == 12

    def test_without_z(self):
        dt = parse_iso("2026-01-15T12:00:00")
        assert dt.tzinfo == timezone.utc

    def test_with_microseconds(self):
        dt = parse_iso("2026-01-15T12:00:00.000Z")
        assert dt.hour == 12


class TestAlignActualToHour:
    def test_on_the_hour(self):
        dt = datetime(2026, 1, 1, 6, 0, 0, tzinfo=timezone.utc)
        result = align_actual_to_hour(dt)
        assert result == dt

    def test_half_hour(self):
        dt = datetime(2026, 1, 1, 6, 30, 0, tzinfo=timezone.utc)
        result = align_actual_to_hour(dt)
        assert result == datetime(2026, 1, 1, 6, 0, 0, tzinfo=timezone.utc)


class TestDeliveryDayCutoff:
    def test_jan1_cutoff(self):
        """Delivery Jan 1 → cutoff Dec 31 at CUTOFF_HOUR_UTC."""
        delivery = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        cutoff = delivery_day_cutoff(delivery)
        assert cutoff == datetime(2025, 12, 31, CUTOFF_HOUR_UTC, 0, 0, tzinfo=timezone.utc)

    def test_jan_15_cutoff(self):
        delivery = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        cutoff = delivery_day_cutoff(delivery)
        assert cutoff == datetime(2026, 1, 14, CUTOFF_HOUR_UTC, 0, 0, tzinfo=timezone.utc)

    def test_cutoff_hour_is_noon(self):
        assert CUTOFF_HOUR_UTC == 12


class TestProcessActuals:
    def test_basic_averaging(self):
        """Two 30-min periods per hour should be averaged."""
        raw = [
            {"startTime": "2026-01-01T00:00:00Z", "fuelType": "WIND", "generation": 1000},
            {"startTime": "2026-01-01T00:30:00Z", "fuelType": "WIND", "generation": 2000},
        ]
        result = process_actuals(raw)
        # Both align to T00:00:00
        assert "2026-01-01T00:00:00" in result
        assert result["2026-01-01T00:00:00"] == pytest.approx(1500.0)

    def test_null_generation_skipped(self):
        """Records with null/None generation must be skipped, not treated as zero."""
        raw = [
            {"startTime": "2026-01-01T00:00:00Z", "fuelType": "WIND", "generation": None},
            {"startTime": "2026-01-01T01:00:00Z", "fuelType": "WIND", "generation": 3000},
        ]
        result = process_actuals(raw)
        assert "2026-01-01T00:00:00" not in result  # Null → no entry
        assert "2026-01-01T01:00:00" in result
        assert result["2026-01-01T01:00:00"] == pytest.approx(3000.0)

    def test_empty_input(self):
        assert process_actuals([]) == {}

    def test_missing_generation_key_skipped(self):
        """Records without 'generation' key treated as missing."""
        raw = [{"startTime": "2026-01-01T00:00:00Z", "fuelType": "WIND"}]
        result = process_actuals(raw)
        assert result == {}


class TestSelectDecisionTimeForecasts:
    """Tests for the critical no-leakage forecast selection logic."""

    def _make_forecast(self, start_hour: str, pub_time: str, gen: float) -> dict:
        return {
            "startTime": f"{start_hour}:00:00Z",
            "publishTime": f"{pub_time}:00:00Z",
            "generation": gen,
        }

    def test_selects_latest_eligible_forecast(self):
        """
        For delivery Jan 1T06:00, cutoff is Dec 31T12:00.
        Forecast published at Dec 31T10:00 is eligible.
        Forecast published at Dec 31T11:00 is eligible (later).
        Forecast published at Dec 31T13:00 is NOT eligible (after cutoff).
        Should return the Dec 31T11:00 forecast.
        """
        delivery_hour = "2026-01-01T06:00:00"
        forecasts = [
            self._make_forecast("2026-01-01T06", "2025-12-31T10", 3000),
            self._make_forecast("2026-01-01T06", "2025-12-31T11", 3500),  # latest eligible
            self._make_forecast("2026-01-01T06", "2025-12-31T13", 4000),  # LEAKS future info
        ]
        result = select_decision_time_forecasts(forecasts, [delivery_hour])
        assert delivery_hour in result
        assert result[delivery_hour]["generation"] == pytest.approx(3500)
        assert "2025-12-31T11:00:00" in result[delivery_hour]["publishTime"]

    def test_no_eligible_forecast_excluded(self):
        """If all forecasts are after cutoff, no entry for that hour."""
        delivery_hour = "2026-01-01T06:00:00"
        forecasts = [
            self._make_forecast("2026-01-01T06", "2025-12-31T13", 4000),  # after noon cutoff
        ]
        result = select_decision_time_forecasts(forecasts, [delivery_hour])
        assert delivery_hour not in result

    def test_exact_cutoff_boundary_included(self):
        """Forecast published exactly at cutoff should be included (<=, not <)."""
        delivery_hour = "2026-01-01T06:00:00"
        forecasts = [
            self._make_forecast("2026-01-01T06", "2025-12-31T12", 5000),  # exactly at cutoff
        ]
        result = select_decision_time_forecasts(forecasts, [delivery_hour])
        assert delivery_hour in result
        assert result[delivery_hour]["generation"] == pytest.approx(5000)

    def test_null_generation_forecast_skipped(self):
        delivery_hour = "2026-01-01T06:00:00"
        forecasts = [
            {"startTime": "2026-01-01T06:00:00Z", "publishTime": "2025-12-31T10:00:00Z", "generation": None},
            {"startTime": "2026-01-01T06:00:00Z", "publishTime": "2025-12-31T09:00:00Z", "generation": 2000},
        ]
        result = select_decision_time_forecasts(forecasts, [delivery_hour])
        assert delivery_hour in result
        assert result[delivery_hour]["generation"] == pytest.approx(2000)

    def test_lead_hours_calculated(self):
        """Lead hours = delivery time - publish time."""
        delivery_hour = "2026-01-15T12:00:00"
        # Cutoff is Jan 14 at noon. Published Jan 14 at 08:00 → lead = 28h
        forecasts = [
            self._make_forecast("2026-01-15T12", "2026-01-14T08", 4000),
        ]
        result = select_decision_time_forecasts(forecasts, [delivery_hour])
        assert delivery_hour in result
        assert result[delivery_hour]["leadHours"] == pytest.approx(28.0)

    def test_delivery_hour_not_in_list_ignored(self):
        """Forecasts for delivery hours not in the requested list are ignored."""
        delivery_hours = ["2026-01-01T06:00:00"]
        forecasts = [
            self._make_forecast("2026-01-01T06", "2025-12-31T10", 3000),
            self._make_forecast("2026-01-02T06", "2026-01-01T10", 4000),  # not requested
        ]
        result = select_decision_time_forecasts(forecasts, delivery_hours)
        assert "2026-01-02T06:00:00" not in result


class TestComputeAccuracyMetrics:
    def test_perfect_forecast(self):
        forecasts = {
            "2026-01-01T00:00:00": {"generation": 3000, "leadHours": 18, "publishTime": "X"},
            "2026-01-01T01:00:00": {"generation": 4000, "leadHours": 17, "publishTime": "X"},
        }
        actuals = {
            "2026-01-01T00:00:00": 3000,
            "2026-01-01T01:00:00": 4000,
        }
        result = compute_accuracy_metrics(forecasts, actuals)
        assert result["mae"] == pytest.approx(0.0)
        assert result["rmse"] == pytest.approx(0.0)
        assert result["bias"] == pytest.approx(0.0)
        assert result["count"] == 2

    def test_over_forecast(self):
        """Bias positive when forecast > actual (sign convention: forecast - actual)."""
        forecasts = {"2026-01-01T00:00:00": {"generation": 5000, "leadHours": 20, "publishTime": "X"}}
        actuals = {"2026-01-01T00:00:00": 3000}
        result = compute_accuracy_metrics(forecasts, actuals)
        assert result["bias"] == pytest.approx(2000.0)
        assert result["mae"] == pytest.approx(2000.0)

    def test_under_forecast(self):
        """Bias negative when forecast < actual."""
        forecasts = {"2026-01-01T00:00:00": {"generation": 2000, "leadHours": 20, "publishTime": "X"}}
        actuals = {"2026-01-01T00:00:00": 4000}
        result = compute_accuracy_metrics(forecasts, actuals)
        assert result["bias"] == pytest.approx(-2000.0)

    def test_rmse_calculation(self):
        """RMSE = sqrt(mean(errors^2))."""
        forecasts = {
            "2026-01-01T00:00:00": {"generation": 4000, "leadHours": 18, "publishTime": "X"},
            "2026-01-01T01:00:00": {"generation": 2000, "leadHours": 17, "publishTime": "X"},
        }
        actuals = {
            "2026-01-01T00:00:00": 3000,  # error = +1000
            "2026-01-01T01:00:00": 3000,  # error = -1000
        }
        result = compute_accuracy_metrics(forecasts, actuals)
        expected_rmse = math.sqrt((1000**2 + 1000**2) / 2)
        assert result["rmse"] == pytest.approx(expected_rmse, rel=1e-3)
        assert result["bias"] == pytest.approx(0.0)
        assert result["mae"] == pytest.approx(1000.0)

    def test_no_matched_pairs(self):
        forecasts = {"2026-01-01T00:00:00": {"generation": 3000, "leadHours": 18, "publishTime": "X"}}
        actuals = {"2026-01-02T00:00:00": 4000}  # Different hour
        result = compute_accuracy_metrics(forecasts, actuals)
        assert result["count"] == 0
        assert result["mae"] is None
        assert "warning" in result

    def test_missing_actual_skipped(self):
        """Hours with forecast but no actual should not be included in metrics."""
        forecasts = {
            "2026-01-01T00:00:00": {"generation": 3000, "leadHours": 18, "publishTime": "X"},
            "2026-01-01T01:00:00": {"generation": 4000, "leadHours": 17, "publishTime": "X"},
        }
        actuals = {"2026-01-01T00:00:00": 3000}  # Only one actual
        result = compute_accuracy_metrics(forecasts, actuals)
        assert result["count"] == 1  # Only one pair


class TestBuildJanuaryDeliveryHours:
    def test_correct_count(self):
        """January 2026 = 31 days × 24 hours = 744 hours."""
        hours = build_january_delivery_hours()
        assert len(hours) == 744

    def test_starts_jan_1(self):
        hours = build_january_delivery_hours()
        assert hours[0] == "2026-01-01T00:00:00"

    def test_ends_jan_31(self):
        hours = build_january_delivery_hours()
        assert hours[-1] == "2026-01-31T23:00:00"

    def test_all_hours_are_on_hour(self):
        hours = build_january_delivery_hours()
        for h in hours:
            dt = datetime.fromisoformat(h)
            assert dt.minute == 0
            assert dt.second == 0
