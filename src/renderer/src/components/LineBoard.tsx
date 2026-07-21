import { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'

interface Props {
  line: string[] // SAN moves from the start position
  orientation: 'white' | 'black'
  initialPly?: number // how far into the line to start (default: full line)
}

/** Small non-interactive board that steps through a SAN line. */
export default function LineBoard({ line, orientation, initialPly }: Props): React.JSX.Element {
  // Pre-validate the line once; keep the legal prefix.
  const positions = useMemo(() => {
    const chess = new Chess()
    const fens: { fen: string; from?: string; to?: string }[] = [{ fen: chess.fen() }]
    for (const san of line) {
      try {
        const mv = chess.move(san)
        if (!mv) break
        fens.push({ fen: chess.fen(), from: mv.from, to: mv.to })
      } catch {
        break
      }
    }
    return fens
  }, [line])

  const maxPly = positions.length - 1
  const [ply, setPly] = useState(Math.min(initialPly ?? maxPly, maxPly))
  const pos = positions[ply]

  const squareStyles: Record<string, React.CSSProperties> = {}
  if (pos.from && pos.to) {
    squareStyles[pos.from] = { backgroundColor: 'rgba(53, 184, 165, 0.35)' }
    squareStyles[pos.to] = { backgroundColor: 'rgba(53, 184, 165, 0.45)' }
  }

  // Move ticker: "1. e4 c5 2. Nf3" up to the current ply
  const played = line
    .slice(0, ply)
    .map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m))
    .join(' ')

  return (
    <div>
      <Chessboard
        options={{
          position: pos.fen,
          boardOrientation: orientation,
          allowDragging: false,
          squareStyles,
          animationDurationInMs: 120,
          darkSquareStyle: { backgroundColor: '#6f7276' },
          lightSquareStyle: { backgroundColor: '#e9e9e7' },
          boardStyle: { borderRadius: '8px', overflow: 'hidden' }
        }}
      />
      <div className="line-controls">
        <button className="small" onClick={() => setPly(0)} disabled={ply === 0}>
          ⏮
        </button>
        <button className="small" onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0}>
          ‹
        </button>
        <button
          className="small"
          onClick={() => setPly((p) => Math.min(maxPly, p + 1))}
          disabled={ply === maxPly}
        >
          ›
        </button>
        <button className="small" onClick={() => setPly(maxPly)} disabled={ply === maxPly}>
          ⏭
        </button>
        <span className="line-ticker mono">{played || 'start position'}</span>
      </div>
    </div>
  )
}
