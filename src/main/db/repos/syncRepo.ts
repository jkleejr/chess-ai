import { getDb } from '../database'

export interface ArchiveState {
  etag: string | null
  isComplete: boolean
}

export function getArchiveState(archiveUrl: string): ArchiveState | null {
  const row = getDb()
    .prepare('SELECT etag, is_complete FROM sync_state WHERE archive_url = ?')
    .get(archiveUrl) as { etag: string | null; is_complete: number } | undefined
  return row ? { etag: row.etag, isComplete: !!row.is_complete } : null
}

export function saveArchiveState(
  archiveUrl: string,
  etag: string | null,
  isComplete: boolean
): void {
  getDb()
    .prepare(
      `INSERT INTO sync_state (archive_url, etag, last_synced_at, is_complete)
       VALUES (?, ?, unixepoch(), ?)
       ON CONFLICT(archive_url) DO UPDATE SET
         etag = excluded.etag, last_synced_at = excluded.last_synced_at, is_complete = excluded.is_complete`
    )
    .run(archiveUrl, etag, isComplete ? 1 : 0)
}

export function clearSyncState(): void {
  getDb().prepare('DELETE FROM sync_state').run()
}
