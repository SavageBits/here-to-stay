/**
 * A single editable set row within an exercise (PRD §8, §14.1): weight + reps,
 * with a delete control. Weight may be blank for bodyweight exercises.
 */

import { NumberField } from '../../components/NumberField'

interface SetRowProps {
  setNumber: number
  weight: number | null
  reps: number
  onChangeWeight: (v: number | null) => void
  onChangeReps: (v: number | null) => void
  onDelete: () => void
}

export function SetRow({
  setNumber,
  weight,
  reps,
  onChangeWeight,
  onChangeReps,
  onDelete,
}: SetRowProps) {
  return (
    <div className="set-row">
      <span className="set-row__num">Set {setNumber}</span>
      <div className="set-row__field">
        <NumberField
          value={weight}
          onChange={onChangeWeight}
          step={5}
          suffix="lb"
          placeholder="—"
          ariaLabel={`Set ${setNumber} weight`}
        />
      </div>
      <div className="set-row__field">
        <NumberField
          value={reps}
          onChange={(v) => onChangeReps(v)}
          step={1}
          suffix="reps"
          ariaLabel={`Set ${setNumber} reps`}
        />
      </div>
      <button
        type="button"
        className="btn btn--ghost set-row__delete"
        aria-label={`Delete set ${setNumber}`}
        onClick={onDelete}
      >
        ✕
      </button>
    </div>
  )
}
