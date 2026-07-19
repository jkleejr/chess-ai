import { useEffect } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import GameList from './screens/GameList'
import GameReview from './screens/GameReview'
import Insights from './screens/Insights'
import Onboarding from './screens/Onboarding'
import Settings from './screens/Settings'
import { useAppStore } from './stores/appStore'

function SidebarStatus(): React.JSX.Element {
  const { syncProgress, analysis, engineStatus } = useAppStore()
  return (
    <div className="status-area">
      {syncProgress && syncProgress.phase !== 'done' && syncProgress.phase !== 'error' && (
        <div>
          <span className="spinner" /> Syncing games… ({syncProgress.gamesInserted})
        </div>
      )}
      {analysis.currentGameId !== null && (
        <div>
          <span className="spinner" /> Analyzing #{analysis.currentGameId} ({analysis.currentPct}%)
          {analysis.queued > 0 && <div>{analysis.queued} in queue</div>}
        </div>
      )}
      {engineStatus?.state === 'downloading' && (
        <div>
          <span className="spinner" /> Engine download {engineStatus.downloadPct ?? 0}%
        </div>
      )}
    </div>
  )
}

function Shell(): React.JSX.Element {
  const location = useLocation()
  const isReview = location.pathname.startsWith('/game/')
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Chess<span>Coach</span>
        </div>
        <nav>
          <NavLink to="/games" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="icon">♟</span> Games
          </NavLink>
          <NavLink
            to="/insights"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="icon">📈</span> Insights
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="icon">⚙</span> Settings
          </NavLink>
        </nav>
        <SidebarStatus />
      </aside>
      <main className={`main-content${isReview ? ' no-pad' : ''}`}>
        <Routes>
          <Route path="/games" element={<GameList />} />
          <Route path="/game/:id" element={<GameReview />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/games" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function Root(): React.JSX.Element {
  const { username, initialized, init } = useAppStore()

  useEffect(() => {
    void init()
  }, [init])

  if (!initialized) return <div />
  if (!username) return <Onboarding />
  return <Shell />
}

export default function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Root />
    </HashRouter>
  )
}
