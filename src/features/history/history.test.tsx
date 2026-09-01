import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { addSet, completeSession, startSession } from '../../data/repositories/sessionRepo'
import { HistoryScreen } from './HistoryScreen'
import { WorkoutDetailScreen } from './WorkoutDetailScreen'
import { ExerciseHistoryScreen } from './ExerciseHistoryScreen'

/**
 * History screens (PRD §12, §13): list completed workouts, show detail with
 * progression outcome, and per-exercise history. Real seeded db over
 * fake-indexeddb.
 */

async function resetDb() {
  await Promise.all([
    db.workoutTemplates.clear(),
    db.exercises.clear(),
    db.templateExercises.clear(),
    db.workoutSessions.clear(),
    db.workoutExercises.clear(),
    db.exerciseSets.clear(),
    db.settings.clear(),
  ])
  await seedIfEmpty()
}

beforeEach(resetDb)
afterEach(resetDb)

/** Start Workout A, record a successful Incline Press set, and complete it. */
async function completeSuccessfulWorkout() {
  const { session, exercises } = await startSession('A', db)
  const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
  await addSet(incline.id, { weight: 55, reps: 12 }, db)
  await db.workoutExercises.update(incline.id, { completed: true })
  await completeSession(session.id, db)
  return { session, inclineExerciseId: incline.exerciseId }
}

describe('HistoryScreen', () => {
  it('lists a completed workout', async () => {
    await completeSuccessfulWorkout()
    render(
      <MemoryRouter>
        <HistoryScreen />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('Workout A')).toBeInTheDocument())
    expect(screen.getByText(/1 exercise completed/)).toBeInTheDocument()
  })

  it('shows an empty state when there is no history', async () => {
    render(
      <MemoryRouter>
        <HistoryScreen />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getByText('No completed workouts yet.')).toBeInTheDocument(),
    )
  })
})

describe('WorkoutDetailScreen', () => {
  it('shows the progression outcome for a successful exercise', async () => {
    const { session } = await completeSuccessfulWorkout()
    render(
      <MemoryRouter initialEntries={[`/history/${session.id}`]}>
        <Routes>
          <Route path="/history/:sessionId" element={<WorkoutDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getByText('Dumbbell Incline Press')).toBeInTheDocument(),
    )
    expect(screen.getByText('Target: 55.0 lb')).toBeInTheDocument()
    expect(screen.getByText('55.0 × 12')).toBeInTheDocument()
    expect(screen.getByText(/Target advanced: 55\.0 → 60\.0 lb/)).toBeInTheDocument()
  })
})

describe('ExerciseHistoryScreen', () => {
  it('lists an exercise’s completed sessions with results', async () => {
    const { inclineExerciseId } = await completeSuccessfulWorkout()
    render(
      <MemoryRouter initialEntries={[`/exercise/${inclineExerciseId}/history`]}>
        <Routes>
          <Route path="/exercise/:id/history" element={<ExerciseHistoryScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getByText('Dumbbell Incline Press history')).toBeInTheDocument(),
    )
    expect(screen.getByText('55.0 × 12')).toBeInTheDocument()
    expect(screen.getByText(/Achieved → next 60\.0 lb/)).toBeInTheDocument()
  })
})
