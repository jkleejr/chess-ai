// Single source of truth for IPC channel names.

export const IPC = {
  // request/response (ipcMain.handle)
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsHasApiKey: 'settings:hasApiKey',
  settingsSetApiKey: 'settings:setApiKey',
  settingsTestApiKey: 'settings:testApiKey',
  syncStart: 'sync:start',
  gamesList: 'games:list',
  gamesGet: 'games:get',
  gamesCount: 'games:count',
  analysisEnqueue: 'analysis:enqueue',
  analysisStatus: 'analysis:status',
  analysisPause: 'analysis:pause',
  analysisResume: 'analysis:resume',
  engineStatus: 'engine:status',
  engineSetup: 'engine:setup',
  coachExplainGame: 'coach:explainGame',
  coachExplainMove: 'coach:explainMove',
  coachStyleReport: 'coach:styleReport',
  coachCosts: 'coach:costs',
  profileGet: 'profile:get',
  statsOpenings: 'stats:openings',
  statsAccuracy: 'stats:accuracy',
  statsMistakeTags: 'stats:mistakeTags',
  statsExtended: 'stats:extended',
  statsTimeControls: 'stats:timeControls',
  botStart: 'bot:start',
  botMove: 'bot:move',
  botStop: 'bot:stop',
  styleReportGet: 'styleReport:get',

  // push events (webContents.send)
  evSyncProgress: 'ev:sync:progress',
  evAnalysisProgress: 'ev:analysis:progress',
  evGameAnalyzed: 'ev:analysis:game-complete',
  evEngineStatus: 'ev:engine:status',
  evInsightReady: 'ev:coach:insight-ready'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
