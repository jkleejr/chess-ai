import type { BrowserWindow } from 'electron'
import type { AnalysisStatusInfo, EngineStatus } from '../../shared/types'
import { countAnalyzed, listPendingGameIds, setAnalysisStatus } from '../db/repos/gamesRepo'
import { getSetting, SETTING_KEYS } from '../db/repos/settingsRepo'
import { IPC } from '../ipc/channels'
import { analyzeGame } from './analyzer'
import { EnginePool } from './enginePool'
import { locateStockfish } from './stockfishProvision'

const MAX_ATTEMPTS = 3

/**
 * Singleton FIFO queue over pending games. One game analyzed at a time; a
 * small, low-priority engine pool parallelizes positions within a game.
 *
 * Analysis is intentionally NOT automatic for the whole library: only freshly
 * synced games (capped) and games the user opens are enqueued by default;
 * "Analyze all" is an explicit action. Pausable at any time.
 */
class AnalysisQueue {
  private queue: number[] = []
  private queued = new Set<number>()
  private attempts = new Map<number, number>()
  private running = false
  private paused = false
  private currentGameId: number | null = null
  private currentPct = 0
  private pool: EnginePool | null = null
  private window: BrowserWindow | null = null
  private onGameAnalyzed: ((gameId: number) => void) | null = null

  attachWindow(win: BrowserWindow): void {
    this.window = win
  }

  setOnGameAnalyzed(cb: (gameId: number) => void): void {
    this.onGameAnalyzed = cb
  }

  enqueue(gameIds: number[]): void {
    for (const id of gameIds) {
      if (!this.queued.has(id)) {
        this.queued.add(id)
        this.queue.push(id)
      }
    }
    void this.pump()
  }

  /** Jump the queue — used when the user opens an unanalyzed game. */
  enqueueFront(gameId: number): void {
    if (this.queued.has(gameId)) {
      this.queue = [gameId, ...this.queue.filter((id) => id !== gameId)]
    } else {
      this.queued.add(gameId)
      this.queue.unshift(gameId)
    }
    void this.pump()
  }

  enqueueAllPending(): void {
    this.enqueue(listPendingGameIds())
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
    void this.pump()
  }

  status(): AnalysisStatusInfo & { paused: boolean } {
    return {
      queued: this.queue.length,
      currentGameId: this.currentGameId,
      currentPct: this.currentPct,
      analyzedTotal: countAnalyzed(),
      paused: this.paused
    }
  }

  private send(channel: string, payload: unknown): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, payload)
    }
  }

  private async ensurePool(): Promise<EnginePool | null> {
    if (this.pool) return this.pool
    const status: EngineStatus = await locateStockfish()
    if (status.state !== 'ready' || !status.path) return null
    const size = Math.max(1, Math.min(6, parseInt(getSetting(SETTING_KEYS.enginePoolSize) ?? '2', 10)))
    this.pool = new EnginePool(status.path, size)
    await this.pool.start()
    return this.pool
  }

  /** Drop the pool so the next run re-locates binary/settings. */
  resetPool(): void {
    this.pool?.shutdown()
    this.pool = null
  }

  private async pump(): Promise<void> {
    if (this.running || this.paused) return
    this.running = true
    try {
      const pool = await this.ensurePool()
      if (!pool) return // engine not available yet; queue stays intact

      const depth = parseInt(getSetting(SETTING_KEYS.engineDepth) ?? '16', 10)
      while (this.queue.length > 0 && !this.paused) {
        const gameId = this.queue.shift()!
        this.queued.delete(gameId)
        this.currentGameId = gameId
        this.currentPct = 0
        try {
          await analyzeGame(gameId, pool, depth, (pct) => {
            this.currentPct = pct
            this.send(IPC.evAnalysisProgress, { gameId, pct, queued: this.queue.length })
          })
          this.send(IPC.evGameAnalyzed, { gameId })
          this.onGameAnalyzed?.(gameId)
        } catch (e) {
          console.error(`analysis of game ${gameId} failed:`, e)
          // Engine deaths are usually transient — retry a couple of times
          // before giving up on the game.
          const tries = (this.attempts.get(gameId) ?? 0) + 1
          this.attempts.set(gameId, tries)
          if (tries < MAX_ATTEMPTS) {
            setAnalysisStatus(gameId, 'pending')
            this.queued.add(gameId)
            this.queue.push(gameId)
          } else {
            setAnalysisStatus(gameId, 'error')
          }
          // Engine may have died mid-game; rebuild pool before continuing.
          this.resetPool()
          const next = await this.ensurePool()
          if (!next) break
        }
      }
    } finally {
      this.currentGameId = null
      this.currentPct = 0
      this.running = false
      // Idle: release the engines entirely so background CPU drops to zero.
      if (this.queue.length === 0) this.resetPool()
    }
  }

  shutdown(): void {
    this.pool?.shutdown()
    this.pool = null
  }
}

export const analysisQueue = new AnalysisQueue()
