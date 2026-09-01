/**
 * Weight tracking (PRD §5): fast daily weigh-in, 7-day average + trend summary,
 * and an editable/deletable list of past weigh-ins.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NumberField } from '../../components/NumberField'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { today } from '../../lib/dates'
import {
  deleteWeight,
  updateWeight,
  upsertWeight,
} from '../../data/repositories/weightRepo'
import { useAllWeights, useWeightSummary } from './useWeights'
import { DIRECTION_ICON, DIRECTION_LABEL, fmtDelta, fmtWeight } from './format'

export function WeightScreen() {
  const entries = useAllWeights()
  const summary = useWeightSummary()

  const [date, setDate] = useState(today())
  const [weight, setWeight] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Most recent weight, used only as a placeholder hint — never auto-saved
  // (PRD §5.1).
  const lastWeight = summary?.latest?.weight ?? null

  async function handleLog() {
    if (weight === null) return
    await upsertWeight(date, weight)
    setWeight(null)
    setDate(today())
  }

  async function handleSaveEdit(id: string) {
    if (editWeight !== null) await updateWeight(id, { weight: editWeight })
    setEditingId(null)
  }

  return (
    <section className="screen">
      <h1>Weight</h1>

      {/* Summary */}
      <div className="card weight-summary">
        <div className="weight-summary__main">
          <span className="weight-summary__avg">{fmtWeight(summary?.average ?? null)}</span>
          <span className="weight-summary__unit">lb · 7-day avg</span>
        </div>
        {summary && (
          <div className={`weight-summary__trend trend--${summary.direction}`}>
            <span aria-hidden>{DIRECTION_ICON[summary.direction]}</span>{' '}
            {DIRECTION_LABEL[summary.direction]} ({fmtDelta(summary.delta)} lb vs 7d ago)
          </div>
        )}
        <Link to="/weight/trend" className="btn btn--ghost btn--block weight-summary__link">
          View trend chart
        </Link>
      </div>

      {/* Log form */}
      <div className="card">
        <h2 className="card__title">Log a weigh-in</h2>
        <div className="weight-form">
          <label className="number-field">
            <span className="number-field__label">Date</span>
            <span className="number-field__control">
              <input
                type="date"
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value)}
              />
            </span>
          </label>
          <NumberField
            label="Weight"
            value={weight}
            onChange={setWeight}
            step={0.1}
            suffix="lb"
            placeholder={lastWeight !== null ? fmtWeight(lastWeight) : 'e.g. 164.8'}
            ariaLabel="Weight"
          />
        </div>
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={weight === null}
          onClick={handleLog}
        >
          Save weigh-in
        </button>
      </div>

      {/* History list */}
      <h2 className="section-title">History</h2>
      {entries && entries.length === 0 && <p className="muted">No weigh-ins yet.</p>}
      <ul className="weight-list">
        {entries
          ?.slice()
          .reverse()
          .map((e) => (
            <li key={e.id} className="weight-row card">
              <span className="weight-row__date">{e.date}</span>
              {editingId === e.id ? (
                <span className="weight-row__edit">
                  <NumberField
                    value={editWeight}
                    onChange={setEditWeight}
                    step={0.1}
                    suffix="lb"
                    ariaLabel={`Edit weight for ${e.date}`}
                  />
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => handleSaveEdit(e.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <span className="weight-row__actions">
                  <span className="weight-row__weight">{fmtWeight(e.weight)} lb</span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setEditingId(e.id)
                      setEditWeight(e.weight)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setDeleteId(e.id)}
                  >
                    Delete
                  </button>
                </span>
              )}
            </li>
          ))}
      </ul>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete weigh-in?"
        message="This removes the weigh-in permanently."
        onConfirm={async () => {
          if (deleteId) await deleteWeight(deleteId)
          setDeleteId(null)
        }}
        onCancel={() => setDeleteId(null)}
      />
    </section>
  )
}
