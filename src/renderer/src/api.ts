// Typed facade over the preload bridge.
import type {
  AccuracyPoint,
  AnalysisStatusInfo,
  CostSummary,
  EngineStatus,
  GameDetail,
  GameInsight,
  GameListFilter,
  GameSummary,
  MoveExplanation,
  OpeningStat,
  PlayerProfile,
  StyleReport,
  SyncProgress
} from '../../shared/types'

const invoke = (channel: string, ...args: unknown[]): Promise<never> =>
  window.api.invoke(channel as never, ...args) as Promise<never>

export const api = {
  getSetting: (key: string) => invoke('settings:get', key) as Promise<string | null>,
  setSetting: (key: string, value: string) => invoke('settings:set', key, value) as Promise<void>,
  hasApiKey: () => invoke('settings:hasApiKey') as Promise<boolean>,
  setApiKey: (key: string) => invoke('settings:setApiKey', key) as Promise<void>,
  testApiKey: () => invoke('settings:testApiKey') as Promise<{ ok: boolean; error?: string }>,

  syncStart: (username?: string) =>
    invoke('sync:start', username) as Promise<{ started: boolean; reason?: string }>,

  listGames: (offset: number, limit: number, filter?: GameListFilter) =>
    invoke('games:list', offset, limit, filter) as Promise<GameSummary[]>,
  countGames: () => invoke('games:count') as Promise<number>,
  getGame: (id: number) => invoke('games:get', id) as Promise<GameDetail | null>,

  enqueueAnalysis: (target: number | 'all-pending') =>
    invoke('analysis:enqueue', target) as Promise<void>,
  analysisStatus: () =>
    invoke('analysis:status') as Promise<
      AnalysisStatusInfo & { pendingTotal: number; paused: boolean }
    >,
  analysisPause: () => invoke('analysis:pause') as Promise<void>,
  analysisResume: () => invoke('analysis:resume') as Promise<void>,

  engineStatus: () => invoke('engine:status') as Promise<EngineStatus>,
  engineSetup: () => invoke('engine:setup') as Promise<EngineStatus>,

  explainGame: (gameId: number) => invoke('coach:explainGame', gameId) as Promise<GameInsight>,
  explainMove: (gameId: number, ply: number) =>
    invoke('coach:explainMove', gameId, ply) as Promise<MoveExplanation>,
  styleReport: () => invoke('coach:styleReport') as Promise<StyleReport>,
  costs: () => invoke('coach:costs') as Promise<CostSummary>,

  getProfile: () =>
    invoke('profile:get') as Promise<{
      version: number
      profile: PlayerProfile
      gamesAnalyzed: number
    } | null>,
  getStyleReport: () => invoke('styleReport:get') as Promise<StyleReport | null>,
  openingStats: (minGames?: number) => invoke('stats:openings', minGames) as Promise<OpeningStat[]>,
  accuracyOverTime: () => invoke('stats:accuracy') as Promise<AccuracyPoint[]>,
  mistakeTags: () => invoke('stats:mistakeTags') as Promise<{ tag: string; count: number }[]>
}

export const events = {
  onSyncProgress: (cb: (p: SyncProgress) => void) =>
    window.api.on('ev:sync:progress', cb as (p: unknown) => void),
  onAnalysisProgress: (cb: (p: { gameId: number; pct: number; queued: number }) => void) =>
    window.api.on('ev:analysis:progress', cb as (p: unknown) => void),
  onGameAnalyzed: (cb: (p: { gameId: number }) => void) =>
    window.api.on('ev:analysis:game-complete', cb as (p: unknown) => void),
  onEngineStatus: (cb: (p: EngineStatus) => void) =>
    window.api.on('ev:engine:status', cb as (p: unknown) => void),
  onInsightReady: (cb: (p: { gameId: number; type: string }) => void) =>
    window.api.on('ev:coach:insight-ready', cb as (p: unknown) => void)
}
