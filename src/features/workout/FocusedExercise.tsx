/**
 * Focused single-exercise logging view (redesign): the screen is devoted to one
 * exercise. A large "Set N" indicator shows which set is being recorded, a huge
 * reps field (default 12) is the primary input, and the weight is secondary
 * (pre-filled to target/last). Tapping Save records the current set IN PLACE and
 * the indicator advances to the next set — no rows are appended or shifted.
 * Recorded sets are shown compactly (read-only) with a tap-to-edit affordance.
 */

import { useState } from 'react'
import { NumberField } from '../../components/NumberField'
import { DEFAULT_REPS } from '../../domain/workoutBuilder'
import type { ExerciseSet, WorkoutExercise } from '../../domain/entities'
import { timestampToLocalDate } from '../../lib/dates'
import { useLastExerciseSession } from '../history/useHistory'
import { fmtWeight } from '../weight/format'
import { formatRest, useRestTimer } from './useRestTimer'

interface FocusedExerciseProps {
  exercise: WorkoutExercise & { sets: ExerciseSet[] }
  onRecordSet: (weight: number | null, reps: number) => Promise<void> | void
  onEditSet: (setId: string, weight: number | null, reps: number) => Promise<void> | void
  onDeleteSet: (setId: string) => Promise<void> | void
  /** "Done with Exercise": marks the exercise complete, then advances/returns. */
  onDone: () => void
  /** "← Exercises": returns to the list WITHOUT marking the exercise complete. */
  onBack: () => void
}

export function FocusedExercise({
  exercise,
  onRecordSet,
  onEditSet,
  onDeleteSet,
  onDone,
  onBack,
}: FocusedExerciseProps) {
  const recorded = exercise.sets
  const nextSetNumber = recorded.length + 1

  // Working weight starts at THIS exercise's target and then carries forward
  // whatever the user last used for it. WorkoutScreen keys this component by
  // exercise id, so these initializers re-run per exercise and never inherit a
  // weight from the exercise before it.
  const lastWeight = recorded.length ? recorded[recorded.length - 1].weight : null
  const defaultWeight = lastWeight ?? exercise.targetWeightSnapshot

  // Draft for the set currently being entered (in place — never appended).
  const [reps, setReps] = useState<number | null>(DEFAULT_REPS)
  const [weight, setWeight] = useState<number | null>(defaultWeight)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showLast, setShowLast] = useState(false)

  const restSeconds = exercise.restSecondsSnapshot ?? null
  const timer = useRestTimer()
  const lastSession = useLastExerciseSession(exercise.exerciseId, exercise.workoutSessionId)

  async function handleSave() {
    await onRecordSet(weight, reps ?? DEFAULT_REPS)
    // Reset the draft for the NEXT set in place. Weight carries forward.
    setReps(DEFAULT_REPS)
    setWeight(weight)
    // Auto-start the rest timer if this exercise has one configured.
    if (restSeconds && restSeconds > 0) timer.start(restSeconds)
  }

  return (
    // When rest is up the whole screen washes green — visible from across the
    // room with nothing to tap. Saving the next set clears it on its own.
    <section className={`screen focus${timer.finished ? ' focus--rest-done' : ''}`}>
      {/* Top bar: back on the left, "Done with Exercise" right-justified so it's
          reachable without scrolling past the set controls. */}
      <div className="focus__topbar">
        <button
          type="button"
          className="focus__back"
          onClick={onBack}
          aria-label="Back to exercises"
        >
          ← Exercises
        </button>
        <button type="button" className="btn btn--ghost focus__done" onClick={onDone}>
          Done with Exercise
        </button>
      </div>

      <h1 className="focus__name">{exercise.exerciseNameSnapshot}</h1>
      <p className="focus__target">
        {exercise.targetWeightSnapshot !== null
          ? `Target ${fmtWeight(exercise.targetWeightSnapshot)} lb`
          : 'Bodyweight'}
      </p>

      {/* Quick peek at the most recent completed session for THIS exercise. */}
      {lastSession && (
        <div className="focus__last">
          <button
            type="button"
            className="focus__last-toggle"
            onClick={() => setShowLast((v) => !v)}
            aria-expanded={showLast}
          >
            <span>Last time · {timestampToLocalDate(lastSession.session.completedAt ?? '')}</span>
            <span className="focus__last-chev" aria-hidden>
              {showLast ? '▾' : '▸'}
            </span>
          </button>
          {showLast && (
            <ul className="focus__last-list">
              {lastSession.sets.length === 0 ? (
                <li className="focus__last-empty muted">No sets recorded</li>
              ) : (
                lastSession.sets.map((s) => (
                  <li key={s.id} className="focus__last-item">
                    <span className="focus__last-num">Set {s.setNumber}</span>
                    <span className="focus__last-val">
                      {s.weight !== null ? `${fmtWeight(s.weight)} lb × ` : ''}
                      {s.reps} reps
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {/* One entry row: reps, weight and the set number, each a stacked
          label-over-value. Weight uses a bare input rather than NumberField so
          it visually matches the reps field — neither holds more than three
          digits, so full-width controls wasted the space. */}
      <div className="focus__entry">
        <div className="focus__field">
          <label className="focus__field-label" htmlFor="focus-reps">
            Reps
          </label>
          <input
            id="focus-reps"
            className="focus__field-input"
            type="number"
            inputMode="numeric"
            min={0}
            value={reps ?? ''}
            onChange={(e) => setReps(e.target.value === '' ? null : Number(e.target.value))}
            onFocus={(e) => e.target.select()}
            aria-label={`Reps for set ${nextSetNumber}`}
          />
        </div>

        <div className="focus__field">
          <label className="focus__field-label" htmlFor="focus-weight">
            Weight
          </label>
          <input
            id="focus-weight"
            className="focus__field-input"
            type="number"
            inputMode="decimal"
            min={0}
            step={5}
            value={weight ?? ''}
            placeholder="—"
            onChange={(e) => setWeight(e.target.value === '' ? null : Number(e.target.value))}
            onFocus={(e) => e.target.select()}
            aria-label={`Weight for set ${nextSetNumber}`}
          />
        </div>

        {/* Same stacked label/value shape as the fields, but the number is
            static text — there is nothing to type here. A span, not a label,
            since it labels no control. */}
        <div className="focus__field focus__field--static">
          <span className="focus__field-label">Set</span>
          <span className="focus__set-number" aria-live="polite">
            {nextSetNumber}
          </span>
        </div>
      </div>

      <button type="button" className="btn btn--primary focus__save" onClick={handleSave}>
        Save set {nextSetNumber}
      </button>

      {timer.running && (
        <div className="rest-timer" role="timer" aria-live="off">
          <div className="rest-timer__count">{formatRest(timer.remaining)}</div>
          <div className="rest-timer__label">Rest</div>
          <div className="rest-timer__actions">
            <button
              type="button"
              className="btn btn--ghost rest-timer__btn"
              onClick={() => timer.add(-15)}
              aria-label="Subtract 15 seconds"
            >
              −15s
            </button>
            <button
              type="button"
              className="btn btn--ghost rest-timer__btn"
              onClick={() => timer.add(15)}
              aria-label="Add 15 seconds"
            >
              +15s
            </button>
            <button
              type="button"
              className="btn btn--ghost rest-timer__btn"
              onClick={timer.skip}
              aria-label="Skip rest"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Rest is up: the readout stays put and reads 0:00 — same position as the
          running timer, so nothing jumps. The green wash is the at-a-distance
          cue; this is the up-close detail. No dismiss: saving the next set
          clears it. */}
      {timer.finished && (
        <div className="rest-timer rest-timer--done" role="alert">
          <div className="rest-timer__count">0:00</div>
          <div className="rest-timer__label">Rest complete — go!</div>
          <div className="rest-timer__actions">
            <button
              type="button"
              className="btn btn--ghost rest-timer__btn"
              onClick={() => timer.add(30)}
              aria-label="Rest 30 more seconds"
            >
              +30s
            </button>
          </div>
        </div>
      )}

      {/* Compact recorded-sets summary (does not push the controls around) */}
      {recorded.length > 0 && (
        <div className="focus__recorded">
          <h2 className="focus__recorded-title">Recorded sets</h2>
          <ul className="focus__recorded-list">
            {recorded.map((s) =>
              editingId === s.id ? (
                <EditRecordedSet
                  key={s.id}
                  set={s}
                  onSave={async (w, r) => {
                    await onEditSet(s.id, w, r)
                    setEditingId(null)
                  }}
                  onCancel={() => setEditingId(null)}
                  onDelete={async () => {
                    await onDeleteSet(s.id)
                    setEditingId(null)
                  }}
                />
              ) : (
                <li key={s.id} className="focus__recorded-item">
                  <button
                    type="button"
                    className="focus__recorded-btn"
                    onClick={() => setEditingId(s.id)}
                    aria-label={`Edit set ${s.setNumber}`}
                  >
                    <span className="focus__recorded-num">Set {s.setNumber}</span>
                    <span className="focus__recorded-val">
                      {s.weight !== null ? `${fmtWeight(s.weight)} lb ×` : ''} {s.reps} reps
                    </span>
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </section>
  )
}

interface EditRecordedSetProps {
  set: ExerciseSet
  onSave: (weight: number | null, reps: number) => Promise<void> | void
  onCancel: () => void
  onDelete: () => Promise<void> | void
}

function EditRecordedSet({ set, onSave, onCancel, onDelete }: EditRecordedSetProps) {
  const [weight, setWeight] = useState<number | null>(set.weight)
  const [reps, setReps] = useState<number | null>(set.reps)
  return (
    <li className="focus__recorded-edit">
      <span className="focus__recorded-num">Set {set.setNumber}</span>
      <NumberField
        value={weight}
        onChange={setWeight}
        step={5}
        suffix="lb"
        ariaLabel={`Edit weight for set ${set.setNumber}`}
      />
      <NumberField
        value={reps}
        onChange={setReps}
        step={1}
        suffix="reps"
        ariaLabel={`Edit reps for set ${set.setNumber}`}
      />
      <div className="focus__recorded-edit-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onSave(weight, reps ?? 0)}
        >
          Save
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--ghost" onClick={onDelete} aria-label="Delete set">
          ✕
        </button>
      </div>
    </li>
  )
}
