/**
 * Settings (PRD §19): workout logging preference and backup/export/import.
 */

import type { AfterExerciseBehavior } from '../../domain/entities'
import { setAfterExercise } from '../../data/repositories/settingsRepo'
import { useSettings } from '../../hooks/useSettings'
import { timestampToLocalDateTime } from '../../lib/dates'
import { BackupCard } from './BackupCard'

const AFTER_OPTIONS: Array<{ value: AfterExerciseBehavior; label: string; hint: string }> = [
  {
    value: 'list',
    label: 'Return to exercise list',
    hint: 'After finishing an exercise, go back to the list to pick the next one.',
  },
  {
    value: 'next',
    label: 'Advance to next exercise',
    hint: 'After finishing an exercise, jump straight into the next one.',
  },
]

export function SettingsScreen() {
  const settings = useSettings()

  return (
    <section className="screen">
      <h1>Settings</h1>

      <div className="card">
        <h2 className="card__title">When I finish an exercise</h2>
        <div className="settings-options">
          {AFTER_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`settings-option${
                settings.afterExercise === opt.value ? ' settings-option--active' : ''
              }`}
            >
              <input
                type="radio"
                name="afterExercise"
                checked={settings.afterExercise === opt.value}
                onChange={() => setAfterExercise(opt.value)}
              />
              <span>
                <span className="settings-option__label">{opt.label}</span>
                <span className="settings-option__hint">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <BackupCard />

      <div className="card">
        <h2 className="card__title">About</h2>
        <dl className="about">
          <dt>Version</dt>
          <dd>{__APP_VERSION__}</dd>
          <dt>Updated</dt>
          <dd>{timestampToLocalDateTime(__BUILD_TIME__)}</dd>
        </dl>
      </div>
    </section>
  )
}
