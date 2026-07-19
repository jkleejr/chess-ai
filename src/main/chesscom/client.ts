// chess.com public API client. No auth required; identify ourselves per their guidelines.

const USER_AGENT = 'chess-ai-coach/0.1 (personal desktop analysis app)'

export interface ChesscomPlayer {
  username: string
  rating: number
  result: string
}

export interface ChesscomGame {
  uuid: string
  url: string
  pgn?: string
  time_class: string
  time_control: string
  rated: boolean
  end_time: number
  white: ChesscomPlayer
  black: ChesscomPlayer
}

export class ChesscomError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message)
  }
}

async function get(url: string, etag?: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT }
  if (etag) headers['If-None-Match'] = etag
  let res: Response
  try {
    res = await fetch(url, { headers })
  } catch (e) {
    throw new ChesscomError(`Network error reaching chess.com: ${(e as Error).message}`)
  }
  if (res.status === 404) throw new ChesscomError('not found', 404)
  if (res.status === 429)
    throw new ChesscomError('chess.com rate limit — try again in a minute', 429)
  if (!res.ok && res.status !== 304) {
    throw new ChesscomError(`chess.com returned HTTP ${res.status}`, res.status)
  }
  return res
}

export async function fetchArchives(username: string): Promise<string[]> {
  const url = `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`
  try {
    const res = await get(url)
    const body = (await res.json()) as { archives: string[] }
    return body.archives ?? []
  } catch (e) {
    if (e instanceof ChesscomError && e.status === 404) {
      throw new ChesscomError(`chess.com user "${username}" not found`, 404)
    }
    throw e
  }
}

export type ArchiveResult =
  { notModified: true } | { notModified: false; games: ChesscomGame[]; etag: string | null }

export async function fetchArchiveGames(
  archiveUrl: string,
  etag?: string | null
): Promise<ArchiveResult> {
  const res = await get(archiveUrl, etag)
  if (res.status === 304) return { notModified: true }
  const body = (await res.json()) as { games: ChesscomGame[] }
  return { notModified: false, games: body.games ?? [], etag: res.headers.get('etag') }
}
