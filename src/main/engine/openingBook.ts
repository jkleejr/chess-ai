// Opening-theory detection backed by the lichess chess-openings dataset
// (vendored as openings.json — one space-joined SAN sequence per named opening).

import openings from './openings.json'

const MAX_BOOK_PLIES = 20

let prefixSet: Set<string> | null = null

function buildPrefixSet(): Set<string> {
  const set = new Set<string>()
  for (const line of openings as string[]) {
    const sans = line.split(' ')
    let acc = ''
    for (let i = 0; i < Math.min(sans.length, MAX_BOOK_PLIES); i++) {
      acc = acc ? `${acc} ${sans[i]}` : sans[i]
      set.add(acc)
    }
  }
  return set
}

/** Number of leading plies of the game that are known opening theory. */
export function bookPlyCount(sans: string[]): number {
  if (!prefixSet) prefixSet = buildPrefixSet()
  let acc = ''
  let count = 0
  for (let i = 0; i < Math.min(sans.length, MAX_BOOK_PLIES); i++) {
    acc = acc ? `${acc} ${sans[i]}` : sans[i]
    if (prefixSet.has(acc)) count = i + 1
    else break
  }
  return count
}
