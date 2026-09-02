/**
 * Workout template editor (PRD §6): add, rename, remove, reorder exercises and
 * set each one's target weight, for Workout A and Workout B. Template edits go
 * through templateRepo/exerciseRepo and never touch historical sessions
 * (PRD §16.3-4).
 */

import { useState } from 'react'
import { NumberField } from '../../components/NumberField'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { WorkoutType } from '../../domain/types'
import {
  addExerciseToTemplate,
  removeExerciseFromTemplate,
  reorderTemplateExercises,
  setTemplateRestSeconds,
  setTemplateTargetWeight,
} from '../../data/repositories/templateRepo'
import { renameExercise } from '../../data/repositories/exerciseRepo'
import { fmtWeight } from '../weight/format'
import { useReaddableExercises, useTemplate, type TemplateRow } from './useTemplate'
import type { ReaddableExercise } from '../../data/repositories/templateRepo'

export function TemplatesScreen() {
  const [type, setType] = useState<WorkoutType>('A')
  const view = useTemplate(type)
  const readdable = useReaddableExercises(type)

  const [newName, setNewName] = useState('')
  const [newTarget, setNewTarget] = useState<number | null>(null)
  const [removeRow, setRemoveRow] = useState<TemplateRow | null>(null)

  async function handleAdd() {
    const name = newName.trim()
    if (!name || !view) return
    await addExerciseToTemplate(view.template.id, { name, targetWeight: newTarget })
    setNewName('')
    setNewTarget(null)
  }

  async function handleReadd(ex: ReaddableExercise) {
    if (!view) return
    // Reuse the same logical exercise so history + progression are retained,
    // resuming at its last achieved target.
    await addExerciseToTemplate(view.template.id, {
      exerciseId: ex.exerciseId,
      targetWeight: ex.lastTarget,
    })
  }

  async function move(index: number, delta: number) {
    if (!view) return
    const ids = view.rows.map((r) => r.templateExercise.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await reorderTemplateExercises(ids)
  }

  return (
    <section className="screen">
      <h1>Workouts</h1>

      <div className="range-tabs" role="tablist" aria-label="Workout type">
        {(['A', 'B'] as WorkoutType[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            className={`range-tab${type === t ? ' range-tab--active' : ''}`}
            onClick={() => setType(t)}
          >
            Workout {t}
          </button>
        ))}
      </div>

      {view === undefined && <p className="muted">Loading…</p>}

      {view && (
        <>
          <ul className="template-list">
            {view.rows.map((row, i) => (
              <TemplateExerciseRow
                key={row.templateExercise.id}
                row={row}
                isFirst={i === 0}
                isLast={i === view.rows.length - 1}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, +1)}
                onRemove={() => setRemoveRow(row)}
              />
            ))}
          </ul>
          {view.rows.length === 0 && <p className="muted">No exercises yet.</p>}

          {readdable && readdable.length > 0 && (
            <div className="card">
              <h2 className="card__title">Add existing exercise</h2>
              <p className="muted readd__hint">
                Re-add a previously-used exercise. Its history and progression are
                kept.
              </p>
              <ul className="readd-list">
                {readdable.map((ex) => (
                  <li key={ex.exerciseId}>
                    <button
                      type="button"
                      className="readd-item"
                      onClick={() => handleReadd(ex)}
                    >
                      <span className="readd-item__main">
                        <span className="readd-item__name">{ex.name}</span>
                        <span className="readd-item__meta">
                          {ex.lastTarget !== null
                            ? `resumes at ${fmtWeight(ex.lastTarget)} lb`
                            : 'bodyweight'}
                          {ex.hasHistory ? ' · has history' : ''}
                        </span>
                      </span>
                      <span className="readd-item__add" aria-hidden>
                        + Add
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <h2 className="card__title">Add new exercise</h2>
            <label className="number-field">
              <span className="number-field__label">Name</span>
              <span className="number-field__control">
                <input
                  type="text"
                  value={newName}
                  placeholder="e.g. Bench Press"
                  aria-label="New exercise name"
                  onChange={(e) => setNewName(e.target.value)}
                />
              </span>
            </label>
            <div className="template-add__target">
              <NumberField
                label="Target weight (optional)"
                value={newTarget}
                onChange={setNewTarget}
                step={5}
                suffix="lb"
                placeholder="blank = bodyweight"
                ariaLabel="New exercise target weight"
              />
            </div>
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={!newName.trim()}
              onClick={handleAdd}
            >
              Add to Workout {type}
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={removeRow !== null}
        title="Remove exercise?"
        message={`Remove "${removeRow?.exercise.name}" from future Workout ${type} sessions? Past workouts keep it.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (removeRow) await removeExerciseFromTemplate(removeRow.templateExercise.id)
          setRemoveRow(null)
        }}
        onCancel={() => setRemoveRow(null)}
      />
    </section>
  )
}

interface RowProps {
  row: TemplateRow
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

function TemplateExerciseRow({ row, isFirst, isLast, onMoveUp, onMoveDown, onRemove }: RowProps) {
  const { templateExercise: te, exercise } = row
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(exercise.name)

  async function saveName() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== exercise.name) {
      await renameExercise(exercise.id, trimmed)
    }
    setEditingName(false)
  }

  return (
    <li className="template-row card">
      <div className="template-row__head">
        {editingName ? (
          <span className="template-row__rename">
            <input
              type="text"
              value={name}
              aria-label={`Rename ${exercise.name}`}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="button" className="btn btn--primary" onClick={saveName}>
              Save
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setName(exercise.name)
                setEditingName(false)
              }}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="template-row__name"
            onClick={() => setEditingName(true)}
            aria-label={`Rename ${exercise.name}`}
          >
            {exercise.name}
          </button>
        )}
      </div>

      <div className="template-row__controls">
        <div className="template-row__target">
          <NumberField
            label="Target"
            value={te.targetWeight}
            onChange={(v) => setTemplateTargetWeight(te.id, v)}
            step={5}
            suffix="lb"
            placeholder="bodyweight"
            ariaLabel={`Target weight for ${exercise.name}`}
          />
        </div>
        <div className="template-row__target">
          <NumberField
            label="Rest"
            value={te.restSeconds ?? null}
            onChange={(v) => setTemplateRestSeconds(te.id, v)}
            step={15}
            suffix="sec"
            placeholder="none"
            ariaLabel={`Rest seconds for ${exercise.name}`}
          />
        </div>
        <div className="template-row__reorder">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={isFirst}
            aria-label={`Move ${exercise.name} up`}
            onClick={onMoveUp}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={isLast}
            aria-label={`Move ${exercise.name} down`}
            onClick={onMoveDown}
          >
            ↓
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            aria-label={`Remove ${exercise.name}`}
            onClick={onRemove}
          >
            ✕
          </button>
        </div>
      </div>
    </li>
  )
}
