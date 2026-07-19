import { Chess } from 'chess.js'
import type { MoveEval } from '../../shared/types'
import { getGamePgn, getGameSummary, setAnalysisResult, setAnalysisStatus } from '../db/repos/gamesRepo'
import { bulkInsertMoves } from '../db/repos/movesRepo'
import {
  classify,
  gameAccuracy,
  MATE_CP,
  moveAccuracy,
  scoreToCp,
  winProb,
  type Score
} from './classify'
import type { EnginePool } from './enginePool'
import { bookPlyCount } from './openingBook'

interface ReplayedMove {
  ply: number
  san: string
  uci: string
  fenBefore: string
  fenAfter: string
  color: 'w' | 'b'
  clockSeconds: number | null
}

interface PositionEval {
  score: Score // side-to-move POV at this position
  bestMoveUci: string | null
  pv: string[]
}

function parseClk(comment: string | undefined): number | null {
  const m = comment?.match(/%clk (\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!m) return null
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3])
}

export function replayPgn(pgn: string): ReplayedMove[] {
  const chess = new Chess()
  chess.loadPgn(pgn)
  const verbose = chess.history({ verbose: true })
  // chess.js comments are keyed by the FEN *after* the move they annotate.
  const comments = new Map(chess.getComments().map((c) => [c.fen, c.comment]))
  return verbose.map((m, i) => ({
    ply: i + 1,
    san: m.san,
    uci: m.from + m.to + (m.promotion ?? ''),
    fenBefore: m.before,
    fenAfter: m.after,
    color: m.color,
    clockSeconds: parseClk(comments.get(m.after))
  }))
}

/** Terminal-position eval without asking the engine (mate/stalemate). */
function terminalScore(fen: string): Score | null {
  const chess = new Chess(fen)
  if (chess.isCheckmate()) return { cp: null, mate: 0 } // side to move is mated
  if (chess.isStalemate() || chess.isDraw()) return { cp: 0, mate: null }
  return null
}

/** Convert a side-to-move POV score at `fen` to white-POV {cp, mate}. */
function toWhitePov(fen: string, score: Score): { cp: number | null; mate: number | null } {
  const whiteToMove = fen.split(' ')[1] === 'w'
  if (score.mate !== null) {
    // mate 0 = side to move is checkmated
    const mate = score.mate === 0 ? (whiteToMove ? -0.5 : 0.5) : score.mate
    const whiteMate = whiteToMove ? mate : -mate
    return { cp: null, mate: Math.round(whiteMate) === 0 ? (whiteMate > 0 ? 1 : -1) : Math.round(whiteMate) }
  }
  return { cp: whiteToMove ? score.cp : -(score.cp ?? 0), mate: null }
}

/** cp value of a score from WHITE's POV. */
function cpWhite(fen: string, score: Score): number {
  const stm = scoreToCp(score)
  return fen.split(' ')[1] === 'w' ? stm : -stm
}

function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null
  try {
    const chess = new Chess(fen)
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4) : undefined
    })
    return move.san
  } catch {
    return null
  }
}

export interface AnalyzeResult {
  accuracyWhite: number
  accuracyBlack: number
}

export async function analyzeGame(
  gameId: number,
  pool: EnginePool,
  depth: number,
  onProgress?: (pct: number) => void
): Promise<AnalyzeResult> {
  const pgn = getGamePgn(gameId)
  const summary = getGameSummary(gameId)
  if (!pgn || !summary) throw new Error(`game ${gameId} not found`)
  setAnalysisStatus(gameId, 'analyzing')

  const moves = replayPgn(pgn)
  if (moves.length === 0) {
    setAnalysisResult(gameId, depth, 100, 100)
    return { accuracyWhite: 100, accuracyBlack: 100 }
  }

  // Positions: fenBefore of move 1 ... fenAfter of last move → N+1 positions.
  const fens = [moves[0].fenBefore, ...moves.map((m) => m.fenAfter)]
  const evals: PositionEval[] = new Array(fens.length)
  let done = 0
  await Promise.all(
    fens.map(async (fen, i) => {
      const terminal = terminalScore(fen)
      if (terminal) {
        evals[i] = { score: terminal, bestMoveUci: null, pv: [] }
      } else {
        const r = await pool.withEngine((e) => e.evaluate(fen, depth))
        evals[i] = { score: r.score, bestMoveUci: r.bestMoveUci, pv: r.pv }
      }
      done++
      onProgress?.(Math.round((done / fens.length) * 100))
    })
  )

  const bookPlies = bookPlyCount(moves.map((m) => m.san))
  const windowWinProbsWhite = fens.map((fen, i) => winProb(cpWhite(fen, evals[i].score)))

  const rows: MoveEval[] = []
  const accByColor: Record<'w' | 'b', { acc: number[]; idx: number[] }> = {
    w: { acc: [], idx: [] },
    b: { acc: [], idx: [] }
  }

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i]
    const before = evals[i] // position before this move (mover to move)
    const after = evals[i + 1] // position after (opponent to move)

    // Mover POV: best-case eval before the move, actual eval after.
    const bestCpMover = scoreToCp(before.score)
    const actualCpMover = -scoreToCp(after.score)
    const cpLoss = Math.max(0, Math.min(2 * MATE_CP, bestCpMover - actualCpMover))
    const wpBefore = winProb(bestCpMover)
    const wpAfter = winProb(actualCpMover)
    const acc = moveAccuracy(wpBefore, wpAfter)
    const isBestMove = before.bestMoveUci === m.uci

    const cls = classify({
      isBestMove,
      cpLoss,
      winProbBefore: wpBefore,
      winProbAfter: wpAfter,
      isBook: m.ply <= bookPlies
    })

    const whiteAfter = toWhitePov(m.fenAfter, after.score)
    rows.push({
      ply: m.ply,
      san: m.san,
      uci: m.uci,
      fenBefore: m.fenBefore,
      fenAfter: m.fenAfter,
      isUserMove: (summary.userColor === 'white') === (m.color === 'w'),
      evalCp: whiteAfter.cp,
      evalMate: whiteAfter.mate,
      bestMoveUci: before.bestMoveUci,
      bestMoveSan: uciToSan(m.fenBefore, before.bestMoveUci),
      cpLoss: Math.round(cpLoss),
      winProbBefore: wpBefore,
      winProbAfter: wpAfter,
      moveAccuracy: acc,
      classification: cls,
      clockSeconds: m.clockSeconds
    })

    if (m.ply > bookPlies) {
      accByColor[m.color].acc.push(acc)
      accByColor[m.color].idx.push(i)
    }
  }

  const accuracyWhite = gameAccuracy(accByColor.w.acc, windowWinProbsWhite, accByColor.w.idx)
  const accuracyBlack = gameAccuracy(accByColor.b.acc, windowWinProbsWhite, accByColor.b.idx)

  bulkInsertMoves(gameId, rows)
  setAnalysisResult(gameId, depth, accuracyWhite, accuracyBlack)
  return { accuracyWhite, accuracyBlack }
}
