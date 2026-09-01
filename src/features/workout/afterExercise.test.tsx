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
})
