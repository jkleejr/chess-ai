import { describe, expect, it } from 'vitest'
import {
  classify,
  gameAccuracy,
  moveAccuracy,
  scoreToCp,
  winProb
} from '../src/main/engine/classify'
import { bookPlyCount } from '../src/main/engine/openingBook'

describe('winProb', () => {
  it('is 50% at equality', () => {
    expect(winProb(0)).toBeCloseTo(50, 5)
  })
  it('is ~59% at +100cp', () => {
    expect(winProb(100)).toBeGreaterThan(58)
    expect(winProb(100)).toBeLessThan(60)
  })
  it('approaches 100% for mate scores', () => {
    expect(winProb(scoreToCp({ cp: null, mate: 3 }))).toBeGreaterThan(99.9)
    expect(winProb(scoreToCp({ cp: null, mate: -3 }))).toBeLessThan(0.1)
  })
  it('is symmetric', () => {
    expect(winProb(150) + winProb(-150)).toBeCloseTo(100, 5)
  })
})

describe('moveAccuracy', () => {
  it('is ~100 for no drop', () => {
    expect(moveAccuracy(50, 50)).toBeGreaterThan(99)
  })
  it('decreases with drop size', () => {
    expect(moveAccuracy(70, 50)).toBeLessThan(moveAccuracy(70, 65))
  })
  it('improving positions score full marks', () => {
    expect(moveAccuracy(40, 60)).toBeGreaterThan(99)
  })
})

describe('classify', () => {
  const base = { isBestMove: false, isBook: false }
  it('book moves are book', () => {
    expect(classify({ ...base, isBook: true, cpLoss: 0, winProbBefore: 50, winProbAfter: 50 })).toBe(
      'book'
    )
  })
  it('engine best move is best', () => {
    expect(
      classify({ ...base, isBestMove: true, cpLoss: 0, winProbBefore: 50, winProbAfter: 50 })
    ).toBe('best')
  })
  it('a 25-point win-prob drop is a blunder', () => {
    expect(classify({ ...base, cpLoss: 350, winProbBefore: 55, winProbAfter: 30 })).toBe('blunder')
  })
  it('a 12-point drop with 150cp loss is a mistake', () => {
    expect(classify({ ...base, cpLoss: 150, winProbBefore: 60, winProbAfter: 48 })).toBe('mistake')
  })
  it('a 6-point drop with 60cp loss is an inaccuracy', () => {
    expect(classify({ ...base, cpLoss: 60, winProbBefore: 55, winProbAfter: 49 })).toBe(
      'inaccuracy'
    )
  })
  it('tiny drops are excellent', () => {
    expect(classify({ ...base, cpLoss: 10, winProbBefore: 50, winProbAfter: 49.5 })).toBe(
      'excellent'
    )
  })
  it('already-lost guard caps severity', () => {
    expect(classify({ ...base, cpLoss: 500, winProbBefore: 3, winProbAfter: 0.5 })).not.toBe(
      'blunder'
    )
  })
  it('big cp loss in winning position still blunder when it matters', () => {
    // +9 -> +2 : still winning but threw away most of the advantage with 700cp loss
    expect(classify({ ...base, cpLoss: 700, winProbBefore: 96, winProbAfter: 71 })).toBe('blunder')
  })
})

describe('gameAccuracy', () => {
  it('perfect game is ~100', () => {
    const acc = gameAccuracy([100, 100, 100], [50, 50, 50, 50], [0, 1, 2])
    expect(acc).toBeGreaterThan(99)
  })
  it('is bounded 0..100 and penalizes blunders', () => {
    const acc = gameAccuracy([100, 20, 100], [50, 50, 10, 10], [0, 1, 2])
    expect(acc).toBeLessThan(90)
    expect(acc).toBeGreaterThan(0)
  })
})

describe('bookPlyCount', () => {
  it('recognizes the Najdorf as book', () => {
    const najdorf = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']
    expect(bookPlyCount(najdorf)).toBe(10)
  })
  it('stops at the first deviation', () => {
    const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'h5']
    const count = bookPlyCount(sans)
    expect(count).toBeGreaterThanOrEqual(5)
    expect(count).toBeLessThan(6 + 1)
  })
  it('nonsense is not book', () => {
    expect(bookPlyCount(['a3', 'h6', 'a4', 'h5'])).toBeLessThanOrEqual(2)
  })
})
