/** "Start from previous" preview (PRD §7, §14.2). Implemented in Phase 7. */
import { useParams } from 'react-router-dom'

export function StartWorkoutScreen() {
  const { type } = useParams<{ type: string }>()
  return (
    <section className="screen">
      <h1>Start Workout {type?.toUpperCase()}</h1>
      <p className="muted">Start-from-previous preview coming in Phase 7.</p>
    </section>
  )
}
