/**
 * "New version available — reload" prompt. With the PWA registered in 'prompt'
 * mode, a freshly deployed service worker waits instead of activating silently;
 * this banner lets the user apply it on demand (architecture §7). `updateServiceWorker(true)`
 * activates the new worker and reloads the page.
 */

import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="update-prompt" role="alert">
      <span className="update-prompt__text">A new version is available.</span>
      <span className="update-prompt__actions">
        <button
          type="button"
          className="btn btn--primary update-prompt__btn"
          onClick={() => updateServiceWorker(true)}
        >
          Reload
        </button>
        <button
          type="button"
          className="btn btn--ghost update-prompt__btn"
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </button>
      </span>
    </div>
  )
}
