import { spawnSync } from 'child_process'
import { app } from 'electron'
import { createWriteStream } from 'fs'
import { chmod, mkdir, rename, rm, stat } from 'fs/promises'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import * as tar from 'tar'
import type { EngineStatus } from '../../shared/types'
import { getSetting, SETTING_KEYS } from '../db/repos/settingsRepo'

const RELEASE_TAG = 'sf_17.1'

function releaseAsset(): string {
  return process.arch === 'arm64'
    ? 'stockfish-macos-m1-apple-silicon.tar'
    : 'stockfish-macos-x86-64-avx2.tar'
}

function managedBinaryPath(): string {
  const name = releaseAsset().replace('.tar', '')
  return join(app.getPath('userData'), 'engines', name, name)
}

function probe(path: string): string | null {
  try {
    const res = spawnSync(path, [], {
      input: 'uci\nquit\n',
      encoding: 'utf8',
      timeout: 10000
    })
    const m = (res.stdout ?? '').match(/id name (.+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function which(cmd: string): string | null {
  const res = spawnSync('/usr/bin/which', [cmd], { encoding: 'utf8' })
  const out = res.stdout?.trim()
  return res.status === 0 && out ? out : null
}

/** Locate a usable stockfish binary without downloading. */
export async function locateStockfish(): Promise<EngineStatus> {
  // 1. explicit setting
  const configured = getSetting(SETTING_KEYS.enginePath)
  if (configured) {
    const version = probe(configured)
    if (version) return { state: 'ready', path: configured, version }
  }
  // 2. PATH (brew installs land in /opt/homebrew/bin or /usr/local/bin)
  for (const candidate of [
    which('stockfish'),
    '/opt/homebrew/bin/stockfish',
    '/usr/local/bin/stockfish'
  ]) {
    if (!candidate) continue
    const version = probe(candidate)
    if (version) return { state: 'ready', path: candidate, version }
  }
  // 3. previously downloaded copy
  const managed = managedBinaryPath()
  try {
    await stat(managed)
    const version = probe(managed)
    if (version) return { state: 'ready', path: managed, version }
  } catch {
    // not downloaded yet
  }
  return { state: 'not-found' }
}

/** Download the official Stockfish release for this Mac into userData/engines. */
export async function downloadStockfish(onProgress: (pct: number) => void): Promise<EngineStatus> {
  const asset = releaseAsset()
  const url = `https://github.com/official-stockfish/Stockfish/releases/download/${RELEASE_TAG}/${asset}`
  const enginesDir = join(app.getPath('userData'), 'engines')
  await mkdir(enginesDir, { recursive: true })
  const tarPath = join(enginesDir, asset)

  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) {
    return { state: 'error', message: `Download failed: HTTP ${res.status}` }
  }
  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0
  const progress = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength
      if (total > 0) onProgress(Math.round((received / total) * 100))
      controller.enqueue(chunk)
    }
  })
  const { Readable } = await import('stream')
  const nodeStream = Readable.fromWeb(res.body.pipeThrough(progress) as never)
  await pipeline(nodeStream, createWriteStream(tarPath))

  await tar.x({ file: tarPath, cwd: enginesDir })
  await rm(tarPath, { force: true })

  // The tar extracts to stockfish/<binary-name>; normalize location.
  const extractedDir = join(enginesDir, 'stockfish')
  const binName = asset.replace('.tar', '')
  const finalDir = join(enginesDir, binName)
  try {
    await rm(finalDir, { recursive: true, force: true })
    await rename(extractedDir, finalDir)
  } catch {
    // extraction layout may already match
  }
  const binPath = join(finalDir, binName)
  await chmod(binPath, 0o755)
  const version = probe(binPath)
  if (!version) return { state: 'error', message: 'Downloaded binary failed to start' }
  return { state: 'ready', path: binPath, version }
}
