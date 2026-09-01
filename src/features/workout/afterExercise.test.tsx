import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { startSession } from '../../data/repositories/sessionRepo'
import { setAfterExercise } from '../../data/repositories/settingsRepo'
import { WorkoutScreen } from './WorkoutScreen'

/**
 * The "after finishing an exercise" setting (user request): 'next' advances into
 * the following exercise's focused view; 'list' returns to the exercise list.
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

function renderAt(sessionId: string) {
  return render(
    <MemoryRouter initialEntries={[`/workout/${sessionId}`]}>
      <Routes>
        <Route path="/workout/:sessionId" element={<WorkoutScreen />} />
        <Route path="/history/:sessionId" element={<div>History detail</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('after-exercise behavior', () => {
  it("'next' advances into the following exercise", async () => {
    const user = userEvent.setup()
    await setAfterExercise('next', db)
    const { session } = await startSession('A', db) // A: Deadlift, Pull-up, ...
    renderAt(session.id)

    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())
    await user.click(screen.getByText('Deadlift'))
    await waitFor(() => expect(screen.getByText('Set 1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Done with Exercise' }))

    // Focused view now shows the next exercise (Pull-up), still in focus mode.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Pull-up' })).toBeInTheDocument(),
    )
    expect(screen.getByText('Set 1')).toBeInTheDocument()
  })

  it("'← Exercises' returns to the list WITHOUT cycling, even in 'next' mode", async () => {
    const user = userEvent.setup()
    await setAfterExercise('next', db)
    const { session } = await startSession('A', db)
    renderAt(session.id)

    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())
    await user.click(screen.getByText('Deadlift'))
    await waitFor(() => expect(screen.getByText('Set 1')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Back to exercises' }))

    // Straight back to the list (Complete Workout is only on the list view);
    // it did NOT advance into Pull-up.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Complete Workout' })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('heading', { name: 'Pull-up' })).not.toBeInTheDocument()
  })

  it("'← Exercises' does NOT mark the exercise complete", async () => {
    const user = userEvent.setup()
    await setAfterExercise('next', db)
    const { session, exercises } = await startSession('A', db)
    const deadlift = exercises.find((e) => e.exerciseNameSnapshot === 'Deadlift')!
    renderAt(session.id)

    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())
    await user.click(screen.getByText('Deadlift'))
    await waitFor(() => expect(screen.getByText('Set 1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Back to exercises' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Complete Workout' })).toBeInTheDocument(),
    )

    // The exercise remains not-completed (only "Done with Exercise" completes it).
    const stored = await db.workoutExercises.get(deadlift.id)
    expect(stored?.completed).toBe(false)
  })

  it("'← Exercises' records nothing when no set was saved", async () => {
    const user = userEvent.setup()
    const { session, exercises } = await startSession('A', db)
    const deadlift = exercises.find((e) => e.exerciseNameSnapshot === 'Deadlift')!
    renderAt(session.id)

    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())
    await user.click(screen.getByText('Deadlift'))
    await waitFor(() => expect(screen.getByText('Set 1')).toBeInTheDocument())
    // Leave without saving a set.
    await user.click(screen.getByRole('button', { name: 'Back to exercises' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Complete Workout' })).toBeInTheDocument(),
    )

    // No sets were recorded for the exercise.
    const count = await db.exerciseSets.where('workoutExerciseId').equals(deadlift.id).count()
    expect(count).toBe(0)
  })
})
