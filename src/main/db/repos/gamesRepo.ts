import type { AnalysisStatus, GameListFilter, GameResult, GameSummary } from '../../../shared/types'
import { getDb } from '../database'

export interface NewGame {
  chesscomUuid: string
  url: string | null
  pgn: string
  timeClass: string | null
  timeControl: string | null
  rated: boolean
  endTime: number
  whiteUsername: string
  blackUsername: string
  whiteRating: number | null
  blackRating: number | null
  userColor: 'white' | 'black'
  result: GameResult
  termination: string | null
  ecoCode: string | null
  openingName: string | null
}

interface GameRow {
  id: number
  chesscom_uuid: string
  url: string | null
  time_class: string | null
  time_control: string | null
  rated: number
  end_time: number
  white_username: string
  black_username: string
  white_rating: number | null
  black_rating: number | null
  user_color: 'white' | 'black'
  result: GameResult
  termination: string | null
  eco_code: string | null
  opening_name: string | null
  analysis_status: AnalysisStatus
  accuracy_white: number | null
  accuracy_black: number | null
  has_review: number
}

const SUMMARY_SELECT = `
  SELECT g.id, g.chesscom_uuid, g.url, g.time_class, g.time_control, g.rated, g.end_time,
         g.white_username, g.black_username, g.white_rating, g.black_rating,
         g.user_color, g.result, g.termination, g.eco_code, g.opening_name,
         g.analysis_status, g.accuracy_white, g.accuracy_black,
         EXISTS(SELECT 1 FROM insights i WHERE i.game_id = g.id AND i.type = 'game_review') AS has_review
  FROM games g
`

function toSummary(r: GameRow): GameSummary {
  return {
    id: r.id,
    chesscomUuid: r.chesscom_uuid,
    url: r.url,
    timeClass: r.time_class,
    timeControl: r.time_control,
    rated: !!r.rated,
    endTime: r.end_time,
    whiteUsername: r.white_username,
    blackUsername: r.black_username,
    whiteRating: r.white_rating,
    blackRating: r.black_rating,
    userColor: r.user_color,
    result: r.result,
    termination: r.termination,
    ecoCode: r.eco_code,
    openingName: r.opening_name,
    analysisStatus: r.analysis_status,
    accuracyWhite: r.accuracy_white,
    accuracyBlack: r.accuracy_black,
    hasCoachReview: !!r.has_review
  }
}

export function insertGame(g: NewGame): number | null {
  const res = getDb()
    .prepare(
      `INSERT OR IGNORE INTO games
       (chesscom_uuid, url, pgn, time_class, time_control, rated, end_time,
        white_username, black_username, white_rating, black_rating,
        user_color, result, termination, eco_code, opening_name)
       VALUES (@chesscomUuid, @url, @pgn, @timeClass, @timeControl, @rated, @endTime,
        @whiteUsername, @blackUsername, @whiteRating, @blackRating,
        @userColor, @result, @termination, @ecoCode, @openingName)`
    )
    .run({ ...g, rated: g.rated ? 1 : 0 })
  return res.changes > 0 ? Number(res.lastInsertRowid) : null
}

export function listGames(offset: number, limit: number, filter?: GameListFilter): GameSummary[] {
  const where: string[] = []
  const params: Record<string, unknown> = { offset, limit }
  if (filter?.result) {
    where.push('g.result = @result')
    params.result = filter.result
  }
  if (filter?.timeClass) {
    where.push('g.time_class = @timeClass')
    params.timeClass = filter.timeClass
  }
  if (filter?.timeControl) {
    where.push('g.time_control = @timeControl')
    params.timeControl = filter.timeControl
  }
  if (filter?.eco) {
    where.push('g.eco_code = @eco')
    params.eco = filter.eco
  }
  const sql = `${SUMMARY_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY g.end_time DESC LIMIT @limit OFFSET @offset`
  return (getDb().prepare(sql).all(params) as GameRow[]).map(toSummary)
}

export function countGames(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM games').get() as { n: number }).n
}

export function getGameSummary(id: number): GameSummary | null {
  const row = getDb().prepare(`${SUMMARY_SELECT} WHERE g.id = ?`).get(id) as GameRow | undefined
  return row ? toSummary(row) : null
}

export function getGamePgn(id: number): string | null {
  const row = getDb().prepare('SELECT pgn FROM games WHERE id = ?').get(id) as
    { pgn: string } | undefined
  return row?.pgn ?? null
}

export function listPendingGameIds(): number[] {
  return (
    (
      getDb()
        // 'analyzing' = interrupted mid-run last session; 'error' games get a
        // fresh chance each session (transient engine crashes).
        .prepare(
          "SELECT id FROM games WHERE analysis_status IN ('pending','analyzing','error') ORDER BY end_time DESC"
        )
        .all() as { id: number }[]
    ).map((r) => r.id)
  )
}

/** Games interrupted mid-analysis by an app quit go back to pending (not enqueued). */
export function resetStuckAnalyzing(): void {
  getDb()
    .prepare("UPDATE games SET analysis_status = 'pending' WHERE analysis_status = 'analyzing'")
    .run()
}

export function setAnalysisStatus(id: number, status: AnalysisStatus): void {
  getDb().prepare('UPDATE games SET analysis_status = ? WHERE id = ?').run(status, id)
}

export function setAnalysisResult(
  id: number,
  depth: number,
  accuracyWhite: number,
  accuracyBlack: number
): void {
  getDb()
    .prepare(
      `UPDATE games SET analysis_status = 'analyzed', analysis_depth = ?,
       accuracy_white = ?, accuracy_black = ?, analyzed_at = unixepoch() WHERE id = ?`
    )
    .run(depth, accuracyWhite, accuracyBlack, id)
}

export function countAnalyzed(): number {
  return (
    getDb().prepare("SELECT COUNT(*) AS n FROM games WHERE analysis_status = 'analyzed'").get() as {
      n: number
    }
  ).n
}
