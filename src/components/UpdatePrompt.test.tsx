import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The update prompt shows only when a new service worker needs activation, and
 * "Reload" calls updateServiceWorker(true). The PWA virtual module is mocked so
 * we control needRefresh.
 */

const updateServiceWorker = vi.fn()
let needRefresh = false
const setNeedRefresh = vi.fn((v: boolean) => {
  needRefresh = v
})

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}))

async function importPrompt() {
  return (await import('./UpdatePrompt')).UpdatePrompt
}

afterEach(() => {
  vi.clearAllMocks()
  needRefresh = false
})

describe('UpdatePrompt', () => {
  it('renders nothing when no update is pending', async () => {
    needRefresh = false
    const UpdatePrompt = await importPrompt()
    const { container } = render(<UpdatePrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the banner and reloads on "Reload" when an update is pending', async () => {
    needRefresh = true
    const user = userEvent.setup()
    const UpdatePrompt = await importPrompt()
    render(<UpdatePrompt />)

    expect(screen.getByText('A new version is available.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('dismisses the banner on "Later"', async () => {
    needRefresh = true
    const user = userEvent.setup()
    const UpdatePrompt = await importPrompt()
    render(<UpdatePrompt />)

    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(setNeedRefresh).toHaveBeenCalledWith(false)
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })
})
