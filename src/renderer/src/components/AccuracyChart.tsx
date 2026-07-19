import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { AccuracyPoint } from '../../../shared/types'

interface Props {
  points: AccuracyPoint[]
}

/** Accuracy over time, smoothed with a 10-game rolling average. */
export default function AccuracyChart({ points }: Props): React.JSX.Element {
  const data = points.map((p, i) => {
    const window = points.slice(Math.max(0, i - 9), i + 1)
    const rolling = window.reduce((s, x) => s + x.accuracy, 0) / window.length
    return {
      date: new Date(p.endTime * 1000).toLocaleDateString(undefined, {
        month: 'short',
        year: '2-digit'
      }),
      accuracy: Number(p.accuracy.toFixed(1)),
      rolling: Number(rolling.toFixed(1))
    }
  })

  if (data.length === 0) {
    return <p className="faint">No analyzed games yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="var(--text-faint)" fontSize={11} minTickGap={40} />
        <YAxis domain={[40, 100]} stroke="var(--text-faint)" fontSize={11} />
        <Tooltip
          contentStyle={{
            background: '#0d0d0d',
            border: '1px solid #333333',
            borderRadius: 0,
            fontSize: 12
          }}
        />
        <Line
          dataKey="accuracy"
          stroke="var(--text-faint)"
          dot={false}
          strokeWidth={1}
          opacity={0.5}
          name="Per game"
        />
        <Line dataKey="rolling" stroke="#ffffff" dot={false} strokeWidth={2} name="10-game avg" />
      </LineChart>
    </ResponsiveContainer>
  )
}
