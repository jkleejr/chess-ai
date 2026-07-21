import type {
  AccuracyPoint,
  OpeningLine,
  OpeningMistakePos,
  OpeningStat,
  StatsFilter,
  TimeControlStat
} from '../../../shared/types'
import { getDb } from '../database'

/** The user's real openings: per eco+color, record + the modal move sequence. */
export function openingLines(minGames = 3, maxPlies = 12): OpeningLine[] {
  const rows = getDb()
    .prepare(
      `SELECT g.id, g.eco_code AS eco, COALESCE(g.opening_name, g.eco_code) AS name,
              g.user_color AS color, g.result,
              CASE WHEN g.analysis_status = 'analyzed'
                   THEN (CASE WHEN g.user_color = 'white' THEN g.accuracy_white ELSE g.accuracy_black END)
              END AS acc,
              m.ply, m.san
       FROM games g JOIN moves m ON m.game_id = g.id
       WHERE g.eco_code IS NOT NULL AND m.ply <= ?
       ORDER BY g.id, m.ply`
    )
    .all(maxPlies) as {
    id: number
    eco: string
    name: string
    color: 'white' | 'black'
    result: string
    acc: number | null
    ply: number
    san: string
  }[]

  interface Group {
    eco: string
    name: string
    color: 'white' | 'black'
    games: number
    wins: number
    losses: number
    draws: number
    accSum: number
    accN: number
    seqCounts: Map<string, number>
  }
  const perGame = new Map<number, { key: string; meta: (typeof rows)[number]; sans: string[] }>()
  for (const r of rows) {
    let g = perGame.get(r.id)
    if (!g) {
      g = { key: `${r.eco}:${r.color}`, meta: r, sans: [] }
      perGame.set(r.id, g)
    }
    g.sans.push(r.san)
  }
  const groups = new Map<string, Group>()
  for (const g of perGame.values()) {
    let grp = groups.get(g.key)
    if (!grp) {
      grp = {
        eco: g.meta.eco,
        name: g.meta.name,
        color: g.meta.color,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        accSum: 0,
        accN: 0,
        seqCounts: new Map()
      }
      groups.set(g.key, grp)
    }
    grp.games++
    if (g.meta.result === 'win') grp.wins++
    else if (g.meta.result === 'loss') grp.losses++
    else grp.draws++
    if (g.meta.acc !== null) {
      grp.accSum += g.meta.acc
      grp.accN++
    }
    const seq = g.sans.join(' ')
    grp.seqCounts.set(seq, (grp.seqCounts.get(seq) ?? 0) + 1)
  }
  return [...groups.values()]
    .filter((g) => g.games >= minGames)
    .sort((a, b) => b.games - a.games)
    .map((g) => {
      const modal = [...g.seqCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      return {
        eco: g.eco,
        name: g.name,
        color: g.color,
        games: g.games,
        wins: g.wins,
        losses: g.losses,
        draws: g.draws,
        avgAccuracy: g.accN ? g.accSum / g.accN : null,
        line: modal.split(' ')
      }
    })
}

/** Early-game positions where the user repeatedly plays a mistake/blunder. */
export function openingMistakes(limit = 9): OpeningMistakePos[] {
  return getDb()
    .prepare(
      `SELECT m.fen_before AS fen, m.san AS playedSan, m.uci AS playedUci,
              m.best_move_san AS bestSan, m.best_move_uci AS bestUci,
              m.classification, MAX(m.cp_loss) AS cpLoss, m.ply,
              COALESCE(g.opening_name, g.eco_code, 'Unknown opening') AS openingName,
              COUNT(*) AS times
       FROM moves m JOIN games g ON g.id = m.game_id
       WHERE m.is_user_move = 1 AND m.ply <= 20
         AND m.classification IN ('mistake', 'blunder')
       GROUP BY m.fen_before, m.san
       ORDER BY times DESC, cpLoss DESC
       LIMIT ?`
    )
    .all(limit) as OpeningMistakePos[]
}

function filterSql(filter?: StatsFilter): { cond: string; params: unknown[] } {
  const conds: string[] = []
  const params: unknown[] = []
  if (filter?.timeClass) {
    conds.push('g.time_class = ?')
    params.push(filter.timeClass)
  }
  if (filter?.timeControl) {
    conds.push('g.time_control = ?')
    params.push(filter.timeControl)
  }
  return { cond: conds.length ? ` AND ${conds.join(' AND ')}` : '', params }
}

/** Win rate / accuracy per exact time control ("300", "180+2", …), most-played first. */
export function timeControlStats(): TimeControlStat[] {
  const rows = getDb()
    .prepare(
      `SELECT time_control AS timeControl,
              MAX(time_class) AS timeClass,
              COUNT(*) AS games,
              SUM(result = 'win') AS wins,
              SUM(result = 'loss') AS losses,
              SUM(result = 'draw') AS draws,
              SUM(analysis_status = 'analyzed') AS analyzed,
              AVG(CASE WHEN analysis_status = 'analyzed'
                       THEN (CASE WHEN user_color = 'white' THEN accuracy_white ELSE accuracy_black END)
                  END) AS avg_accuracy
       FROM games
       WHERE time_control IS NOT NULL
       GROUP BY time_control
       ORDER BY games DESC`
    )
    .all() as {
    timeControl: string
    timeClass: string | null
    games: number
    wins: number | null
    losses: number | null
    draws: number | null
    analyzed: number | null
    avg_accuracy: number | null
  }[]
  return rows.map((r) => ({
    timeControl: r.timeControl,
    timeClass: r.timeClass,
    games: r.games,
    wins: r.wins ?? 0,
    losses: r.losses ?? 0,
    draws: r.draws ?? 0,
    analyzed: r.analyzed ?? 0,
    avgAccuracy: r.avg_accuracy
  }))
}

export function openingStats(minGames = 1, filter?: StatsFilter): OpeningStat[] {
  const f = filterSql(filter)
  const rows = getDb()
    .prepare(
      `SELECT g.eco_code AS eco,
              COALESCE(g.opening_name, g.eco_code) AS name,
              g.user_color AS color,
              COUNT(*) AS games,
              SUM(g.result = 'win') AS wins,
              SUM(g.result = 'loss') AS losses,
              SUM(g.result = 'draw') AS draws,
              AVG(CASE WHEN g.analysis_status = 'analyzed'
                       THEN (CASE WHEN g.user_color = 'white' THEN g.accuracy_white ELSE g.accuracy_black END)
                  END) AS avg_accuracy
       FROM games g
       WHERE g.eco_code IS NOT NULL${f.cond}
       GROUP BY g.eco_code, g.user_color
       HAVING COUNT(*) >= ?
       ORDER BY games DESC`
    )
    .all(...f.params, minGames) as {
    eco: string
    name: string
    color: 'white' | 'black'
    games: number
    wins: number
    losses: number
    draws: number
    avg_accuracy: number | null
  }[]
  return rows.map((r) => ({
    eco: r.eco,
    name: r.name,
    color: r.color,
    games: r.games,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    avgAccuracy: r.avg_accuracy
  }))
}

export function accuracyOverTime(filter?: StatsFilter): AccuracyPoint[] {
  const f = filterSql(filter)
  const rows = getDb()
    .prepare(
      `SELECT g.end_time,
              CASE WHEN g.user_color = 'white' THEN g.accuracy_white ELSE g.accuracy_black END AS accuracy,
              g.time_class
       FROM games g
       WHERE g.analysis_status = 'analyzed'${f.cond}
       ORDER BY g.end_time ASC`
    )
    .all(...f.params) as { end_time: number; accuracy: number | null; time_class: string | null }[]
  return rows
    .filter((r) => r.accuracy !== null)
    .map((r) => ({
      endTime: r.end_time,
      accuracy: r.accuracy!,
      timeClass: r.time_class ?? 'other'
    }))
}

export interface AggregateStats {
  totalGames: number
  analyzedGames: number
  accuracyByTimeClass: { timeClass: string; games: number; avgAccuracy: number }[]
  blunderRateByOpening: { eco: string; name: string; games: number; blundersPerGame: number }[]
  clockPressureBlunders: { lowClockBlunders: number; totalBlunders: number }
  resultCounts: { wins: number; losses: number; draws: number }
}

/** SQL-derived aggregates used as style-report input (no LLM needed). */
export function aggregateStats(): AggregateStats {
  const db = getDb()
  const totalGames = (db.prepare('SELECT COUNT(*) n FROM games').get() as { n: number }).n
  const analyzedGames = (
    db.prepare("SELECT COUNT(*) n FROM games WHERE analysis_status = 'analyzed'").get() as {
      n: number
    }
  ).n

  const accuracyByTimeClass = (
    db
      .prepare(
        `SELECT time_class AS timeClass, COUNT(*) AS games,
                AVG(CASE WHEN user_color = 'white' THEN accuracy_white ELSE accuracy_black END) AS avgAccuracy
         FROM games WHERE analysis_status = 'analyzed' AND time_class IS NOT NULL
         GROUP BY time_class`
      )
      .all() as { timeClass: string; games: number; avgAccuracy: number | null }[]
  ).map((r) => ({ ...r, avgAccuracy: r.avgAccuracy ?? 0 }))

  const blunderRateByOpening = db
    .prepare(
      `SELECT g.eco_code AS eco, COALESCE(g.opening_name, g.eco_code) AS name,
              COUNT(DISTINCT g.id) AS games,
              CAST(COUNT(m.id) AS REAL) / COUNT(DISTINCT g.id) AS blundersPerGame
       FROM games g
       LEFT JOIN moves m ON m.game_id = g.id AND m.is_user_move = 1 AND m.classification = 'blunder'
       WHERE g.analysis_status = 'analyzed' AND g.eco_code IS NOT NULL
       GROUP BY g.eco_code
       HAVING COUNT(DISTINCT g.id) >= 3
       ORDER BY blundersPerGame DESC
       LIMIT 15`
    )
    .all() as { eco: string; name: string; games: number; blundersPerGame: number }[]

  const clock = db
    .prepare(
      `SELECT SUM(CASE WHEN clock_seconds IS NOT NULL AND clock_seconds < 30 THEN 1 ELSE 0 END) AS low,
              COUNT(*) AS total
       FROM moves WHERE is_user_move = 1 AND classification = 'blunder'`
    )
    .get() as { low: number | null; total: number }

  const results = db
    .prepare(
      `SELECT SUM(result = 'win') wins, SUM(result = 'loss') losses, SUM(result = 'draw') draws FROM games`
    )
    .get() as { wins: number | null; losses: number | null; draws: number | null }

  return {
    totalGames,
    analyzedGames,
    accuracyByTimeClass,
    blunderRateByOpening,
    clockPressureBlunders: { lowClockBlunders: clock.low ?? 0, totalBlunders: clock.total },
    resultCounts: {
      wins: results.wins ?? 0,
      losses: results.losses ?? 0,
      draws: results.draws ?? 0
    }
  }
}
