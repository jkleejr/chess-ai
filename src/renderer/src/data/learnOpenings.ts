// Curated openings to learn, with main lines the user can step through.
// Chosen for a ~1000-rated attacking player: sound, plan-driven, low-theory.

export interface LearnOpening {
  name: string
  eco: string
  color: 'white' | 'black'
  line: string[] // SAN main line
  summary: string
  ideas: string[]
}

export const LEARN_OPENINGS: LearnOpening[] = [
  // ---- as Black ----
  {
    name: 'Sicilian Defense',
    eco: 'B90',
    color: 'black',
    line: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    summary:
      "Black's most ambitious answer to 1.e4: trade your c-pawn for White's d-pawn and attack down the half-open c-file. Sharp and fighting — a great fit for your attacking style.",
    ideas: [
      'Never let White keep a free pawn center — strike it with ...cxd4 and later ...e5 or ...d5',
      'Your counterplay lives on the c-file: ...Rc8, ...Qc7, pressure on c2',
      '...a6 stops Nb5/Bb5 tricks and prepares ...e5 or ...b5 expansion',
      'Develop the f8-bishop with ...e5/...Be7 or fianchetto plans before castling'
    ]
  },
  {
    name: 'Caro-Kann Defense',
    eco: 'B13',
    color: 'black',
    line: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6', 'h4', 'h6', 'Nf3', 'Nd7'],
    summary:
      'The solid alternative to the Sicilian: challenge e4 with ...d5 while keeping your light-squared bishop active — a common French problem solved.',
    ideas: [
      'Get the c8-bishop OUT (to f5/g4) before playing ...e6',
      'Your structure is rock-solid; trade into endgames happily',
      'Watch for h4-h5 chasing your bishop — meet h4 with ...h6',
      'Standard plan: ...e6, ...Ngf6, ...Be7, castle short, break with ...c5'
    ]
  },
  {
    name: 'French Defense (Advance)',
    eco: 'C02',
    color: 'black',
    line: ['e4', 'e6', 'd4', 'd5', 'e5', 'c5', 'c3', 'Nc6', 'Nf3', 'Qb6'],
    summary:
      'Invite White to grab space with e5, then chip the pawn chain down with ...c5 and heavy pressure on d4. Counterattacking chess with clear plans.',
    ideas: [
      'The d4 pawn is your target: pile up with ...c5, ...Nc6, ...Qb6, sometimes ...Nh6-f5',
      'Your bad bishop on c8 — plan ...Bd7-b5 trades or a later ...b6/...Ba6',
      'If the center locks, play on the queenside with ...c4 and ...b5-b4',
      'Do not open the f-file for White by careless ...f6 too early'
    ]
  },
  {
    name: 'Queen\'s Gambit Declined',
    eco: 'D37',
    color: 'black',
    line: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'Be7', 'Bg5', 'O-O', 'e3', 'Nbd7'],
    summary:
      'Your answer to 1.d4: hold the center with ...d5/...e6, develop simply, castle, and free your game with ...c5 or ...dxc4 at the right moment.',
    ideas: [
      'Keep d5 defended; never let White get e4 for free',
      'The freeing breaks are ...c5 and ...dxc4 followed by ...b5/...c5',
      'Solve the c8-bishop with ...b6 and ...Bb7 once the center is stable',
      'Typical piece setup: ...Be7, ...O-O, ...Nbd7, ...Re8'
    ]
  },
  {
    name: 'King\'s Indian Defense',
    eco: 'E97',
    color: 'black',
    line: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7'],
    summary:
      'The ultimate counterattacking defense to 1.d4: give White the center, castle fast, then launch the kingside pawn storm. Made for an attacking player.',
    ideas: [
      'Let White build the center — your g7-bishop and ...e5 strike back at it',
      'The famous plan: after d5 closes the center, play ...f5, ...f4, then ...g5-g4 storming the king',
      'White attacks the queenside, you attack the KING — speed decides, so never waste a move',
      'Keep the g7-bishop: it defends your king and wins endgames'
    ]
  },
  // ---- as White ----
  {
    name: 'Italian Game',
    eco: 'C54',
    color: 'white',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O'],
    summary:
      'The classical attacking start: quick development, a bishop eyeing f7, and a slow pawn storm with c3-d4. More sound than early-queen attacks, same aggressive spirit.',
    ideas: [
      'c3 + d4 builds the big center by force — that is the whole plan',
      'Keep the c4-bishop pointed at f7; reroute with Bb3/Bc2 when hit',
      'Typical attack: Re1, Nbd2-f1-g3, then Ng5 or d4-d5 and kingside play',
      'Do not rush Ng5 unless f7 really hangs — develop first'
    ]
  },
  {
    name: 'Scotch Game',
    eco: 'C45',
    color: 'white',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nxc6', 'bxc6', 'e5', 'Qe7', 'Qe2', 'Nd5'],
    summary:
      'Open the center on move 3 and fight in an open game immediately — forcing, concrete, and much less theory than the Ruy Lopez.',
    ideas: [
      'You get a lead in development; open files favor the better-developed side',
      'After Nxc6 bxc6 Black\'s pawns are damaged — trade into endgames happily',
      'Watch the e5 push: it gains space and kicks the f6-knight',
      'Common motifs: Ba3 pinning, c4 hitting the d5-knight'
    ]
  },
  {
    name: 'Vienna Gambit (your weapon, sharpened)',
    eco: 'C29',
    color: 'white',
    line: ['e4', 'e5', 'Nc3', 'Nf6', 'f4', 'd5', 'exd5', 'Nxd5', 'fxe5', 'Nxc3', 'bxc3', 'Qh4+', 'g3', 'Qe4+', 'Qe2', 'Qxe2+', 'Bxe2'],
    summary:
      'You already play the Vienna — this is the critical main line so the ...d5 counter never surprises you again. Know this sequence and the gambit is a real weapon.',
    ideas: [
      'Against 3...d5 (the best reply): exd5 first, THEN deal with the center',
      'The Qh4+ check looks scary but trades queens into a fine endgame for you',
      'If Black plays 3...exf4 instead, push e5! hitting the knight — that is the point',
      'Half-open f-file + quick O-O (or O-O-O) is your attacking engine'
    ]
  },
  {
    name: 'Ruy Lopez',
    eco: 'C84',
    color: 'white',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O'],
    summary:
      'The king of 1.e4 openings: pressure e5 through the c6-knight, castle fast, and outplay Black slowly. Deeper than the Italian, and it teaches real chess.',
    ideas: [
      'Bb5 pressures the defender of e5 — the threat to win the pawn comes AFTER you protect e4',
      'The bishop retreats Ba4/Bb3 keep it alive; it becomes a monster on the a2-g8 diagonal',
      'Classic maneuver: Nb1-d2-f1-g3 rerouting to the kingside before you attack',
      'c3 + d4 builds the big center when you are ready — never rush d4'
    ]
  },
  {
    name: 'Fried Liver Attack',
    eco: 'C57',
    color: 'white',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+', 'Ke6', 'Nc3'],
    summary:
      'The most violent attack in the Italian: sacrifice the knight on f7 and drag Black\'s king into the center. Pure attacking chess — exactly your style.',
    ideas: [
      'The sac only works after 5...Nxd5 — if Black knows 5...Na5 you play d3 and are still fine',
      'After Qf3+ Ke6 pile EVERYTHING on the pinned d5-knight: Nc3, Re1(after O-O), d4',
      'Black\'s king on e6 means every open line is worth more than material',
      'If Black avoids it with 4...Bc5, the Ng5 ideas still hover over f7'
    ]
  },
  {
    name: 'Catalan Opening',
    eco: 'E04',
    color: 'white',
    line: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Be7', 'Nf3', 'O-O', 'O-O', 'dxc4', 'Qc2', 'a6', 'Qxc4', 'b5', 'Qc2', 'Bb7'],
    summary:
      'Queen\'s Gambit with a fianchetto: the g2-bishop bears down the long diagonal all game. Positional pressure that wins endgames by itself — a favorite of world champions.',
    ideas: [
      'The g2-bishop is the whole opening — never block or trade it carelessly',
      'If Black grabs c4, you calmly win it back (Qc2/Ne5/a4) with lasting pressure',
      'Typical squares: Nf3, Nbd2 or Nc3, Rd1/Rc1, Qc2 — then push e4 or a4',
      'Endgames favor you: the long-diagonal bishop and queenside pressure persist'
    ]
  },
  {
    name: 'Queen\'s Gambit',
    eco: 'D35',
    color: 'white',
    line: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'cxd5', 'exd5', 'Bg5', 'c6', 'e3', 'Be7', 'Bd3', 'Nbd7', 'Qc2', 'O-O'],
    summary:
      'The classical 1.d4 weapon: offer the c-pawn to pull Black\'s center apart. This Exchange line gives you a clear structure and a famous long-term plan — the minority attack.',
    ideas: [
      'The "gambit" is rarely kept — if Black takes on c4, you win the pawn back with e3/e4 and Bxc4',
      'In the Exchange structure your plan is the minority attack: b4-b5 to create a weak c6 pawn',
      'Pieces belong on: Bg5, Bd3, Nf3 or Nge2, Qc2, rooks on b1/c1',
      'Alternative plan: f3 + e4 building the big center — pick one plan and commit'
    ]
  },
  {
    name: 'London System',
    eco: 'D02',
    color: 'white',
    line: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'c5', 'c3', 'Nc6', 'Nbd2', 'Bd6', 'Bg3', 'O-O'],
    summary:
      'A low-theory system you can play against nearly anything Black tries: same solid setup every game, then attack once development is done.',
    ideas: [
      'Setup order matters: d4, Bf4 (before e3!), e3, Nf3, c3, Nbd2, Bd3',
      'Your attacking plan: Ne5, f4 (the "London stonewall"), then Rf3-h3 lifts',
      'Meet ...Qb6 hitting b2 with Qb3 or Rb1 — do not panic',
      'Trade dark-squared bishops via Bg3 only when it helps you'
    ]
  }
]
