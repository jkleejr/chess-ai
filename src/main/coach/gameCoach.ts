import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { GameInsight, MoveEval, MoveExplanation } from '../../shared/types'
import { getGameSummary } from '../db/repos/gamesRepo'
import {
  getGameReview,
  getMoveExplanation,
  saveInsight,
  type InsightUsage
} from '../db/repos/insightsRepo'
import { getMoves } from '../db/repos/movesRepo'
import { getProfile } from '../db/repos/profileRepo'
import { getSetting, SETTING_KEYS } from '../db/repos/settingsRepo'
import { computeCostUsd, getClient } from './anthropicClient'
import { buildGamePrompt, buildMovePrompt, systemBlocks, type CriticalMoment } from './prompts'
import { GameInsightSchema, MoveExplanationSchema } from './schemas'

const MAX_MOMENTS = 6

/**
 * Cost control lives here, not in the LLM: pick at most MAX_MOMENTS moments
 * locally from the engine analysis — the user's blunders/mistakes, their single
 * biggest win-prob swing, and missed wins.
 */
export function selectCriticalMoments(moves: MoveEval[]): CriticalMoment[] {
  const userMoves = moves.filter((m) => m.isUserMove)
  const byPly = new Map<number, CriticalMoment>()

  for (const m of userMoves) {
    if (m.classification === 'blunder') byPly.set(m.ply, { move: m, reason: 'blunder' })
    else if (m.classification === 'mistake') byPly.set(m.ply, { move: m, reason: 'mistake' })
  }

  // Missed wins: from clearly winning (>=70%) to toss-up or worse (<=50%).
  for (const m of userMoves) {
    if (
      !byPly.has(m.ply) &&
      m.winProbBefore !== null &&
      m.winProbAfter !== null &&
      m.winProbBefore >= 70 &&
      m.winProbAfter <= 50
    ) {
      byPly.set(m.ply, { move: m, reason: 'missed-win' })
    }
  }

  // Biggest single swing, even if it didn't cross a classification threshold.
  let biggest: MoveEval | null = null
  let biggestDrop = 0
  for (const m of userMoves) {
    const drop = (m.winProbBefore ?? 0) - (m.winProbAfter ?? 0)
    if (drop > biggestDrop) {
      biggestDrop = drop
      biggest = m
    }
  }
  if (biggest && biggestDrop >= 8 && !byPly.has(biggest.ply)) {
    byPly.set(biggest.ply, { move: biggest, reason: 'biggest-swing' })
  }

  // Worst first, cap, then restore game order for the prompt.
  return [...byPly.values()]
    .sort((a, b) => (b.move.cpLoss ?? 0) - (a.move.cpLoss ?? 0))
    .slice(0, MAX_MOMENTS)
    .sort((a, b) => a.move.ply - b.move.ply)
}

export async function explainGame(gameId: number): Promise<GameInsight> {
  const cached = getGameReview(gameId)
  if (cached) return cached

  const game = getGameSummary(gameId)
  if (!game) throw new Error(`game ${gameId} not found`)
  if (game.analysisStatus !== 'analyzed') {
    throw new Error('Game must be engine-analyzed before coaching')
  }
  const moves = getMoves(gameId)
  const moments = selectCriticalMoments(moves)
  const model = getSetting(SETTING_KEYS.modelPerGame) ?? 'claude-haiku-4-5'

  const client = getClient()
  const response = await client.messages.parse({
    model,
    max_tokens: 2048,
    system: systemBlocks(getProfile()?.profile ?? null),
    messages: [{ role: 'user', content: buildGamePrompt(game, moves, moments) }],
    output_config: { format: zodOutputFormat(GameInsightSchema) }
  })

  const insight = response.parsed_output
  if (!insight) throw new Error('Coach response failed schema validation')

  const usage: InsightUsage = {
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    costUsd: computeCostUsd(model, response.usage)
  }
  saveInsight(gameId, 'game_review', null, insight, usage)
  return insight
}

export async function explainMove(gameId: number, ply: number): Promise<MoveExplanation> {
  const cached = getMoveExplanation(gameId, ply)
  if (cached) return cached

  const game = getGameSummary(gameId)
  if (!game) throw new Error(`game ${gameId} not found`)
  const moves = getMoves(gameId)
  const move = moves.find((m) => m.ply === ply)
  if (!move) throw new Error(`ply ${ply} not found in game ${gameId}`)
  const contextSans = moves.slice(Math.max(0, ply - 9), ply - 1).map((m) => m.san)
  const model = getSetting(SETTING_KEYS.modelPerGame) ?? 'claude-haiku-4-5'

  const client = getClient()
  const response = await client.messages.parse({
    model,
    max_tokens: 1024,
    system: systemBlocks(getProfile()?.profile ?? null),
    messages: [{ role: 'user', content: buildMovePrompt(game, move, contextSans) }],
    output_config: { format: zodOutputFormat(MoveExplanationSchema) }
  })

  const explanation = response.parsed_output
  if (!explanation) throw new Error('Coach response failed schema validation')

  saveInsight(gameId, 'move_explanation', ply, explanation, {
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    costUsd: computeCostUsd(model, response.usage)
  })
  return explanation
}
