import { useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { BotStartResult } from '../../../shared/types'
import { api } from '../api'

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

export default function Play(): React.JSX.Element {
  const chessRef = useRef(new Chess())
  const [fen, setFen] = useState(chessRef.current.fen())
  const [you, setYou] = useState<Color>('white')
  const [started, setStarted] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [bot, setBot] = useState<BotStartResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sanMoves, setSanMoves] = useState<string[]>([])

  // Shut the bot engine down when leaving the screen.
  useEffect(() => {
    return () => {
      void api.botStop()
    }
  }, [])

  const gameOver = statusOf(chessRef.current, you)

  const requestBotMove = async (): Promise<void> => {
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
        if (applied) {
          setFen(chess.fen())
          setSanMoves(chess.history())
        }
      }
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setThinking(false)
    }
  }

  const start = async (color: Color): Promise<void> => {
    setError(null)
    setYou(color)
    chessRef.current = new Chess()
    setFen(chessRef.current.fen())
    setSanMoves([])
    try {
      const info = await api.botStart()
      setBot(info)
      setStarted(true)
      if (color === 'black') void requestBotMove()
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }

  const onPieceDrop = ({
    sourceSquare,
    targetSquare
  }: {
    sourceSquare: string
    targetSquare: string | null
  }): boolean => {
    const chess = chessRef.current
    if (!started || thinking || chess.isGameOver() || !targetSquare) return false
    if ((chess.turn() === 'w' ? 'white' : 'black') !== you) return false
    try {
      const mv = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
      if (!mv) return false
    } catch {
      return false
    }
    setFen(chess.fen())
    setSanMoves(chess.history())
    void requestBotMove()
    return true
  }

  const midBlunder = bot?.phases.find((p) => p.phase === 'middlegame')?.blunderPct

  return (
    <div className="play-layout">
      <div className="play-board">
        <Chessboard
          options={{
            position: fen,
            boardOrientation: you,
            allowDragging: started && !thinking && !gameOver,
            onPieceDrop,
            animationDurationInMs: 120,
            darkSquareStyle: { backgroundColor: '#6f7276' },
            lightSquareStyle: { backgroundColor: '#e9e9e7' },
            boardStyle: { borderRadius: '10px', overflow: 'hidden' }
          }}
        />
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
                  <span>{(chessRef.current.turn() === 'w' ? 'white' : 'black') === you ? 'Your move.' : '…'}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => void start(you)}>New game</button>
                <button onClick={() => void start(you === 'white' ? 'black' : 'white')}>
                  Switch colors
                </button>
              </div>
            </div>
            <div className="card move-scroll">
              <h2>Moves</h2>
              {sanMoves.length === 0 ? (
                <p className="faint">No moves yet.</p>
              ) : (
                <p className="mono" style={{ lineHeight: 1.8, fontSize: 13 }}>
                  {sanMoves
                    .map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m))
                    .join('  ')}
                </p>
              )}
            </div>
            {bot && (
              <p className="faint" style={{ lineHeight: 1.6 }}>
                Mirror built from {bot.analyzedMoves.toLocaleString()} of your analyzed moves and{' '}
                {bot.bookPositions.toLocaleString()} opening positions you have played
                {midBlunder !== undefined
                  ? `; it blunders about ${midBlunder.toFixed(1)}% of middlegame moves, like you`
                  : ''}
                .
              </p>
            )}
          </>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  )
}
