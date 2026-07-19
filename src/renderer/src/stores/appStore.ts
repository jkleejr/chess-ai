import { create } from 'zustand'
import type { EngineStatus, SyncProgress } from '../../../shared/types'
import { api, events } from '../api'

interface AppState {
  username: string | null
  hasApiKey: boolean
  engineStatus: EngineStatus | null
  syncProgress: SyncProgress | null
  analysis: { queued: number; currentGameId: number | null; currentPct: number }
  initialized: boolean

  init: () => Promise<void>
  refreshSettings: () => Promise<void>
  startSync: (username?: string) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  username: null,
  hasApiKey: false,
  engineStatus: null,
  syncProgress: null,
  analysis: { queued: 0, currentGameId: null, currentPct: 0 },
  initialized: false,

  init: async () => {
    if (get().initialized) return
    set({ initialized: true })

    events.onSyncProgress((p) => set({ syncProgress: p }))
    events.onEngineStatus((p) => set({ engineStatus: p }))
    events.onAnalysisProgress((p) =>
      set({ analysis: { queued: p.queued, currentGameId: p.gameId, currentPct: p.pct } })
    )
    events.onGameAnalyzed(() => {
      void api.analysisStatus().then((s) =>
        set({
          analysis: { queued: s.queued, currentGameId: s.currentGameId, currentPct: s.currentPct }
        })
      )
    })

    await get().refreshSettings()
    const [engineStatus, analysis] = await Promise.all([api.engineStatus(), api.analysisStatus()])
    set({
      engineStatus,
      analysis: {
        queued: analysis.queued,
        currentGameId: analysis.currentGameId,
        currentPct: analysis.currentPct
      }
    })
  },

  refreshSettings: async () => {
    const [username, hasApiKey] = await Promise.all([
      api.getSetting('chesscom_username'),
      api.hasApiKey()
    ])
    set({ username, hasApiKey })
  },

  startSync: async (username?: string) => {
    set({
      syncProgress: { phase: 'archives', archiveIndex: 0, archiveTotal: 0, gamesInserted: 0 }
    })
    const res = await api.syncStart(username)
    if (!res.started && res.reason !== 'already-running') {
      set({
        syncProgress: {
          phase: 'error',
          archiveIndex: 0,
          archiveTotal: 0,
          gamesInserted: 0,
          message: res.reason === 'no-username' ? 'Enter a chess.com username first' : res.reason
        }
      })
      return
    }
    if (username) await get().refreshSettings()
  }
}))
