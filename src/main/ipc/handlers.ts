import { ipcMain, type BrowserWindow } from 'electron'
import type { GameDetail, GameListFilter, StatsFilter, SyncProgress } from '../../shared/types'
import { ChesscomError } from '../chesscom/client'
import { syncGames } from '../chesscom/sync'
import { NoApiKeyError, testApiKey } from '../coach/anthropicClient'
import { explainGame, explainMove } from '../coach/gameCoach'
import { generateStyleReport } from '../coach/styleReport'
import {
  countGames,
  getGamePgn,
  getGameSummary,
  listGames,
  listPendingGameIds
} from '../db/repos/gamesRepo'
import {
  costSummary,
  getGameReview,
  getLatestStyleReport,
  getMoveExplanations,
  mistakeTagCounts
} from '../db/repos/insightsRepo'
import { getMoves } from '../db/repos/movesRepo'
import { getProfile } from '../db/repos/profileRepo'
import {
  getSetting,
  hasApiKey,
  setApiKey,
  setSetting,
  SETTING_KEYS
} from '../db/repos/settingsRepo'
import { extendedStats } from '../db/repos/extendedStatsRepo'
import { accuracyOverTime, openingStats, timeControlStats } from '../db/repos/statsRepo'
import { botMove, botStart, botStop } from '../bot/mimicBot'
import { analysisQueue } from '../engine/analysisQueue'
import { downloadStockfish, locateStockfish } from '../engine/stockfishProvision'
import { IPC } from './channels'

let syncRunning = false

export function registerIpcHandlers(win: BrowserWindow): void {
  analysisQueue.attachWindow(win)

  const send = (channel: string, payload: unknown): void => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  // Auto-coach: after each analyzed game, generate the review if enabled + key set.
  analysisQueue.setOnGameAnalyzed((gameId) => {
    if (getSetting(SETTING_KEYS.autoCoach) === 'true' && hasApiKey()) {
      explainGame(gameId)
        .then(() => send(IPC.evInsightReady, { gameId, type: 'game_review' }))
        .catch((e) => console.error('auto-coach failed:', e))
    }
  })

  // --- settings ---
  ipcMain.handle(IPC.settingsGet, (_e, key: string) => getSetting(key))
  ipcMain.handle(IPC.settingsSet, (_e, key: string, value: string) => {
    setSetting(key, value)
    if (
      key === SETTING_KEYS.enginePath ||
      key === SETTING_KEYS.engineDepth ||
      key === SETTING_KEYS.enginePoolSize
    ) {
      analysisQueue.resetPool()
    }
  })
  ipcMain.handle(IPC.settingsHasApiKey, () => hasApiKey())
  ipcMain.handle(IPC.settingsSetApiKey, (_e, key: string) => setApiKey(key))
  ipcMain.handle(IPC.settingsTestApiKey, () => testApiKey())

  // --- sync ---
  ipcMain.handle(IPC.syncStart, async (_e, usernameArg?: string) => {
    if (syncRunning) return { started: false, reason: 'already-running' }
    const username = usernameArg ?? getSetting(SETTING_KEYS.username)
    if (!username) return { started: false, reason: 'no-username' }
    if (usernameArg) setSetting(SETTING_KEYS.username, usernameArg)

    syncRunning = true
    ;(async () => {
      try {
        const newIds = await syncGames(username, (p: SyncProgress) => send(IPC.evSyncProgress, p))
        // Auto-analyze only the newest handful of fresh games; the rest stay
        // pending until the user opens them or clicks "Analyze all".
        analysisQueue.enqueue(newIds.reverse().slice(0, 30))
      } catch (e) {
        const message =
          e instanceof ChesscomError ? e.message : `Sync failed: ${(e as Error).message}`
        send(IPC.evSyncProgress, {
          phase: 'error',
          archiveIndex: 0,
          archiveTotal: 0,
          gamesInserted: 0,
          message
        } satisfies SyncProgress)
      } finally {
        syncRunning = false
      }
    })()
    return { started: true }
  })

  // --- games ---
  ipcMain.handle(IPC.gamesList, (_e, offset: number, limit: number, filter?: GameListFilter) =>
    listGames(offset, limit, filter)
  )
  ipcMain.handle(IPC.gamesCount, () => countGames())
  ipcMain.handle(IPC.gamesGet, (_e, gameId: number): GameDetail | null => {
    const game = getGameSummary(gameId)
    const pgn = getGamePgn(gameId)
    if (!game || !pgn) return null
    // Opening an unanalyzed game bumps it to the front of the queue.
    if (game.analysisStatus === 'pending' || game.analysisStatus === 'error') {
      analysisQueue.enqueueFront(gameId)
    }
    return {
      game,
      pgn,
      moves: getMoves(gameId),
      review: getGameReview(gameId),
      moveExplanations: getMoveExplanations(gameId)
    }
  })

  // --- analysis ---
  ipcMain.handle(IPC.analysisEnqueue, (_e, target: number | 'all-pending') => {
    if (target === 'all-pending') analysisQueue.enqueueAllPending()
    else analysisQueue.enqueue([target])
  })
  ipcMain.handle(IPC.analysisStatus, () => ({
    ...analysisQueue.status(),
    pendingTotal: listPendingGameIds().length
  }))
  ipcMain.handle(IPC.analysisPause, () => analysisQueue.pause())
  ipcMain.handle(IPC.analysisResume, () => analysisQueue.resume())

  // --- engine ---
  ipcMain.handle(IPC.engineStatus, () => locateStockfish())
  ipcMain.handle(IPC.engineSetup, async () => {
    const located = await locateStockfish()
    if (located.state === 'ready') return located
    send(IPC.evEngineStatus, { state: 'downloading', downloadPct: 0 })
    const result = await downloadStockfish((pct) =>
      send(IPC.evEngineStatus, { state: 'downloading', downloadPct: pct })
    )
    send(IPC.evEngineStatus, result)
    if (result.state === 'ready') analysisQueue.enqueueAllPending()
    return result
  })

  // --- coach ---
  const coachError = (e: unknown): never => {
    if (e instanceof NoApiKeyError) throw new Error(e.message)
    throw e
  }
  ipcMain.handle(IPC.coachExplainGame, (_e, gameId: number) =>
    explainGame(gameId).catch(coachError)
  )
  ipcMain.handle(IPC.coachExplainMove, (_e, gameId: number, ply: number) =>
    explainMove(gameId, ply).catch(coachError)
  )
  ipcMain.handle(IPC.coachStyleReport, () => generateStyleReport().catch(coachError))
  ipcMain.handle(IPC.coachCosts, () => costSummary())

  // --- profile / stats ---
  ipcMain.handle(IPC.profileGet, () => getProfile())
  ipcMain.handle(IPC.styleReportGet, () => getLatestStyleReport())
  ipcMain.handle(IPC.statsOpenings, (_e, minGames?: number, filter?: StatsFilter) =>
    openingStats(minGames ?? 1, filter)
  )
  ipcMain.handle(IPC.statsAccuracy, (_e, filter?: StatsFilter) => accuracyOverTime(filter))
  ipcMain.handle(IPC.statsTimeControls, () => timeControlStats())
  ipcMain.handle(IPC.statsMistakeTags, () => mistakeTagCounts())
  ipcMain.handle(IPC.statsExtended, (_e, filter?: StatsFilter) => extendedStats(filter))

  // --- mirror-match bot ---
  ipcMain.handle(IPC.botStart, () => botStart())
  ipcMain.handle(IPC.botMove, (_e, fen: string, ply: number) => botMove(fen, ply))
  ipcMain.handle(IPC.botStop, () => botStop())
}
