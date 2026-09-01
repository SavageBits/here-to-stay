/**
 * Active workout logging (PRD §8, §14.1). Each exercise shows its target
 * prominently, an editable list of sets, an "Add Set" that pre-fills 12 reps and
 * the current/last weight, and "Done with Exercise". Completing the workout runs
 * the (already-tested) progression engine via completeSession.
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DEFAULT_REPS } from '../../domain/workoutBuilder'
import {
  addSet,
  completeSession,
  deleteSet,
  setExerciseCompleted,
  updateSet,
} from '../../data/repositories/sessionRepo'
import { fmtWeight } from '../weight/format'
import { useSession, type LoadedSessionView } from './useSession'
import { SetRow } from './SetRow'

export function WorkoutScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const loaded = useSession(sessionId)
  const [confirmComplete, setConfirmComplete] = useState(false)
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

  async function handleComplete() {
    if (!sessionId) return
    setCompleting(true)
    await completeSession(sessionId)
    navigate(`/history/${sessionId}`, { replace: true })
  }

  const view: LoadedSessionView = loaded
  const dateLabel = view.session.startedAt.slice(0, 10)

  return (
    <section className="screen">
      <h1>Workout {view.session.workoutType}</h1>
      <p className="muted">{dateLabel}</p>

      {view.exercises.map((ex) => {
        // Weight to pre-fill a new set: last set's weight, else the target.
        const lastWeight = ex.sets.length ? ex.sets[ex.sets.length - 1].weight : null
        const prefillWeight = lastWeight ?? ex.targetWeightSnapshot
        return (
          <div key={ex.id} className={`card exercise-card${ex.completed ? ' exercise-card--done' : ''}`}>
            <div className="exercise-card__head">
              <h2 className="exercise-card__name">{ex.exerciseNameSnapshot}</h2>
              <span className="exercise-card__target">
                {ex.targetWeightSnapshot !== null
                  ? `Target: ${fmtWeight(ex.targetWeightSnapshot)} lb`
                  : 'Bodyweight'}
              </span>
            </div>

            {ex.sets.map((s) => (
              <SetRow
                key={s.id}
                setNumber={s.setNumber}
                weight={s.weight}
                reps={s.reps}
                onChangeWeight={(v) => updateSet(s.id, { weight: v })}
                onChangeReps={(v) => updateSet(s.id, { reps: v ?? 0 })}
                onDelete={() => deleteSet(s.id)}
              />
            ))}

            <div className="exercise-card__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => addSet(ex.id, { weight: prefillWeight, reps: DEFAULT_REPS })}
              >
                + Add Set
              </button>
              <button
                type="button"
                className={ex.completed ? 'btn btn--ghost' : 'btn btn--primary'}
                onClick={() => setExerciseCompleted(ex.id, !ex.completed)}
              >
                {ex.completed ? 'Done ✓' : 'Done with Exercise'}
              </button>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        className="btn btn--primary btn--block workout__complete"
        onClick={() => setConfirmComplete(true)}
      >
        Complete Workout
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
    </section>
  )
}
