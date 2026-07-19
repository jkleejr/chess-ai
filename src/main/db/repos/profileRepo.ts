import type { PlayerProfile } from '../../../shared/types'
import { getDb } from '../database'

export interface ProfileRecord {
  version: number
  profile: PlayerProfile
  gamesAnalyzed: number
}

export function getProfile(): ProfileRecord | null {
  const row = getDb()
    .prepare(
      'SELECT version, profile_json, games_analyzed FROM player_profile ORDER BY version DESC LIMIT 1'
    )
    .get() as { version: number; profile_json: string; games_analyzed: number } | undefined
  if (!row) return null
  try {
    return {
      version: row.version,
      profile: JSON.parse(row.profile_json) as PlayerProfile,
      gamesAnalyzed: row.games_analyzed
    }
  } catch {
    return null
  }
}

export function saveProfile(
  profile: PlayerProfile,
  gamesAnalyzed: number,
  sourceInsightId: number | null
): number {
  const next = (getProfile()?.version ?? 0) + 1
  getDb()
    .prepare(
      'INSERT INTO player_profile (version, profile_json, games_analyzed, source_insight_id) VALUES (?, ?, ?, ?)'
    )
    .run(next, JSON.stringify(profile), gamesAnalyzed, sourceInsightId)
  return next
}
