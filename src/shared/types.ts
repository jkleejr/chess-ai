// Shared types between main and renderer processes.

export type AnalysisStatus = 'pending' | 'analyzing' | 'analyzed' | 'error'

export type Classification =
  | 'book'
  | 'brilliant'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'

export type GameResult = 'win' | 'loss' | 'draw'

export interface GameSummary {
  id: number
  chesscomUuid: string
  url: string | null
  timeClass: string | null
  timeControl: string | null
  rated: boolean
  endTime: number
  whiteUsername: string
  blackUsername: string
  whiteRating: number | null
  blackRating: number | null
  userColor: 'white' | 'black'
  result: GameResult
  termination: string | null
  ecoCode: string | null
  openingName: string | null
  analysisStatus: AnalysisStatus
  accuracyWhite: number | null
  accuracyBlack: number | null
  hasCoachReview: boolean
}

export interface MoveEval {
  ply: number
  san: string
  uci: string
  fenBefore: string
  fenAfter: string
  isUserMove: boolean
  evalCp: number | null // white POV, after the move
  evalMate: number | null // white POV; positive = white mates in N
  bestMoveUci: string | null
  bestMoveSan: string | null
  cpLoss: number | null
  winProbBefore: number | null // mover POV, 0..100
  winProbAfter: number | null
  moveAccuracy: number | null
  classification: Classification | null
  clockSeconds: number | null
}

export interface GameDetail {
  game: GameSummary
  pgn: string
  moves: MoveEval[]
  review: GameInsight | null
  moveExplanations: Record<number, MoveExplanation>
}

// --- LLM insight payloads (validated with zod on the main side) ---

export interface InsightMoment {
  ply: number
  whatHappened: string
  betterPlan: string
  concept: string
}

export interface GameInsight {
  summary: string
  keyTakeaway: string
  moments: InsightMoment[]
  mistakeTags: string[]
}

export interface MoveExplanation {
  explanation: string
  keyIdea: string
  bestLineExplained: string
}

export interface OpeningRepertoireEntry {
  eco: string
  name: string
  games: number
  winRate: number
  avgAccuracy: number
}

export interface RecurringMistake {
  pattern: string
  frequency: string
  exampleGameIds: number[]
}

export interface PlayerProfile {
  styleSummary: string
  strengths: string[]
  weaknesses: string[]
  recurringMistakes: RecurringMistake[]
  openingRepertoire: {
    asWhite: OpeningRepertoireEntry[]
    asBlack: OpeningRepertoireEntry[]
  }
  openingSuggestions: string[]
  timeManagement: string
  improvementFocus: string[]
}

export interface StyleReport {
  report: string // markdown
  updatedProfile: PlayerProfile
}

// --- progress / status payloads ---

export interface SyncProgress {
  phase: 'archives' | 'games' | 'done' | 'error'
  archiveIndex: number
  archiveTotal: number
  gamesInserted: number
  message?: string
}

export interface AnalysisStatusInfo {
  queued: number
  currentGameId: number | null
  currentPct: number
  analyzedTotal: number
}

export interface EngineStatus {
  state: 'not-found' | 'downloading' | 'ready' | 'error'
  path?: string
  version?: string
  downloadPct?: number
  message?: string
}

export interface CostSummary {
  totalUsd: number
  byModel: { model: string; usd: number; calls: number }[]
}

export interface GameListFilter {
  result?: GameResult
  timeClass?: string
  eco?: string
}

export interface OpeningStat {
  eco: string
  name: string
  color: 'white' | 'black'
  games: number
  wins: number
  losses: number
  draws: number
  avgAccuracy: number | null
}

export interface AccuracyPoint {
  endTime: number
  accuracy: number
  timeClass: string
}
