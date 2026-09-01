/**
 * Workout logging (redesigned). The workout is a LIST of exercises; tapping one
 * opens a FocusedExercise view devoted to logging sets for just that exercise.
 * "Done with Exercise" exits the focused view — either back to the list or, per
 * the user's setting, straight into the next exercise (PRD §8, §14.1).
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useSettings } from '../../hooks/useSettings'
import {
  abandonSession,
  addSet,
  completeSession,
  deleteSet,
  setExerciseCompleted,
  updateSet,
} from '../../data/repositories/sessionRepo'
import { fmtWeight } from '../weight/format'
import { useSession, type LoadedSessionView } from './useSession'
import { FocusedExercise } from './FocusedExercise'

export function WorkoutScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const loaded = useSession(sessionId)
  const settings = useSettings()
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [completing, setCompleting] = useState(false)

  if (loaded === undefined) return <p className="muted screen">Loading…</p>
  if (loaded === null) {
    return (
      <section className="screen">
        <h1>Workout not found</h1>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
          Back home
        </button>
      </section>
    )
  }

  const view: LoadedSessionView = loaded

  // ---- Focused single-exercise view ----
  if (focusIndex !== null && view.exercises[focusIndex]) {
    const ex = view.exercises[focusIndex]
    return (
      <FocusedExercise
        exercise={ex}
        onRecordSet={async (weight, reps) => {
          await addSet(ex.id, { weight, reps })
        }}
        onEditSet={(setId, weight, reps) => updateSet(setId, { weight, reps })}
        onDeleteSet={(setId) => deleteSet(setId)}
        onDone={async () => {
          await setExerciseCompleted(ex.id, true)
          // After finishing: go to the next exercise or back to the list.
          if (settings.afterExercise === 'next' && focusIndex + 1 < view.exercises.length) {
            setFocusIndex(focusIndex + 1)
          } else {
            setFocusIndex(null)
          }
        }}
      />
    )
  }

  // ---- Exercise list view ----
  async function handleComplete() {
    if (!sessionId) return
    setCompleting(true)
    await completeSession(sessionId)
    navigate(`/history/${sessionId}`, { replace: true })
  }

  async function handleAbandon() {
    if (!sessionId) return
    await abandonSession(sessionId)
    navigate('/', { replace: true })
  }

  const dateLabel = view.session.startedAt.slice(0, 10)

  return (
    <section className="screen">
      <h1>Workout {view.session.workoutType}</h1>
      <p className="muted">{dateLabel}</p>

      <ul className="exercise-nav">
        {view.exercises.map((ex, i) => (
          <li key={ex.id}>
            <button
              type="button"
              className={`exercise-nav__item${ex.completed ? ' exercise-nav__item--done' : ''}`}
              onClick={() => setFocusIndex(i)}
            >
              <span className="exercise-nav__main">
                <span className="exercise-nav__name">{ex.exerciseNameSnapshot}</span>
                <span className="exercise-nav__meta">
                  {ex.targetWeightSnapshot !== null
                    ? `Target ${fmtWeight(ex.targetWeightSnapshot)} lb`
                    : 'Bodyweight'}
                  {' · '}
                  {ex.sets.length} {ex.sets.length === 1 ? 'set' : 'sets'}
                </span>
              </span>
              <span className="exercise-nav__chev" aria-hidden>
                {ex.completed ? '✓' : '›'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn btn--primary btn--block workout__complete"
        onClick={() => setConfirmComplete(true)}
      >
        Complete Workout
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--block workout__abandon"
        onClick={() => setConfirmAbandon(true)}
      >
        Abandon Workout
      </button>

      <ConfirmDialog
        open={confirmComplete}
        title="Complete workout?"
        message="This evaluates progression for each exercise and saves the workout. You can still reopen and edit it later."
        confirmLabel={completing ? 'Saving…' : 'Complete'}
        cancelLabel="Keep editing"
        onConfirm={handleComplete}
        onCancel={() => setConfirmComplete(false)}
      />

      <ConfirmDialog
        open={confirmAbandon}
        title="Abandon workout?"
        message="This discards the workout and everything logged in it. Progression is not affected. This cannot be undone."
        confirmLabel="Abandon"
        cancelLabel="Keep going"
        onConfirm={handleAbandon}
        onCancel={() => setConfirmAbandon(false)}
      />
    </section>
  )
}
