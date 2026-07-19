import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { StyleReport } from '../../shared/types'
import { countAnalyzed } from '../db/repos/gamesRepo'
import { listRecentReviewSummaries, mistakeTagCounts, saveInsight } from '../db/repos/insightsRepo'
import { getProfile, saveProfile } from '../db/repos/profileRepo'
import { getSetting, SETTING_KEYS } from '../db/repos/settingsRepo'
import { aggregateStats, openingStats } from '../db/repos/statsRepo'
import { computeCostUsd, getClient } from './anthropicClient'
import { buildStyleReportPrompt, SYSTEM_COACH } from './prompts'
import { StyleReportSchema } from './schemas'

/**
 * Deep multi-game analysis on the bigger model. Input is SQL aggregates plus
 * prior per-game review summaries — never raw games — so one call stays cheap
 * (~15-25K input tokens).
 */
export async function generateStyleReport(): Promise<StyleReport> {
  const stats = aggregateStats()
  if (stats.analyzedGames < 3) {
    throw new Error('Analyze at least 3 games before generating a style report')
  }

  const reviews = listRecentReviewSummaries(50).map((r) => ({
    gameId: r.gameId,
    summary: r.insight.summary,
    keyTakeaway: r.insight.keyTakeaway,
    mistakeTags: r.insight.mistakeTags
  }))
  const previous = getProfile()
  const model = getSetting(SETTING_KEYS.modelStyleReport) ?? 'claude-sonnet-5'

  const client = getClient()
  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    system: [{ type: 'text', text: SYSTEM_COACH }],
    messages: [
      {
        role: 'user',
        content: buildStyleReportPrompt(
          stats,
          reviews,
          mistakeTagCounts(),
          openingStats(2),
          previous?.profile ?? null
        )
      }
    ],
    output_config: { format: zodOutputFormat(StyleReportSchema) }
  })

  const report = response.parsed_output
  if (!report) throw new Error('Style report failed schema validation')

  const insightId = saveInsight(null, 'style_report', null, report, {
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    costUsd: computeCostUsd(model, response.usage)
  })
  saveProfile(report.updatedProfile, countAnalyzed(), insightId)
  return report
}
