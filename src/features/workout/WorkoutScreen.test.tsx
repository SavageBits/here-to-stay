import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { startSession } from '../../data/repositories/sessionRepo'
import { getTemplateExerciseViews } from '../../data/repositories/templateRepo'
import { WorkoutScreen } from './WorkoutScreen'

/**
 * Active workout logging + completion (PRD §8, §11, §18). Drives the full stack:
 * start a session, log sets, complete → progression evaluated. Uses the real
 * seeded db over fake-indexeddb.
 */

async function resetDb() {
  await Promise.all([
    db.workoutTemplates.clear(),
    db.exercises.clear(),
    db.templateExercises.clear(),
    db.workoutSessions.clear(),
    db.workoutExercises.clear(),
    db.exerciseSets.clear(),
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

describe('WorkoutScreen', () => {
  it('renders the started session with exercises and their targets', async () => {
    const { session } = await startSession('A', db)
    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())
    expect(screen.getByText('Target: 135.0 lb')).toBeInTheDocument()
    // Pull-up and Plank are bodyweight in the seed.
    expect(screen.getAllByText('Bodyweight').length).toBeGreaterThanOrEqual(1)
  })

  it('adds a set pre-filled to 12 reps', async () => {
    const user = userEvent.setup()
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Dumbbell Incline Press')).toBeInTheDocument())

    // Seeded with one set; add a second.
    const before = await db.exerciseSets.where('workoutExerciseId').equals(incline.id).count()
    const card = screen.getByText('Dumbbell Incline Press').closest('.exercise-card') as HTMLElement
    await user.click(within(card).getByRole('button', { name: '+ Add Set' }))

    await waitFor(async () => {
      const after = await db.exerciseSets.where('workoutExerciseId').equals(incline.id).count()
      expect(after).toBe(before + 1)
    })
    // The newest set defaults to 12 reps.
    const sets = await db.exerciseSets.where('workoutExerciseId').equals(incline.id).toArray()
    expect(sets[sets.length - 1].reps).toBe(12)
  })

  it('completing a successful workout advances the next target by 5', async () => {
    const user = userEvent.setup()
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    // Set up a clean success: mark the exercise done with its one 55x12 set.
    await db.workoutExercises.update(incline.id, { completed: true })

    renderAt(session.id)
    await waitFor(() => expect(screen.getByText('Dumbbell Incline Press')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Complete Workout' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Complete' }))

    // Navigates to history and the template target advanced to 60.
    await waitFor(() => expect(screen.getByText('History detail')).toBeInTheDocument())
    const views = await getTemplateExerciseViews('A', db)
    expect(views.find((v) => v.name === 'Dumbbell Incline Press')?.targetWeight).toBe(60)
  })
})
