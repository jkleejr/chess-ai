import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MoveEval } from '../src/shared/types'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/chess-ai-test' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString()
  }
}))

import { selectCriticalMoments } from '../src/main/coach/gameCoach'
import { buildGamePrompt, systemBlocks } from '../src/main/coach/prompts'
import { GameInsightSchema } from '../src/main/coach/schemas'
import type { GameSummary, PlayerProfile } from '../src/shared/types'

function mv(ply: number, over: Partial<MoveEval> = {}): MoveEval {
  return {
    ply,
    san: 'e4',
    uci: 'e2e4',
    fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    isUserMove: true,
    evalCp: 0,
    evalMate: null,
    bestMoveUci: 'd2d4',
    bestMoveSan: 'd4',
    cpLoss: 0,
    winProbBefore: 50,
    winProbAfter: 50,
    moveAccuracy: 100,
    classification: 'good',
    clockSeconds: 60,
    ...over
  }
}

describe('selectCriticalMoments', () => {
  it('caps at 6 moments, keeps the worst, in game order', () => {
    const moves: MoveEval[] = []
    for (let i = 1; i <= 10; i++) {
      moves.push(
        mv(i, { classification: 'blunder', cpLoss: i * 100, winProbBefore: 60, winProbAfter: 30 })
      )
    }
    const moments = selectCriticalMoments(moves)
    expect(moments).toHaveLength(6)
    // worst 6 by cpLoss are plies 5..10; and order restored ascending
    expect(moments.map((m) => m.move.ply)).toEqual([5, 6, 7, 8, 9, 10])
  })

  it('ignores opponent moves', () => {
    const moves = [
      mv(1, { isUserMove: false, classification: 'blunder', cpLoss: 500 }),
      mv(2, { classification: 'good' })
    ]
    expect(selectCriticalMoments(moves)).toHaveLength(0)
  })

  it('detects missed wins even when not classified mistake', () => {
    const moves = [
      mv(4, { classification: 'good', cpLoss: 90, winProbBefore: 85, winProbAfter: 48 })
    ]
    const moments = selectCriticalMoments(moves)
    expect(moments).toHaveLength(1)
    expect(moments[0].reason).toBe('missed-win')
  })

  it('clean game yields no moments', () => {
    const moves = [mv(1), mv(2), mv(3)]
    expect(selectCriticalMoments(moves)).toHaveLength(0)
  })
})

describe('prompt assembly', () => {
  const game: GameSummary = {
    id: 1,
    chesscomUuid: 'x',
    url: null,
    timeClass: 'rapid',
    timeControl: '600',
    rated: true,
    endTime: 1700000000,
    whiteUsername: 'me',
    blackUsername: 'them',
    whiteRating: 1200,
    blackRating: 1250,
    userColor: 'white',
    result: 'loss',
    termination: 'resigned',
    ecoCode: 'B01',
    openingName: 'Scandinavian Defense',
    analysisStatus: 'analyzed',
    accuracyWhite: 78.2,
    accuracyBlack: 85.1,
    hasCoachReview: false
  }

  it('cache_control sits on the profile block only (stable prefix first)', () => {
    const blocks = systemBlocks(null)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].cache_control).toBeUndefined()
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('persona block is byte-identical across calls (prefix caching)', () => {
    const p: PlayerProfile = {
      styleSummary: 'aggressive',
      strengths: [],
      weaknesses: [],
      recurringMistakes: [],
      openingRepertoire: { asWhite: [], asBlack: [] },
      openingSuggestions: [],
      timeManagement: '',
      improvementFocus: []
    }
    expect(systemBlocks(p)[0].text).toBe(systemBlocks(null)[0].text)
  })

  it('game prompt includes FEN, engine best and clock for each moment', () => {
    const move = mv(9, {
      classification: 'blunder',
      cpLoss: 400,
      winProbBefore: 55,
      winProbAfter: 20,
      clockSeconds: 23
    })
    const prompt = buildGamePrompt(game, [move], [{ move, reason: 'blunder' }])
    expect(prompt).toContain(move.fenBefore)
    expect(prompt).toContain('best move was: d4')
    expect(prompt).toContain('0:23')
    expect(prompt).toContain('ply 9')
    expect(prompt).toContain('Scandinavian')
  })

  it('clean-game prompt asks for encouragement, not mistakes', () => {
    const prompt = buildGamePrompt(game, [mv(1)], [])
    expect(prompt).toContain('clean game')
  })
})

describe('GameInsightSchema', () => {
  it('accepts a well-formed insight', () => {
    const parsed = GameInsightSchema.safeParse({
      summary: 's',
      keyTakeaway: 'k',
      moments: [{ ply: 3, whatHappened: 'w', betterPlan: 'b', concept: 'loose-pieces' }],
      mistakeTags: ['loose-pieces']
    })
    expect(parsed.success).toBe(true)
  })
  it('rejects missing fields', () => {
    expect(GameInsightSchema.safeParse({ summary: 's' }).success).toBe(false)
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})
