import React from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../api';
import { DashboardChart } from '../components/DashboardChart';
import { KpiCard } from '../components/KpiCard';
import { LoadingState, ErrorState } from '../components/States';
import { ForecastIcon, ClockIcon, ActualsIcon, DatabaseIcon } from '../components/Icons';

export const DashboardPage: React.FC = () => {
  const { data, status, error, refetch } = useApi(() => api.dashboard(), []);

  const isLoading = status === 'loading' || status === 'idle';
  const isError = status === 'error';

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
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Day-Ahead Wind Procurement Desk</h1>
        <p className="page-subtitle">
          Real-time wind generation forecasts and actuals from Elexon BMRS for UK energy utilities evaluating wholesale day-ahead procurement.
        </p>
      </div>

      {/* Operational Telemetry Strip */}
      <div className="market-strip">
        <div className="strip-item">
          <span className="strip-label">Market Jurisdiction</span>
          <span className="strip-value">National Grid GB (UK)</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Forecast Stream</span>
          <span className="strip-value">Elexon WINDFOR (Hourly)</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Actuals Stream</span>
          <span className="strip-value">Elexon FUELHH (WIND Half-Hourly)</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Gate Boundary Assumption</span>
          <span className="strip-value">D-1 12:00 UTC (Documented)</span>
        </div>
        <div className="strip-item">
          <span className="strip-label">Settlement Timezone</span>
          <span className="strip-value">UTC (London Winter)</span>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="metric-grid">
        <KpiCard
          label="Latest Available Forecast"
          value={latestGen != null ? Math.round(latestGen).toLocaleString() : null}
          unit="MW"
          sub={publishedAgo ? `Published ${publishedAgo}` : 'Latest WINDFOR run'}
          icon={<ForecastIcon size={18} color="var(--accent-cyan)" />}
          accent="cyan"
          loading={isLoading}
        />
        <KpiCard
          label="Next Delivery Hour Target"
          value={nextGen != null ? Math.round(nextGen).toLocaleString() : null}
          unit="MW"
          sub="Forecasted generation volume"
          icon={<ClockIcon size={18} color="var(--accent-indigo)" />}
          accent="indigo"
          loading={isLoading}
        />
        <KpiCard
          label="Recent Avg Realised Generation"
          value={recentWindAvg != null ? recentWindAvg.toLocaleString() : null}
          unit="MW"
          sub="Past 72-hour FUELHH mean"
          icon={<ActualsIcon size={18} color="var(--accent-amber)" />}
          accent="amber"
          loading={isLoading}
        />
        <KpiCard
          label="Actuals Sample Density"
          value={data?.recentActuals?.count ?? null}
          unit="hrs"
          sub="Aligned hourly observations"
          icon={<DatabaseIcon size={18} color="var(--accent-emerald)" />}
          accent="emerald"
          loading={isLoading}
        />
      </div>

      {/* Live Chart */}
      {isLoading && <LoadingState message="Fetching live Elexon BMRS data streams..." />}
      {isError && <ErrorState message={error ?? 'Failed to load live dashboard streams'} onRetry={refetch} />}
      {data && !isLoading && <DashboardChart data={data} />}

      {/* Metadata Note */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
        Data Source: Elexon BMRS API (WINDFOR, FUELHH) | Units: Megawatts (MW) | Reference: National GB wind generation only.
      </div>
    </div>
  );
};
