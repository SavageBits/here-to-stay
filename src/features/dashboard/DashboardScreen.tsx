/**
 * Dashboard / Today (PRD §4). Phase 5 wires up the weight portion (today's
 * weigh-in, most recent weight, 7-day average + trend) and quick actions.
 * The workout suggestion + "start workout" actions land in Phase 8.
 */

import { Link } from 'react-router-dom'
import { today } from '../../lib/dates'
import { useWeightSummary } from '../weight/useWeights'
import { DIRECTION_ICON, DIRECTION_LABEL, fmtDelta, fmtWeight } from '../weight/format'

export function DashboardScreen() {
  const summary = useWeightSummary()

  return (
    <section className="screen">
      <h1>Today</h1>
      <p className="muted">{today()}</p>

      <div className="card">
        <h2 className="card__title">Weight</h2>
        {summary?.todayEntry ? (
          <p className="dashboard__today">
            Weighed in today: <strong>{fmtWeight(summary.todayEntry.weight)} lb</strong>
          </p>
        ) : (
          <p className="muted">No weigh-in yet today.</p>
        )}

        <div className="dashboard__stats">
          <div>
            <span className="stat__value">{fmtWeight(summary?.latest?.weight ?? null)}</span>
            <span className="stat__label">Most recent</span>
          </div>
          <div>
            <span className="stat__value">{fmtWeight(summary?.average ?? null)}</span>
            <span className="stat__label">7-day avg</span>
          </div>
        </div>

        {summary && (
          <div className={`weight-summary__trend trend--${summary.direction}`}>
            <span aria-hidden>{DIRECTION_ICON[summary.direction]}</span>{' '}
            {DIRECTION_LABEL[summary.direction]} ({fmtDelta(summary.delta)} lb vs 7d ago)
          </div>
        )}

        <div className="dashboard__actions">
          <Link to="/weight" className="btn btn--primary">
            Log Weight
          </Link>
          <Link to="/weight/trend" className="btn btn--ghost">
            View Trend
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="card__title">Next workout</h2>
        <p className="muted">Workout suggestions and start actions come in Phase 8.</p>
      </div>
    </section>
  )
}
