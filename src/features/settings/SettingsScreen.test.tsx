import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsScreen } from './SettingsScreen'

/**
 * The About card surfaces the build-time app version and updated timestamp
 * (injected via Vite `define`, available to Vitest through the same config).
 */
describe('SettingsScreen — About', () => {
  it('shows the app version and a formatted updated time', async () => {
    render(<SettingsScreen />)

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()

    // Version comes from package.json via __APP_VERSION__ (semver-ish).
    const version = screen.getByText(/^\d+\.\d+\.\d+/)
    expect(version).toBeInTheDocument()

    // Updated time renders as a localized date string (contains a 4-digit year).
    await waitFor(() =>
      expect(screen.getByText('Updated').nextElementSibling?.textContent).toMatch(/\d{4}/),
    )
  })
})
