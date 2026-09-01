/**
 * Completed workout detail (PRD §12). Shows each exercise with its target, the
 * sets performed, and the progression outcome (target retained vs advanced).
 * "Edit workout" reopens the session for editing in the logging view; on
 * re-completion progression is recomputed deterministically (no double +5).
 */

import { useNavigate, useParams } from 'react-router-dom'
import { reopenSession } from '../../data/repositories/sessionRepo'
import { timestampToLocalDate } from '../../lib/dates'
import { fmtWeight } from '../weight/format'
import { useSessionDetail } from './useHistory'

export function WorkoutDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const detail = useSessionDetail(sessionId)

  if (detail === undefined) return <p className="muted screen">Loading…</p>
  if (detail === null) {
    return (
      <section className="screen">
        <h1>Workout not found</h1>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/history')}>
          Back to history
        </button>
      </section>
    )
  }

  async function handleEdit() {
    if (!sessionId) return
    await reopenSession(sessionId)
    navigate(`/workout/${sessionId}`)
  }

  const { session, exercises } = detail
  const dateLabel = timestampToLocalDate(session.completedAt ?? session.startedAt)

  return (
    <section className="screen">
      <h1>
        Workout {session.workoutType} — {dateLabel}
      </h1>

      {exercises.map((ex) => (
        <div key={ex.id} className="card detail-exercise">
          <div className="detail-exercise__head">
            <h2 className="detail-exercise__name">{ex.exerciseNameSnapshot}</h2>
            {!ex.completed && <span className="badge badge--muted">Skipped</span>}
          </div>

          {ex.targetWeightSnapshot !== null && (
            <p className="detail-exercise__target">
              Target: {fmtWeight(ex.targetWeightSnapshot)} lb
            </p>
          )}

          {ex.sets.length === 0 ? (
            <p className="muted">No sets recorded.</p>
          ) : (
            <ul className="detail-sets">
              {ex.sets.map((s) => (
                <li key={s.id} className="detail-sets__row">
                  {s.weight !== null ? `${fmtWeight(s.weight)} × ${s.reps}` : `${s.reps} reps`}
                </li>
              ))}
            </ul>
          )}

          {ex.completed && ex.targetWeightSnapshot !== null && (
            <p
              className={`detail-exercise__result ${
                ex.progressionAchieved ? 'result--up' : 'result--flat'
              }`}
            >
              {ex.progressionAchieved
                ? `Target advanced: ${fmtWeight(ex.targetWeightSnapshot)} → ${fmtWeight(ex.nextTargetWeight)} lb`
                : `Target retained: ${fmtWeight(ex.targetWeightSnapshot)} lb`}
            </p>
          )}

          <button
            type="button"
            className="btn btn--ghost detail-exercise__link"
            onClick={() => navigate(`/exercise/${ex.exerciseId}/history`)}
          >
            View exercise history
          </button>
        </div>
      ))}

      <button type="button" className="btn btn--primary btn--block" onClick={handleEdit}>
        Edit workout
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--block detail__back"
        onClick={() => navigate('/history')}
      >
        Back to history
      </button>
    </section>
  )
}
