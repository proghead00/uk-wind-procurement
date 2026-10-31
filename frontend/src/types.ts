// Types matching the Python backend API responses

export interface ForecastRecord {
  dataset: string;
  publishTime: string;
  startTime: string;
  generation: number;
}

export interface ActualRecord {
  hour: string;
  generation: number;
}

export interface LeadTimeBucket {
  label: string;
  count: number;
  mae: number;
  rmse: number;
  bias: number;
}

export interface PairedRecord {
  hour: string;
  forecast: number;
  actual: number;
  error: number;
  absError: number;
  leadHours: number;
  publishTime: string;
}

export interface AccuracyMetrics {
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  count: number;
  paired: PairedRecord[];
  leadTimeBuckets: LeadTimeBucket[];
  warning?: string;
}

export interface DailySummary {
  date: string;
  avgForecast: number | null;
  avgActual: number | null;
  forecastHours: number;
  actualHours: number;
}

export interface JanuaryAnalysis {
  period: string;
  cutoffAssumption: string;
  timezone: string;
  dataSource: string;
  units: string;
  metrics: AccuracyMetrics;
  dailySummary: DailySummary[];
  forecastCount: number;
  actualCount: number;
  matchedPairs: number;
  deliveryHoursRequested: number;
}

export interface DashboardData {
  latestForecast: {
    publishTime: string | null;
    data: ForecastRecord[];
  };
  recentActuals: {
    count: number;
    data: ActualRecord[];
  };
  fetchedAt: string;
}

export interface ApiError {
  detail: string;
}
