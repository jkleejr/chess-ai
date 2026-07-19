import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { ExtendedStats } from '../../../shared/types'

// Categorical slots (validated for the dark card surface, adjacent-pair CVD-safe,
// fixed assignment by entity — never by rank).
const TIME_CLASS_COLORS: Record<string, string> = {
  blitz: '#3987e5',
  rapid: '#008300',
  bullet: '#d55181',
  daily: '#c98500'
}
const STATUS_SERIOUS = '#e66767' // blunder metrics: the series MEANS bad
const SINGLE_HUE = '#3987e5' // magnitude charts: one hue

const TOOLTIP_STYLE = {
  background: 'var(--bg-raised)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12
} as const

const AXIS = { stroke: 'var(--text-faint)', fontSize: 11 } as const

// --- stat tiles -------------------------------------------------------------

export function StatTiles({ stats }: { stats: ExtendedStats }): React.JSX.Element {
  const { conversions, recentForm, terminations } = stats
  const timeoutLosses = terminations
    .filter((t) => t.result === 'loss' && t.termination === 'timeout')
    .reduce((s, t) => s + t.games, 0)
  const winningGames = conversions.thrownWins + conversions.wonWhenWinning
  const conversionPct = winningGames ? (conversions.wonWhenWinning / winningGames) * 100 : null
  const delta =
    recentForm.recentAvgAccuracy !== null && recentForm.previousAvgAccuracy !== null
      ? recentForm.recentAvgAccuracy - recentForm.previousAvgAccuracy
      : null

  const tiles = [
    {
      label: 'Thrown wins',
      value: String(conversions.thrownWins),
      sub: `of ${winningGames} winning positions`,
      tone: 'bad' as const
    },
    {
      label: 'Conversion rate',
      value: conversionPct !== null ? `${conversionPct.toFixed(0)}%` : '—',
      sub: 'winning positions converted',
      tone: conversionPct !== null && conversionPct >= 75 ? ('good' as const) : ('neutral' as const)
    },
    {
      label: 'Comeback wins',
      value: String(conversions.comebacks),
      sub: 'won from a lost position',
      tone: 'good' as const
    },
    {
      label: 'Timeout losses',
      value: String(timeoutLosses),
      sub: 'games lost on the clock',
      tone: 'bad' as const
    },
    {
      label: `Last ${recentForm.recentGames} games`,
      value:
        recentForm.recentAvgAccuracy !== null ? `${recentForm.recentAvgAccuracy.toFixed(1)}%` : '—',
      sub:
        delta !== null
          ? `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)} vs previous`
          : 'avg accuracy',
      tone:
        delta !== null ? (delta >= 0 ? ('good' as const) : ('bad' as const)) : ('neutral' as const)
    }
  ]

  return (
    <div className="tile-row">
      {tiles.map((t) => (
        <div key={t.label} className="stat-tile">
          <div className="tile-label">{t.label}</div>
          <div className={`tile-value tile-${t.tone}`}>{t.value}</div>
          <div className="tile-sub">{t.sub}</div>
        </div>
      ))}
    </div>
  )
}

// --- rating over time -------------------------------------------------------

export function RatingChart({ stats }: { stats: ExtendedStats }): React.JSX.Element {
  const points = stats.ratingHistory
  if (points.length === 0) return <p className="faint">No rated games yet.</p>

  // One row per game, columns per time class (recharts connects nulls off).
  const classes = [...new Set(points.map((p) => p.timeClass))].filter((c) => c in TIME_CLASS_COLORS)
  const data = points.map((p) => ({
    date: new Date(p.endTime * 1000).toLocaleDateString(undefined, {
      month: 'short',
      year: '2-digit'
    }),
    [p.timeClass]: p.rating
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" {...AXIS} minTickGap={50} />
        <YAxis domain={['auto', 'auto']} {...AXIS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {classes.map((c) => (
          <Line
            key={c}
            dataKey={c}
            stroke={TIME_CLASS_COLORS[c]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// --- accuracy by phase ------------------------------------------------------

export function PhaseChart({ stats }: { stats: ExtendedStats }): React.JSX.Element {
  const data = stats.phases.map((p) => ({
    phase: p.phase,
    accuracy: Number(p.avgAccuracy.toFixed(1)),
    blunderPct: Number(p.blunderPct.toFixed(1)),
    moves: p.moves
  }))
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart
        data={data}
        margin={{ top: 16, right: 8, bottom: 0, left: -14 }}
        barCategoryGap="28%"
      >
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="phase" {...AXIS} />
        <YAxis domain={[0, 100]} {...AXIS} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={((v: number) => [`${v}%`, 'Avg move accuracy']) as never}
        />
        <Bar
          dataKey="accuracy"
          fill={SINGLE_HUE}
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
          label={{
            position: 'top',
            fill: 'var(--text-dim)',
            fontSize: 12,
            formatter: ((v: number) => `${v}%`) as never
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- blunders vs clock ------------------------------------------------------

export function ClockChart({ stats }: { stats: ExtendedStats }): React.JSX.Element {
  const data = stats.clock.map((c) => ({
    label: c.label,
    blunderPct: Number(c.blunderPct.toFixed(1)),
    moves: c.moves
  }))
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart
        data={data}
        margin={{ top: 16, right: 8, bottom: 0, left: -14 }}
        barCategoryGap="28%"
      >
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={((v: number) => [`${v}% of moves`, 'Blunder rate']) as never}
        />
        <Bar
          dataKey="blunderPct"
          fill={STATUS_SERIOUS}
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
          label={{
            position: 'top',
            fill: 'var(--text-dim)',
            fontSize: 12,
            formatter: ((v: number) => `${v}%`) as never
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- how games end ----------------------------------------------------------

const TERMINATION_ORDER = ['checkmate', 'resignation', 'timeout', 'abandoned', 'other']
const TERMINATION_COLORS = ['#3987e5', '#008300', '#d55181', '#c98500', '#6b6963']

export function TerminationChart({ stats }: { stats: ExtendedStats }): React.JSX.Element {
  const rows = (['win', 'loss'] as const).map((result) => {
    const row: Record<string, number | string> = { result: result === 'win' ? 'Wins' : 'Losses' }
    for (const t of TERMINATION_ORDER) {
      row[t] = stats.terminations
        .filter((x) => x.result === result && x.termination === t)
        .reduce((s, x) => s + x.games, 0)
    }
    return row
  })
  const present = TERMINATION_ORDER.filter((t) => rows.some((r) => (r[t] as number) > 0))

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
        <XAxis type="number" {...AXIS} />
        <YAxis type="category" dataKey="result" {...AXIS} width={52} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {present.map((t, i) => (
          <Bar
            key={t}
            dataKey={t}
            stackId="a"
            fill={TERMINATION_COLORS[TERMINATION_ORDER.indexOf(t)]}
            stroke="var(--bg-raised)"
            strokeWidth={2}
            maxBarSize={34}
            radius={i === present.length - 1 ? [0, 4, 4, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- time of day ------------------------------------------------------------

export function HourChart({ stats }: { stats: ExtendedStats }): React.JSX.Element {
  const data = stats.hourOfDay
    .filter((h) => h.games >= 5)
    .map((h) => ({
      label: h.label,
      winPct: Number(h.winPct.toFixed(0)),
      games: h.games
    }))
  if (data.length === 0) return <p className="faint">Not enough games yet.</p>
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart
        data={data}
        margin={{ top: 16, right: 8, bottom: 0, left: -14 }}
        barCategoryGap="28%"
      >
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis domain={[0, 100]} {...AXIS} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={((v: number) => [`${v}%`, 'Win rate']) as never}
        />
        <Bar
          dataKey="winPct"
          fill={SINGLE_HUE}
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
          label={{
            position: 'top',
            fill: 'var(--text-dim)',
            fontSize: 12,
            formatter: ((v: number) => `${v}%`) as never
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
