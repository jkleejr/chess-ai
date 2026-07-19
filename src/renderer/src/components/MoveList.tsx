import { useEffect, useRef } from 'react'
import type { MoveEval } from '../../../shared/types'
import { GLYPHS } from './classificationUi'

interface Props {
  moves: MoveEval[]
  currentPly: number // 0 = start position
  onSelect: (ply: number) => void
}

function MoveCell({
  move,
  current,
  onSelect
}: {
  move: MoveEval | undefined
  current: boolean
  onSelect: (ply: number) => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (current) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [current])
  if (!move) return <div />
  const ui = move.classification ? GLYPHS[move.classification] : null
  return (
    <div
      ref={ref}
      className={`move-cell${current ? ' current' : ''}`}
      onClick={() => onSelect(move.ply)}
      title={ui?.label}
    >
      {move.san}
      {ui && ui.glyph && (
        <span className="glyph" style={{ color: ui.color }}>
          {ui.glyph}
        </span>
      )}
    </div>
  )
}

export default function MoveList({ moves, currentPly, onSelect }: Props): React.JSX.Element {
  const rows: { num: number; white?: MoveEval; black?: MoveEval }[] = []
  for (const m of moves) {
    const num = Math.ceil(m.ply / 2)
    if (m.ply % 2 === 1) rows.push({ num, white: m })
    else {
      const row = rows[rows.length - 1]
      if (row && row.num === num) row.black = m
      else rows.push({ num, black: m })
    }
  }
  return (
    <div className="move-list-panel">
      <div className="move-grid">
        {rows.map((r) => (
          <div key={r.num} style={{ display: 'contents' }}>
            <div className="move-num">{r.num}.</div>
            <MoveCell move={r.white} current={r.white?.ply === currentPly} onSelect={onSelect} />
            <MoveCell move={r.black} current={r.black?.ply === currentPly} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </div>
  )
}
