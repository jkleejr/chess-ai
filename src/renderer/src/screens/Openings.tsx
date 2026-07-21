import { useEffect, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { OpeningLine, OpeningMistakePos, PlayerProfile } from '../../../shared/types'
import { api } from '../api'
import LineBoard from '../components/LineBoard'
import { LEARN_OPENINGS } from '../data/learnOpenings'

function MistakeBoard({ m }: { m: OpeningMistakePos }): React.JSX.Element {
  const orientation = m.fen.includes(' w ') ? 'white' : 'black'
  const arrows: { startSquare: string; endSquare: string; color: string }[] = []
  if (m.playedUci && m.playedUci.length >= 4) {
    arrows.push({
      startSquare: m.playedUci.slice(0, 2),
      endSquare: m.playedUci.slice(2, 4),
      color: 'rgba(240, 106, 93, 0.9)'
    })
  }
  if (m.bestUci && m.bestUci.length >= 4) {
    arrows.push({
      startSquare: m.bestUci.slice(0, 2),
      endSquare: m.bestUci.slice(2, 4),
      color: 'rgba(85, 180, 85, 0.9)'
    })
  }
  return (
    <Chessboard
      options={{
        position: m.fen,
        boardOrientation: orientation,
        allowDragging: false,
        arrows,
        darkSquareStyle: { backgroundColor: '#6f7276' },
        lightSquareStyle: { backgroundColor: '#e9e9e7' },
        boardStyle: { borderRadius: '8px', overflow: 'hidden' }
      }}
    />
  )
}

export default function Openings(): React.JSX.Element {
  const [lines, setLines] = useState<OpeningLine[]>([])
  const [mistakes, setMistakes] = useState<OpeningMistakePos[]>([])
  const [profile, setProfile] = useState<PlayerProfile | null>(null)

  useEffect(() => {
    void (async () => {
      const [l, m, p] = await Promise.all([
        api.openingLines().catch(() => [] as OpeningLine[]),
        api.openingMistakes().catch(() => [] as OpeningMistakePos[]),
        api.getProfile().catch(() => null)
      ])
      setLines(l)
      setMistakes(m)
      setProfile(p?.profile ?? null)
    })()
  }, [])

  const learnWhite = LEARN_OPENINGS.filter((o) => o.color === 'white')
  const learnBlack = LEARN_OPENINGS.filter((o) => o.color === 'black')

  return (
    <div>
      <h1>Openings</h1>

      <h2 className="op-section">Openings you play</h2>
      <p className="muted op-caption">
        Your most common line in each opening (3+ games), with your record. Step through with the
        arrows.
      </p>
      {lines.length === 0 ? (
        <p className="faint">Analyze some games first — your repertoire will appear here.</p>
      ) : (
        <div className="op-grid">
          {lines.slice(0, 8).map((o) => {
            const winPct = o.games ? ((o.wins + o.draws / 2) / o.games) * 100 : 0
            return (
              <div key={`${o.eco}-${o.color}`} className="card op-card">
                <div className="op-head">
                  <b title={o.name}>{o.name}</b>
                  <span className="faint">
                    as {o.color} · {o.eco}
                  </span>
                </div>
                <LineBoard line={o.line} orientation={o.color} />
                <div className="op-stats">
                  <span>
                    {o.games} games · {o.wins}W–{o.losses}L–{o.draws}D
                  </span>
                  <span style={{ color: winPct >= 52 ? 'var(--win)' : winPct <= 48 ? 'var(--loss)' : undefined }}>
                    {winPct.toFixed(0)}% score
                  </span>
                  {o.avgAccuracy !== null && <span>{o.avgAccuracy.toFixed(1)}% acc</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="op-section">Where you slip in the opening</h2>
      <p className="muted op-caption">
        Positions from your games where you played a mistake (<span style={{ color: 'var(--loss)' }}>red arrow
        = your move</span>, <span style={{ color: 'var(--win)' }}>green = best</span>). Repeats mean a habit.
      </p>
      {mistakes.length === 0 ? (
        <p className="faint">No repeated opening mistakes found yet.</p>
      ) : (
        <div className="op-grid">
          {mistakes.map((m, i) => (
            <div key={i} className="card op-card">
              <div className="op-head">
                <b title={m.openingName}>{m.openingName}</b>
                <span className="faint">move {Math.ceil(m.ply / 2)}</span>
              </div>
              <MistakeBoard m={m} />
              <div className="op-stats">
                <span>
                  You played <b style={{ color: 'var(--loss)' }}>{m.playedSan}</b>
                  {m.bestSan ? (
                    <>
                      {' '}
                      — better is <b style={{ color: 'var(--win)' }}>{m.bestSan}</b>
                    </>
                  ) : null}
                </span>
                <span className="faint">
                  {m.times > 1 ? `${m.times}× ` : ''}
                  {m.classification}
                  {m.cpLoss !== null ? ` (−${(m.cpLoss / 100).toFixed(1)})` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="op-section">Openings to learn</h2>
      {profile && profile.openingSuggestions.length > 0 && (
        <p className="muted op-caption">
          Your coach suggests: {profile.openingSuggestions.join(' · ')}
        </p>
      )}

      <h2 className="op-sub">As White</h2>
      <div className="op-grid">
        {learnWhite.map((o) => (
          <div key={o.name} className="card op-card">
            <div className="op-head">
              <b>{o.name}</b>
              <span className="faint">{o.eco}</span>
            </div>
            <LineBoard line={o.line} orientation="white" initialPly={4} />
            <p className="op-summary">{o.summary}</p>
            <ul className="op-ideas">
              {o.ideas.map((idea) => (
                <li key={idea}>{idea}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="op-sub">As Black</h2>
      <div className="op-grid">
        {learnBlack.map((o) => (
          <div key={o.name} className="card op-card">
            <div className="op-head">
              <b>{o.name}</b>
              <span className="faint">{o.eco}</span>
            </div>
            <LineBoard line={o.line} orientation="black" initialPly={4} />
            <p className="op-summary">{o.summary}</p>
            <ul className="op-ideas">
              {o.ideas.map((idea) => (
                <li key={idea}>{idea}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
