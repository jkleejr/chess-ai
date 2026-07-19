import type { OpeningStat } from '../../../shared/types'

interface Props {
  stats: OpeningStat[]
  color: 'white' | 'black'
}

export default function OpeningStats({ stats, color }: Props): React.JSX.Element {
  const rows = stats.filter((s) => s.color === color).slice(0, 10)
  if (rows.length === 0) return <p className="faint">No games yet.</p>
  return (
    <table className="stat-table">
      <thead>
        <tr>
          <th>Opening</th>
          <th>Games</th>
          <th>Score</th>
          <th>Acc</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const winRate = ((s.wins + s.draws / 2) / s.games) * 100
          return (
            <tr key={`${s.eco}-${s.color}`}>
              <td
                style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={s.name}
              >
                {s.name} <span className="faint">{s.eco}</span>
              </td>
              <td>{s.games}</td>
              <td
                style={{
                  color: winRate >= 55 ? 'var(--win)' : winRate <= 45 ? 'var(--loss)' : undefined
                }}
              >
                {winRate.toFixed(0)}%
              </td>
              <td className="acc">{s.avgAccuracy !== null ? s.avgAccuracy.toFixed(1) : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
