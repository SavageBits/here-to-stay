import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { addSet, startSession } from '../../data/repositories/sessionRepo'
import { getTemplateExerciseViews } from '../../data/repositories/templateRepo'
import { WorkoutScreen } from './WorkoutScreen'

/**
 * Redesigned workout logging (focused single-exercise view). Drives the full
 * stack: exercise list → focus an exercise → record sets in place → done →
 * complete → progression evaluated. Real seeded db over fake-indexeddb.
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

describe('WorkoutScreen (focused redesign)', () => {
  it('lists exercises with target and set count', async () => {
    const { session } = await startSession('A', db)
    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())
    // Exercises start with no recorded sets.
    expect(screen.getByText(/Target 135\.0 lb · 0 sets/)).toBeInTheDocument()
  })

  it('focuses an exercise and records a set in place, advancing the indicator', async () => {
    const user = userEvent.setup()
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    // Sessions start with no seeded sets, so numbering begins at Set 1.

    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Dumbbell Incline Press')).toBeInTheDocument())

    // Enter the focused view.
    await user.click(screen.getByText('Dumbbell Incline Press'))
    expect(screen.getByText('Set 1')).toBeInTheDocument()
    // Reps default to 12.
    expect((screen.getByLabelText('Reps for set 1') as HTMLInputElement).value).toBe('12')

    // Save set 1 — indicator advances to Set 2 in place (no appended rows).
    await user.click(screen.getByRole('button', { name: 'Save set 1' }))
    await waitFor(() => expect(screen.getByText('Set 2')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Save set 2' })).toBeInTheDocument()

    const count = await db.exerciseSets.where('workoutExerciseId').equals(incline.id).count()
    expect(count).toBe(1)
    const sets = await db.exerciseSets.where('workoutExerciseId').equals(incline.id).toArray()
    expect(sets[0].reps).toBe(12)
  })

  it('clears the default reps on focus so typing replaces it', async () => {
    const user = userEvent.setup()
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!

    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Dumbbell Incline Press')).toBeInTheDocument())
    await user.click(screen.getByText('Dumbbell Incline Press'))

    const repsInput = screen.getByLabelText('Reps for set 1') as HTMLInputElement
    expect(repsInput.value).toBe('12')

    // Focusing selects the value; typing replaces it rather than appending.
    await user.click(repsInput)
    await user.keyboard('8')
    expect(repsInput.value).toBe('8')

    await user.click(screen.getByRole('button', { name: 'Save set 1' }))
    await waitFor(async () => {
      const sets = await db.exerciseSets.where('workoutExerciseId').equals(incline.id).toArray()
      expect(sets[0]?.reps).toBe(8)
    })
  })

  it('returns to the list after "Done with Exercise" (default setting)', async () => {
    const user = userEvent.setup()
    const { session } = await startSession('A', db)
    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())

    await user.click(screen.getByText('Deadlift'))
    await waitFor(() => expect(screen.getByText('Set 1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Done with Exercise' }))

    // Back on the list; the exercise shows as done (✓).
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete Workout' })).toBeInTheDocument())
  })

  it('completing a successful workout advances the next target by 5', async () => {
    const user = userEvent.setup()
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    // Record a qualifying set (target 55) and mark the exercise done.
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await db.workoutExercises.update(incline.id, { completed: true })

    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Dumbbell Incline Press')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Complete Workout' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Complete' }))

    await waitFor(() => expect(screen.getByText('History detail')).toBeInTheDocument())
    const views = await getTemplateExerciseViews('A', db)
    expect(views.find((v) => v.name === 'Dumbbell Incline Press')?.targetWeight).toBe(60)
  })

  it('abandons the workout: confirms, navigates home, and deletes the session', async () => {
    const user = userEvent.setup()
    const { session } = await startSession('A', db)
    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Abandon Workout' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Abandon' }))

    // Navigated home and the session is gone.
    await waitFor(() => expect(screen.getByText('Home dashboard')).toBeInTheDocument())
    expect(await db.workoutSessions.get(session.id)).toBeUndefined()
  })

  it('keeps the workout when abandon is cancelled', async () => {
    const user = userEvent.setup()
    const { session } = await startSession('A', db)
    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Abandon Workout' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Keep going' }))

    // Still on the workout; session intact.
    expect(screen.getByRole('button', { name: 'Complete Workout' })).toBeInTheDocument()
    expect(await db.workoutSessions.get(session.id)).toBeDefined()
  })
})
