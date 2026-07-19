import type { Classification } from '../../../shared/types'

export const GLYPHS: Record<Classification, { glyph: string; color: string; label: string }> = {
  brilliant: { glyph: '!!', color: 'var(--brilliant)', label: 'Brilliant' },
  best: { glyph: '★', color: 'var(--best)', label: 'Best move' },
  excellent: { glyph: '', color: 'var(--excellent)', label: 'Excellent' },
  good: { glyph: '', color: 'var(--good)', label: 'Good' },
  book: { glyph: '📖', color: 'var(--book)', label: 'Book' },
  inaccuracy: { glyph: '?!', color: 'var(--inaccuracy)', label: 'Inaccuracy' },
  mistake: { glyph: '?', color: 'var(--mistake)', label: 'Mistake' },
  blunder: { glyph: '??', color: 'var(--blunder)', label: 'Blunder' }
}
