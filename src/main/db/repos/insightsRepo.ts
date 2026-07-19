import type { CostSummary, GameInsight, MoveExplanation, StyleReport } from '../../../shared/types'
import { getDb } from '../database'

export type InsightType = 'game_review' | 'move_explanation' | 'style_report'

export interface InsightUsage {
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  costUsd: number
}

export function saveInsight(
  gameId: number | null,
  type: InsightType,
  ply: number | null,
  content: unknown,
  usage: InsightUsage
): number {
  const res = getDb()
    .prepare(
      `INSERT INTO insights (game_id, type, ply, content, model, input_tokens, output_tokens, cache_read_tokens, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(game_id, type, IFNULL(ply, -1)) DO UPDATE SET
         content = excluded.content, model = excluded.model,
         input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens,
         cache_read_tokens = excluded.cache_read_tokens, cost_usd = excluded.cost_usd`
    )
    .run(
      gameId,
      type,
      ply,
      JSON.stringify(content),
      usage.model,
      usage.inputTokens,
      usage.outputTokens,
      usage.cacheReadTokens,
      usage.costUsd
    )
  return Number(res.lastInsertRowid)
}

function getContent<T>(gameId: number | null, type: InsightType, ply: number | null): T | null {
  const row = getDb()
    .prepare(
      'SELECT content FROM insights WHERE game_id IS ? AND type = ? AND IFNULL(ply, -1) = IFNULL(?, -1)'
    )
    .get(gameId, type, ply) as { content: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.content) as T
  } catch {
    return null
  }
}

export function getGameReview(gameId: number): GameInsight | null {
  return getContent<GameInsight>(gameId, 'game_review', null)
}

export function getMoveExplanations(gameId: number): Record<number, MoveExplanation> {
  const rows = getDb()
    .prepare("SELECT ply, content FROM insights WHERE game_id = ? AND type = 'move_explanation'")
    .all(gameId) as { ply: number; content: string }[]
  const out: Record<number, MoveExplanation> = {}
  for (const r of rows) {
    try {
      out[r.ply] = JSON.parse(r.content) as MoveExplanation
    } catch {
      // skip corrupt rows
    }
  }
  return out
}

export function getMoveExplanation(gameId: number, ply: number): MoveExplanation | null {
  return getContent<MoveExplanation>(gameId, 'move_explanation', ply)
}

export function getLatestStyleReport(): StyleReport | null {
  const row = getDb()
    .prepare("SELECT content FROM insights WHERE type = 'style_report' ORDER BY created_at DESC, id DESC LIMIT 1")
    .get() as { content: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.content) as StyleReport
  } catch {
    return null
  }
}

export function listRecentReviewSummaries(limit: number): { gameId: number; insight: GameInsight }[] {
  const rows = getDb()
    .prepare(
      `SELECT i.game_id, i.content FROM insights i
       JOIN games g ON g.id = i.game_id
       WHERE i.type = 'game_review'
       ORDER BY g.end_time DESC LIMIT ?`
    )
    .all(limit) as { game_id: number; content: string }[]
  const out: { gameId: number; insight: GameInsight }[] = []
  for (const r of rows) {
    try {
      out.push({ gameId: r.game_id, insight: JSON.parse(r.content) as GameInsight })
    } catch {
      // skip corrupt rows
    }
  }
  return out
}

export function mistakeTagCounts(): { tag: string; count: number }[] {
  const rows = getDb()
    .prepare("SELECT content FROM insights WHERE type = 'game_review'")
    .all() as { content: string }[]
  const counts = new Map<string, number>()
  for (const r of rows) {
    try {
      const insight = JSON.parse(r.content) as GameInsight
      for (const tag of insight.mistakeTags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    } catch {
      // skip
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export function costSummary(): CostSummary {
  const rows = getDb()
    .prepare(
      'SELECT model, SUM(cost_usd) AS usd, COUNT(*) AS calls FROM insights GROUP BY model ORDER BY usd DESC'
    )
    .all() as { model: string; usd: number | null; calls: number }[]
  const byModel = rows.map((r) => ({ model: r.model, usd: r.usd ?? 0, calls: r.calls }))
  return { totalUsd: byModel.reduce((s, m) => s + m.usd, 0), byModel }
}
