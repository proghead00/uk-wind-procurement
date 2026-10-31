import React from 'react';
import { AlertIcon, DatabaseIcon } from './Icons';

interface Props {
  message?: string;
  sub?: string;
}

export const LoadingState: React.FC<Props> = ({
  message = 'Fetching data...',
  sub,
}) => (
  <div className="state-container">
    <div className="state-spinner" />
    <div className="state-title">{message}</div>
    {sub && <div className="state-subtitle">{sub}</div>}
  </div>
);

interface ErrorProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorProps> = ({ message, onRetry }) => (
  <div className="state-container">
    <div style={{ color: 'var(--accent-rose)', marginBottom: 12 }}>
      <AlertIcon size={28} />
    </div>
    <div className="state-title">Data Stream Unavailable</div>
    <div className="state-subtitle">{message}</div>
    {onRetry && (
      <button className="btn-retry" onClick={onRetry}>
        Retry Connection
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{ message?: string }> = ({
  message = 'No records available for the requested parameters.',
}) => (
  <div className="state-container">
    <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
      <DatabaseIcon size={28} />
    </div>
    <div className="state-subtitle">{message}</div>
  </div>
);
