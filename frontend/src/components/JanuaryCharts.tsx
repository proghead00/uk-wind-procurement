import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { JanuaryAnalysis } from '../types';
import { ForecastIcon, ActualsIcon, TargetIcon } from './Icons';

interface Props {
  analysis: JanuaryAnalysis;
}

const DailyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const forecast = payload.find((p: any) => p.dataKey === 'forecast')?.value;
  const actual = payload.find((p: any) => p.dataKey === 'actual')?.value;
  const delta = forecast != null && actual != null ? forecast - actual : null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__header">Date: 2026-{label} UTC</div>
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

const ErrorTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__header">Date: 2026-{label} UTC</div>
      <div className="chart-tooltip__row">
        <span style={{ color: 'var(--text-secondary)' }}>Daily Net Bias:</span>
        <span
          className="chart-tooltip__val"
          style={{
            color: val > 0 ? 'var(--accent-rose)' : val < 0 ? 'var(--accent-emerald)' : 'var(--text-primary)',
          }}
        >
          {val != null ? `${val > 0 ? '+' : ''}${Math.round(val).toLocaleString()} MW` : 'N/A'}
        </span>
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
        {val > 0 ? 'Over-forecast: wind was below prediction' : 'Under-forecast: wind exceeded prediction'}
      </div>
    </div>
  );
};

export const JanuaryCharts: React.FC<Props> = ({ analysis }) => {
  const { dailySummary, metrics } = analysis;

  const dailyData = dailySummary.map((d) => ({
    date: d.date.slice(5),
    forecast: d.avgForecast,
    actual: d.avgActual,
    error: d.avgForecast != null && d.avgActual != null ? d.avgForecast - d.avgActual : null,
  }));

  const bucketData = metrics.leadTimeBuckets.map((b) => ({
    label: b.label,
    MAE: Math.round(b.mae),
    RMSE: Math.round(b.rmse),
    Bias: Math.round(b.bias),
    count: b.count,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Daily Average Profile */}
      <div className="chart-panel">
        <div className="chart-panel__header">
          <div>
            <div className="chart-panel__title">
              <ForecastIcon size={16} color="var(--accent-cyan)" />
              Daily Average Profile: Decision-Time Forecast vs Actual (January 2026)
            </div>
            <div className="chart-panel__desc">
              Latest eligible WINDFOR forecasts published at or before noon UTC on D-1, compared against realised FUELHH actuals.
            </div>
          </div>
          <div className="chart-legend">
            <div className="legend-chip">
              <div className="legend-indicator" style={{ backgroundColor: 'var(--accent-cyan)' }} />
              <span>Daily Avg Forecast</span>
            </div>
            <div className="legend-chip">
              <div className="legend-indicator" style={{ backgroundColor: 'var(--accent-amber)' }} />
              <span>Daily Avg Actual</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={dailyData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)} GW`}
              width={48}
            />
            <Tooltip content={<DailyTooltip />} />
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke="#0EA5E9"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Error Distribution */}
      <div className="chart-panel">
        <div className="chart-panel__header">
          <div>
            <div className="chart-panel__title">
              <ActualsIcon size={16} color="var(--accent-amber)" />
              Daily Forecast Error (Forecast - Actual)
            </div>
            <div className="chart-panel__desc">
              Positive values indicate over-prediction (generation deficit requiring thermal backup). Negative values indicate under-prediction.
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={dailyData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(1)}k`}
              width={48}
            />
            <Tooltip content={<ErrorTooltip />} />
            <Bar
              dataKey="error"
              name="Daily Error"
              fill="#0EA5E9"
              radius={[2, 2, 0, 0]}
              maxBarSize={18}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Lead-Time Accuracy Matrix */}
      {bucketData.length > 0 && (
        <div className="chart-panel">
          <div className="chart-panel__header">
            <div>
              <div className="chart-panel__title">
                <TargetIcon size={16} color="var(--accent-emerald)" />
                Lead-Time Performance Matrix
              </div>
              <div className="chart-panel__desc">
                Error quantification stratified by publication lead time before delivery hour. Shorter lead times allow tighter thermal buffer sizing.
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead Time Horizon</th>
                  <th style={{ textAlign: 'right' }}>Observations (n)</th>
                  <th style={{ textAlign: 'right' }}>MAE (MW)</th>
                  <th style={{ textAlign: 'right' }}>RMSE (MW)</th>
                  <th style={{ textAlign: 'right' }}>Mean Bias (MW)</th>
                  <th>Procurement Impact</th>
                </tr>
              </thead>
              <tbody>
                {bucketData.map((b) => (
                  <tr key={b.label}>
                    <td style={{ fontWeight: 600 }}>{b.label}</td>
                    <td style={{ textAlign: 'right' }}>{b.count}</td>
                    <td style={{ textAlign: 'right' }}>{b.MAE.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{b.RMSE.toLocaleString()}</td>
                    <td
                      style={{ textAlign: 'right' }}
                      className={b.Bias > 0 ? 'delta-positive' : b.Bias < 0 ? 'delta-negative' : ''}
                    >
                      {b.Bias > 0 ? '+' : ''}{b.Bias.toLocaleString()}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {b.Bias > 0 ? 'Over-forecast tendency (plan thermal backup)' : 'Under-forecast tendency (surplus risk)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
