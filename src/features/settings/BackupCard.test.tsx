import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { exportBackupJson } from '../../data/repositories/backupRepo'
import { upsertWeight } from '../../data/repositories/weightRepo'
import { BackupCard } from './BackupCard'

/**
 * Settings backup controls (Phase 10). Exercises export (downloads a file) and
 * import (confirm → replace all data). The DOM download side effect is stubbed;
 * the data effects go through the real db.
 */

beforeEach(async () => {
  await seedIfEmpty()
  // Stub the anchor-click download so jsdom doesn't try to navigate.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  // jsdom lacks URL.createObjectURL / revokeObjectURL.
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:x', writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, writable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BackupCard', () => {
  it('exports a JSON backup and reports success', async () => {
    const user = userEvent.setup()
    render(<BackupCard />)
    await user.click(screen.getByRole('button', { name: 'Export backup (JSON)' }))
    await waitFor(() =>
      expect(screen.getByText('JSON backup downloaded.')).toBeInTheDocument(),
    )
  })

  it('imports a backup after confirmation, replacing current data', async () => {
    const user = userEvent.setup()

    // Build a backup that contains a distinctive weigh-in, from a separate state.
    await upsertWeight('2026-03-03', 155.5)
    const json = await exportBackupJson()
    // Now change current data so we can prove the import replaces it.
    await db.weightEntries.clear()
    await upsertWeight('2026-03-03', 999)

    render(<BackupCard />)
    const file = new File([json], 'backup.json', { type: 'application/json' })
    const input = screen.getByLabelText('Choose a JSON backup file') as HTMLInputElement
    await user.upload(input, file)

    // Confirm the destructive import.
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Replace all data' }))

    await waitFor(() =>
      expect(screen.getByText('Backup imported. All data replaced.')).toBeInTheDocument(),
    )
    // The imported value (155.5) replaced the current one (999).
    expect((await db.weightEntries.where('date').equals('2026-03-03').first())?.weight).toBe(155.5)
  })

  it('rejects a non-JSON file without touching data', async () => {
    const user = userEvent.setup()
    render(<BackupCard />)
    // A .json file (so the accept filter passes) but with invalid contents.
    const file = new File(['not json {{{'], 'bad.json', { type: 'application/json' })
    const input = screen.getByLabelText('Choose a JSON backup file') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() =>
      expect(screen.getByText('That file is not valid JSON.')).toBeInTheDocument(),
    )
    // No confirm dialog appeared.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
