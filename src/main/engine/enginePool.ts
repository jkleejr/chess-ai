import os from 'os'
import { UciEngine } from './uciEngine'

/**
 * Fixed-size pool of single-threaded engines. Parallelism comes from evaluating
 * many positions of one game concurrently across the pool.
 */
export class EnginePool {
  private engines: UciEngine[] = []
  private idle: UciEngine[] = []
  private waiters: ((e: UciEngine) => void)[] = []
  private started = false

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
    // Replace dead engines transparently.
    let e = this.idle.pop()
    while (e && e.dead) e = this.idle.pop()
    if (e) return e
    if (this.engines.filter((x) => !x.dead).length < this.size) {
      const fresh = new UciEngine(this.binaryPath)
      await fresh.init(1, 64)
      this.engines.push(fresh)
      return fresh
    }
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  private checkin(e: UciEngine): void {
    if (e.dead) {
      this.engines = this.engines.filter((x) => x !== e)
      // wake a waiter with a fresh engine if needed
      const waiter = this.waiters.shift()
      if (waiter) {
        const fresh = new UciEngine(this.binaryPath)
        fresh
          .init(1, 64)
          .then(() => {
            this.engines.push(fresh)
            waiter(fresh)
          })
          .catch(() => this.waiters.unshift(waiter))
      }
      return
    }
    const waiter = this.waiters.shift()
    if (waiter) waiter(e)
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
    for (const e of this.engines) e.quit()
    this.engines = []
    this.idle = []
    this.started = false
  }
}
