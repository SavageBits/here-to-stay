import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

/**
 * Smoke test for the app shell (Phase 4): the provider + router mount, the
 * first-run seed gate resolves, and the dashboard + bottom nav render.
 */
describe('App shell', () => {
  it('renders the dashboard and bottom nav after seeding', async () => {
    render(<App />)
    // Loading gate shows first, then resolves to the dashboard.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument())
    // Bottom nav is present with the primary destinations. Scope queries to the
    // nav since some labels (e.g. "Weight") also appear in dashboard content.
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).getByText('Weight')).toBeInTheDocument()
    expect(within(nav).getByText('Workouts')).toBeInTheDocument()
  })
})
