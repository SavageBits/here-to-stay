/**
 * Weight trend chart (PRD §5.3): daily weigh-ins with a prominent 7-day moving
 * average, selectable time ranges, and the current average + direction.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendRange } from '../../domain/types'
import { movingAverageSeries } from '../../domain/weightStats'
import { useAllWeights, useWeightSummary } from './useWeights'
import { DIRECTION_ICON, DIRECTION_LABEL, fmtDelta, fmtWeight } from './format'

const RANGES: Array<{ key: TrendRange; label: string }> = [
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '6m', label: '6m' },
  { key: '1y', label: '1y' },
  { key: 'all', label: 'All' },
]

export function TrendScreen() {
  const entries = useAllWeights()
  const summary = useWeightSummary()
  const [range, setRange] = useState<TrendRange>('90d')

  const series = entries ? movingAverageSeries(entries, range) : []

  return (
    <section className="screen">
      <h1>Weight Trend</h1>

      <div className="card">
        <div className="weight-summary__main">
          <span className="weight-summary__avg">{fmtWeight(summary?.average ?? null)}</span>
          <span className="weight-summary__unit">lb · 7-day avg</span>
        </div>
        {summary && (
          <div className={`weight-summary__trend trend--${summary.direction}`}>
            <span aria-hidden>{DIRECTION_ICON[summary.direction]}</span>{' '}
            {DIRECTION_LABEL[summary.direction]} ({fmtDelta(summary.delta)} lb vs 7d ago)
          </div>
        )}
      </div>

      <div className="range-tabs" role="tablist" aria-label="Time range">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={range === r.key}
            className={`range-tab${range === r.key ? ' range-tab--active' : ''}`}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="card chart-card">
        {series.length === 0 ? (
          <p className="muted">No weigh-ins in this range yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} minTickGap={28} />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: 8,
                  color: '#f9fafb',
                }}
                formatter={(v: number) => fmtWeight(v)}
              />
              {/* Daily weigh-ins: subtle. */}
              <Line
                type="monotone"
                dataKey="weight"
                name="Daily"
                stroke="#4b5563"
                strokeWidth={1}
                dot={{ r: 2, fill: '#6b7280' }}
                isAnimationActive={false}
              />
              {/* 7-day average: prominent (PRD §5.3). */}
              <Line
                type="monotone"
                dataKey="average"
                name="7-day avg"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <Link to="/weight" className="btn btn--ghost btn--block">
        Back to weight
      </Link>
    </section>
  )
}
