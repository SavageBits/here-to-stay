/**
 * Numeric input tuned for fast mobile entry (PRD §2 — minimal typing). Uses a
 * decimal input mode so phones show a number pad; reports parsed numbers (or
 * null when blank) rather than raw strings.
 */

interface NumberFieldProps {
  label?: string
  value: number | null
  onChange: (value: number | null) => void
  step?: number
  min?: number
  placeholder?: string
  suffix?: string
  ariaLabel?: string
}

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  placeholder,
  suffix,
  ariaLabel,
}: NumberFieldProps) {
  return (
    <label className="number-field">
      {label && <span className="number-field__label">{label}</span>}
      <span className="number-field__control">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={value ?? ''}
          placeholder={placeholder}
          aria-label={ariaLabel ?? label}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === '' ? null : Number(raw))
          }}
          onFocus={(e) => e.target.select()}
        />
        {suffix && <span className="number-field__suffix">{suffix}</span>}
      </span>
    </label>
  )
}
