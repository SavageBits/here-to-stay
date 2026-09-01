/** Workout detail view (PRD §12). Implemented in Phase 9. */
import { useParams } from 'react-router-dom'

export function WorkoutDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  return (
    <section className="screen">
      <h1>Workout Detail</h1>
      <p className="muted">Detail view coming in Phase 9. Session: {sessionId}</p>
    </section>
  )
}
