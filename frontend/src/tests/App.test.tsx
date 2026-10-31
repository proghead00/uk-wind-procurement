/**
 * Frontend smoke tests
 * Tests that key components render without crashing and display correct UI states.
 * Run with: npm test (inside frontend/)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the API module
vi.mock('../api', () => ({
  api: {
    health: vi.fn().mockResolvedValue({ status: 'ok', ts: '2026-01-01T00:00:00Z' }),
    dashboard: vi.fn().mockResolvedValue({
      latestForecast: {
        publishTime: '2026-01-01T12:00:00Z',
        data: [
          { dataset: 'WINDFOR', publishTime: '2026-01-01T12:00:00Z', startTime: '2026-01-01T13:00:00Z', generation: 5000 },
        ],
      },
      recentActuals: {
        count: 2,
        data: [
          { hour: '2026-01-01T10:00:00', generation: 4800 },
          { hour: '2026-01-01T11:00:00', generation: 5100 },
        ],
      },
      fetchedAt: '2026-01-01T14:00:00Z',
    }),
    januaryAnalysis: vi.fn().mockResolvedValue({
      period: 'January 2026',
      cutoffAssumption: 'Noon UTC on D-1',
      timezone: 'UTC',
      dataSource: 'Elexon BMRS',
      units: 'MW',
      metrics: {
        mae: 512.3,
        rmse: 698.1,
        bias: 42.5,
        count: 720,
        paired: [],
        leadTimeBuckets: [
          { label: '24-36h', count: 360, mae: 480.0, rmse: 650.0, bias: 35.0 },
          { label: '36-48h', count: 360, mae: 545.0, rmse: 748.0, bias: 50.0 },
        ],
      },
      dailySummary: [
        { date: '2026-01-01', avgForecast: 5200, avgActual: 5100, forecastHours: 24, actualHours: 24 },
      ],
      forecastCount: 5800,
      actualCount: 1488,
      matchedPairs: 720,
      deliveryHoursRequested: 744,
    }),
  },
}));

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  ComposedChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
  Line: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
  ErrorBar: () => null,
}));

import App from '../App';

describe('App smoke tests', () => {
  it('renders header with WindPulse branding', () => {
    render(<App />);
    expect(screen.getByText(/WindPulse/i)).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Live Operations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /January 2026 Verification/i })).toBeInTheDocument();
  });

  it('shows dashboard page by default', () => {
    render(<App />);
    expect(screen.getByText(/Day-Ahead Wind Procurement Desk/i)).toBeInTheDocument();
  });

  it('shows operational telemetry strip', () => {
    render(<App />);
    expect(screen.getAllByText(/National Grid GB/i)[0]).toBeInTheDocument();
  });
});
