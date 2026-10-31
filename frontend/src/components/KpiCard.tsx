import React from 'react';

type AccentColor = 'blue' | 'cyan' | 'green' | 'amber' | 'purple';

interface KpiCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  sub?: string;
  icon: string;
  accent: AccentColor;
  loading?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label, value, unit, sub, icon, accent, loading,
}) => (
  <div className="kpi-card fade-in">
    <div className={`kpi-card__accent ${accent}`} />
    <div className="kpi-card__icon">{icon}</div>
    <div className="kpi-card__label">{label}</div>
    <div className="kpi-card__value">
      {loading ? (
        <span style={{ fontSize: 20, color: 'var(--text-muted)' }}>—</span>
      ) : value === null || value === undefined ? (
        <span style={{ fontSize: 20, color: 'var(--text-muted)' }}>N/A</span>
      ) : (
        <>
          {value}
          {unit && <span className="kpi-card__unit">{unit}</span>}
        </>
      )}
    </div>
    {sub && <div className="kpi-card__sub">{sub}</div>}
  </div>
);
