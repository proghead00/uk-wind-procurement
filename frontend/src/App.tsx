import React, { useState } from 'react';
import './index.css';
import { DashboardPage } from './pages/DashboardPage';
import { AnalysisPage } from './pages/AnalysisPage';

import { api } from './api';

type Page = 'dashboard' | 'analysis';

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [apiStatus, setApiStatus] = useState<'ok' | 'loading' | 'error'>('loading');

  // Health check on mount
  React.useEffect(() => {
    api.health()
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'));
  }, []);

  return (
    <div className="app">
      {/* ---- Header ---- */}
      <header className="header">
        <div className="container">
          <div className="header__inner">
            <div className="logo">
              <div className="logo__icon">🌬️</div>
              <div className="logo__name">Wind<span>Pulse</span></div>
              <div className="logo__badge">UK</div>
            </div>

            <nav className="nav">
              <button
                id="nav-dashboard"
                className={`nav__link ${page === 'dashboard' ? 'active' : ''}`}
                onClick={() => setPage('dashboard')}
              >
                Live Dashboard
              </button>
              <button
                id="nav-analysis"
                className={`nav__link ${page === 'analysis' ? 'active' : ''}`}
                onClick={() => setPage('analysis')}
              >
                Jan 2026 Analysis
              </button>
            </nav>

            <div className="header__status">
              <div
                className={`status-dot ${apiStatus === 'loading' ? 'loading' : apiStatus === 'error' ? 'error' : ''}`}
              />
              <span>
                {apiStatus === 'loading' ? 'Connecting…' : apiStatus === 'error' ? 'API offline' : 'Elexon BMRS Live'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ---- Main Content ---- */}
      <main className="container" style={{ flex: 1, paddingTop: 0, paddingBottom: 40 }}>
        {page === 'dashboard' ? <DashboardPage /> : <AnalysisPage />}
      </main>

      {/* ---- Footer ---- */}
      <footer className="footer">
        <div className="container">
          <div className="footer__inner">
            <div className="footer__text">
              WindPulse · Data: Elexon BMRS API · National GB wind only · UTC timestamps
            </div>
            <div className="footer__links">
              <a
                href="https://bmrs.elexon.co.uk/api-documentation"
                target="_blank"
                rel="noopener noreferrer"
                className="footer__link"
              >
                Elexon API Docs
              </a>
              <a
                href="https://github.com/susnatoww/xwrp7k"
                target="_blank"
                rel="noopener noreferrer"
                className="footer__link"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
