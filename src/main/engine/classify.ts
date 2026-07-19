// Pure math for move classification and accuracy — no I/O, unit-testable.
// Evals here are centipawns from the MOVER's point of view unless noted.

import type { Classification } from '../../shared/types'

export const MATE_CP = 10000

// Thresholds are exported so they can be tuned against known chess.com reviews.
export const THRESHOLDS = {
  bestEvalTolerance: 5, // cp within engine best still counts as "best"
  excellentDrop: 2, // win-prob percentage points
  goodDrop: 5,
  inaccuracyDrop: 10,
  mistakeDrop: 20,
  inaccuracyCpLoss: 50,
  mistakeCpLoss: 100,
  blunderCpLoss: 300,
  alreadyLostWinProb: 5,
  brilliantSecondBestGap: 150
}

export interface Score {
  cp: number | null
  mate: number | null // positive = side to move mates in N
}

/** Convert an engine score (side-to-move POV) to a single cp number. */
export function scoreToCp(score: Score): number {
  if (score.mate !== null) {
    return score.mate > 0 ? MATE_CP - score.mate : -MATE_CP - score.mate
  }
  return score.cp ?? 0
}

/** Lichess's fitted logistic: win probability (0..100) for the side the cp is from. */
export function winProb(cp: number): number {
  const clamped = Math.max(-MATE_CP, Math.min(MATE_CP, cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1)
}

/** Lichess per-move accuracy from win-prob before/after (both mover POV). */
export function moveAccuracy(winProbBefore: number, winProbAfter: number): number {
  const drop = Math.max(0, winProbBefore - winProbAfter)
  const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669
  return Math.max(0, Math.min(100, raw))
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0.5
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
}

/**
 * Game accuracy for one player: mean of a volatility-weighted mean and a harmonic
 * mean of that player's per-move accuracies (mirrors Lichess's approach, which
 * tracks chess.com's numbers closely).
 *
 * @param accuracies per-move accuracies for this player's moves, in game order
 * @param windowWinProbs white-POV win probabilities across the whole game (used
 *   to weight volatile positions more heavily)
 * @param moveIndices index into windowWinProbs for each of this player's moves
 */
export function gameAccuracy(
  accuracies: number[],
  windowWinProbs: number[],
  moveIndices: number[]
): number {
  if (accuracies.length === 0) return 100
  const windowSize = Math.max(2, Math.min(8, windowWinProbs.length))
  const weights = moveIndices.map((idx) => {
    const start = Math.max(0, idx - windowSize + 1)
    const window = windowWinProbs.slice(start, idx + 2)
    return Math.max(0.5, Math.min(12, stddev(window)))
  })
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const weighted = accuracies.reduce((s, a, i) => s + a * weights[i], 0) / weightSum
  const harmonic = accuracies.length / accuracies.reduce((s, a) => s + 1 / Math.max(a, 1e-6), 0)
  return Math.max(0, Math.min(100, (weighted + harmonic) / 2))
}

export interface ClassifyInput {
  isBestMove: boolean
  cpLoss: number
  winProbBefore: number // mover POV
  winProbAfter: number // mover POV
  isBook: boolean
  /** For brilliancy detection (optional, v2): move sacrifices material and 2nd best is much worse. */
  isSacrifice?: boolean
  secondBestGapCp?: number
}

export function classify(input: ClassifyInput): Classification {
  const T = THRESHOLDS
  if (input.isBook) return 'book'
  const drop = input.winProbBefore - input.winProbAfter

  if (input.isBestMove || input.cpLoss <= T.bestEvalTolerance) {
    if (
      input.isSacrifice &&
      (input.secondBestGapCp ?? 0) >= T.brilliantSecondBestGap &&
      input.winProbAfter > 30
    ) {
      return 'brilliant'
    }
    return 'best'
  }

  // Nothing left to lose: don't pile blunders onto dead-lost positions.
  const alreadyLost = input.winProbBefore < T.alreadyLostWinProb

  if (!alreadyLost) {
    if (drop >= T.mistakeDrop || (input.cpLoss >= T.blunderCpLoss && input.winProbAfter < 90)) {
      return 'blunder'
    }
    if (drop >= T.inaccuracyDrop && input.cpLoss >= T.mistakeCpLoss) return 'mistake'
  }
  if (drop >= T.goodDrop && input.cpLoss >= T.inaccuracyCpLoss) return 'inaccuracy'
  if (drop < T.excellentDrop) return 'excellent'
  return 'good'
}
