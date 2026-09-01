/**
 * Exercise history (PRD §13): for one logical exercise, list each completed
 * session's date, target, actual weights, reps, whether progression was
 * achieved, and the next target.
 */

import { useNavigate, useParams } from 'react-router-dom'
import { fmtWeight } from '../weight/format'
import { useExerciseHistory } from './useHistory'

export function ExerciseHistoryScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const history = useExerciseHistory(id)

  if (history === undefined) return <p className="muted screen">Loading…</p>

  const { exercise, entries } = history

  return (
    <section className="screen">
      <h1>{exercise?.name ?? 'Exercise'} history</h1>

      {entries.length === 0 && <p className="muted">No completed sessions yet.</p>}

      {entries.map(({ workoutExercise: we, sets, session }) => (
        <div key={we.id} className="card">
          <div className="detail-exercise__head">
            <h2 className="detail-exercise__name">{session.completedAt?.slice(0, 10)}</h2>
            <span className="muted">Workout {session.workoutType}</span>
          </div>

          {we.targetWeightSnapshot !== null && (
            <p className="detail-exercise__target">
              Target: {fmtWeight(we.targetWeightSnapshot)} lb
            </p>
          )}

          <ul className="detail-sets">
            {sets.map((s) => (
              <li key={s.id} className="detail-sets__row">
                {s.weight !== null ? `${fmtWeight(s.weight)} × ${s.reps}` : `${s.reps} reps`}
              </li>
            ))}
            {sets.length === 0 && <li className="muted">No sets recorded.</li>}
          </ul>

          {we.completed && we.targetWeightSnapshot !== null && (
            <p
              className={`detail-exercise__result ${
                we.progressionAchieved ? 'result--up' : 'result--flat'
              }`}
            >
              {we.progressionAchieved
                ? `Achieved → next ${fmtWeight(we.nextTargetWeight)} lb`
                : `Not achieved → target ${fmtWeight(we.nextTargetWeight)} lb`}
            </p>
          )}
        </div>
      ))}

      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => navigate(-1)}
      >
        Back
      </button>
    </section>
  )
}
