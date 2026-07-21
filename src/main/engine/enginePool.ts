import os from 'os'
import { UciEngine } from './uciEngine'

/**
 * Fixed-size pool of single-threaded engines. Parallelism comes from evaluating
 * many positions of one game concurrently across the pool.
 */
export class EnginePool {
  private engines: UciEngine[] = []
  private idle: UciEngine[] = []
  private waiters: { resolve: (e: UciEngine) => void; reject: (err: Error) => void }[] = []
  private started = false
  /** Slots reserved by in-flight spawns; counted before awaiting init(). */
  private spawning = 0
  /** Set by shutdown(). A dead pool must never spawn another process. */
  private disposed = false

  constructor(
    private readonly binaryPath: string,
    private readonly size = Math.max(1, Math.min(6, os.cpus().length - 2))
  ) {}

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    for (let i = 0; i < this.size; i++) {
      const e = new UciEngine(this.binaryPath)
      await e.init(1, 64)
      this.engines.push(e)
      this.idle.push(e)
    }
  }

  private async checkout(): Promise<UciEngine> {
    if (this.disposed) throw new Error('engine pool has been shut down')
    // Replace dead engines transparently.
    let e = this.idle.pop()
    while (e && e.dead) e = this.idle.pop()
    if (e) return e
    // Reserve the slot BEFORE awaiting init(). Callers arrive in bursts (one
    // per position of a game), so a check that only counts live engines lets
    // every one of them pass and spawn — hundreds of processes at once.
    if (this.engines.filter((x) => !x.dead).length + this.spawning < this.size) {
      this.spawning++
      try {
        const fresh = new UciEngine(this.binaryPath)
        await fresh.init(1, 64)
        if (this.disposed) {
          fresh.quit()
          throw new Error('engine pool has been shut down')
        }
        this.engines.push(fresh)
        return fresh
      } finally {
        this.spawning--
      }
    }
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }))
  }

  private checkin(e: UciEngine): void {
    if (e.dead) {
      this.engines = this.engines.filter((x) => x !== e)
      // wake a waiter with a fresh engine if needed
      const waiter = this.waiters.shift()
      if (waiter) {
        if (this.disposed) {
          waiter.reject(new Error('engine pool has been shut down'))
          return
        }
        this.spawning++
        const fresh = new UciEngine(this.binaryPath)
        fresh
          .init(1, 64)
          .then(() => {
            this.spawning--
            if (this.disposed) {
              fresh.quit()
              waiter.reject(new Error('engine pool has been shut down'))
              return
            }
            this.engines.push(fresh)
            waiter.resolve(fresh)
          })
          .catch((err) => {
            this.spawning--
            // Nothing else will wake this waiter — fail it rather than park it.
            waiter.reject(err instanceof Error ? err : new Error(String(err)))
          })
      }
      return
    }
    const waiter = this.waiters.shift()
    if (waiter) waiter.resolve(e)
    else this.idle.push(e)
  }

  async withEngine<T>(fn: (e: UciEngine) => Promise<T>): Promise<T> {
    const e = await this.checkout()
    try {
      return await fn(e)
    } finally {
      this.checkin(e)
    }
  }

  shutdown(): void {
    this.disposed = true
    for (const e of this.engines) e.quit()
    this.engines = []
    this.idle = []
    this.started = false
    // Unblock anyone parked in checkout(); otherwise their analyzeGame() never
    // settles and the queue wedges.
    const parked = this.waiters
    this.waiters = []
    for (const w of parked) w.reject(new Error('engine pool has been shut down'))
  }
}
