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

  // The weight to pre-fill: last recorded set's weight, else the target.
  const lastWeight = recorded.length ? recorded[recorded.length - 1].weight : null
  const defaultWeight = lastWeight ?? exercise.targetWeightSnapshot

  // Draft for the set currently being entered (in place — never appended).
  const [reps, setReps] = useState<number | null>(DEFAULT_REPS)
  const [weight, setWeight] = useState<number | null>(defaultWeight)
  const [editingId, setEditingId] = useState<string | null>(null)

  const restSeconds = exercise.restSecondsSnapshot ?? null
  const timer = useRestTimer()

  async function handleSave() {
    await onRecordSet(weight, reps ?? DEFAULT_REPS)
    // Reset the draft for the NEXT set in place. Weight carries forward.
    setReps(DEFAULT_REPS)
    setWeight(weight)
    // Auto-start the rest timer if this exercise has one configured.
    if (restSeconds && restSeconds > 0) timer.start(restSeconds)
  }

  return (
    <section className="screen focus">
      <button type="button" className="focus__back" onClick={onBack} aria-label="Back to exercises">
        ← Exercises
      </button>

      <h1 className="focus__name">{exercise.exerciseNameSnapshot}</h1>
      <p className="focus__target">
        {exercise.targetWeightSnapshot !== null
          ? `Target ${fmtWeight(exercise.targetWeightSnapshot)} lb`
          : 'Bodyweight'}
      </p>

      {/* Large "current set" indicator */}
      <div className="focus__set-indicator" aria-live="polite">
        Set {nextSetNumber}
      </div>

      {/* Huge reps field — the primary input */}
      <div className="focus__reps">
        <label className="focus__reps-label" htmlFor="focus-reps">
          Reps
        </label>
        <input
          id="focus-reps"
          className="focus__reps-input"
          type="number"
          inputMode="numeric"
          min={0}
          value={reps ?? ''}
          onChange={(e) => setReps(e.target.value === '' ? null : Number(e.target.value))}
          aria-label={`Reps for set ${nextSetNumber}`}
        />
      </div>

      {/* Secondary weight field */}
      <div className="focus__weight">
        <NumberField
          label="Weight"
          value={weight}
          onChange={setWeight}
          step={5}
          suffix="lb"
          placeholder="bodyweight"
          ariaLabel={`Weight for set ${nextSetNumber}`}
        />
      </div>

      <button type="button" className="btn btn--primary btn--block focus__save" onClick={handleSave}>
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

      <button type="button" className="btn btn--ghost btn--block focus__done" onClick={onDone}>
        Done with Exercise
      </button>
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
        <button type="button" className="btn btn--primary" onClick={() => onSave(weight, reps ?? 0)}>
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
