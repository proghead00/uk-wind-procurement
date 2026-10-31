// API client – reads base URL from Vite env variable
const API_BASE = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? 'http://localhost:8002' : '');


async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  health: () => apiFetch<{ status: string; ts: string }>('/api/health'),
  dashboard: () => apiFetch<import('./types').DashboardData>('/api/dashboard'),
  januaryAnalysis: () => apiFetch<import('./types').JanuaryAnalysis>('/api/january-analysis'),
  latestForecast: () =>
    apiFetch<{ publishTime: string; count: number; data: import('./types').ForecastRecord[] }>(
      '/api/forecasts/latest'
    ),
};
