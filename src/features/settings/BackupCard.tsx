/**
 * Backup & data controls (PRD §19): export a full JSON backup, export CSVs for
 * spreadsheets, and import a JSON backup (replacing all current data). The
 * import confirms first since it is destructive.
 */

import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import {
  exportBackupJson,
  exportWeightsCsv,
  exportWorkoutSetsCsv,
  importBackupJson,
} from '../../data/repositories/backupRepo'
import { markBackedUp } from '../../data/repositories/settingsRepo'
import { downloadTextFile, readFileText, stampedName } from '../../lib/download'
import { calendarDaysBetween, timestampToLocalDate, today } from '../../lib/dates'
import { getPersistence, type PersistenceState } from '../../lib/persistStorage'
import { useSettings } from '../../hooks/useSettings'

type Status = { kind: 'idle' } | { kind: 'ok'; message: string } | { kind: 'error'; message: string }

export function BackupCard() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [pendingJson, setPendingJson] = useState<string | null>(null)
  const [persistence, setPersistence] = useState<PersistenceState | null>(null)
  const settings = useSettings()

  useEffect(() => {
    getPersistence().then(setPersistence)
  }, [])

  async function handleExportJson() {
    try {
      const json = await exportBackupJson()
      downloadTextFile(`${stampedName('health-backup', today())}.json`, json, 'application/json')
      await markBackedUp()
      setStatus({ kind: 'ok', message: 'JSON backup downloaded.' })
    } catch (err) {
      setStatus({ kind: 'error', message: `Export failed: ${String(err)}` })
    }
  }

  async function handleExportWeightsCsv() {
    const csv = await exportWeightsCsv()
    downloadTextFile(`${stampedName('weights', today())}.csv`, csv, 'text/csv')
    setStatus({ kind: 'ok', message: 'Weigh-ins CSV downloaded.' })
  }

  async function handleExportWorkoutsCsv() {
    const csv = await exportWorkoutSetsCsv()
    downloadTextFile(`${stampedName('workout-sets', today())}.csv`, csv, 'text/csv')
    setStatus({ kind: 'ok', message: 'Workout sets CSV downloaded.' })
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file later
    if (!file) return
    try {
      const text = await readFileText(file)
      // Validate it parses before asking to overwrite.
      JSON.parse(text)
      setPendingJson(text)
    } catch {
      setStatus({ kind: 'error', message: 'That file is not valid JSON.' })
    }
  }

  async function handleConfirmImport() {
    if (!pendingJson) return
    try {
      await importBackupJson(pendingJson)
      setStatus({ kind: 'ok', message: 'Backup imported. All data replaced.' })
    } catch (err) {
      setStatus({ kind: 'error', message: `Import failed: ${String(err)}` })
    } finally {
      setPendingJson(null)
    }
  }

  // Days since last backup and whether to nudge (never, or > 7 days ago).
  const lastBackupAt = settings.lastBackupAt ?? null
  const daysSinceBackup =
    lastBackupAt !== null ? calendarDaysBetween(timestampToLocalDate(lastBackupAt), today()) : null
  const backupStale = daysSinceBackup === null || daysSinceBackup > 7

  const lastBackupLabel =
    daysSinceBackup === null
      ? 'You have never exported a backup.'
      : daysSinceBackup === 0
        ? 'Last backup: today.'
        : `Last backup: ${daysSinceBackup} day${daysSinceBackup === 1 ? '' : 's'} ago (${timestampToLocalDate(lastBackupAt!)}).`

  return (
    <div className="card">
      <h2 className="card__title">Backup &amp; data</h2>
      <p className="muted backup__hint">
        Your data lives only on this device. Export a backup regularly so you can
        restore it if the browser data is cleared.
      </p>

      <div className={`backup__durability${backupStale ? ' backup__durability--warn' : ''}`}>
        <p className="backup__durability-line">
          {backupStale ? '⚠️ ' : '✓ '}
          {lastBackupLabel}
        </p>
        {persistence && !persistence.persisted && (
          <p className="backup__durability-line muted">
            {persistence.supported
              ? 'Tip: install this app to your home screen to help the browser keep your data.'
              : 'This browser may clear stored data over time — keep backups.'}
          </p>
        )}
      </div>

      <div className="backup__group">
        <button type="button" className="btn btn--primary btn--block" onClick={handleExportJson}>
          Export backup (JSON)
        </button>
        <div className="backup__row">
          <button type="button" className="btn btn--ghost" onClick={handleExportWeightsCsv}>
            Weigh-ins CSV
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleExportWorkoutsCsv}>
            Workout sets CSV
          </button>
        </div>
      </div>

      <div className="backup__group">
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => fileInput.current?.click()}
        >
          Import backup (JSON)…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="backup__file"
          aria-label="Choose a JSON backup file"
          onChange={handleFilePicked}
        />
      </div>

      {status.kind !== 'idle' && (
        <p className={`backup__status backup__status--${status.kind}`} role="status">
          {status.message}
        </p>
      )}

      <ConfirmDialog
        open={pendingJson !== null}
        title="Import backup?"
        message="This replaces ALL current data (weigh-ins, workouts, templates, settings) with the contents of the file. This cannot be undone."
        confirmLabel="Replace all data"
        cancelLabel="Cancel"
        onConfirm={handleConfirmImport}
        onCancel={() => setPendingJson(null)}
      />
    </div>
  )
}
