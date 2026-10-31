import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { DashboardData } from '../types';
import { ForecastIcon } from './Icons';

interface Props {
  data: DashboardData;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const time = label
    ? new Date(label + 'Z').toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : label;

  const forecastVal = payload.find((p: any) => p.dataKey === 'forecast')?.value;
  const actualVal = payload.find((p: any) => p.dataKey === 'actual')?.value;
  const delta =
    forecastVal != null && actualVal != null ? forecastVal - actualVal : null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__header">
        {label?.slice(0, 10)} {time} UTC
      </div>
      {payload.map((p: any) => (
        <div key={p.name} className="chart-tooltip__row">
          <span style={{ color: p.color }}>{p.name}:</span>
          <span className="chart-tooltip__val" style={{ color: p.color }}>
            {p.value != null ? `${Math.round(p.value).toLocaleString()} MW` : 'N/A'}
          </span>
        </div>
      ))}
      {delta != null && (
        <div className="chart-tooltip__row" style={{ marginTop: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
          <span style={{ color: 'var(--text-muted)' }}>Delta (F - A):</span>
          <span className="chart-tooltip__val" style={{ color: delta > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
            {delta > 0 ? '+' : ''}{Math.round(delta).toLocaleString()} MW
          </span>
        </div>
      )}
    </div>
  );
};

export const DashboardChart: React.FC<Props> = ({ data }) => {
  const { latestForecast, recentActuals } = data;

  const forecastMap = new Map(
    latestForecast.data.map((r) => [r.startTime.replace('Z', ''), r.generation])
  );
  const actualMap = new Map(
    recentActuals.data.map((r) => [r.hour.slice(0, 16), r.generation])
  );

  const allHours = new Set([
    ...Array.from(forecastMap.keys()),
    ...Array.from(actualMap.keys()),
  ]);

  const chartData = Array.from(allHours)
    .sort()
    .slice(-96)
    .map((h) => ({
      hour: h,
      forecast: forecastMap.get(h) ?? null,
      actual: actualMap.get(h.slice(0, 16)) ?? null,
    }));

  const formatTick = (h: string) => {
    try {
      const d = new Date(h + 'Z');
      if (d.getUTCHours() === 0) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      }
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    } catch {
      return '';
    }
  };

  const nowISO = new Date().toISOString().slice(0, 16);

  return (
    <div className="chart-panel">
      <div className="chart-panel__header">
        <div>
          <div className="chart-panel__title">
            <ForecastIcon size={16} color="var(--accent-cyan)" />
            Wind Generation: Delivery Window Timeline
          </div>
          <div className="chart-panel__desc">
            Latest WINDFOR forecast (published {
              latestForecast.publishTime
                ? new Date(latestForecast.publishTime).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'
                : 'N/A'
            }) aligned with recent FUELHH actual generation.
          </div>
        </div>

        <div className="chart-legend">
          <div className="legend-chip">
            <div className="legend-indicator" style={{ backgroundColor: 'var(--accent-cyan)' }} />
            <span>Latest Forecast (WINDFOR)</span>
          </div>
          <div className="legend-chip">
            <div className="legend-indicator" style={{ backgroundColor: 'var(--accent-amber)' }} />
            <span>Actual Generation (FUELHH)</span>
          </div>
          <div className="legend-chip">
            <div className="legend-indicator" style={{ borderTop: '2px dashed var(--text-muted)' }} />
            <span>Gate Line (Now)</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="gradientForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="gradientActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={formatTick}
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'var(--border-subtle)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)} GW`}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            x={nowISO}
            stroke="var(--text-muted)"
            strokeDasharray="3 3"
            label={{ value: 'NOW', fill: 'var(--text-secondary)', fontSize: 10, position: 'insideTopRight', fontFamily: 'var(--font-mono)' }}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#0EA5E9"
            strokeWidth={2}
            fill="url(#gradientForecast)"
            dot={false}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#F59E0B"
            strokeWidth={2}
            fill="url(#gradientActual)"
            dot={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
