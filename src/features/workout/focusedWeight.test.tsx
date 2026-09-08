import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { addSet, completeSession, startSession } from '../../data/repositories/sessionRepo'
import { setAfterExercise } from '../../data/repositories/settingsRepo'
import { WorkoutScreen } from './WorkoutScreen'

/**
 * Working weight is per-exercise (user request): it starts at the focused
 * exercise's own target and carries forward only within that exercise — it must
 * never inherit the weight from the exercise logged before it.
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
        <Route path="/" element={<div>Home dashboard</div>} />
        <Route path="/workout/:sessionId" element={<WorkoutScreen />} />
        <Route path="/history/:sessionId" element={<div>History detail</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('focused view working weight', () => {
  it('pre-fills the focused exercise target, not the previous exercise weight', async () => {
    const user = userEvent.setup()
    // Workout B: Back Squat (185) then Barbell Row (95).
    const { session } = await startSession('B', db)
    renderAt(session.id)

    await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
    await user.click(screen.getByText('Back Squat'))
    expect((screen.getByLabelText('Weight for set 1') as HTMLInputElement).value).toBe('185')

    // Leave Back Squat and focus a different exercise.
    await user.click(screen.getByRole('button', { name: 'Back to exercises' }))
    await waitFor(() => expect(screen.getByText('Barbell Row')).toBeInTheDocument())
    await user.click(screen.getByText('Barbell Row'))

    // Barbell Row's own target — NOT 185 carried over from Back Squat.
    await waitFor(() =>
      expect((screen.getByLabelText('Weight for set 1') as HTMLInputElement).value).toBe('95'),
    )
  })

  it('does not carry weight across exercises when auto-advancing', async () => {
    const user = userEvent.setup()
    await setAfterExercise('next', db)
    const { session } = await startSession('B', db)
    renderAt(session.id)

    await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
    await user.click(screen.getByText('Back Squat'))
    expect((screen.getByLabelText('Weight for set 1') as HTMLInputElement).value).toBe('185')

    // Finish Back Squat; 'next' advances straight into Barbell Row.
    await user.click(screen.getByRole('button', { name: 'Done with Exercise' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Barbell Row' })).toBeInTheDocument(),
    )
    expect((screen.getByLabelText('Weight for set 1') as HTMLInputElement).value).toBe('95')
  })

  it('persists a changed weight to the next set of the SAME exercise', async () => {
    const user = userEvent.setup()
    const { session } = await startSession('B', db)
    renderAt(session.id)

    await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
    await user.click(screen.getByText('Back Squat'))

    // Override the target weight for set 1.
    const weightInput = screen.getByLabelText('Weight for set 1') as HTMLInputElement
    await user.clear(weightInput)
    await user.type(weightInput, '195')
    await user.click(screen.getByRole('button', { name: 'Save set 1' }))

    // Set 2 begins at the weight actually used, not back at the 185 target.
    await waitFor(() =>
      expect((screen.getByLabelText('Weight for set 2') as HTMLInputElement).value).toBe('195'),
    )
  })

  it('carries the changed weight back in after leaving and re-entering', async () => {
    const user = userEvent.setup()
    const { session, exercises } = await startSession('B', db)
    const squat = exercises.find((e) => e.exerciseNameSnapshot === 'Back Squat')!
    // A set already logged at a weight above target.
    await addSet(squat.id, { weight: 205, reps: 12 }, db)

    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
    await user.click(screen.getByText('Back Squat'))

    // Resumes from the last recorded set for this exercise.
    await waitFor(() =>
      expect((screen.getByLabelText('Weight for set 2') as HTMLInputElement).value).toBe('205'),
    )
  })
})

describe('last session panel', () => {
  it('shows the most recent completed session for the focused exercise', async () => {
    const user = userEvent.setup()
    // A previous, completed workout with logged sets.
    const prev = await startSession('B', db)
    const prevSquat = prev.exercises.find((e) => e.exerciseNameSnapshot === 'Back Squat')!
    await addSet(prevSquat.id, { weight: 180, reps: 10 }, db)
    await addSet(prevSquat.id, { weight: 180, reps: 8 }, db)
    await completeSession(prev.session.id, db)

    // Today's workout.
    const { session } = await startSession('B', db)
    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
    await user.click(screen.getByText('Back Squat'))

    const toggle = await screen.findByRole('button', { name: /Last time/ })
    // Collapsed by default so it doesn't crowd the entry controls.
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(await screen.findByText('180.0 lb × 10 reps')).toBeInTheDocument()
    expect(screen.getByText('180.0 lb × 8 reps')).toBeInTheDocument()
  })

  it('is absent when the exercise has no completed history', async () => {
    const user = userEvent.setup()
    const { session } = await startSession('B', db)
    renderAt(session.id)

    await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
    await user.click(screen.getByText('Back Squat'))
    await waitFor(() => expect(screen.getByText('Set 1')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /Last time/ })).not.toBeInTheDocument()
  })

  it('never shows the in-progress session as its own "last time"', async () => {
    const user = userEvent.setup()
    const { session, exercises } = await startSession('B', db)
    const squat = exercises.find((e) => e.exerciseNameSnapshot === 'Back Squat')!
    await addSet(squat.id, { weight: 185, reps: 12 }, db)

    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
    await user.click(screen.getByText('Back Squat'))
    await waitFor(() => expect(screen.getByText('Set 2')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /Last time/ })).not.toBeInTheDocument()
  })
})
