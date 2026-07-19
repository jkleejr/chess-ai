import { useState } from 'react'
import type { GameDetail, MoveExplanation } from '../../../shared/types'
import { api } from '../api'
import { GLYPHS } from './classificationUi'

interface Props {
  detail: GameDetail
  currentPly: number
  onReviewLoaded: () => void
}

export default function CoachPanel({
  detail,
  currentPly,
  onReviewLoaded
}: Props): React.JSX.Element {
  const { game, moves, review, moveExplanations } = detail
  const [loadingReview, setLoadingReview] = useState(false)
  const [loadingMove, setLoadingMove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localExplanations, setLocalExplanations] = useState<Record<number, MoveExplanation>>({})

  const currentMove = moves.find((m) => m.ply === currentPly)
  const moment = review?.moments.find((m) => m.ply === currentPly)
  const explanation = localExplanations[currentPly] ?? moveExplanations[currentPly]

  const requestReview = async (): Promise<void> => {
    setLoadingReview(true)
    setError(null)
    try {
      await api.explainGame(game.id)
      onReviewLoaded()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingReview(false)
    }
  }

  const requestMove = async (): Promise<void> => {
    if (!currentMove) return
    setLoadingMove(true)
    setError(null)
    try {
      const ex = await api.explainMove(game.id, currentMove.ply)
      setLocalExplanations((prev) => ({ ...prev, [currentMove.ply]: ex }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingMove(false)
    }
  }

  const cls = currentMove?.classification ? GLYPHS[currentMove.classification] : null

  return (
    <div className="coach-panel">
      <h3>Coach</h3>

      {error && <p className="error-text">{error.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}</p>}

      {/* Per-move commentary when we have it */}
      {currentPly > 0 && currentMove && (
        <>
          <p>
            <b>
              {Math.ceil(currentMove.ply / 2)}
              {currentMove.ply % 2 === 1 ? '.' : '…'} {currentMove.san}
            </b>{' '}
            {cls && (
              <span style={{ color: cls.color, fontWeight: 700 }}>
                {cls.glyph || ''} {cls.label}
              </span>
            )}
            {currentMove.bestMoveSan &&
              currentMove.classification !== 'best' &&
              currentMove.classification !== 'book' && (
                <span className="muted"> — best was {currentMove.bestMoveSan}</span>
              )}
          </p>
          {moment && (
            <>
              <span className="concept-chip">{moment.concept}</span>
              <p>{moment.whatHappened}</p>
              <p>
                <b>Better plan:</b> {moment.betterPlan}
              </p>
            </>
          )}
          {explanation && (
            <>
              <span className="concept-chip">{explanation.keyIdea}</span>
              <p>{explanation.explanation}</p>
              <p>
                <b>Best line:</b> {explanation.bestLineExplained}
              </p>
            </>
          )}
          {!moment && !explanation && (
            <p>
              <button className="small" onClick={() => void requestMove()} disabled={loadingMove}>
                {loadingMove ? 'Asking coach…' : 'Explain this move (~$0.001)'}
              </button>
            </p>
          )}
        </>
      )}

      {/* Game-level summary at the start position or when no move selected */}
      {currentPly === 0 && review && (
        <>
          <p>{review.summary}</p>
          <p>
            <b>Key takeaway:</b> {review.keyTakeaway}
          </p>
          {review.mistakeTags.length > 0 && (
            <p>
              {review.mistakeTags.map((t) => (
                <span key={t} className="concept-chip">
                  {t}
                </span>
              ))}
            </p>
          )}
        </>
      )}

      {!review && (
        <p>
          {game.analysisStatus === 'analyzed' ? (
            <button className="small primary" onClick={() => void requestReview()} disabled={loadingReview}>
              {loadingReview ? 'Coach is reviewing…' : 'Coach this game (~$0.01)'}
            </button>
          ) : (
            <span className="faint">Engine analysis must finish before coaching.</span>
          )}
        </p>
      )}
    </div>
  )
}
