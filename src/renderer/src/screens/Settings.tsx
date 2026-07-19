import { useEffect, useState } from 'react'
import type { EngineStatus } from '../../../shared/types'
import { api, events } from '../api'
import { useAppStore } from '../stores/appStore'

export default function Settings(): React.JSX.Element {
  const { refreshSettings } = useAppStore()
  const [username, setUsername] = useState('')
  const [apiKey, setApiKeyInput] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [keyStatus, setKeyStatus] = useState<{ ok: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [depth, setDepth] = useState('16')
  const [autoCoach, setAutoCoach] = useState(false)
  const [modelPerGame, setModelPerGame] = useState('claude-haiku-4-5')
  const [modelReport, setModelReport] = useState('claude-sonnet-5')
  const [engine, setEngine] = useState<EngineStatus | null>(null)
  const [settingUp, setSettingUp] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      const [u, hk, d, ac, mg, mr, es] = await Promise.all([
        api.getSetting('chesscom_username'),
        api.hasApiKey(),
        api.getSetting('engine_depth'),
        api.getSetting('auto_coach'),
        api.getSetting('model_per_game'),
        api.getSetting('model_style_report'),
        api.engineStatus()
      ])
      setUsername(u ?? '')
      setHasKey(hk)
      setDepth(d ?? '16')
      setAutoCoach(ac === 'true')
      setModelPerGame(mg ?? 'claude-haiku-4-5')
      setModelReport(mr ?? 'claude-sonnet-5')
      setEngine(es)
    })()
    return events.onEngineStatus(setEngine)
  }, [])

  const save = async (): Promise<void> => {
    await api.setSetting('chesscom_username', username.trim())
    await api.setSetting('engine_depth', depth)
    await api.setSetting('auto_coach', String(autoCoach))
    await api.setSetting('model_per_game', modelPerGame)
    await api.setSetting('model_style_report', modelReport)
    if (apiKey.trim()) {
      await api.setApiKey(apiKey.trim())
      setApiKeyInput('')
      setHasKey(true)
      setKeyStatus(null)
    }
    await refreshSettings()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testKey = async (): Promise<void> => {
    setTesting(true)
    if (apiKey.trim()) {
      await api.setApiKey(apiKey.trim())
      setApiKeyInput('')
      setHasKey(true)
    }
    setKeyStatus(await api.testApiKey())
    setTesting(false)
  }

  const setupEngine = async (): Promise<void> => {
    setSettingUp(true)
    const res = await api.engineSetup()
    setEngine(res)
    setSettingUp(false)
  }

  return (
    <div>
      <h1>Settings</h1>
      <div className="settings-form">
        <div className="field">
          <label>chess.com username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} spellCheck={false} />
          <span className="faint">Changing this keeps existing games; new syncs use the new name.</span>
        </div>

        <div className="field">
          <label>Anthropic API key</label>
          <div className="row">
            <input
              type="password"
              placeholder={hasKey ? '•••••••• (key saved)' : 'sk-ant-…'}
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
              spellCheck={false}
            />
            <button onClick={() => void testKey()} disabled={testing || (!apiKey.trim() && !hasKey)}>
              {testing ? 'Testing…' : 'Test'}
            </button>
          </div>
          {keyStatus &&
            (keyStatus.ok ? (
              <span className="ok-text">✓ Key works</span>
            ) : (
              <span className="error-text">{keyStatus.error}</span>
            ))}
          <span className="faint">
            Stored encrypted in your macOS keychain. Used only for coaching calls.
          </span>
        </div>

        <div className="field">
          <label>Stockfish engine</label>
          {engine?.state === 'ready' ? (
            <span className="ok-text">
              ✓ {engine.version} <span className="faint">({engine.path})</span>
            </span>
          ) : engine?.state === 'downloading' ? (
            <span>
              <span className="spinner" /> Downloading… {engine.downloadPct ?? 0}%
            </span>
          ) : (
            <div className="row">
              <span className="error-text" style={{ alignSelf: 'center' }}>
                Not found{engine?.message ? ` — ${engine.message}` : ''}
              </span>
              <button className="primary" onClick={() => void setupEngine()} disabled={settingUp}>
                {settingUp ? 'Setting up…' : 'Download Stockfish'}
              </button>
            </div>
          )}
        </div>

        <div className="field">
          <label>Engine depth: {depth}</label>
          <input
            type="range"
            min={12}
            max={24}
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
          />
          <span className="faint">
            Higher = more accurate but slower. Depth {depth} ≈{' '}
            {Number(depth) <= 14 ? 'fast' : Number(depth) <= 18 ? 'balanced' : 'slow, strongest'}.
            Already-analyzed games are not re-analyzed.
          </span>
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={autoCoach}
              onChange={(e) => setAutoCoach(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Auto-coach every game after analysis (~$0.01/game)
          </label>
        </div>

        <div className="field">
          <label>Per-game coach model</label>
          <select value={modelPerGame} onChange={(e) => setModelPerGame(e.target.value)}>
            <option value="claude-haiku-4-5">Claude Haiku 4.5 — cheapest (~$0.01/game)</option>
            <option value="claude-sonnet-5">Claude Sonnet 5 — smarter (~$0.03/game)</option>
          </select>
        </div>

        <div className="field">
          <label>Style report model</label>
          <select value={modelReport} onChange={(e) => setModelReport(e.target.value)}>
            <option value="claude-sonnet-5">Claude Sonnet 5 — recommended (~$0.15/report)</option>
            <option value="claude-opus-4-8">Claude Opus 4.8 — deepest (~$0.40/report)</option>
          </select>
        </div>

        <div>
          <button className="primary" onClick={() => void save()}>
            Save settings
          </button>
          {saved && <span className="ok-text" style={{ marginLeft: 10 }}>Saved ✓</span>}
        </div>
      </div>
    </div>
  )
}
