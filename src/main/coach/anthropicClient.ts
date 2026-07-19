import Anthropic from '@anthropic-ai/sdk'
import { getApiKey } from '../db/repos/settingsRepo'

let client: Anthropic | null = null
let clientKey: string | null = null

export class NoApiKeyError extends Error {
  constructor() {
    super('No Anthropic API key configured — add one in Settings')
  }
}

export function getClient(): Anthropic {
  const key = getApiKey()
  if (!key) throw new NoApiKeyError()
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key })
    clientKey = key
  }
  return client
}

// $/MTok — used only for the local cost dashboard.
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 5, output: 25 }
}

export interface UsageLike {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

export function computeCostUsd(model: string, usage: UsageLike): number {
  const p = PRICING[model] ?? { input: 5, output: 25 }
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  return (
    (usage.input_tokens * p.input +
      cacheRead * p.input * 0.1 +
      cacheWrite * p.input * 1.25 +
      usage.output_tokens * p.output) /
    1_000_000
  )
}

/** Cheap connectivity/key check: one tiny haiku request. */
export async function testApiKey(): Promise<{ ok: boolean; error?: string }> {
  try {
    const c = getClient()
    await c.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'ping' }]
    })
    return { ok: true }
  } catch (e) {
    if (e instanceof NoApiKeyError) return { ok: false, error: e.message }
    if (e instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: 'Invalid API key' }
    }
    if (e instanceof Anthropic.APIConnectionError) {
      return { ok: false, error: 'Could not reach the Anthropic API — check your connection' }
    }
    return { ok: false, error: (e as Error).message }
  }
}
