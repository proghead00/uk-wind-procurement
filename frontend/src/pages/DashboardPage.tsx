import React from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import { DashboardChart } from '../components/DashboardChart';
import { KpiCard } from '../components/KpiCard';
import { LoadingState, ErrorState } from '../components/States';

export const DashboardPage: React.FC = () => {
  const { data, status, error, refetch } = useApi(() => api.dashboard(), []);

  const isLoading = status === 'loading' || status === 'idle';
  const isError = status === 'error';

  // Derive KPI values from dashboard data
  const latestPub = data?.latestForecast?.publishTime;
  const latestGen = data?.latestForecast?.data?.[0]?.generation;
  const recentWindAvg = data
    ? (() => {
        const vals = data.recentActuals.data.map((r) => r.generation);
        if (!vals.length) return null;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      })()
    : null;

  const nextGen = data?.latestForecast?.data?.find(
    (r) => new Date(r.startTime) > new Date()
  )?.generation;

  const publishedAgo = latestPub
    ? (() => {
        const mins = Math.round((Date.now() - new Date(latestPub).getTime()) / 60000);
        if (mins < 60) return `${mins}m ago`;
        return `${Math.round(mins / 60)}h ago`;
      })()
    : null;

  return (
    <div className="fade-in">
      {/* ---- Hero ---- */}
      <div className="hero">
        <div className="hero__eyebrow">UK Wind Power Intelligence</div>
        <h1 className="hero__title">
          Day-Ahead Wind Procurement<br />Dashboard
        </h1>
        <p className="hero__sub">
          Real-time wind generation forecasts and actuals from Elexon BMRS — 
          enabling informed day-ahead electricity procurement decisions for UK energy utilities.
        </p>
        <div className="hero__meta">
          <div className="hero__chip">🌬️ WINDFOR Forecasts</div>
          <div className="hero__chip">⚡ FUELHH Actuals</div>
          <div className="hero__chip">🇬🇧 National Grid GB</div>
          <div className="hero__chip">🕐 UTC Timestamps</div>
        </div>
      </div>

      {/* ---- KPIs ---- */}
      <div className="kpi-grid">
        <KpiCard
          label="Latest Forecast"
          value={latestGen != null ? Math.round(latestGen).toLocaleString() : null}
          unit="MW"
          sub={publishedAgo ? `Published ${publishedAgo}` : 'Wind generation forecast'}
          icon="🔮"
          accent="cyan"
          loading={isLoading}
        />
        <KpiCard
          label="Next Delivery Hour"
          value={nextGen != null ? Math.round(nextGen).toLocaleString() : null}
          unit="MW"
          sub="Forecast for next hour"
          icon="⏰"
          accent="blue"
          loading={isLoading}
        />
        <KpiCard
          label="Recent Avg Actual"
          value={recentWindAvg != null ? recentWindAvg.toLocaleString() : null}
          unit="MW"
          sub="Last 3 days FUELHH average"
          icon="📊"
          accent="green"
          loading={isLoading}
        />
        <KpiCard
          label="Actual Records"
          value={data?.recentActuals?.count ?? null}
          sub="Hourly actuals (last 3 days)"
          icon="🗄️"
          accent="amber"
          loading={isLoading}
        />
      </div>

      {/* ---- Chart ---- */}
      {isLoading && <LoadingState message="Fetching live wind data…" />}
      {isError && <ErrorState message={error ?? 'Failed to load dashboard data'} onRetry={refetch} />}
      {data && !isLoading && <DashboardChart data={data} />}

      {/* ---- Context note ---- */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Data source:</strong> Elexon BMRS API (WINDFOR + FUELHH) ·{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>Units:</strong> MW ·{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>Timezone:</strong> UTC ·{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>Refresh:</strong> Per page load ·{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>Scope:</strong> National GB wind only
      </div>
    </div>
  );
};
