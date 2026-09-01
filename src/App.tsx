/**
 * App shell: React Query provider, first-run seed gate, and the router
 * (architecture §6). Reads use Dexie live queries; React Query is available for
 * any imperative async needs. Routes map to the PRD product areas.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { UpdatePrompt } from './components/UpdatePrompt'
import { useSeed } from './hooks/useSeed'
import { DashboardScreen } from './features/dashboard/DashboardScreen'
import { WeightScreen } from './features/weight/WeightScreen'
import { TrendScreen } from './features/weight/TrendScreen'
import { TemplatesScreen } from './features/templates/TemplatesScreen'
import { StartWorkoutScreen } from './features/workout/StartWorkoutScreen'
import { WorkoutScreen } from './features/workout/WorkoutScreen'
import { HistoryScreen } from './features/history/HistoryScreen'
import { WorkoutDetailScreen } from './features/history/WorkoutDetailScreen'
import { ExerciseHistoryScreen } from './features/history/ExerciseHistoryScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'

const queryClient = new QueryClient()

// Vite's base URL ('/' locally, '/here-to-stay/' on GitHub Pages). React Router
// wants a basename without a trailing slash (except the root '/').
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export default function App() {
  const seeded = useSeed()

  if (!seeded) {
    return (
      <div className="app-loading" role="status">
        Loading…
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <UpdatePrompt />
      <BrowserRouter basename={ROUTER_BASENAME}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardScreen />} />
            <Route path="weight" element={<WeightScreen />} />
            <Route path="weight/trend" element={<TrendScreen />} />
            <Route path="templates" element={<TemplatesScreen />} />
            <Route path="workout/start/:type" element={<StartWorkoutScreen />} />
            <Route path="workout/:sessionId" element={<WorkoutScreen />} />
            <Route path="history" element={<HistoryScreen />} />
            <Route path="history/:sessionId" element={<WorkoutDetailScreen />} />
            <Route path="exercise/:id/history" element={<ExerciseHistoryScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
