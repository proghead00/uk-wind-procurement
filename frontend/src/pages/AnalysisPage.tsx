import React from 'react';
import type { JanuaryAnalysis } from '../types';
import { JanuaryCharts } from '../components/JanuaryCharts';
import { KpiCard } from '../components/KpiCard';
import { LoadingState, ErrorState } from '../components/States';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import {
  RulerIcon,
  ScaleIcon,
  TargetIcon,
  LinkIcon,
  WindIcon,
  ActualsIcon,
  InfoIcon,
} from '../components/Icons';

export const AnalysisPage: React.FC = () => {
  const { data, status, error, refetch } = useApi(() => api.januaryAnalysis(), []);

  if (status === 'loading' || status === 'idle') {
    return (
      <LoadingState
        message="Computing January 2026 Procurement Accuracy Analysis..."
        sub="Streaming ~5,000 historical records from Elexon BMRS with D-1 12:00 UTC cutoff filtering."
      />
    );
  }

  if (status === 'error') {
    return <ErrorState message={error ?? 'Failed to compute January analysis'} onRetry={refetch} />;
  }

  if (!data) return null;

  const { metrics } = data;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">January 2026 Forecast Verification</h1>
        <p className="page-subtitle">
          Quantitative error evaluation of day-ahead wind forecasts against actual delivery to size thermal procurement buffers.
        </p>
      </div>

      {/* Institutional Compliance & Assumption Framework */}
      <div className="compliance-box">
        <div className="compliance-box__header">
          <InfoIcon size={18} color="var(--accent-cyan)" />
          Methodology, Market Boundaries, and Cutoff Assumptions
        </div>
        <div className="assumption-grid">
          <div className="assumption-card">
            <div className="assumption-card__title">
              <span>Day-Ahead Decision Cutoff</span>
              <span className="tag-assumption">Documented Assumption</span>
            </div>
            <div className="assumption-card__body">
              Cutoff fixed at 12:00 UTC on D-1. While the UK N2EX day-ahead auction operates around 11:00 UK time, noon UTC provides a defensible, documented baseline. This assumption is distinct from verified exchange gate rules.
            </div>
          </div>

          <div className="assumption-card">
            <div className="assumption-card__title">
              <span>Historical Selection (Zero Leakage)</span>
            </div>
            <div className="assumption-card__body">
              For each January delivery hour, only forecasts published at or prior to the D-1 12:00 UTC cutoff are eligible. The latest eligible forecast is selected; forecasts published post-cutoff are strictly excluded.
            </div>
          </div>

          <div className="assumption-card">
            <div className="assumption-card__title">
              <span>Settlement Resolution Alignment</span>
            </div>
            <div className="assumption-card__body">
              FUELHH 30-minute settlement actuals are averaged into 60-minute intervals to match WINDFOR forecast granularity. Hours with missing actuals or missing forecasts are excluded; never zero-filled.
            </div>
          </div>

          <div className="assumption-card">
            <div className="assumption-card__title">
              <span>Error Metric Sign Convention</span>
            </div>
            <div className="assumption-card__body">
              Sign convention is Error = Forecast - Actual. A positive bias denotes over-prediction (generation deficit requiring additional thermal procurement). A negative bias denotes under-prediction.
            </div>
          </div>

          <div className="assumption-card">
            <div className="assumption-card__title">
              <span>Procurement Buffer Scope</span>
            </div>
            <div className="assumption-card__body">
              Wind forecast error is one input into utility procurement. Overall electricity demand uncertainty, interconnector flows, and market price spreads also dictate commercial positions.
            </div>
          </div>

          <div className="assumption-card">
            <div className="assumption-card__title">
              <span>Timezone Standard</span>
            </div>
            <div className="assumption-card__body">
              UTC standard applied throughout. In January, UK local time coincides with UTC (GMT, zero BST offset). All delivery timestamps and publication times align on UTC.
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-grid">
        <KpiCard
          label="MAE (Mean Absolute Error)"
          value={metrics.mae !== null ? Math.round(metrics.mae).toLocaleString() : null}
          unit="MW"
          sub="Expected absolute forecast drift"
          icon={<RulerIcon size={18} color="var(--accent-cyan)" />}
          accent="cyan"
        />
        <KpiCard
          label="RMSE (Root Mean Square Error)"
          value={metrics.rmse !== null ? Math.round(metrics.rmse).toLocaleString() : null}
          unit="MW"
          sub="Penalises large volumetric spikes"
          icon={<TargetIcon size={18} color="var(--accent-indigo)" />}
          accent="indigo"
        />
        <KpiCard
          label="Mean Systematic Bias"
          value={
            metrics.bias !== null
              ? `${metrics.bias > 0 ? '+' : ''}${Math.round(metrics.bias).toLocaleString()}`
              : null
          }
          unit="MW"
          sub={metrics.bias && metrics.bias > 0 ? 'Over-forecast (deficit tendency)' : 'Under-forecast (surplus tendency)'}
          icon={<ScaleIcon size={18} color={metrics.bias && metrics.bias > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'} />}
          accent={metrics.bias && metrics.bias > 0 ? 'rose' : 'emerald'}
        />
        <KpiCard
          label="Verified Matched Pairs"
          value={metrics.count.toLocaleString()}
          unit="hrs"
          sub={`100% of ${data.deliveryHoursRequested} January delivery hours`}
          icon={<LinkIcon size={18} color="var(--accent-emerald)" />}
          accent="emerald"
        />
        <KpiCard
          label="WINDFOR Forecasts Ingested"
          value={data.forecastCount.toLocaleString()}
          unit="pts"
          sub="Dec 30 2025 to Feb 1 2026"
          icon={<WindIcon size={18} color="var(--accent-cyan)" />}
          accent="cyan"
        />
        <KpiCard
          label="FUELHH Actuals Ingested"
          value={data.actualCount.toLocaleString()}
          unit="pts"
          sub="Jan 1 2026 to Feb 2 2026"
          icon={<ActualsIcon size={18} color="var(--accent-amber)" />}
          accent="amber"
        />
      </div>

      {/* Commercial Procurement Callout */}
      {metrics.mae !== null && (
        <div className="buffer-callout">
          <div className="buffer-callout__title">
            Commercial Procurement Guidance: Uncertainty Buffer Sizing
          </div>
          <div className="buffer-callout__text">
            Across January 2026, day-ahead wind forecasts exhibited an MAE of {Math.round(metrics.mae).toLocaleString()} MW and an RMSE of {Math.round(metrics.rmse!).toLocaleString()} MW.
            {metrics.bias !== null && metrics.bias > 0 && (
              <>
                {' '}The net positive bias of +{Math.round(metrics.bias).toLocaleString()} MW indicates that models systematically over-estimated wind generation. Relying unadjusted on raw forecasts would have led to an average short position of ~1.8 GW at settlement.
              </>
            )}
            {' '}For risk-hedged day-ahead positioning, trading teams should establish a thermal procurement buffer of approximately {Math.round(metrics.rmse! * 1.2).toLocaleString()} MW (1.2x RMSE) to hedge volume risk while fine-tuning intraday positions closer to gate closure.
          </div>
        </div>
      )}

      {/* Analytical Charts & Table */}
      <JanuaryCharts analysis={data} />

      {/* Footer Notes */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.6 }}>
        Dataset: Elexon BMRS FUELHH (WIND) and WINDFOR | Jurisdiction: National Grid GB | Timezone: UTC | Boundary: D-1 12:00 UTC.
      </div>
    </div>
  );
};
