// Compact live opening detection: longest SAN-prefix match wins.
// Covers the openings common at club level (and everything in the learn tab).

const NAMES: [string, string][] = [
  // 1.e4 e5
  ['e4 e5', "King's Pawn Game"],
  ['e4 e5 Nf3', "King's Knight Opening"],
  ['e4 e5 Nf3 Nc6', 'Open Game'],
  ['e4 e5 Nf3 Nc6 Bc4', 'Italian Game'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5', 'Italian: Giuoco Piano'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5 c3', 'Giuoco Piano: Main Line'],
  ['e4 e5 Nf3 Nc6 Bc4 Nf6', 'Italian: Two Knights Defense'],
  ['e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5', 'Two Knights: Knight Attack'],
  ['e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7', 'Fried Liver Attack'],
  ['e4 e5 Nf3 Nc6 Bb5', 'Ruy Lopez'],
  ['e4 e5 Nf3 Nc6 Bb5 a6', 'Ruy Lopez: Morphy Defense'],
  ['e4 e5 Nf3 Nc6 d4', 'Scotch Game'],
  ['e4 e5 Nf3 Nf6', "Petrov's Defense"],
  ['e4 e5 Nc3', 'Vienna Game'],
  ['e4 e5 Nc3 Nf6 f4', 'Vienna Gambit'],
  ['e4 e5 f4', "King's Gambit"],
  ['e4 e5 f4 exf4', "King's Gambit Accepted"],
  ['e4 e5 Bc4', "Bishop's Opening"],
  ['e4 e5 Qh5', 'Wayward Queen Attack'],
  // 1.e4 others
  ['e4 c5', 'Sicilian Defense'],
  ['e4 c5 Nf3 d6', 'Sicilian: Open (…d6)'],
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'Sicilian: Najdorf'],
  ['e4 c5 Nf3 Nc6', 'Sicilian: Old Sicilian'],
  ['e4 c5 Nf3 e6', 'Sicilian: French Variation'],
  ['e4 c5 c3', 'Sicilian: Alapin'],
  ['e4 c5 Nc3', 'Sicilian: Closed'],
  ['e4 c6', 'Caro-Kann Defense'],
  ['e4 c6 d4 d5', 'Caro-Kann: Main Line'],
  ['e4 c6 d4 d5 e5', 'Caro-Kann: Advance'],
  ['e4 e6', 'French Defense'],
  ['e4 e6 d4 d5 e5', 'French: Advance'],
  ['e4 e6 d4 d5 Nc3', 'French: Main Line'],
  ['e4 d5', 'Scandinavian Defense'],
  ['e4 d5 exd5 Qxd5', 'Scandinavian: Main Line'],
  ['e4 d5 exd5 Nf6', 'Scandinavian: Modern'],
  ['e4 d6', 'Pirc Defense'],
  ['e4 g6', 'Modern Defense'],
  ['e4 Nf6', "Alekhine's Defense"],
  // 1.d4
  ['d4 d5', "Queen's Pawn Game"],
  ['d4 d5 c4', "Queen's Gambit"],
  ['d4 d5 c4 e6', "Queen's Gambit Declined"],
  ['d4 d5 c4 dxc4', "Queen's Gambit Accepted"],
  ['d4 d5 c4 c6', 'Slav Defense'],
  ['d4 d5 Bf4', 'London System'],
  ['d4 d5 Nf3 Nf6 Bf4', 'London System'],
  ['d4 Nf6', 'Indian Defense'],
  ['d4 Nf6 c4 g6', "King's Indian Defense"],
  ['d4 Nf6 c4 g6 Nc3 d5', 'Grünfeld Defense'],
  ['d4 Nf6 c4 e6', 'Indian: East Indian'],
  ['d4 Nf6 c4 e6 g3', 'Catalan Opening'],
  ['d4 Nf6 c4 e6 Nc3 Bb4', 'Nimzo-Indian Defense'],
  ['d4 Nf6 Bf4', 'London System'],
  ['d4 f5', 'Dutch Defense'],
  // flank
  ['c4', 'English Opening'],
  ['Nf3', 'Réti Opening'],
  ['f4', "Bird's Opening"],
  ['b3', 'Nimzo-Larsen Attack']
]

// Sorted once by prefix length (longest first) for longest-match lookup.
const SORTED = [...NAMES].sort((a, b) => b[0].length - a[0].length)

export function nameOpening(sans: string[]): string | null {
  const line = sans.join(' ')
  for (const [prefix, name] of SORTED) {
    if (line === prefix || line.startsWith(prefix + ' ')) return name
  }
  return null
}
