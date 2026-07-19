import type { Classification, MoveEval } from '../../../shared/types'
import { getDb } from '../database'

interface MoveRow {
  ply: number
  san: string
  uci: string
  fen_before: string
  fen_after: string
  is_user_move: number
  eval_cp: number | null
  eval_mate: number | null
  best_move_uci: string | null
  best_move_san: string | null
  cp_loss: number | null
  win_prob_before: number | null
  win_prob_after: number | null
  move_accuracy: number | null
  classification: Classification | null
  clock_seconds: number | null
}

export function bulkInsertMoves(gameId: number, moves: MoveEval[]): void {
  const db = getDb()
  const del = db.prepare('DELETE FROM moves WHERE game_id = ?')
  const ins = db.prepare(
    `INSERT INTO moves
     (game_id, ply, san, uci, fen_before, fen_after, is_user_move,
      eval_cp, eval_mate, best_move_uci, best_move_san, cp_loss,
      win_prob_before, win_prob_after, move_accuracy, classification, clock_seconds)
     VALUES (?, @ply, @san, @uci, @fenBefore, @fenAfter, @isUserMove,
      @evalCp, @evalMate, @bestMoveUci, @bestMoveSan, @cpLoss,
      @winProbBefore, @winProbAfter, @moveAccuracy, @classification, @clockSeconds)`
  )
  db.transaction(() => {
    del.run(gameId)
    for (const m of moves) {
      ins.run(gameId, { ...m, isUserMove: m.isUserMove ? 1 : 0 })
    }
  })()
}

export function getMoves(gameId: number): MoveEval[] {
  const rows = getDb()
    .prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY ply ASC')
    .all(gameId) as MoveRow[]
  return rows.map((r) => ({
    ply: r.ply,
    san: r.san,
    uci: r.uci,
    fenBefore: r.fen_before,
    fenAfter: r.fen_after,
    isUserMove: !!r.is_user_move,
    evalCp: r.eval_cp,
    evalMate: r.eval_mate,
    bestMoveUci: r.best_move_uci,
    bestMoveSan: r.best_move_san,
    cpLoss: r.cp_loss,
    winProbBefore: r.win_prob_before,
    winProbAfter: r.win_prob_after,
    moveAccuracy: r.move_accuracy,
    classification: r.classification,
    clockSeconds: r.clock_seconds
  }))
}
