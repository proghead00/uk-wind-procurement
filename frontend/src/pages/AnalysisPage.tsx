import React from 'react';
import type { JanuaryAnalysis } from '../types';
import { JanuaryCharts } from '../components/JanuaryCharts';
import { KpiCard } from '../components/KpiCard';
import { LoadingState, ErrorState } from '../components/States';
import { useApi } from '../hooks/useApi';
import { api } from '../api';

export const AnalysisPage: React.FC = () => {
  const { data, status, error, refetch } = useApi(() => api.januaryAnalysis(), []);

  if (status === 'loading' || status === 'idle') {
    return (
      <LoadingState
        message="Computing January 2026 analysis…"
        sub="Fetching ~5,000 records from Elexon BMRS. This may take 10–15 seconds."
      />
    );
  }

  if (status === 'error') {
    return <ErrorState message={error ?? 'Unknown error'} onRetry={refetch} />;
  }

  if (!data) return null;

  const { metrics } = data;
  const biasClass = metrics.bias === null ? '' :
    metrics.bias > 0 ? 'metric-positive' : metrics.bias < 0 ? 'metric-negative' : '';

  return (
    <div className="fade-in">
      {/* ---- Methodology ---- */}
      <div className="methodology">
        <div className="methodology__title">🔬 Methodology & Assumptions</div>
        <div className="methodology__grid">
          <div className="methodology__item">
            <h4>Day-ahead Cutoff <span className="assumption-tag">assumption</span></h4>
            <p>
              {data.cutoffAssumption}. The UK N2EX market closes around 11:00 UK time,
              but we use noon UTC as a conservative, documented assumption. This is <em>not</em> a verified market rule.
            </p>
          </div>
          <div className="methodology__item">
            <h4>Forecast Selection (No-Leakage)</h4>
            <p>
              For each delivery hour, we select the <strong>latest</strong> WINDFOR forecast
              published at or before the cutoff. No "future" forecasts are used in historical analysis.
            </p>
          </div>
          <div className="methodology__item">
            <h4>Resolution Alignment</h4>
            <p>
              FUELHH (30-min) actuals are averaged to hourly intervals to match WINDFOR (60-min) forecasts.
              Pairs with missing actuals or missing eligible forecasts are excluded — never filled with zero.
            </p>
          </div>
          <div className="methodology__item">
            <h4>Error Sign Convention</h4>
            <p>
              <strong>Error = Forecast − Actual</strong>.
              Positive bias = systematic over-forecast (less wind than predicted; procure <em>more</em> thermal).
              Negative bias = under-forecast (more wind; procure <em>less</em>).
            </p>
          </div>
          <div className="methodology__item">
            <h4>Procurement Context</h4>
            <p>
              Wind error alone does not determine procurement. Total demand forecast error,
              other renewable sources, network constraints, and price signals all contribute.
              These metrics help size a <em>wind uncertainty buffer</em> for the procurement volume.
            </p>
          </div>
          <div className="methodology__item">
            <h4>Timezone</h4>
            <p>
              {data.timezone}. All timestamps are UTC. January in the UK = UTC (no BST offset).
              If extended to summer, BST (UTC+1) must be applied to the cutoff calculation.
            </p>
          </div>
        </div>
      </div>

      {/* ---- KPI Row ---- */}
      <div className="kpi-grid">
        <KpiCard
          label="MAE"
          value={metrics.mae !== null ? Math.round(metrics.mae).toLocaleString() : null}
          unit="MW"
          sub="Mean Absolute Error"
          icon="📏"
          accent="blue"
        />
        <KpiCard
          label="RMSE"
          value={metrics.rmse !== null ? Math.round(metrics.rmse).toLocaleString() : null}
          unit="MW"
          sub="Root Mean Square Error"
          icon="📐"
          accent="purple"
        />
        <KpiCard
          label="Bias"
          value={
            metrics.bias !== null
              ? `${metrics.bias > 0 ? '+' : ''}${Math.round(metrics.bias).toLocaleString()}`
              : null
          }
          unit="MW"
          sub={metrics.bias && metrics.bias > 0 ? 'Over-forecast (buy more)' : metrics.bias && metrics.bias < 0 ? 'Under-forecast (buy less)' : 'Error sign: F − A'}
          icon="⚖️"
          accent={metrics.bias && metrics.bias > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          label="Matched Pairs"
          value={metrics.count.toLocaleString()}
          sub={`of ${data.deliveryHoursRequested} January delivery hours`}
          icon="🔗"
          accent="cyan"
        />
        <KpiCard
          label="Forecasts"
          value={data.forecastCount.toLocaleString()}
          sub="WINDFOR records fetched"
          icon="🌬️"
          accent="blue"
        />
        <KpiCard
          label="Actuals"
          value={data.actualCount.toLocaleString()}
          sub="FUELHH WIND records fetched"
          icon="⚡"
          accent="green"
        />
      </div>

      {/* ---- Procurement Insight ---- */}
      {metrics.mae !== null && (
        <div className="insight-card">
          <div className="insight-card__title">💡 Procurement Implication</div>
          <div className="insight-card__body">
            Over January 2026, decision-time wind forecasts had a <strong>MAE of ~{Math.round(metrics.mae).toLocaleString()} MW</strong>{' '}
            and <strong>RMSE of ~{Math.round(metrics.rmse!).toLocaleString()} MW</strong>.
            {metrics.bias !== null && metrics.bias !== 0 && (
              <>
                {' '}The <strong>{metrics.bias > 0 ? 'positive' : 'negative'} bias of ~{Math.abs(Math.round(metrics.bias)).toLocaleString()} MW</strong> suggests wind was systematically{' '}
                {metrics.bias > 0 ? 'over-predicted — the team should plan to procure additional thermal capacity to cover the shortfall.' : 'under-predicted — the team may have procured more thermal capacity than ultimately needed.'}
              </>
            )}
            {' '}For risk-adjusted procurement, consider adding a{' '}
            <strong>~{Math.round(metrics.rmse! * 1.2).toLocaleString()} MW buffer</strong> (1.2× RMSE) to thermal procurement volumes when wind forecasts are the primary source of uncertainty.
            {' '}Wind forecast error is one input — total demand uncertainty, cross-border flows, and market prices also drive final procurement decisions.
          </div>
        </div>
      )}

      {/* ---- Charts ---- */}
      <JanuaryCharts analysis={data} />

      {/* ---- Data metadata ---- */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.8 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Data source:</strong> {data.dataSource} ·{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>Period:</strong> {data.period} ·{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>Units:</strong> {data.units} ·{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>Cutoff:</strong> Noon UTC (D−1)
      </div>
    </div>
  );
};
