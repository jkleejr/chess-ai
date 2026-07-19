import { z } from 'zod'

export const InsightMomentSchema = z.object({
  ply: z.number(),
  whatHappened: z.string(),
  betterPlan: z.string(),
  concept: z.string()
})

export const GameInsightSchema = z.object({
  summary: z.string(),
  keyTakeaway: z.string(),
  moments: z.array(InsightMomentSchema),
  mistakeTags: z.array(z.string())
})

export const MoveExplanationSchema = z.object({
  explanation: z.string(),
  keyIdea: z.string(),
  bestLineExplained: z.string()
})

export const OpeningRepertoireEntrySchema = z.object({
  eco: z.string(),
  name: z.string(),
  games: z.number(),
  winRate: z.number(),
  avgAccuracy: z.number()
})

export const PlayerProfileSchema = z.object({
  styleSummary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recurringMistakes: z.array(
    z.object({
      pattern: z.string(),
      frequency: z.string(),
      exampleGameIds: z.array(z.number())
    })
  ),
  openingRepertoire: z.object({
    asWhite: z.array(OpeningRepertoireEntrySchema),
    asBlack: z.array(OpeningRepertoireEntrySchema)
  }),
  openingSuggestions: z.array(z.string()),
  timeManagement: z.string(),
  improvementFocus: z.array(z.string())
})

export const StyleReportSchema = z.object({
  report: z.string(),
  updatedProfile: PlayerProfileSchema
})
