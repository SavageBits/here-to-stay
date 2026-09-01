/**
 * Completed workout history list (PRD §12): date, A/B, exercises completed.
 * Tapping a row opens the detail view.
 */

import { Link } from 'react-router-dom'
import { timestampToLocalDate } from '../../lib/dates'
import { useWorkoutHistory } from './useHistory'

export function HistoryScreen() {
  const history = useWorkoutHistory()

  return (
    <section className="screen">
      <h1>History</h1>

      {history === undefined && <p className="muted">Loading…</p>}
      {history && history.length === 0 && (
        <p className="muted">No completed workouts yet.</p>
      )}

      <ul className="history-list">
        {history?.map(({ session, exerciseCount }) => (
          <li key={session.id}>
            <Link to={`/history/${session.id}`} className="history-row">
              <span className="history-row__main">
                <span className="history-row__title">Workout {session.workoutType}</span>
                <span className="history-row__meta">
                  {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'} completed
                </span>
              </span>
              <span className="history-row__date">
                {session.completedAt ? timestampToLocalDate(session.completedAt) : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
