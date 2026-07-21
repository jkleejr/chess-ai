import { beforeEach, describe, expect, it, vi } from 'vitest'

// Count constructions of UciEngine — the bug this guards against was the pool
// spawning one Stockfish process per position instead of `size` total.
let spawned = 0

vi.mock('../src/main/engine/uciEngine', () => {
  class FakeEngine {
    public dead = false
    public version = 'fake'
    constructor() {
      spawned++
    }
    async init(): Promise<void> {
      // Yield, so concurrent checkouts interleave exactly like the real
      // async init() does. A synchronous stub would hide the race entirely.
      await new Promise((r) => setTimeout(r, 0))
    }
    async evaluate(): Promise<unknown> {
      await new Promise((r) => setTimeout(r, 0))
      return { score: { cp: 0, mate: null }, bestMoveUci: null, pv: [] }
    }
    quit(): void {
      this.dead = true
    }
  }
  return { UciEngine: FakeEngine }
})

const { EnginePool } = await import('../src/main/engine/enginePool')

describe('EnginePool', () => {
  beforeEach(() => {
    spawned = 0
  })

  it('never exceeds `size` processes under a burst of concurrent checkouts', async () => {
    const pool = new EnginePool('/fake/stockfish', 3)
    await pool.start()
    expect(spawned).toBe(3)

    // 80 positions arriving at once, as analyzeGame does for a full game.
    await Promise.all(Array.from({ length: 80 }, () => pool.withEngine(async (e) => e.evaluate())))

    expect(spawned).toBe(3)
    pool.shutdown()
  })

  it('does not spawn on a pool that was already shut down', async () => {
    const pool = new EnginePool('/fake/stockfish', 3)
    await pool.start()
    pool.shutdown()
    spawned = 0

    const results = await Promise.allSettled(
      Array.from({ length: 80 }, () => pool.withEngine(async (e) => e.evaluate()))
    )

    expect(spawned).toBe(0)
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
  })

  it('caps spawns when a burst arrives at a drained pool', async () => {
    // The crash sequence: engines die (or the pool is handed out post-reset),
    // leaving it below `size`, and then a whole game's positions arrive at
    // once. Every checkout passes the capacity check in the same tick and
    // spawns its own process unless the slot is reserved before awaiting init.
    const pool = new EnginePool('/fake/stockfish', 3)
    await pool.start()

    // Drain: kill all three engines so `engines` is empty but the pool is live.
    await Promise.all(
      Array.from({ length: 3 }, () =>
        pool.withEngine(async (e) => {
          e.quit()
          return null
        })
      )
    )
    spawned = 0

    await Promise.all(Array.from({ length: 80 }, () => pool.withEngine(async (e) => e.evaluate())))

    expect(spawned).toBeLessThanOrEqual(3)
    pool.shutdown()
  })

  it('rejects parked waiters on shutdown instead of hanging', async () => {
    const pool = new EnginePool('/fake/stockfish', 1)
    await pool.start()

    // Occupy the only engine, then park a second caller behind it.
    let release: () => void = () => {}
    const held = pool.withEngine(() => new Promise<null>((r) => (release = () => r(null))))
    const parked = pool.withEngine(async () => null)

    pool.shutdown()
    await expect(parked).rejects.toThrow(/shut down/)
    release()
    await held
  })
})
