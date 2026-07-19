import type { ExtendedStats, Phase } from '../../../shared/types'
import { getDb } from '../database'

// --- game phases -----------------------------------------------------------

/** Non-king, non-pawn pieces on the board, from the FEN board field. */
function pieceCount(fen: string): number {
  const board = fen.split(' ')[0]
  let n = 0
  for (const ch of board) {
    if ('QRBNqrbn'.includes(ch)) n++
  }
  return n
}

export function phaseOf(ply: number, fenBefore: string): Phase {
  if (pieceCount(fenBefore) <= 6) return 'endgame'
  if (ply <= 20) return 'opening'
  return 'middlegame'
}

export interface PhaseStat {
  phase: Phase
  moves: number
  avgAccuracy: number
  blunderPct: number // blunders per 100 moves
}

export function phaseStats(): PhaseStat[] {
  const rows = getDb()
    .prepare(
      `SELECT m.ply, m.fen_before, m.move_accuracy, m.classification
       FROM moves m WHERE m.is_user_move = 1 AND m.move_accuracy IS NOT NULL
         AND m.classification != 'book'`
    )
    .all() as { ply: number; fen_before: string; move_accuracy: number; classification: string }[]

  const acc: Record<Phase, { n: number; accSum: number; blunders: number }> = {
    opening: { n: 0, accSum: 0, blunders: 0 },
    middlegame: { n: 0, accSum: 0, blunders: 0 },
    endgame: { n: 0, accSum: 0, blunders: 0 }
  }
  for (const r of rows) {
    const p = phaseOf(r.ply, r.fen_before)
    acc[p].n++
    acc[p].accSum += r.move_accuracy
    if (r.classification === 'blunder') acc[p].blunders++
  }
  return (['opening', 'middlegame', 'endgame'] as Phase[]).map((phase) => ({
    phase,
    moves: acc[phase].n,
    avgAccuracy: acc[phase].n ? acc[phase].accSum / acc[phase].n : 0,
    blunderPct: acc[phase].n ? (acc[phase].blunders / acc[phase].n) * 100 : 0
  }))
}

// --- clock pressure --------------------------------------------------------

export interface ClockBucket {
  label: string
  moves: number
  blunderPct: number
}

const CLOCK_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '> 2 min', min: 120, max: Infinity },
  { label: '1–2 min', min: 60, max: 120 },
  { label: '30–60 s', min: 30, max: 60 },
  { label: '10–30 s', min: 10, max: 30 },
  { label: '< 10 s', min: 0, max: 10 }
]

export function clockBuckets(): ClockBucket[] {
  const rows = getDb()
    .prepare(
      `SELECT clock_seconds AS clk, classification = 'blunder' AS isBlunder
       FROM moves WHERE is_user_move = 1 AND clock_seconds IS NOT NULL
         AND classification IS NOT NULL AND classification != 'book'`
    )
    .all() as { clk: number; isBlunder: number }[]
  return CLOCK_BUCKETS.map((b) => {
    const inBucket = rows.filter((r) => r.clk >= b.min && r.clk < b.max)
    const blunders = inBucket.filter((r) => r.isBlunder).length
    return {
      label: b.label,
      moves: inBucket.length,
      blunderPct: inBucket.length ? (blunders / inBucket.length) * 100 : 0
    }
  })
}

// --- conversions: thrown wins & comebacks ---------------------------------

export interface Conversions {
  thrownWins: number // was >=80% winning, didn't win
  wonWhenWinning: number // was >=80% winning and won
  comebacks: number // was <=20% and won
  lostWhenLosing: number
}

export function conversions(): Conversions {
  const row = getDb()
    .prepare(
      `WITH per_game AS (
         SELECT g.id, g.result,
                MAX(m.win_prob_after) AS best,
                MIN(m.win_prob_after) AS worst
         FROM games g JOIN moves m ON m.game_id = g.id AND m.is_user_move = 1
         WHERE g.analysis_status = 'analyzed' AND m.win_prob_after IS NOT NULL
         GROUP BY g.id
       )
       SELECT
         SUM(best >= 80 AND result != 'win') AS thrown,
         SUM(best >= 80 AND result = 'win') AS held,
         SUM(worst <= 20 AND result = 'win') AS comebacks,
         SUM(worst <= 20 AND result = 'loss') AS lostLosing
       FROM per_game`
    )
    .get() as {
    thrown: number | null
    held: number | null
    comebacks: number | null
    lostLosing: number | null
  }
  return {
    thrownWins: row.thrown ?? 0,
    wonWhenWinning: row.held ?? 0,
    comebacks: row.comebacks ?? 0,
    lostWhenLosing: row.lostLosing ?? 0
  }
}

// --- terminations ----------------------------------------------------------

export interface TerminationRow {
  result: 'win' | 'loss'
  termination: string
  games: number
}

const TERMINATION_LABELS: Record<string, string> = {
  checkmated: 'checkmate',
  resigned: 'resignation',
  timeout: 'timeout',
  abandoned: 'abandoned'
}

export function terminations(): TerminationRow[] {
  const rows = getDb()
    .prepare(
      `SELECT result, termination, COUNT(*) AS games FROM games
       WHERE result IN ('win','loss') AND termination IS NOT NULL
       GROUP BY result, termination`
    )
    .all() as { result: 'win' | 'loss'; termination: string; games: number }[]
  const merged = new Map<string, TerminationRow>()
  for (const r of rows) {
    const label = TERMINATION_LABELS[r.termination] ?? 'other'
    const key = `${r.result}:${label}`
    const existing = merged.get(key)
    if (existing) existing.games += r.games
    else merged.set(key, { result: r.result, termination: label, games: r.games })
  }
  return [...merged.values()]
}

// --- rating history --------------------------------------------------------

export interface RatingPoint {
  endTime: number
  rating: number
  timeClass: string
}

export function ratingHistory(): RatingPoint[] {
  const rows = getDb()
    .prepare(
      `SELECT end_time,
              CASE WHEN user_color = 'white' THEN white_rating ELSE black_rating END AS rating,
              time_class
       FROM games WHERE time_class IS NOT NULL ORDER BY end_time ASC`
    )
    .all() as { end_time: number; rating: number | null; time_class: string }[]
  return rows
    .filter((r) => r.rating !== null)
    .map((r) => ({ endTime: r.end_time, rating: r.rating!, timeClass: r.time_class }))
}

// --- time of day ------------------------------------------------------------

export interface HourBucket {
  label: string
  games: number
  winPct: number
  avgAccuracy: number | null
}

export function hourOfDay(): HourBucket[] {
  const rows = getDb()
    .prepare(
      `SELECT CAST(strftime('%H', end_time, 'unixepoch', 'localtime') AS INTEGER) AS hour,
              COUNT(*) AS games,
              AVG(result = 'win') * 100 AS winPct,
              AVG(CASE WHEN analysis_status = 'analyzed'
                       THEN (CASE WHEN user_color = 'white' THEN accuracy_white ELSE accuracy_black END)
                  END) AS avgAccuracy
       FROM games GROUP BY hour`
    )
    .all() as { hour: number; games: number; winPct: number; avgAccuracy: number | null }[]
  const buckets = [
    { label: 'Night (0–6)', hours: [0, 1, 2, 3, 4, 5] },
    { label: 'Morning (6–12)', hours: [6, 7, 8, 9, 10, 11] },
    { label: 'Afternoon (12–18)', hours: [12, 13, 14, 15, 16, 17] },
    { label: 'Evening (18–24)', hours: [18, 19, 20, 21, 22, 23] }
  ]
  return buckets.map((b) => {
    const inB = rows.filter((r) => b.hours.includes(r.hour))
    const games = inB.reduce((s, r) => s + r.games, 0)
    const wins = inB.reduce((s, r) => s + (r.winPct / 100) * r.games, 0)
    const accRows = inB.filter((r) => r.avgAccuracy !== null)
    const accGames = accRows.reduce((s, r) => s + r.games, 0)
    const accSum = accRows.reduce((s, r) => s + r.avgAccuracy! * r.games, 0)
    return {
      label: b.label,
      games,
      winPct: games ? (wins / games) * 100 : 0,
      avgAccuracy: accGames ? accSum / accGames : null
    }
  })
}

// --- recent form ------------------------------------------------------------

export interface RecentForm {
  recentAvgAccuracy: number | null
  previousAvgAccuracy: number | null
  recentGames: number
}

export function recentForm(window = 30): RecentForm {
  const rows = getDb()
    .prepare(
      `SELECT CASE WHEN user_color = 'white' THEN accuracy_white ELSE accuracy_black END AS acc
       FROM games WHERE analysis_status = 'analyzed'
       ORDER BY end_time DESC LIMIT ?`
    )
    .all(window * 2) as { acc: number | null }[]
  const accs = rows.map((r) => r.acc).filter((a): a is number => a !== null)
  const recent = accs.slice(0, window)
  const previous = accs.slice(window, window * 2)
  const avg = (xs: number[]): number | null =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  return {
    recentAvgAccuracy: avg(recent),
    previousAvgAccuracy: avg(previous),
    recentGames: recent.length
  }
}

// --- bundle -----------------------------------------------------------------

export function extendedStats(): ExtendedStats {
  return {
    phases: phaseStats(),
    clock: clockBuckets(),
    conversions: conversions(),
    terminations: terminations(),
    ratingHistory: ratingHistory(),
    hourOfDay: hourOfDay(),
    recentForm: recentForm()
  }
}
