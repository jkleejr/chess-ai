import { beforeEach, describe, expect, it, vi } from 'vitest'

// Guards the engine lifecycle of the mirror-match bot: concurrent callers must
// share one Stockfish process, and a stop mid-startup must not leave one alive.
let spawned = 0
let live = 0

vi.mock('../src/main/engine/uciEngine', () => {
  class FakeEngine {
    public dead = false
    public version = 'fake'
    constructor() {
      spawned++
      live++
    }
    async init(): Promise<void> {
      await new Promise((r) => setTimeout(r, 5))
    }
    async evaluate(): Promise<unknown> {
      return { score: { cp: 0, mate: null }, bestMoveUci: null, pv: [] }
    }
    async evaluateMulti(): Promise<unknown[]> {
      return []
    }
    quit(): void {
      if (!this.dead) live--
      this.dead = true
    }
  }
  return { UciEngine: FakeEngine }
})

vi.mock('../src/main/engine/stockfishProvision', () => ({
  locateStockfish: async () => ({ state: 'ready', path: '/fake/stockfish' })
}))

vi.mock('../src/main/db/database', () => ({
  getDb: () => ({ prepare: () => ({ all: () => [] }) })
}))
vi.mock('../src/main/db/repos/extendedStatsRepo', () => ({ phaseOf: () => 'middlegame' }))

const { botEval, botStop } = await import('../src/main/bot/mimicBot')

describe('mimicBot engine lifecycle', () => {
  beforeEach(() => {
    botStop()
    spawned = 0
    live = 0
  })

  it('shares one engine across concurrent callers', async () => {
    // The live-analysis panel fires these back-to-back as the user navigates.
    await Promise.all(Array.from({ length: 20 }, () => botEval('8/8/8/8/8/8/8/K6k w - - 0 1')))

    expect(spawned).toBe(1)
    expect(live).toBe(1)
    botStop()
    expect(live).toBe(0)
  })

  it('leaves no engine alive when stopped mid-startup', async () => {
    const pending = botEval('8/8/8/8/8/8/8/K6k w - - 0 1')
    botStop() // lands while init() is still in flight
    await pending.catch(() => undefined)

    expect(live).toBe(0)
  })

  it('respawns after the engine dies rather than reusing the dead one', async () => {
    await botEval('8/8/8/8/8/8/8/K6k w - - 0 1')
    expect(spawned).toBe(1)

    // Simulate the process dying between calls.
    botStop()
    await botEval('8/8/8/8/8/8/8/K6k w - - 0 1')

    expect(spawned).toBe(2)
    expect(live).toBe(1)
    botStop()
  })
})
