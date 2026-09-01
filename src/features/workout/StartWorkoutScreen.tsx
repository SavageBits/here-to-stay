/**
 * "Start Workout A/B" preview (PRD §7, §14.2). Shows the exercises and suggested
 * targets the new session will use (derived from the previous same-type session
 * + current template), then creates and opens the session on Start.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { WorkoutType } from '../../domain/types'
import { buildSessionFromPrevious } from '../../domain/workoutBuilder'
import { getTemplateExerciseViews } from '../../data/repositories/templateRepo'
import { startSession } from '../../data/repositories/sessionRepo'
import { timestampToLocalDate } from '../../lib/dates'
import { fmtWeight } from '../weight/format'

function isWorkoutType(v: string | undefined): v is WorkoutType {
  return v === 'A' || v === 'B'
}

export function StartWorkoutScreen() {
  const { type } = useParams<{ type: string }>()
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)

  const workoutType: WorkoutType = isWorkoutType(type) ? type : 'A'

  // Build the same draft startSession will, purely for preview.
  const preview = useLiveQuery(async () => {
    const template = await getTemplateExerciseViews(workoutType, db)
    const last = await db.workoutSessions
      .where('[workoutType+completedAt]')
      .between([workoutType, ''], [workoutType, '￿'], true, true)
      .last()
    let previous = null
    if (last) {
      const exercises = await db.workoutExercises
        .where('workoutSessionId')
        .equals(last.id)
        .toArray()
      previous = exercises.map((e) => ({
        exerciseId: e.exerciseId,
        nextTargetWeight: e.nextTargetWeight ?? e.targetWeightSnapshot,
      }))
    }
    const draft = buildSessionFromPrevious(workoutType, template, previous)
    return { draft, basedOn: last?.completedAt ?? null }
  }, [workoutType])

  useEffect(() => {
    if (!isWorkoutType(type)) navigate('/', { replace: true })
  }, [type, navigate])

  async function handleStart() {
    setStarting(true)
    const { session } = await startSession(workoutType)
    navigate(`/workout/${session.id}`, { replace: true })
  }

  return (
    <section className="screen">
      <h1>Start Workout {workoutType}</h1>

      {preview === undefined ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <p className="muted">
            {preview.basedOn
              ? `Based on your last Workout ${workoutType} (${timestampToLocalDate(preview.basedOn)})`
              : `First Workout ${workoutType} — using your template`}
          </p>

          <ul className="start-list card">
            {preview.draft.exercises.map((e) => (
              <li key={e.exerciseId} className="start-list__item">
                <span>{e.exerciseNameSnapshot}</span>
                <span className="muted">
                  {e.targetWeightSnapshot !== null
                    ? `target ${fmtWeight(e.targetWeightSnapshot)} lb`
                    : 'bodyweight'}
                </span>
              </li>
            ))}
            {preview.draft.exercises.length === 0 && (
              <li className="muted">No exercises in this template yet.</li>
            )}
          </ul>

          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={starting || preview.draft.exercises.length === 0}
            onClick={handleStart}
          >
            {starting ? 'Starting…' : 'Start'}
          </button>
        </>
      )}
    </section>
  )
}
