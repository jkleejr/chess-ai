import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameListFilter, GameSummary } from '../../../shared/types'
import { api, events } from '../api'
import { useAppStore } from '../stores/appStore'

const PAGE = 100

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    year: '2-digit',
    month: 'short',
    day: 'numeric'
  })
}

function opponentOf(g: GameSummary): { name: string; rating: number | null } {
  return g.userColor === 'white'
    ? { name: g.blackUsername, rating: g.blackRating }
    : { name: g.whiteUsername, rating: g.whiteRating }
}

function userAccuracy(g: GameSummary): number | null {
  return g.userColor === 'white' ? g.accuracyWhite : g.accuracyBlack
}

export default function GameList(): React.JSX.Element {
  const navigate = useNavigate()
  const [games, setGames] = useState<GameSummary[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<GameListFilter>({})
  const [limit, setLimit] = useState(PAGE)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [paused, setPaused] = useState(false)
  const [queueActive, setQueueActive] = useState(false)
  const { startSync, syncProgress } = useAppStore()

  const load = useCallback(async () => {
    const [rows, count, status] = await Promise.all([
      api.listGames(0, limit, filter),
      api.countGames(),
      api.analysisStatus()
    ])
    setGames(rows)
    setTotal(count)
    setPendingTotal(status.pendingTotal)
    setPaused(status.paused)
    setQueueActive(status.queued > 0 || status.currentGameId !== null)
  }, [filter, limit])

  useEffect(() => {
    void load()
    const offAnalyzed = events.onGameAnalyzed(() => void load())
    const offSync = events.onSyncProgress((p) => {
      if (p.phase === 'done') void load()
    })
    const offInsight = events.onInsightReady(() => void load())
    return () => {
      offAnalyzed()
      offSync()
      offInsight()
    }
  }, [load])

  const syncing =
    syncProgress !== null && syncProgress.phase !== 'done' && syncProgress.phase !== 'error'

  return (
    <div>
      <h1>Games</h1>
      <div className="filters">
        <select
          value={filter.result ?? ''}
          onChange={(e) =>
            setFilter((f) => ({ ...f, result: (e.target.value || undefined) as never }))
          }
        >
          <option value="">All results</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
          <option value="draw">Draws</option>
        </select>
        <select
          value={filter.timeClass ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, timeClass: e.target.value || undefined }))}
        >
          <option value="">All time controls</option>
          <option value="bullet">Bullet</option>
          <option value="blitz">Blitz</option>
          <option value="rapid">Rapid</option>
          <option value="daily">Daily</option>
        </select>
        <button onClick={() => void startSync()} disabled={syncing}>
          {syncing ? 'Syncing…' : '↻ Sync new games'}
        </button>
        {pendingTotal > 0 && !queueActive && (
          <button
            onClick={() => {
              void api.analysisResume()
              void api.enqueueAnalysis('all-pending').then(load)
            }}
            title="Runs in the background at low CPU priority; you can pause anytime"
          >
            ⚙ Analyze all ({pendingTotal})
          </button>
        )}
        {queueActive && (
          <button
            onClick={() => void (paused ? api.analysisResume() : api.analysisPause()).then(load)}
          >
            {paused ? '▶ Resume analysis' : '⏸ Pause analysis'}
          </button>
        )}
        <span className="faint">
          {total} games{syncProgress?.phase === 'error' ? ` — ${syncProgress.message}` : ''}
        </span>
      </div>

      <table className="game-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Opponent</th>
            <th></th>
            <th>Time</th>
            <th>Opening</th>
            <th>Accuracy</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => {
            const opp = opponentOf(g)
            const acc = userAccuracy(g)
            return (
              <tr key={g.id} onClick={() => navigate(`/game/${g.id}`)}>
                <td className="muted">{fmtDate(g.endTime)}</td>
                <td>
                  {opp.name} <span className="faint">({opp.rating ?? '?'})</span>
                </td>
                <td>
                  <span className={`result-chip result-${g.result}`}>
                    {g.result === 'win' ? 'W' : g.result === 'loss' ? 'L' : 'D'}
                  </span>
                </td>
                <td className="muted">{g.timeClass}</td>
                <td
                  className="muted"
                  style={{
                    maxWidth: 220,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {g.openingName ?? '—'}
                </td>
                <td className="acc">{acc !== null ? `${acc.toFixed(1)}%` : '—'}</td>
                <td>
                  {g.analysisStatus === 'analyzed' ? (
                    <span title="Engine analyzed">⚙︎{g.hasCoachReview ? ' 🎓' : ''}</span>
                  ) : g.analysisStatus === 'analyzing' ? (
                    <span className="spinner" />
                  ) : g.analysisStatus === 'error' ? (
                    <span className="error-text">!</span>
                  ) : (
                    <span className="faint">queued</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {games.length >= limit && (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <button onClick={() => setLimit((l) => l + PAGE)}>Load more</button>
        </div>
      )}
    </div>
  )
}
