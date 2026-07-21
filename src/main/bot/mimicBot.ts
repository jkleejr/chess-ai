// The mirror-match bot: plays like the user, built from their analyzed games.
//
// Openings: samples moves the user actually played in each position, weighted
// by frequency — the bot plays the user's real repertoire.
// Middle/endgame: Stockfish MultiPV candidates, then picks the move whose
// eval loss matches a random draw from the user's own per-phase mistake
// distribution (so it is strong where they are strong, error-prone where and
// as often as they are). Among near-equal options it prefers forcing moves
// (captures/checks), matching the user's attacking profile. Errors are capped
// so the bot is never MORE careless than the data says the user is.
import { Chess } from 'chess.js'
import type { BotEval, BotMove, BotStartResult, Phase } from '../../shared/types'
import { getDb } from '../db/database'
import { phaseOf } from '../db/repos/extendedStatsRepo'
import { UciEngine } from '../engine/uciEngine'
import { locateStockfish } from '../engine/stockfishProvision'
import type { Score } from '../engine/classify'

const ENGINE_DEPTH = 12
const MULTIPV = 8
const BOOK_MAX_PLY = 24
const BOOK_MIN_SAMPLES = 2
const NORMAL_LOSS_CAP = 160 // outside a sampled mistake event, never lose more than this
const BLUNDER_LOSS_CAP = 420 // mistakes happen at the user's real rate, but capped (~a piece)

interface ErrorModel {
  normal: number[] // cp losses of non-blunder moves
  blunder: number[] // cp losses of blunder moves
  blunderRate: number // fraction of moves that are blunders
}

let engine: UciEngine | null = null
let model: Record<Phase, ErrorModel> | null = null

function cpOf(score: Score): number {
  if (score.mate !== null) return score.mate > 0 ? 10000 - score.mate : -10000 - score.mate
  return score.cp ?? 0
}

function sample(xs: number[], fallback: number): number {
  if (xs.length === 0) return fallback
  return xs[Math.floor(Math.random() * xs.length)]
}

/** Per-phase error distributions from the user's analyzed moves. */
function buildModel(): Record<Phase, ErrorModel> {
  const rows = getDb()
    .prepare(
      `SELECT ply, fen_before, cp_loss, classification FROM moves
       WHERE is_user_move = 1 AND cp_loss IS NOT NULL AND classification != 'book'`
    )
    .all() as { ply: number; fen_before: string; cp_loss: number; classification: string }[]
  const m: Record<Phase, ErrorModel> = {
    opening: { normal: [], blunder: [], blunderRate: 0 },
    middlegame: { normal: [], blunder: [], blunderRate: 0 },
    endgame: { normal: [], blunder: [], blunderRate: 0 }
  }
  for (const r of rows) {
    const p = phaseOf(r.ply, r.fen_before)
    if (r.classification === 'blunder') {
      m[p].blunder.push(Math.min(r.cp_loss, BLUNDER_LOSS_CAP))
    } else {
      m[p].normal.push(Math.min(r.cp_loss, NORMAL_LOSS_CAP))
    }
  }
  for (const p of Object.keys(m) as Phase[]) {
    const total = m[p].normal.length + m[p].blunder.length
    m[p].blunderRate = total ? m[p].blunder.length / total : 0
  }
  return m
}

/** The user's own moves from this exact position, weighted by frequency. */
function bookMove(fen: string): { uci: string; samples: number } | null {
  const epd = fen.split(' ').slice(0, 4).join(' ')
  const rows = getDb()
    .prepare(
      `SELECT uci, COUNT(*) AS n FROM moves
       WHERE is_user_move = 1 AND fen_before LIKE ? || ' %'
       GROUP BY uci ORDER BY n DESC`
    )
    .all(epd) as { uci: string; n: number }[]
  const total = rows.reduce((s, r) => s + r.n, 0)
  if (total < BOOK_MIN_SAMPLES) return null
  let r = Math.random() * total
  for (const row of rows) {
    r -= row.n
    if (r <= 0) return { uci: row.uci, samples: row.n }
  }
  return { uci: rows[0].uci, samples: rows[0].n }
}

function isLegalUci(chess: Chess, uci: string): boolean {
  return chess
    .moves({ verbose: true })
    .some((mv) => mv.from + mv.to + (mv.promotion ?? '') === uci || mv.from + mv.to === uci)
}

function isForcing(chess: Chess, uci: string): boolean {
  const mv = chess
    .moves({ verbose: true })
    .find((x) => x.from + x.to + (x.promotion ?? '') === uci || x.from + x.to === uci)
  if (!mv) return false
  return mv.san.includes('x') || mv.san.includes('+') || mv.san.includes('#')
}

export async function botStart(): Promise<BotStartResult> {
  model = buildModel()
  await ensureEngine()
  const bookFens = getDb()
    .prepare(`SELECT DISTINCT fen_before AS f FROM moves WHERE is_user_move = 1 AND ply <= ?`)
    .all(BOOK_MAX_PLY) as { f: string }[]
  const bookPositions = new Set(bookFens.map((r) => r.f.split(' ').slice(0, 4).join(' '))).size
  const analyzedMoves = Object.values(model).reduce(
    (s, p) => s + p.normal.length + p.blunder.length,
    0
  )
  return {
    analyzedMoves,
    bookPositions,
    phases: (Object.keys(model) as Phase[]).map((phase) => ({
      phase,
      blunderPct: model![phase].blunderRate * 100
    }))
  }
}

async function ensureEngine(): Promise<UciEngine> {
  if (!engine || engine.dead) {
    const status = await locateStockfish()
    if (status.state !== 'ready' || !status.path) throw new Error('Engine not available')
    engine = new UciEngine(status.path)
    await engine.init(1, 64)
  }
  return engine
}

/** Quick single-PV eval for the live-analysis panel. White-POV score. */
export async function botEval(fen: string): Promise<BotEval> {
  const e = await ensureEngine()
  const res = await e.evaluate(fen, ENGINE_DEPTH)
  const whiteToMove = fen.split(' ')[1] === 'w'
  const cpWhite = res.score.cp === null ? null : whiteToMove ? res.score.cp : -res.score.cp
  const mateWhite = res.score.mate === null ? null : whiteToMove ? res.score.mate : -res.score.mate
  // Convert the engine PV (UCI) to SAN for display
  const chess = new Chess(fen)
  const pvSans: string[] = []
  for (const uci of res.pv.slice(0, 4)) {
    try {
      const mv = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci.slice(4) : undefined
      })
      if (!mv) break
      pvSans.push(mv.san)
    } catch {
      break
    }
  }
  return { cpWhite, mateWhite, bestSan: pvSans[0] ?? null, pvSans }
}

export function botStop(): void {
  engine?.quit()
  engine = null
  model = null
}

export async function botMove(fen: string, ply: number): Promise<BotMove | null> {
  if (!model) model = buildModel()
  const chess = new Chess(fen)
  const legal = chess.moves({ verbose: true })
  if (legal.length === 0) return null
  if (legal.length === 1) {
    const only = legal[0]
    return { uci: only.from + only.to + (only.promotion ?? ''), source: 'engine', cpLoss: 0 }
  }

  // 1) the user's own repertoire
  if (ply <= BOOK_MAX_PLY) {
    const book = bookMove(fen)
    if (book && isLegalUci(chess, book.uci)) {
      return { uci: book.uci, source: 'book', cpLoss: null }
    }
  }

  // 2) engine candidates, filtered through the user's error distribution
  const eng = await ensureEngine()
  const raw = await eng.evaluateMulti(fen, ENGINE_DEPTH, Math.min(MULTIPV, legal.length))
  if (raw.length === 0) throw new Error('engine returned no candidates')
  const bestCp = cpOf(raw[0].score)
  const candidates = raw.map((c) => ({ uci: c.uci, cpLoss: Math.max(0, bestCp - cpOf(c.score)) }))

  const phase = phaseOf(ply, fen)
  const m = model[phase]
  const isBlunderEvent = Math.random() < m.blunderRate
  const target = isBlunderEvent ? sample(m.blunder, 250) : sample(m.normal, 15)
  const cap = isBlunderEvent ? BLUNDER_LOSS_CAP : NORMAL_LOSS_CAP

  const eligible = candidates.filter((c) => c.cpLoss <= cap)
  const pool = eligible.length > 0 ? eligible : [candidates[0]]
  let chosen = pool.reduce((a, b) =>
    Math.abs(b.cpLoss - target) < Math.abs(a.cpLoss - target) ? b : a
  )
  // style: among near-equal picks, lean into forcing moves (attacking profile)
  const near = pool.filter((c) => Math.abs(c.cpLoss - chosen.cpLoss) <= 30)
  const forcing = near.filter((c) => isForcing(chess, c.uci))
  if (forcing.length > 0 && Math.random() < 0.6) {
    chosen = forcing.reduce((a, b) => (b.cpLoss < a.cpLoss ? b : a))
  }
  return { uci: chosen.uci, source: 'engine', cpLoss: chosen.cpLoss }
}
