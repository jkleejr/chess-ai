import { useState } from 'react'
import { useAppStore } from '../stores/appStore'

export default function Onboarding(): React.JSX.Element {
  const [input, setInput] = useState('')
  const { syncProgress, startSync, refreshSettings } = useAppStore()
  const syncing =
    syncProgress !== null && syncProgress.phase !== 'done' && syncProgress.phase !== 'error'

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const name = input.trim()
    if (!name) return
    await startSync(name)
  }

  // Once the sync finishes the username setting exists → App switches to the shell.
  if (syncProgress?.phase === 'done') {
    void refreshSettings()
  }

  return (
    <div className="onboarding">
      <div className="card">
        <h1>
          Welcome to Chess<span style={{ color: 'var(--accent)' }}>Coach</span>
        </h1>
        <p className="muted">
          Your personal AI chess coach. Enter your chess.com username and every game you have
          played will be downloaded, analyzed by Stockfish, and coached by Claude.
        </p>
        <form onSubmit={submit}>
          <input
            autoFocus
            placeholder="chess.com username"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={syncing}
            spellCheck={false}
          />
          <button className="primary" type="submit" disabled={syncing || !input.trim()}>
            {syncing ? 'Syncing…' : 'Start'}
          </button>
        </form>
        {syncProgress && (
          <div className="progress-area">
            {syncing && (
              <>
                <progress
                  max={syncProgress.archiveTotal || 1}
                  value={syncProgress.archiveIndex}
                />
                <div className="faint">
                  Archive {syncProgress.archiveIndex}/{syncProgress.archiveTotal || '…'} —{' '}
                  {syncProgress.gamesInserted} games downloaded
                </div>
              </>
            )}
            {syncProgress.phase === 'error' && (
              <div className="error-text">{syncProgress.message}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
