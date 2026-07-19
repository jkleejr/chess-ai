import type { BrowserWindow } from 'electron'
import type { AnalysisStatusInfo, EngineStatus } from '../../shared/types'
import { countAnalyzed, listPendingGameIds, setAnalysisStatus } from '../db/repos/gamesRepo'
import { getSetting, SETTING_KEYS } from '../db/repos/settingsRepo'
import { IPC } from '../ipc/channels'
import { analyzeGame } from './analyzer'
import { EnginePool } from './enginePool'
import { locateStockfish } from './stockfishProvision'

/**
 * Singleton FIFO queue over pending games. One game analyzed at a time; the
 * engine pool parallelizes positions within a game (best latency-to-first-result).
 */
class AnalysisQueue {
  private queue: number[] = []
  private queued = new Set<number>()
  private running = false
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

  enqueueAllPending(): void {
    this.enqueue(listPendingGameIds())
  }

  status(): AnalysisStatusInfo {
    return {
      queued: this.queue.length,
      currentGameId: this.currentGameId,
      currentPct: this.currentPct,
      analyzedTotal: countAnalyzed()
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
    this.pool = new EnginePool(status.path)
    await this.pool.start()
    return this.pool
  }

  /** Drop the pool so the next run re-locates the binary (e.g. after settings change). */
  resetPool(): void {
    this.pool?.shutdown()
    this.pool = null
  }

  private async pump(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const pool = await this.ensurePool()
      if (!pool) return // engine not available yet; queue stays intact

      const depth = parseInt(getSetting(SETTING_KEYS.engineDepth) ?? '16', 10)
      while (this.queue.length > 0) {
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
          setAnalysisStatus(gameId, 'error')
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
    }
  }

  shutdown(): void {
    this.pool?.shutdown()
    this.pool = null
  }
}

export const analysisQueue = new AnalysisQueue()
