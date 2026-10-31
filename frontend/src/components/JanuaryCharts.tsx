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
  Legend,
  ErrorBar,
} from 'recharts';
import type { JanuaryAnalysis } from '../types';

interface Props {
  analysis: JanuaryAnalysis;
}

const DailyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip__label">{label}</div>
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

const ErrorTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip__label">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="custom-tooltip__row">
          <span className="custom-tooltip__key">{p.name}</span>
          <span
            className="custom-tooltip__val"
            style={{
              color: p.value > 0 ? '#ff5252' : p.value < 0 ? '#00e676' : 'var(--text-secondary)',
            }}
          >
            {p.value != null ? `${p.value > 0 ? '+' : ''}${Math.round(p.value).toLocaleString()} MW` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

export const JanuaryCharts: React.FC<Props> = ({ analysis }) => {
  const { dailySummary, metrics } = analysis;

  // Daily comparison chart data
  const dailyData = dailySummary.map((d) => ({
    date: d.date.slice(5), // MM-DD
    forecast: d.avgForecast,
    actual: d.avgActual,
    error: d.avgForecast != null && d.avgActual != null ? d.avgForecast - d.avgActual : null,
  }));

  // Lead-time bucket data
  const bucketData = metrics.leadTimeBuckets.map((b) => ({
    label: b.label,
    MAE: Math.round(b.mae),
    RMSE: Math.round(b.rmse),
    Bias: Math.round(b.bias),
    count: b.count,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ---- Daily Avg Forecast vs Actual ---- */}
      <div className="chart-card fade-in">
        <div className="chart-card__title">📅 January 2026 – Daily Average: Forecast vs Actual</div>
        <div className="chart-card__desc">
          Decision-time forecasts (latest eligible before noon UTC D−1) averaged per day against realised actuals. Units: MW.
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#00e5ff' }} />
            <span>Avg Forecast (decision-time)</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#00e676' }} />
            <span>Avg Actual (FUELHH)</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={dailyData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(33,150,243,0.08)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip content={<DailyTooltip />} />
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke="#00e5ff"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="#00e676"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ---- Daily Error ---- */}
      <div className="chart-card fade-in">
        <div className="chart-card__title">📊 Daily Forecast Error (Forecast − Actual)</div>
        <div className="chart-card__desc">
          Positive = over-forecast (wind was less than expected → procure more than planned).
          Negative = under-forecast (wind exceeded forecast → procured too much). Units: MW.
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={dailyData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(33,150,243,0.08)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(1)}k`}
              width={50}
            />
            <Tooltip content={<ErrorTooltip />} />
            <Bar
              dataKey="error"
              name="Error (F−A)"
              fill="#2196f3"
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
              // Color bars by sign
              label={false}
            />
            {/* Zero line */}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ---- Lead-time Accuracy ---- */}
      {bucketData.length > 0 && (
        <div className="chart-card fade-in">
          <div className="chart-card__title">🎯 Accuracy by Forecast Lead Time</div>
          <div className="chart-card__desc">
            MAE and RMSE grouped by how far ahead the forecast was published before delivery. Units: MW.
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-dot" style={{ background: '#2196f3' }} />
              <span>MAE</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: '#7c4dff' }} />
              <span>RMSE</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: '#ffab40' }} />
              <span>Bias (F−A)</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={bucketData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(33,150,243,0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                width={48}
              />
              <Tooltip />
              <Bar dataKey="MAE" fill="#2196f3" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="RMSE" fill="#7c4dff" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Bias" fill="#ffab40" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Lead-time table */}
          <div className="data-table-wrap" style={{ marginTop: 20 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead Time</th>
                  <th>n</th>
                  <th>MAE (MW)</th>
                  <th>RMSE (MW)</th>
                  <th>Bias (MW)</th>
                </tr>
              </thead>
              <tbody>
                {bucketData.map((b) => (
                  <tr key={b.label}>
                    <td>{b.label}</td>
                    <td>{b.count}</td>
                    <td>{b.MAE.toLocaleString()}</td>
                    <td>{b.RMSE.toLocaleString()}</td>
                    <td className={b.Bias > 0 ? 'metric-positive' : b.Bias < 0 ? 'metric-negative' : ''}>
                      {b.Bias > 0 ? '+' : ''}{b.Bias.toLocaleString()}
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
