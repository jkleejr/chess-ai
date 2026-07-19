import type { AccuracyPoint, OpeningStat } from '../../../shared/types'
import { getDb } from '../database'

export function openingStats(minGames = 1): OpeningStat[] {
  const rows = getDb()
    .prepare(
      `SELECT eco_code AS eco,
              COALESCE(opening_name, eco_code) AS name,
              user_color AS color,
              COUNT(*) AS games,
              SUM(result = 'win') AS wins,
              SUM(result = 'loss') AS losses,
              SUM(result = 'draw') AS draws,
              AVG(CASE WHEN analysis_status = 'analyzed'
                       THEN (CASE WHEN user_color = 'white' THEN accuracy_white ELSE accuracy_black END)
                  END) AS avg_accuracy
       FROM games
       WHERE eco_code IS NOT NULL
       GROUP BY eco_code, user_color
       HAVING COUNT(*) >= ?
       ORDER BY games DESC`
    )
    .all(minGames) as {
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

export function accuracyOverTime(): AccuracyPoint[] {
  const rows = getDb()
    .prepare(
      `SELECT end_time,
              CASE WHEN user_color = 'white' THEN accuracy_white ELSE accuracy_black END AS accuracy,
              time_class
       FROM games
       WHERE analysis_status = 'analyzed'
       ORDER BY end_time ASC`
    )
    .all() as { end_time: number; accuracy: number | null; time_class: string | null }[]
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
