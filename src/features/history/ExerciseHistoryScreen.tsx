/** Exercise history (PRD §13). Implemented in Phase 9. */
import { useParams } from 'react-router-dom'

export function ExerciseHistoryScreen() {
  const { id } = useParams<{ id: string }>()
  return (
    <section className="screen">
      <h1>Exercise History</h1>
      <p className="muted">Exercise history coming in Phase 9. Exercise: {id}</p>
    </section>
  )
}
