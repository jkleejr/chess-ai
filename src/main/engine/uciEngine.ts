import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createInterface } from 'readline'
import type { Score } from './classify'

export interface EvalResult {
  score: Score // side-to-move POV
  bestMoveUci: string | null
  pv: string[] // principal variation in UCI
}

/**
 * Wraps one Stockfish child process speaking UCI. Commands are serialized via
 * an internal promise chain so callers can share an instance safely.
 */
export class UciEngine {
  private proc: ChildProcessWithoutNullStreams
  private queue: Promise<unknown> = Promise.resolve()
  private lineHandlers: ((line: string) => void)[] = []
  public dead = false
  public version = ''

  constructor(binaryPath: string) {
    // Run at low CPU priority so analysis never competes with the user's
    // foreground work. `nice` execs the engine, so the pid stays stockfish's.
    this.proc =
      process.platform === 'darwin' || process.platform === 'linux'
        ? spawn('/usr/bin/nice', ['-n', '15', binaryPath], { stdio: ['pipe', 'pipe', 'pipe'] })
        : spawn(binaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.proc.on('exit', () => {
      this.dead = true
    })
    this.proc.on('error', () => {
      this.dead = true
    })
    const rl = createInterface({ input: this.proc.stdout })
    rl.on('line', (line) => {
      for (const h of [...this.lineHandlers]) h(line)
    })
  }

  private send(cmd: string): void {
    if (this.dead) throw new Error('engine process is dead')
    this.proc.stdin.write(cmd + '\n')
  }

  /** Wait for a line matching `match`, collecting info lines along the way. */
  private waitFor(
    match: (line: string) => boolean,
    onLine?: (line: string) => void,
    timeoutMs = 120000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('engine timeout'))
      }, timeoutMs)
      const onExit = (): void => {
        cleanup()
        reject(new Error('engine died'))
      }
      const handler = (line: string): void => {
        onLine?.(line)
        if (match(line)) {
          cleanup()
          resolve(line)
        }
      }
      const cleanup = (): void => {
        clearTimeout(timer)
        this.lineHandlers = this.lineHandlers.filter((h) => h !== handler)
        this.proc.off('exit', onExit)
      }
      this.lineHandlers.push(handler)
      this.proc.once('exit', onExit)
    })
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn)
    this.queue = next.catch(() => undefined)
    return next
  }

  init(threads = 1, hashMb = 64): Promise<void> {
    return this.run(async () => {
      const idPromise = this.waitFor(
        (l) => l === 'uciok',
        (l) => {
          if (l.startsWith('id name ')) this.version = l.slice('id name '.length)
        }
      )
      this.send('uci')
      await idPromise
      this.send(`setoption name Threads value ${threads}`)
      this.send(`setoption name Hash value ${hashMb}`)
      const ready = this.waitFor((l) => l === 'readyok')
      this.send('isready')
      await ready
    })
  }

  /** Evaluate a FEN at fixed depth. Score is from the side to move's POV. */
  evaluate(fen: string, depth: number): Promise<EvalResult> {
    return this.run(async () => {
      let lastInfo: { score: Score; pv: string[] } | null = null
      const done = this.waitFor(
        (l) => l.startsWith('bestmove'),
        (l) => {
          if (!l.startsWith('info ') || !l.includes(' score ')) return
          const score = parseScore(l)
          const pv = parsePv(l)
          if (score) lastInfo = { score, pv }
        }
      )
      this.send(`position fen ${fen}`)
      this.send(`go depth ${depth}`)
      const bestLine = await done
      const bestMove = bestLine.split(/\s+/)[1]
      const info = lastInfo as { score: Score; pv: string[] } | null
      return {
        score: info?.score ?? { cp: 0, mate: null },
        bestMoveUci: bestMove && bestMove !== '(none)' ? bestMove : null,
        pv: info?.pv ?? []
      }
    })
  }

  quit(): void {
    if (this.dead) return
    try {
      this.send('quit')
    } catch {
      // already gone
    }
    const proc = this.proc
    setTimeout(() => {
      if (!this.dead) proc.kill('SIGKILL')
    }, 1000)
  }
}

function parseScore(infoLine: string): Score | null {
  const m = infoLine.match(/ score (cp|mate) (-?\d+)/)
  if (!m) return null
  return m[1] === 'cp'
    ? { cp: parseInt(m[2], 10), mate: null }
    : { cp: null, mate: parseInt(m[2], 10) }
}

function parsePv(infoLine: string): string[] {
  const idx = infoLine.indexOf(' pv ')
  if (idx === -1) return []
  return infoLine
    .slice(idx + 4)
    .trim()
    .split(/\s+/)
}
