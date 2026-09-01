/** Active workout logging (PRD §8, §14.1). Implemented in Phase 7. */
import { useParams } from 'react-router-dom'

export function WorkoutScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  return (
    <section className="screen">
      <h1>Workout</h1>
      <p className="muted">Set logging coming in Phase 7. Session: {sessionId}</p>
    </section>
  )
}
