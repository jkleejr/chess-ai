import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => mkdtempSync(join(tmpdir(), 'chess-ai-test-')) },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString()
  }
}))

import { syncGames } from '../src/main/chesscom/sync'
import { closeDb, openDb } from '../src/main/db/database'
import { countGames } from '../src/main/db/repos/gamesRepo'

const PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[White "testuser"]
[Black "opponent"]
[Result "1-0"]
[ECO "C50"]
[ECOUrl "https://www.chess.com/openings/Italian-Game"]

1. e4 {[%clk 0:09:58.5]} e5 {[%clk 0:09:57]} 2. Nf3 {[%clk 0:09:55]} Nc6 {[%clk 0:09:50]} 3. Bc4 {[%clk 0:09:52]} Bc5 {[%clk 0:09:45]} 1-0`

function fixtureGame(uuid: string): unknown {
  return {
    uuid,
    url: `https://chess.com/game/${uuid}`,
    pgn: PGN,
    time_class: 'rapid',
    time_control: '600',
    rated: true,
    end_time: 1700000000,
    white: { username: 'TestUser', rating: 1200, result: 'win' },
    black: { username: 'opponent', rating: 1180, result: 'resigned' }
  }
}

const ARCHIVE_PAST = 'https://api.chess.com/pub/player/testuser/games/2023/01'
const ARCHIVE_CURR = 'https://api.chess.com/pub/player/testuser/games/2023/02'
const calls: { url: string; etagSent: string | null }[] = []

function mockFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      calls.push({ url, etagSent: init?.headers?.['If-None-Match'] ?? null })
      const headers = new Headers()
      if (url.endsWith('/archives')) {
        if (url.includes('nosuchuser')) return new Response('not found', { status: 404 })
        return new Response(JSON.stringify({ archives: [ARCHIVE_PAST, ARCHIVE_CURR] }), {
          status: 200
        })
      }
      if (url === ARCHIVE_PAST) {
        headers.set('etag', 'W/"past"')
        return new Response(JSON.stringify({ games: [fixtureGame('g1'), fixtureGame('g2')] }), {
          status: 200,
          headers
        })
      }
      if (url === ARCHIVE_CURR) {
        if (init?.headers?.['If-None-Match'] === 'W/"curr"') {
          return new Response(null, { status: 304 })
        }
        headers.set('etag', 'W/"curr"')
        return new Response(JSON.stringify({ games: [fixtureGame('g3')] }), {
          status: 200,
          headers
        })
      }
      return new Response('not found', { status: 404 })
    })
  )
}

describe('syncGames (fixtures, mocked fetch)', () => {
  beforeAll(() => {
    process.env.CHESS_AI_DB_PATH = join(mkdtempSync(join(tmpdir(), 'chess-ai-db-')), 'test.db')
    openDb()
    mockFetch()
  })
  afterAll(() => {
    closeDb()
    vi.unstubAllGlobals()
  })

  it('first sync inserts all games with parsed metadata', async () => {
    const newIds = await syncGames('TestUser', () => {})
    expect(newIds).toHaveLength(3)
    expect(countGames()).toBe(3)
  })

  it('re-sync is idempotent: 0 inserts, past archive skipped, ETag 304 honored', async () => {
    calls.length = 0
    const newIds = await syncGames('TestUser', () => {})
    expect(newIds).toHaveLength(0)
    expect(countGames()).toBe(3)
    // Past (complete) archive must not be re-fetched at all.
    expect(calls.some((c) => c.url === ARCHIVE_PAST)).toBe(false)
    // Current month re-fetched with stored ETag → 304.
    const curr = calls.find((c) => c.url === ARCHIVE_CURR)
    expect(curr?.etagSent).toBe('W/"curr"')
  })

  it('unknown user surfaces a clear error', async () => {
    await expect(syncGames('nosuchuser', () => {})).rejects.toThrow(/not found/)
  })
})
