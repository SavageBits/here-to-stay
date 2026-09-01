/**
 * Browser file download / read helpers for backup export & import
 * (architecture §7). Kept out of the repositories so persistence stays
 * DOM-free and unit-testable.
 */

/** Trigger a client-side download of `content` as a file named `filename`. */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Read a picked File as text. */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/** A date-stamped filename base, e.g. `health-backup-2026-08-31`. */
export function stampedName(base: string, dateISO: string): string {
  return `${base}-${dateISO}`
}
