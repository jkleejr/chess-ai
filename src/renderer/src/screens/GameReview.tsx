import { Chess } from 'chess.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GameDetail, MoveEval } from '../../../shared/types'
import { api, events } from '../api'
import Board from '../components/Board'
import CoachPanel from '../components/CoachPanel'
import EvalBar from '../components/EvalBar'
import MoveList from '../components/MoveList'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export default function GameReview(): React.JSX.Element {
  const { id } = useParams()
  const gameId = Number(id)
  const navigate = useNavigate()
  const [detail, setDetail] = useState<GameDetail | null>(null)
  const [ply, setPly] = useState(0) // 0 = start position

  const load = useCallback(async () => {
    const d = await api.getGame(gameId)
    setDetail(d)
  }, [gameId])

  useEffect(() => {
    void load()
    const off = events.onGameAnalyzed((p) => {
      if (p.gameId === gameId) void load()
    })
    const offInsight = events.onInsightReady((p) => {
      if (p.gameId === gameId) void load()
    })
    return () => {
      off()
      offInsight()
    }
  }, [load, gameId])

  // Before engine analysis there are no rows in `moves` — replay the PGN
  // locally so the game is still browsable.
  const replayedMoves = useMemo<MoveEval[]>(() => {
    if (!detail || detail.moves.length > 0) return []
    try {
      const chess = new Chess()
      chess.loadPgn(detail.pgn)
      const userIsWhite = detail.game.userColor === 'white'
      return chess.history({ verbose: true }).map((m, i) => ({
        ply: i + 1,
        san: m.san,
        uci: m.from + m.to + (m.promotion ?? ''),
        fenBefore: m.before,
        fenAfter: m.after,
        isUserMove: (m.color === 'w') === userIsWhite,
        evalCp: null,
        evalMate: null,
        bestMoveUci: null,
        bestMoveSan: null,
        cpLoss: null,
        winProbBefore: null,
        winProbAfter: null,
        moveAccuracy: null,
        classification: null,
        clockSeconds: null
      }))
    } catch {
      return []
    }
  }, [detail])

  const moves = detail && detail.moves.length > 0 ? detail.moves : replayedMoves
  const maxPly = moves.length

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight') setPly((p) => Math.min(maxPly, p + 1))
      else if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowUp') setPly(0)
      else if (e.key === 'ArrowDown') setPly(maxPly)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [maxPly])

  if (!detail) {
    return (
      <div style={{ padding: 60 }}>
        <span className="spinner" /> Loading game…
      </div>
    )
  }

  const { game } = detail
  const current = ply > 0 ? moves[ply - 1] : null
  const fen = current?.fenAfter ?? moves[0]?.fenBefore ?? START_FEN
  // Show the best-move arrow for the position ON THE BOARD (i.e. the next move's best).
  const next = ply < maxPly ? moves[ply] : null
  const analyzed = game.analysisStatus === 'analyzed'
  const opp = game.userColor === 'white' ? game.blackUsername : game.whiteUsername
  const userAcc = game.userColor === 'white' ? game.accuracyWhite : game.accuracyBlack
  const oppAcc = game.userColor === 'white' ? game.accuracyBlack : game.accuracyWhite

  return (
    <div className="review-layout">
      <div className="board-column">
        {analyzed && <EvalBar evalCp={current?.evalCp ?? 0} evalMate={current?.evalMate ?? null} />}
        <div>
          <Board
            fen={fen}
            orientation={game.userColor}
            bestMoveUci={analyzed ? (next?.bestMoveUci ?? null) : null}
            playedMoveUci={current?.uci ?? null}
            showBestArrow={analyzed && ply < maxPly}
          />
          <div className="board-under">
            <button className="small" onClick={() => navigate('/games')}>
              ← Games
            </button>
            <div className="nav-buttons">
              <button onClick={() => setPly(0)} title="Start (↑)">
                ⏮
              </button>
              <button onClick={() => setPly((p) => Math.max(0, p - 1))} title="Back (←)">
                ◀
              </button>
              <button onClick={() => setPly((p) => Math.min(maxPly, p + 1))} title="Forward (→)">
                ▶
              </button>
              <button onClick={() => setPly(maxPly)} title="End (↓)">
                ⏭
              </button>
            </div>
            <span className="faint">
              {ply}/{maxPly}
            </span>
          </div>
        </div>
      </div>

      <div className="side-column">
        <div>
          <div className="review-header">
            <span className="title">
              vs {opp} — {game.result.toUpperCase()}
            </span>
            <span className={`result-chip result-${game.result}`}>
              {game.result === 'win' ? 'W' : game.result === 'loss' ? 'L' : 'D'}
            </span>
          </div>
          <div className="accuracy-badges">
            <span>{game.openingName ?? game.ecoCode ?? ''}</span>
            {analyzed && (
              <>
                <span>
                  You: <b className="acc">{userAcc?.toFixed(1)}%</b>
                </span>
                <span>
                  Opponent: <b className="acc">{oppAcc?.toFixed(1)}%</b>
                </span>
              </>
            )}
            {!analyzed && <span className="faint">engine analysis pending…</span>}
          </div>
        </div>

        <MoveList moves={moves} currentPly={ply} onSelect={setPly} />

        <CoachPanel detail={detail} currentPly={ply} onReviewLoaded={() => void load()} />
      </div>
    </div>
  )
}
