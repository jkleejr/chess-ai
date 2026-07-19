import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type {
  AccuracyPoint,
  CostSummary,
  OpeningStat,
  PlayerProfile,
  StyleReport
} from '../../../shared/types'
import { api } from '../api'
import AccuracyChart from '../components/AccuracyChart'
import OpeningStats from '../components/OpeningStats'

export default function Insights(): React.JSX.Element {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [report, setReport] = useState<StyleReport | null>(null)
  const [openings, setOpenings] = useState<OpeningStat[]>([])
  const [accuracy, setAccuracy] = useState<AccuracyPoint[]>([])
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [costs, setCosts] = useState<CostSummary | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    const [p, r, o, a, t, c] = await Promise.all([
      api.getProfile(),
      api.getStyleReport(),
      api.openingStats(1),
      api.accuracyOverTime(),
      api.mistakeTags(),
      api.costs()
    ])
    setProfile(p?.profile ?? null)
    setReport(r)
    setOpenings(o)
    setAccuracy(a)
    setTags(t)
    setCosts(c)
  }

  useEffect(() => {
    void load()
  }, [])

  const generate = async (): Promise<void> => {
    setGenerating(true)
    setError(null)
    try {
      await api.styleReport()
      await load()
    } catch (e) {
      setError(
        (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <h1>Insights</h1>
      <div className="insights-grid">
        <div className="card full">
          <h2>Your style</h2>
          {profile ? (
            <>
              <p style={{ lineHeight: 1.6 }}>{profile.styleSummary}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                <div>
                  <h2 style={{ color: 'var(--win)' }}>Strengths</h2>
                  <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
                    {profile.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 style={{ color: 'var(--loss)' }}>Weaknesses</h2>
                  <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
                    {profile.weaknesses.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <p className="muted">
              No profile yet — analyze some games, coach a few of them, then generate your first
              style report below.
            </p>
          )}
        </div>

        <div className="card">
          <h2>Accuracy over time</h2>
          <AccuracyChart points={accuracy} />
        </div>

        <div className="card">
          <h2>Recurring mistakes</h2>
          {tags.length > 0 ? (
            <div className="tag-cloud">
              {tags.slice(0, 20).map((t) => (
                <span key={t.tag} className="tag">
                  {t.tag} <b>×{t.count}</b>
                </span>
              ))}
            </div>
          ) : (
            <p className="faint">Coach some games to start tracking mistake patterns.</p>
          )}
          {profile && profile.recurringMistakes.length > 0 && (
            <ul style={{ paddingLeft: 18, lineHeight: 1.6, marginTop: 12 }}>
              {profile.recurringMistakes.map((m) => (
                <li key={m.pattern}>
                  <b>{m.pattern}</b> <span className="faint">({m.frequency})</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>Openings as White</h2>
          <OpeningStats stats={openings} color="white" />
        </div>

        <div className="card">
          <h2>Openings as Black</h2>
          <OpeningStats stats={openings} color="black" />
        </div>

        {profile && profile.openingSuggestions.length > 0 && (
          <div className="card full">
            <h2>Openings to try</h2>
            <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
              {profile.openingSuggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="card full">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Style report</h2>
            <button className="primary" onClick={() => void generate()} disabled={generating}>
              {generating ? 'Generating (deep analysis)…' : report ? 'Regenerate report (~$0.15)' : 'Generate style report (~$0.15)'}
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
          {report ? (
            <div className="markdown">
              <ReactMarkdown>{report.report}</ReactMarkdown>
            </div>
          ) : (
            <p className="muted">
              The style report is a deep multi-game analysis by Claude: your playing style,
              recurring mistakes with evidence, opening repertoire advice, and an improvement plan.
            </p>
          )}
        </div>

        <div className="card full">
          <h2>AI spend</h2>
          {costs && costs.byModel.length > 0 ? (
            <table className="stat-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Calls</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {costs.byModel.map((m) => (
                  <tr key={m.model}>
                    <td>{m.model}</td>
                    <td>{m.calls}</td>
                    <td>${m.usd.toFixed(3)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <b>Total</b>
                  </td>
                  <td></td>
                  <td>
                    <b>${costs.totalUsd.toFixed(3)}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="faint">No AI calls yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
