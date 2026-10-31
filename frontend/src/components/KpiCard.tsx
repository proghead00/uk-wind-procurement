import React from 'react';

type AccentType = 'cyan' | 'amber' | 'emerald' | 'rose' | 'indigo';

interface KpiCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: AccentType;
  loading?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit,
  sub,
  icon,
  accent = 'cyan',
  loading,
}) => (
  <div className={`metric-card accent-${accent}`}>
    <div className="metric-card__header">
      <span className="metric-card__label">{label}</span>
      {icon && <span className="metric-card__icon">{icon}</span>}
    </div>
    <div className="metric-card__value tabular-nums">
      {loading ? (
        <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>...</span>
      ) : value === null || value === undefined ? (
        <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>N/A</span>
      ) : (
        <>
          {value}
          {unit && <span className="metric-card__unit">{unit}</span>}
        </>
      )}
    </div>
    {sub && <div className="metric-card__meta">{sub}</div>}
  </div>
);
