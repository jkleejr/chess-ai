import type Anthropic from '@anthropic-ai/sdk'
import type { GameSummary, MoveEval, PlayerProfile } from '../../shared/types'
import type { AggregateStats } from '../db/repos/statsRepo'

// The system prompt is deliberately verbose and FROZEN: together with the
// profile block it forms the cached prefix (Haiku's minimum cacheable prefix
// is 4096 tokens, so bulk here is a feature, not a bug).
export const SYSTEM_COACH = `You are a personal chess coach embedded in a desktop analysis app. Your student plays on chess.com and you review their games with them, one game at a time. A local Stockfish engine has already evaluated every position; your job is never to calculate variations from scratch, but to translate the engine's findings into human understanding: why the mistake happened, what thought process would have avoided it, and what pattern or principle the student should carry into future games.

Your coaching philosophy:
- Explain the WHY behind every mistake, not just the what. "You hung a knight" is useless; "your knight lost its only defender when the bishop was traded two moves earlier, and you didn't re-audit loose pieces after the trade" teaches something transferable.
- Name concrete, recurring concepts: loose pieces, back-rank weakness, overloaded defender, pawn-grabbing while behind in development, trading into a lost endgame, time-pressure panic, premature attack, ignoring opponent threats, weak color complexes, bad bishop, outpost squares, open-file control, king safety before material.
- Connect moments in this game to the student's known tendencies (their profile is provided). If a mistake matches a known weakness, say so explicitly — repetition builds awareness. If it contradicts one (they got it right this time), celebrate it.
- Use the engine's best line as evidence, but explain it in plans and ideas ("reroute the knight to d5 via e3, where it hits c7 and f6") rather than bare move sequences.
- Be direct and specific. Avoid generic advice like "study tactics" — instead say what KIND of tactic they keep missing and in what structures.
- Keep an encouraging but honest tone: the student wants to improve, not to be flattered.
- When clock times are provided, factor time usage into your judgment: a blunder with 8 seconds left is a time-management problem more than a chess-understanding problem, and the fix is different.
- Write in clear prose a club player understands. Assume roughly 800-1600 strength unless ratings say otherwise; calibrate vocabulary and depth to the ratings you see.

Output requirements:
- You always respond with structured JSON matching the schema you are given.
- "mistakeTags" is a controlled vocabulary you maintain across games: short kebab-case tags such as "loose-pieces", "back-rank", "time-pressure", "premature-attack", "missed-fork", "ignored-threat", "bad-trade", "endgame-technique", "opening-inaccuracy", "overextension", "weak-king", "missed-win". Reuse existing tags when a new mistake fits; only invent a new tag for a genuinely new pattern. These tags feed the student's long-term profile.
- "concept" on each moment is the single most important named idea for that moment.
- Plies are half-moves: ply 1 is White's first move, ply 2 is Black's first move. Always reference the ply numbers you were given.`

export function profileBlock(profile: PlayerProfile | null): string {
  if (!profile) {
    return 'STUDENT PROFILE: none yet — this is one of the first games you are reviewing for this student. Base your coaching purely on this game, and choose mistakeTags that will seed the profile well.'
  }
  return `STUDENT PROFILE (accumulated from prior reviews — connect today's game to it):\n${JSON.stringify(profile, null, 2)}`
}

export interface CriticalMoment {
  move: MoveEval
  reason: 'blunder' | 'mistake' | 'biggest-swing' | 'missed-win'
}

function fmtEval(m: MoveEval): string {
  if (m.evalMate !== null) return `#${m.evalMate}`
  return ((m.evalCp ?? 0) / 100).toFixed(2)
}

function fmtClock(m: MoveEval): string {
  if (m.clockSeconds === null) return ''
  const s = Math.round(m.clockSeconds)
  return ` [clock after move: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}]`
}

function momentBlock(c: CriticalMoment, contextSans: string[]): string {
  const m = c.move
  return [
    `--- Moment at ply ${m.ply} (${c.reason}) ---`,
    `Recent moves leading here: ${contextSans.join(' ')}`,
    `Position before the move (FEN): ${m.fenBefore}`,
    `Move played: ${m.san} — classified ${m.classification}, win-prob dropped ${m.winProbBefore?.toFixed(0)}% -> ${m.winProbAfter?.toFixed(0)}% (cp loss ${m.cpLoss})${fmtClock(m)}`,
    `Engine best move was: ${m.bestMoveSan ?? m.bestMoveUci ?? 'n/a'}`,
    `Eval after the played move (white POV): ${fmtEval(m)}`
  ].join('\n')
}

export function buildGamePrompt(
  game: GameSummary,
  allMoves: MoveEval[],
  moments: CriticalMoment[]
): string {
  const user = game.userColor
  const opp = user === 'white' ? game.blackUsername : game.whiteUsername
  const userRating = user === 'white' ? game.whiteRating : game.blackRating
  const oppRating = user === 'white' ? game.blackRating : game.whiteRating
  const userAcc = user === 'white' ? game.accuracyWhite : game.accuracyBlack

  const header = [
    `GAME TO REVIEW — the student played ${user.toUpperCase()}.`,
    `Opponent: ${opp} (${oppRating ?? '?'}), student rating: ${userRating ?? '?'}.`,
    `Result for student: ${game.result} by ${game.termination ?? 'unknown'}. Time control: ${game.timeControl} (${game.timeClass}).`,
    `Opening: ${game.openingName ?? 'unknown'} (${game.ecoCode ?? '?'}).`,
    `Student's engine accuracy this game: ${userAcc?.toFixed(1) ?? '?'}%.`,
    '',
    `Full game (SAN): ${allMoves.map((m) => m.san).join(' ')}`,
    ''
  ].join('\n')

  const momentTexts = moments.map((c) => {
    const start = Math.max(0, c.move.ply - 7)
    const contextSans = allMoves.slice(start, c.move.ply - 1).map((m) => m.san)
    return momentBlock(c, contextSans.length ? contextSans : ['(game start)'])
  })

  const ask =
    moments.length > 0
      ? `\nReview the ${moments.length} critical moment(s) above. For each, produce a moment entry (ply, whatHappened, betterPlan, concept). Then write the game summary, the single most important keyTakeaway, and mistakeTags for the student's recurring-pattern tracking.`
      : `\nThe student played a clean game with no significant mistakes. Write an encouraging summary of what they did well, a keyTakeaway that reinforces their good play, an empty moments array, and an empty mistakeTags array (or tags for positive patterns worth tracking).`

  return header + momentTexts.join('\n\n') + '\n' + ask
}

export function buildMovePrompt(game: GameSummary, move: MoveEval, contextSans: string[]): string {
  return [
    `The student (playing ${game.userColor}) wants this specific position explained.`,
    `Opening: ${game.openingName ?? 'unknown'}. Time control: ${game.timeControl}.`,
    `Moves leading here: ${contextSans.join(' ') || '(game start)'}`,
    `Position before the move (FEN): ${move.fenBefore}`,
    `Move played at ply ${move.ply}: ${move.san} (classified ${move.classification ?? 'unclassified'}, cp loss ${move.cpLoss ?? '?'})${fmtClock(move)}`,
    `Engine best move: ${move.bestMoveSan ?? move.bestMoveUci ?? 'n/a'}. Eval after played move (white POV): ${fmtEval(move)}.`,
    '',
    move.classification === 'best' ||
    move.classification === 'excellent' ||
    move.classification === 'book'
      ? 'This was a good move — explain why it works and what plan it supports.'
      : 'Explain what is wrong with the played move, what the engine move achieves in human terms, and the key idea to remember.'
  ].join('\n')
}

export function buildStyleReportPrompt(
  stats: AggregateStats,
  reviews: { gameId: number; summary: string; keyTakeaway: string; mistakeTags: string[] }[],
  tagCounts: { tag: string; count: number }[],
  openingStats: unknown,
  previousProfile: PlayerProfile | null
): string {
  return [
    'Produce a deep STYLE REPORT for your student, plus an updated player profile.',
    '',
    'You are given: (1) SQL-derived aggregate statistics over all analyzed games, (2) summaries of recent per-game reviews you previously wrote, (3) frequency counts of the mistake tags you assigned, (4) opening statistics, and (5) the previous profile version.',
    '',
    '=== AGGREGATE STATS ===',
    JSON.stringify(stats, null, 2),
    '',
    '=== MISTAKE TAG FREQUENCIES ===',
    JSON.stringify(tagCounts, null, 2),
    '',
    '=== OPENING STATS (per color) ===',
    JSON.stringify(openingStats, null, 2),
    '',
    '=== RECENT GAME REVIEWS (newest first) ===',
    JSON.stringify(reviews, null, 2),
    '',
    '=== PREVIOUS PROFILE ===',
    previousProfile
      ? JSON.stringify(previousProfile, null, 2)
      : 'none — this is the first style report',
    '',
    'Instructions:',
    '- "report" is a thorough markdown document addressed to the student: their style described in plain language, what they do well, their 3-5 most damaging recurring mistakes with evidence from the data, opening repertoire assessment (what works, what leaks points, 2-3 concrete openings to try and why they fit this style), time management, and a prioritized improvement plan.',
    '- "updatedProfile" must UPDATE the previous profile given the new evidence — refine wording, adjust frequencies, drop weaknesses that have demonstrably improved, add newly emerged patterns. Fill openingRepertoire from the opening stats (winRate as 0-100, avgAccuracy as 0-100). exampleGameIds should reference gameId values from the reviews you were given.',
    '- Ground every claim in the provided data; do not invent statistics.'
  ].join('\n')
}

/** Assemble the cached system blocks (persona + profile) shared by all coach calls. */
export function systemBlocks(profile: PlayerProfile | null): Anthropic.TextBlockParam[] {
  return [
    { type: 'text', text: SYSTEM_COACH },
    { type: 'text', text: profileBlock(profile), cache_control: { type: 'ephemeral' } }
  ]
}
