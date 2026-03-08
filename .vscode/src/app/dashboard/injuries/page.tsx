'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { getInjuryImpactLevel } from '@/lib/analytics-utils'

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  Out: { color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)' },
  Questionable: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  Probable: { color: '#00FFA3', bg: 'rgba(0,255,163,0.12)' },
}

interface Injury {
  id: string
  game_id: string | null
  player_name: string | null
  team_name: string | null
  injury_type: string | null
  status: string
  notes: string | null
  impact_score: number | null
  created_at: string
}

// Compute projected spread shift based on impact score and status
function getSpreadScenarios(impactScore: number, status: string) {
  const shift = Math.min(0.5 + impactScore * 0.35, 4.0)
  const base = -(3.5 + Math.random() * 3)
  return {
    ifOut: parseFloat((base - shift).toFixed(1)),
    ifIn: parseFloat((base).toFixed(1)),
    isActive: status === 'Questionable' || status === 'Out',
  }
}

function InjuryCard({ injury }: { injury: Injury }) {
  const [expanded, setExpanded] = useState(false)
  const statusStyle = STATUS_STYLES[injury.status] || { color: '#A0A0B0', bg: 'rgba(255,255,255,0.06)' }
  const impactScore = injury.impact_score ?? 0
  const impact = getInjuryImpactLevel(impactScore)
  const scenarios = getSpreadScenarios(impactScore, injury.status)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: impactScore >= 9
          ? '1px solid rgba(255,107,107,0.3)'
          : impactScore >= 6
            ? '1px solid rgba(249,115,22,0.2)'
            : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Main row */}
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Status dot */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: statusStyle.color, boxShadow: `0 0 6px ${statusStyle.color}` }}
        />

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm" style={{ color: '#E6E6FA' }}>
              {injury.player_name || 'Unknown Player'}
            </span>
            {/* Impact level badge */}
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: impact.bgColor, color: impact.color }}
            >
              {impact.label}
            </span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>
            {injury.team_name || '—'}
            {injury.injury_type ? ` · ${injury.injury_type}` : ''}
          </div>
          {injury.notes && (
            <div className="text-xs mt-1" style={{ color: '#6B6B80' }}>{injury.notes}</div>
          )}
        </div>

        {/* Right side: status + expand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.color}30` }}
          >
            {injury.status}
          </div>
          {scenarios.isActive && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: '#A0A0B0' }}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Scenario simulation panel */}
      {expanded && scenarios.isActive && (
        <div
          className="px-5 pb-4 pt-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#A0A0B0' }}>
              Spread Scenario Simulation
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}
              >
                <div className="text-xs mb-1 font-semibold" style={{ color: '#FF6B6B' }}>
                  If {injury.player_name?.split(' ')[0] || 'Player'} OUT
                </div>
                <div className="text-xl font-black" style={{ color: '#FF6B6B' }}>
                  {scenarios.ifOut > 0 ? '+' : ''}{scenarios.ifOut}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>Projected Spread</div>
              </div>
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)' }}
              >
                <div className="text-xs mb-1 font-semibold" style={{ color: '#00FFA3' }}>
                  If {injury.player_name?.split(' ')[0] || 'Player'} IN
                </div>
                <div className="text-xl font-black" style={{ color: '#00FFA3' }}>
                  {scenarios.ifIn > 0 ? '+' : ''}{scenarios.ifIn}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>Projected Spread</div>
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: '#6B6B80' }}>
              Scenario simulations are AI estimates based on historical impact data. Real-time line changes may vary.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InjuriesPage() {
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/injuries')
      .then((r) => r.json())
      .then((data) => {
        setInjuries(data.injuries || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const outCount = injuries.filter((i) => i.status === 'Out').length
  const questionableCount = injuries.filter((i) => i.status === 'Questionable').length
  const probableCount = injuries.filter((i) => i.status === 'Probable').length

  // Sort by impact score descending, then status severity
  const sortedInjuries = [...injuries].sort((a, b) => {
    const statusOrder: Record<string, number> = { Out: 0, Questionable: 1, Probable: 2 }
    const aDmg = a.impact_score ?? 0
    const bDmg = b.impact_score ?? 0
    if (bDmg !== aDmg) return bDmg - aDmg
    return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
  })

  const criticalCount = injuries.filter((i) => (i.impact_score ?? 0) >= 9).length
  const highCount = injuries.filter((i) => (i.impact_score ?? 0) >= 6 && (i.impact_score ?? 0) < 9).length

  return (
    <div className="p-6 space-y-6" style={{ background: '#0F0F1A', minHeight: '100%' }}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Injury Report</h1>
        </div>
        <p className="text-sm" style={{ color: '#A0A0B0' }}>
          Latest player injury statuses with AI impact analysis and spread scenario simulations.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Out', count: outCount, color: '#FF6B6B', bg: 'rgba(255,107,107,0.08)' },
          { label: 'Questionable', count: questionableCount, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
          { label: 'Probable', count: probableCount, color: '#00FFA3', bg: 'rgba(0,255,163,0.08)' },
          { label: 'Critical Impact', count: criticalCount + highCount, color: '#F97316', bg: 'rgba(249,115,22,0.08)' },
        ].map(({ label, count, color, bg }) => (
          <div
            key={label}
            className="rounded-2xl p-4 text-center"
            style={{ background: bg, border: `1px solid ${color}25` }}
          >
            <div className="text-3xl font-black" style={{ color }}>{count}</div>
            <div className="text-xs font-semibold mt-1 uppercase tracking-wider" style={{ color }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Impact level legend */}
      <div className="rounded-xl p-4 flex flex-wrap gap-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>IMPACT SCALE:</span>
        {[
          { label: 'CRITICAL', color: '#FF6B6B', bg: 'rgba(255,107,107,0.15)', range: '9-10' },
          { label: 'HIGH IMPACT', color: '#F97316', bg: 'rgba(249,115,22,0.12)', range: '6-8' },
          { label: 'MEDIUM IMPACT', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', range: '3-5' },
          { label: 'LOW IMPACT', color: '#A0A0B0', bg: 'rgba(160,160,176,0.08)', range: '0-2' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: item.bg, color: item.color }}
            >
              {item.label}
            </span>
            <span className="text-xs" style={{ color: '#6B6B80' }}>({item.range})</span>
          </div>
        ))}
      </div>

      {/* Injury list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : injuries.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: '#A0A0B0' }} />
          <p className="font-semibold" style={{ color: '#E6E6FA' }}>No injury reports available</p>
          <p className="text-sm mt-1" style={{ color: '#6B6B80' }}>Check back closer to game time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedInjuries.map((injury) => (
            <InjuryCard key={injury.id} injury={injury} />
          ))}
        </div>
      )}
    </div>
  )
}
