import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { DashboardData } from '../types';

interface Props {
  data: DashboardData;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const time = label ? new Date(label + 'Z').toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) : label;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip__label">{label?.slice(0, 10)} {time} UTC</div>
      {payload.map((p: any) => (
        <div key={p.name} className="custom-tooltip__row">
          <span className="custom-tooltip__key">{p.name}</span>
          <span className="custom-tooltip__val" style={{ color: p.color }}>
            {p.value != null ? `${Math.round(p.value).toLocaleString()} MW` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

export const DashboardChart: React.FC<Props> = ({ data }) => {
  const { latestForecast, recentActuals } = data;

  // Merge forecast and actuals into unified timeline
  const forecastMap = new Map(
    latestForecast.data.map((r) => [r.startTime.replace('Z', ''), r.generation])
  );
  const actualMap = new Map(
    recentActuals.data.map((r) => [r.hour.slice(0, 16), r.generation])
  );

  // Build unified time axis from all unique hours
  const allHours = new Set([
    ...Array.from(forecastMap.keys()),
    ...Array.from(actualMap.keys()),
  ]);

  const chartData = Array.from(allHours)
    .sort()
    .slice(-96) // last 4 days + next 3 days (max 96 pts)
    .map((h) => ({
      hour: h,
      forecast: forecastMap.get(h) ?? null,
      actual: actualMap.get(h.slice(0, 16)) ?? null,
    }));

  const formatHour = (h: string) => {
    try {
      return new Date(h + 'Z').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        timeZone: 'UTC',
      });
    } catch { return h; }
  };

  const formatTick = (h: string) => {
    try {
      const d = new Date(h + 'Z');
      if (d.getUTCHours() === 0) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      }
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    } catch { return ''; }
  };

  const nowISO = new Date().toISOString().slice(0, 16);

  return (
    <div className="chart-card fade-in fade-in-2">
      <div className="section-header">
        <div>
          <div className="chart-card__title">⚡ Wind Generation – Live View</div>
          <div className="chart-card__desc">
            Latest WINDFOR forecast (published {
              latestForecast.publishTime
                ? new Date(latestForecast.publishTime).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'
                : '—'
            }) vs recent actuals (FUELHH)
          </div>
        </div>
        <div className="section-badge">MW</div>
      </div>

      <div className="chart-legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#00e5ff' }} />
          <span>Latest Forecast</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#00e676' }} />
          <span>Actuals (FUELHH)</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(255,255,255,0.3)', border: '1px dashed rgba(255,255,255,0.3)' }} />
          <span>Now</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#00e5ff" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00e676" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#00e676" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(33,150,243,0.08)"
            vertical={false}
          />
          <XAxis
            dataKey="hour"
            tickFormatter={formatTick}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            x={nowISO}
            stroke="rgba(255,255,255,0.25)"
            strokeDasharray="4 4"
            label={{ value: 'NOW', fill: 'rgba(255,255,255,0.4)', fontSize: 10, position: 'insideTopRight' }}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#00e5ff"
            strokeWidth={2}
            fill="url(#fg)"
            dot={false}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#00e676"
            strokeWidth={2.5}
            fill="url(#ag)"
            dot={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
