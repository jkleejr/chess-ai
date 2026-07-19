import { Chess } from 'chess.js'
import type { GameResult, SyncProgress } from '../../shared/types'
import { insertGame, type NewGame } from '../db/repos/gamesRepo'
import { getArchiveState, saveArchiveState } from '../db/repos/syncRepo'
import { fetchArchiveGames, fetchArchives, type ChesscomGame } from './client'

const WIN_CODES = new Set(['win'])
const DRAW_CODES = new Set([
  'agreed',
  'repetition',
  'stalemate',
  'insufficient',
  '50move',
  'timevsinsufficient'
])

function resultForUser(game: ChesscomGame, userColor: 'white' | 'black'): GameResult {
  const code = userColor === 'white' ? game.white.result : game.black.result
  if (WIN_CODES.has(code)) return 'win'
  if (DRAW_CODES.has(code)) return 'draw'
  return 'loss'
}

function terminationForUser(game: ChesscomGame, userColor: 'white' | 'black'): string {
  const mine = userColor === 'white' ? game.white.result : game.black.result
  const theirs = userColor === 'white' ? game.black.result : game.white.result
  return mine === 'win' ? theirs : mine
}

interface PgnMeta {
  ecoCode: string | null
  openingName: string | null
}

function parsePgnMeta(pgn: string): PgnMeta {
  try {
    const chess = new Chess()
    chess.loadPgn(pgn)
    const headers = chess.getHeaders()
    const ecoUrl = headers['ECOUrl'] ?? null
    // ECOUrl looks like https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation
    const openingName = ecoUrl
      ? decodeURIComponent(ecoUrl.split('/').pop() ?? '').replace(/-/g, ' ') || null
      : null
    return { ecoCode: headers['ECO'] ?? null, openingName }
  } catch {
    return { ecoCode: null, openingName: null }
  }
}

function toNewGame(game: ChesscomGame, username: string): NewGame | null {
  if (!game.pgn || !game.uuid) return null // e.g. variants without PGN
  const lower = username.toLowerCase()
  let userColor: 'white' | 'black'
  if (game.white.username.toLowerCase() === lower) userColor = 'white'
  else if (game.black.username.toLowerCase() === lower) userColor = 'black'
  else return null
  const meta = parsePgnMeta(game.pgn)
  return {
    chesscomUuid: game.uuid,
    url: game.url ?? null,
    pgn: game.pgn,
    timeClass: game.time_class ?? null,
    timeControl: game.time_control ?? null,
    rated: !!game.rated,
    endTime: game.end_time,
    whiteUsername: game.white.username,
    blackUsername: game.black.username,
    whiteRating: game.white.rating ?? null,
    blackRating: game.black.rating ?? null,
    userColor,
    result: resultForUser(game, userColor),
    termination: terminationForUser(game, userColor),
    ecoCode: meta.ecoCode,
    openingName: meta.openingName
  }
}

/**
 * Incremental sync: past-month archives are fetched once and marked complete;
 * the current month is re-fetched with an ETag. Games dedupe on chesscom_uuid.
 * Returns ids of newly inserted games.
 */
export async function syncGames(
  username: string,
  onProgress: (p: SyncProgress) => void
): Promise<number[]> {
  const archives = await fetchArchives(username)
  const newIds: number[] = []
  let gamesInserted = 0

  for (let i = 0; i < archives.length; i++) {
    const url = archives[i]
    const isCurrentMonth = i === archives.length - 1
    const state = getArchiveState(url)
    onProgress({
      phase: 'archives',
      archiveIndex: i + 1,
      archiveTotal: archives.length,
      gamesInserted
    })

    if (state?.isComplete && !isCurrentMonth) continue

    const result = await fetchArchiveGames(url, state?.etag)
    if (result.notModified) {
      if (!isCurrentMonth) saveArchiveState(url, state?.etag ?? null, true)
      continue
    }

    for (const g of result.games) {
      const ng = toNewGame(g, username)
      if (!ng) continue
      const id = insertGame(ng)
      if (id !== null) {
        newIds.push(id)
        gamesInserted++
      }
    }
    saveArchiveState(url, result.etag, !isCurrentMonth)
    onProgress({
      phase: 'games',
      archiveIndex: i + 1,
      archiveTotal: archives.length,
      gamesInserted
    })
  }

  onProgress({
    phase: 'done',
    archiveIndex: archives.length,
    archiveTotal: archives.length,
    gamesInserted
  })
  return newIds
}
