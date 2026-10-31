import React from 'react';

interface Props {
  message?: string;
  sub?: string;
}

export const LoadingState: React.FC<Props> = ({
  message = 'Fetching data…',
  sub,
}) => (
  <div className="loading-state">
    <div className="spinner" />
    <div className="loading-text">{message}</div>
    {sub && <div className="loading-sub">{sub}</div>}
  </div>
);

interface ErrorProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorProps> = ({ message, onRetry }) => (
  <div className="error-state">
    <div className="error-icon">⚡</div>
    <div className="error-title">Data Unavailable</div>
    <div className="error-msg">{message}</div>
    {onRetry && (
      <button className="retry-btn" onClick={onRetry}>
        Try Again
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{ message?: string }> = ({
  message = 'No data available.',
}) => <div className="empty-state">{message}</div>;
