interface Props {
  evalCp: number | null
  evalMate: number | null
  height?: number | string
}

/** Vertical eval bar: white share grows from the bottom. */
export default function EvalBar({ evalCp, evalMate }: Props): React.JSX.Element {
  let whitePct = 50
  let label = '0.0'
  if (evalMate !== null) {
    whitePct = evalMate > 0 ? 98 : 2
    label = `M${Math.abs(evalMate)}`
  } else if (evalCp !== null) {
    // logistic squash for display
    whitePct = 100 / (1 + Math.exp(-evalCp / 300))
    whitePct = Math.max(3, Math.min(97, whitePct))
    label = (evalCp / 100).toFixed(1)
  }
  return (
    <div className="eval-bar" title={`Eval: ${label}`}>
      <div className="white-part" style={{ height: `${whitePct}%` }} />
    </div>
  )
}
