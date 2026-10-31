import React, { useState } from 'react';
import './index.css';
import { DashboardPage } from './pages/DashboardPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { WindIcon } from './components/Icons';
import { api } from './api';

type Page = 'dashboard' | 'analysis';

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [apiStatus, setApiStatus] = useState<'ok' | 'loading' | 'error'>('loading');

  React.useEffect(() => {
    api.health()
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'));
  }, []);

  return (
    <div className="app-container">
      {/* Shell Header */}
      <header className="shell-header">
        <div className="shell-header__inner">
          <div className="brand">
            <div className="brand-badge">
              <WindIcon size={18} />
            </div>
            <div className="brand-text">
              Wind<span>Pulse</span>
            </div>
            <span className="brand-market">GB Market</span>
          </div>

          <nav className="nav-group">
            <button
              id="nav-dashboard"
              className={`nav-tab ${page === 'dashboard' ? 'active' : ''}`}
              onClick={() => setPage('dashboard')}
            >
              Live Operations
            </button>
            <button
              id="nav-analysis"
              className={`nav-tab ${page === 'analysis' ? 'active' : ''}`}
              onClick={() => setPage('analysis')}
            >
              January 2026 Verification
            </button>
          </nav>

          <div className="stream-status">
            <span
              className={`status-beacon ${apiStatus === 'loading' ? 'loading' : apiStatus === 'error' ? 'error' : ''}`}
            />
            <span>
              {apiStatus === 'loading'
                ? 'Connecting to Elexon...'
                : apiStatus === 'error'
                ? 'Elexon API Disconnected'
                : 'Elexon BMRS Live Feed'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="workspace-main">
        {page === 'dashboard' ? <DashboardPage /> : <AnalysisPage />}
      </main>

      {/* Shell Footer */}
      <footer className="shell-footer">
        <div className="shell-footer__inner">
          <div>
            WindPulse Intelligence Desk | Data Provider: Elexon BMRS API | Settlement: National Grid GB | Standard: UTC
          </div>
          <div className="shell-footer__links">
            <a
              href="https://bmrs.elexon.co.uk/api-documentation"
              target="_blank"
              rel="noopener noreferrer"
            >
              Elexon API Docs
            </a>
            <a
              href="https://github.com/proghead00/xwrp7k"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
