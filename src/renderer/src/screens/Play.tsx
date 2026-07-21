import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { BotEval, BotStartResult } from '../../../shared/types'
import { api } from '../api'
import { nameOpening } from '../data/openingNames'

type Color = 'white' | 'black'

function statusOf(chess: Chess, you: Color): string | null {
  if (!chess.isGameOver()) return null
  if (chess.isCheckmate()) {
    const winner: Color = chess.turn() === 'w' ? 'black' : 'white'
    return winner === you ? 'Checkmate — you beat yourself!' : 'Checkmate — your mirror got you.'
  }
  if (chess.isStalemate()) return 'Draw by stalemate.'
  if (chess.isThreefoldRepetition()) return 'Draw by repetition.'
  if (chess.isInsufficientMaterial()) return 'Draw — insufficient material.'
  if (chess.isDraw()) return 'Draw.'
  return 'Game over.'
}

function fmtEval(ev: BotEval): string {
  if (ev.mateWhite !== null) return ev.mateWhite > 0 ? `#${ev.mateWhite}` : `#−${-ev.mateWhite}`
  if (ev.cpWhite === null) return '—'
  const p = ev.cpWhite / 100
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}`
}

interface Verdict {
  san: string
  label: string
  lossPawns: number
  tone: 'good' | 'ok' | 'bad'
}

function verdictOf(san: string, lossCp: number): Verdict {
  if (lossCp < 30) return { san, label: 'good move', lossPawns: lossCp / 100, tone: 'good' }
  if (lossCp < 90) return { san, label: 'okay', lossPawns: lossCp / 100, tone: 'ok' }
  if (lossCp < 200) return { san, label: 'inaccuracy', lossPawns: lossCp / 100, tone: 'ok' }
  if (lossCp < 400) return { san, label: 'mistake', lossPawns: lossCp / 100, tone: 'bad' }
  return { san, label: 'blunder', lossPawns: lossCp / 100, tone: 'bad' }
}

export default function Play(): React.JSX.Element {
  const chessRef = useRef(new Chess())
  const [fens, setFens] = useState<string[]>([chessRef.current.fen()])
  const [viewPly, setViewPly] = useState(0)
  const [you, setYou] = useState<Color>('white')
  const [started, setStarted] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [bot, setBot] = useState<BotStartResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sanMoves, setSanMoves] = useState<string[]>([])
  const [analysisOn, setAnalysisOn] = useState(true)
  const [evalInfo, setEvalInfo] = useState<BotEval | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  // eval per position index, for scoring the user's last move
  const evalsRef = useRef(new Map<number, BotEval>())
  const analysisOnRef = useRef(true)

  useEffect(() => {
    return () => {
      void api.botStop()
    }
  }, [])

  const latestPly = fens.length - 1
  const atLatest = viewPly === latestPly
  const gameOver = statusOf(chessRef.current, you)

  /** Evaluate position #idx (its fen) and, when it follows a user move, grade it. */
  const runAnalysis = useCallback(
    async (idx: number, fen: string, movedByUser: boolean, movedSan: string | null) => {
      if (!analysisOnRef.current) return
      try {
        const ev = await api.botEval(fen)
        evalsRef.current.set(idx, ev)
        setEvalInfo(ev)
        if (movedByUser && movedSan) {
          const before = evalsRef.current.get(idx - 1)
          if (
            before &&
            before.cpWhite !== null &&
            ev.cpWhite !== null &&
            before.mateWhite === null &&
            ev.mateWhite === null
          ) {
            const povBefore = you === 'white' ? before.cpWhite : -before.cpWhite
            const povAfter = you === 'white' ? ev.cpWhite : -ev.cpWhite
            setVerdict(verdictOf(movedSan, Math.max(0, povBefore - povAfter)))
          }
        }
      } catch {
        // analysis is best-effort; never break the game over it
      }
    },
    [you]
  )

  const pushPosition = useCallback(
    (movedByUser: boolean, movedSan: string | null) => {
      const chess = chessRef.current
      const fen = chess.fen()
      setFens((prev) => {
        const next = [...prev, fen]
        setViewPly(next.length - 1)
        void runAnalysis(next.length - 1, fen, movedByUser, movedSan)
        return next
      })
      setSanMoves(chess.history())
    },
    [runAnalysis]
  )

  const requestBotMove = useCallback(async (): Promise<void> => {
    const chess = chessRef.current
    if (chess.isGameOver()) return
    setThinking(true)
    setError(null)
    try {
      const ply = chess.history().length + 1
      const mv = await api.botMove(chess.fen(), ply)
      if (mv) {
        const applied = chess.move({
          from: mv.uci.slice(0, 2),
          to: mv.uci.slice(2, 4),
          promotion: mv.uci.length > 4 ? mv.uci.slice(4) : undefined
        })
        if (applied) pushPosition(false, null)
      }
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setThinking(false)
    }
  }, [pushPosition])

  const start = async (color: Color): Promise<void> => {
    setError(null)
    setYou(color)
    chessRef.current = new Chess()
    setFens([chessRef.current.fen()])
    setViewPly(0)
    setSanMoves([])
    setEvalInfo(null)
    setVerdict(null)
    evalsRef.current = new Map()
    try {
      const info = await api.botStart()
      setBot(info)
      setStarted(true)
      void runAnalysis(0, chessRef.current.fen(), false, null)
      if (color === 'black') void requestBotMove()
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }

  // Keyboard: ← / a = back one move, → / d = forward one move
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (e.key === 'ArrowLeft' || k === 'a') {
        e.preventDefault()
        setViewPly((p) => Math.max(0, p - 1))
      } else if (e.key === 'ArrowRight' || k === 'd') {
        e.preventDefault()
        setViewPly((p) => Math.min(fens.length - 1, p + 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fens.length])

  const onPieceDrop = ({
    sourceSquare,
    targetSquare
  }: {
    sourceSquare: string
    targetSquare: string | null
  }): boolean => {
    const chess = chessRef.current
    if (!started || thinking || chess.isGameOver() || !targetSquare || !atLatest) return false
    if ((chess.turn() === 'w' ? 'white' : 'black') !== you) return false
    let san: string
    try {
      const mv = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
      if (!mv) return false
      san = mv.san
    } catch {
      return false
    }
    pushPosition(true, san)
    void requestBotMove()
    return true
  }

  const toggleAnalysis = (on: boolean): void => {
    setAnalysisOn(on)
    analysisOnRef.current = on
    if (on && started) {
      void runAnalysis(latestPly, fens[latestPly], false, null)
    }
  }

  const opening = nameOpening(sanMoves)
  const yourTurn = started && (chessRef.current.turn() === 'w' ? 'white' : 'black') === you

  return (
    <div className="play-layout">
      <div className="play-board">
        <Chessboard
          options={{
            position: fens[viewPly],
            boardOrientation: you,
            allowDragging: started && !thinking && !gameOver && atLatest,
            onPieceDrop,
            animationDurationInMs: 120,
            darkSquareStyle: { backgroundColor: '#6f7276' },
            lightSquareStyle: { backgroundColor: '#e9e9e7' },
            boardStyle: { borderRadius: '10px', overflow: 'hidden' }
          }}
        />
        {started && (
          <div className="board-under">
            <div className="nav-buttons">
              <button onClick={() => setViewPly(0)} disabled={viewPly === 0}>
                ⏮
              </button>
              <button onClick={() => setViewPly((p) => Math.max(0, p - 1))} disabled={viewPly === 0}>
                ‹
              </button>
              <button
                onClick={() => setViewPly((p) => Math.min(latestPly, p + 1))}
                disabled={atLatest}
              >
                ›
              </button>
              <button onClick={() => setViewPly(latestPly)} disabled={atLatest}>
                ⏭
              </button>
            </div>
            <span className="faint">
              {atLatest
                ? '← → or A / D to review moves'
                : `viewing move ${viewPly} of ${latestPly} — → to return`}
            </span>
          </div>
        )}
      </div>
      <div className="play-side">
        <h1>Play yourself</h1>
        {!started ? (
          <div className="card">
            <p className="muted" style={{ marginBottom: 14, lineHeight: 1.55 }}>
              A bot built from your analyzed games: it opens with your repertoire, is accurate
              where you are accurate, and makes mistakes where — and about as often as — you do.
              Beat it by exploiting your own bad habits.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="primary" onClick={() => void start('white')}>
                Play as White
              </button>
              <button onClick={() => void start('black')}>Play as Black</button>
            </div>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="play-status">
                {gameOver ? (
                  <b>{gameOver}</b>
                ) : thinking ? (
                  <span>
                    <span className="spinner" /> Mirror-you is thinking…
                  </span>
                ) : (
                  <span>{yourTurn ? 'Your move.' : '…'}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => void start(you)}>New game</button>
                <button onClick={() => void start(you === 'white' ? 'black' : 'white')}>
                  Switch colors
                </button>
              </div>
            </div>

            <div className="card analysis-card">
              <div className="analysis-head">
                <h2 style={{ marginBottom: 0 }}>Live analysis</h2>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={analysisOn}
                    onChange={(e) => toggleAnalysis(e.target.checked)}
                  />
                  <span className="muted">{analysisOn ? 'on' : 'off'}</span>
                </label>
              </div>
              {analysisOn ? (
                <div className="analysis-body">
                  {opening && (
                    <div className="analysis-row">
                      <span className="faint">Opening</span>
                      <b>{opening}</b>
                    </div>
                  )}
                  {evalInfo && (
                    <div className="analysis-row">
                      <span className="faint">Eval</span>
                      <b className="mono">{fmtEval(evalInfo)}</b>
                      <span className="faint">(+ favors White)</span>
                    </div>
                  )}
                  {verdict && (
                    <div className="analysis-row">
                      <span className="faint">Your last move</span>
                      <b
                        style={{
                          color:
                            verdict.tone === 'good'
                              ? 'var(--win)'
                              : verdict.tone === 'bad'
                                ? 'var(--loss)'
                                : undefined
                        }}
                      >
                        {verdict.san} — {verdict.label}
                        {verdict.lossPawns >= 0.3 ? ` (−${verdict.lossPawns.toFixed(1)})` : ''}
                      </b>
                    </div>
                  )}
                  {yourTurn && !gameOver && evalInfo?.bestSan && (
                    <div className="analysis-row">
                      <span className="faint">Suggestion</span>
                      <b style={{ color: 'var(--accent)' }}>{evalInfo.bestSan}</b>
                      {evalInfo.pvSans.length > 1 && (
                        <span className="faint mono">{evalInfo.pvSans.join(' ')}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="faint">Analysis hidden — play without hints.</p>
              )}
            </div>

            <div className="card move-scroll">
              <h2>Moves</h2>
              {sanMoves.length === 0 ? (
                <p className="faint">No moves yet.</p>
              ) : (
                <p className="mono" style={{ lineHeight: 1.8, fontSize: 13 }}>
                  {sanMoves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join('  ')}
                </p>
              )}
            </div>
            {bot && (
              <p className="faint" style={{ lineHeight: 1.6 }}>
                Mirror built from {bot.analyzedMoves.toLocaleString()} of your analyzed moves and{' '}
                {bot.bookPositions.toLocaleString()} opening positions you have played.
              </p>
            )}
          </>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  )
}
