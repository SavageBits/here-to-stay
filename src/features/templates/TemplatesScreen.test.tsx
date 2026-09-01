import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { TemplatesScreen } from './TemplatesScreen'

/**
 * Workout template editing acceptance checks (PRD §18): add, rename, remove,
 * reorder exercises. Uses the real seeded `db` over fake-indexeddb.
 */

async function resetDb() {
  await Promise.all([
    db.workoutTemplates.clear(),
    db.exercises.clear(),
    db.templateExercises.clear(),
  ])
  await seedIfEmpty()
}

beforeEach(resetDb)
afterEach(resetDb)

describe('TemplatesScreen', () => {
  it('shows the seeded Workout A exercises', async () => {
    render(<TemplatesScreen />)
    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())
    expect(screen.getByText('Dumbbell Incline Press')).toBeInTheDocument()
  })

  it('adds a new exercise to the template', async () => {
    const user = userEvent.setup()
    render(<TemplatesScreen />)
    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())

    await user.type(screen.getByLabelText('New exercise name'), 'Bench Press')
    await user.click(screen.getByRole('button', { name: 'Add to Workout A' }))

    await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument())
  })

  it('renames an exercise', async () => {
    const user = userEvent.setup()
    render(<TemplatesScreen />)
    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Rename Deadlift' }))
    const input = screen.getByLabelText('Rename Deadlift')
    await user.clear(input)
    await user.type(input, 'Trap Bar Deadlift')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText('Trap Bar Deadlift')).toBeInTheDocument())
    expect(screen.queryByText('Deadlift')).not.toBeInTheDocument()
  })

  it('removes an exercise after confirmation', async () => {
    const user = userEvent.setup()
    render(<TemplatesScreen />)
    await waitFor(() => expect(screen.getByText('Plank')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Remove Plank' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(screen.queryByText('Plank')).not.toBeInTheDocument())
  })

  it('reorders exercises with the move-down control', async () => {
    const user = userEvent.setup()
    render(<TemplatesScreen />)
    await waitFor(() => expect(screen.getByText('Deadlift')).toBeInTheDocument())

    const namesBefore = screen.getAllByRole('button', { name: /^Rename / }).map((b) => b.textContent)
    expect(namesBefore[0]).toContain('Deadlift')

    await user.click(screen.getByRole('button', { name: 'Move Deadlift down' }))

    await waitFor(() => {
      const namesAfter = screen
        .getAllByRole('button', { name: /^Rename / })
        .map((b) => b.textContent)
      expect(namesAfter[0]).not.toContain('Deadlift')
      expect(namesAfter[1]).toContain('Deadlift')
    })
  })

  it('offers a removed exercise for re-adding, then restores it to the template', async () => {
    const user = userEvent.setup()
    render(<TemplatesScreen />)
    await waitFor(() => expect(screen.getByText('Plank')).toBeInTheDocument())

    // Remove Plank.
    await user.click(screen.getByRole('button', { name: 'Remove Plank' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rename Plank' })).not.toBeInTheDocument())

    // It now appears under "Add existing exercise".
    const readdCard = (await screen.findByText('Add existing exercise')).closest(
      '.card',
    ) as HTMLElement
    const addBtn = within(readdCard).getByText('Plank').closest('button') as HTMLElement
    await user.click(addBtn)

    // Back in the template as an editable exercise.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Rename Plank' })).toBeInTheDocument(),
    )
  })
})
