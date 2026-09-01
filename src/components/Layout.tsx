/**
 * Mobile-first app shell: a scrollable content area with a fixed bottom nav
 * (thumb-friendly primary navigation — PRD §14.1). Renders the active route via
 * <Outlet />.
 */

import { NavLink, Outlet } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: '🏠' },
  { to: '/weight', label: 'Weight', icon: '⚖️' },
  { to: '/history', label: 'History', icon: '📈' },
  { to: '/templates', label: 'Workouts', icon: '🏋️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export function Layout() {
  return (
    <div className="app-shell">
      <main className="app-content">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Primary">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <span className="nav-item__icon" aria-hidden>
              {item.icon}
            </span>
            <span className="nav-item__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
