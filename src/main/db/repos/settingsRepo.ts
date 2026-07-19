import { safeStorage } from 'electron'
import { getDb } from '../database'

export const SETTING_KEYS = {
  username: 'chesscom_username',
  apiKeyEnc: 'anthropic_api_key_enc',
  engineDepth: 'engine_depth',
  enginePoolSize: 'engine_pool_size',
  enginePath: 'stockfish_path',
  modelPerGame: 'model_per_game',
  modelStyleReport: 'model_style_report',
  autoCoach: 'auto_coach'
} as const

export const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.engineDepth]: '16',
  [SETTING_KEYS.enginePoolSize]: '2',
  [SETTING_KEYS.modelPerGame]: 'claude-haiku-4-5',
  [SETTING_KEYS.modelStyleReport]: 'claude-sonnet-5',
  [SETTING_KEYS.autoCoach]: 'false'
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    { value: string } | undefined
  return row?.value ?? DEFAULTS[key] ?? null
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, value)
}

export function deleteSetting(key: string): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(key)
}

// API key is encrypted at rest with the OS keychain-backed safeStorage.
export function setApiKey(plaintext: string): void {
  if (!plaintext) {
    deleteSetting(SETTING_KEYS.apiKeyEnc)
    return
  }
  const enc = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(plaintext).toString('base64')
    : Buffer.from(plaintext, 'utf8').toString('base64')
  setSetting(SETTING_KEYS.apiKeyEnc, enc)
}

export function getApiKey(): string | null {
  const enc = getSetting(SETTING_KEYS.apiKeyEnc)
  if (!enc) return null
  const buf = Buffer.from(enc, 'base64')
  try {
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf8')
  } catch {
    return null
  }
}

export function hasApiKey(): boolean {
  return getApiKey() !== null
}
