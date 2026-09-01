import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import { WeightScreen } from './WeightScreen'
import { today } from '../../lib/dates'

/**
 * Weight tracking acceptance checks (PRD §18): record a weigh-in, see it in the
 * list, edit it, delete it. Uses the real `db` singleton over fake-indexeddb.
 */

async function clearDb() {
  await db.weightEntries.clear()
}

beforeEach(clearDb)
afterEach(clearDb)

function renderScreen() {
  return render(
    <MemoryRouter>
      <WeightScreen />
    </MemoryRouter>,
  )
}

describe('WeightScreen', () => {
  it('records today’s weight and shows it in the history list', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.type(screen.getByLabelText('Weight'), '164.8')
    await user.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    await waitFor(() => {
      expect(screen.getByText('164.8 lb')).toBeInTheDocument()
      expect(screen.getByText(today())).toBeInTheDocument()
    })
  })

  it('edits an existing weigh-in', async () => {
    const user = userEvent.setup()
    await db.weightEntries.add({
      id: 'w1',
      date: today(),
      weight: 164.8,
      createdAt: 't',
      updatedAt: 't',
    })
    renderScreen()

    await waitFor(() => expect(screen.getByText('164.8 lb')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByLabelText(`Edit weight for ${today()}`)
    await user.clear(input)
    await user.type(input, '160.0')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText('160.0 lb')).toBeInTheDocument())
  })

  it('deletes a weigh-in after confirmation', async () => {
    const user = userEvent.setup()
    await db.weightEntries.add({
      id: 'w1',
      date: today(),
      weight: 164.8,
      createdAt: 't',
      updatedAt: 't',
    })
    renderScreen()

    await waitFor(() => expect(screen.getByText('164.8 lb')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.getByText('No weigh-ins yet.')).toBeInTheDocument())
  })
})
