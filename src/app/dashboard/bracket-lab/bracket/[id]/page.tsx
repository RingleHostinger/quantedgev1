'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Pencil, Zap, ArrowLeft } from 'lucide-react'
import { BracketTeam, BracketPicks, GRADE_COLORS, RISK_COLORS, getPoolSizeLabel } from '@/lib/bracket-analysis'
import { BracketRegion, getRegionE8Winner } from '@/components/BracketRegion'
import { useAuth } from '@/hooks/useAuth'

interface Bracket {
  id: string
  name: string
  pool_size: number
  source: string
  bracket_score: string
  win_probability: number
  risk_level: string
  uniqueness_score: number
  picks: BracketPicks
  created_at: string
  updated_at: string
}

const REGIONS = ['East', 'West', 'South', 'Midwest']

// No-op pick handler for read-only mode
function noop() {}

export default function BracketViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isPremium, loading: authLoading } = useAuth()
  const router = useRouter()
  const [bracket, setBracket] = useState<Bracket | null>(null)
  const [teams, setTeams] = useState<BracketTeam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isPremium) router.push('/dashboard/pricing')
  }, [authLoading, isPremium, router])

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/brackets/${id}`).then(r => r.json()),
      fetch('/api/bracket-teams').then(r => r.json()),
    ])
      .then(([bracketData, teamsData]) => {
        setBracket(bracketData.bracket ?? null)
        setTeams(teamsData.teams ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#00FFA3', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!bracket) {
    return (
      <div className="text-center py-20">
        <p style={{ color: '#A0A0B0' }}>Bracket not found.</p>
        <button onClick={() => router.push('/dashboard/bracket-lab')}
          className="mt-4 text-sm underline" style={{ color: '#00FFA3' }}>
          Back to My Brackets
        </button>
      </div>
    )
  }

  const gradeColor = GRADE_COLORS[bracket.bracket_score] ?? '#A0A0B0'
  const riskColor = RISK_COLORS[bracket.risk_level] ?? '#F59E0B'
  const picks = bracket.picks

  const regionTeams = Object.fromEntries(
    REGIONS.map(r => [r, teams.filter(t => t.region === r).sort((a, b) => a.seed - b.seed)])
  )

  // Final Four matchups from E8 winners
  const eastWinner = getRegionE8Winner('East', picks)
  const westWinner = getRegionE8Winner('West', picks)
  const southWinner = getRegionE8Winner('South', picks)
  const midwestWinner = getRegionE8Winner('Midwest', picks)

  const ff1Winner = (picks.finalFour as Record<string, string>)?.['FF_top'] ?? null
  const ff2Winner = (picks.finalFour as Record<string, string>)?.['FF_bottom'] ?? null
  const champion = picks.champion ?? ''

  return (
    <div className="max-w-full px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button onClick={() => router.push('/dashboard/bracket-lab')}
            className="text-xs mb-2 hover:underline flex items-center gap-1" style={{ color: '#6B6B80' }}>
            <ArrowLeft className="w-3 h-3" />
            My Brackets
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0"
              style={{ background: `${gradeColor}15`, color: gradeColor }}>
              {bracket.bracket_score ?? '?'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{bracket.name}</h1>
              <p className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>
                {getPoolSizeLabel(bracket.pool_size)} &middot; Created {new Date(bracket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} &middot; Updated {new Date(bracket.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Eye className="w-3.5 h-3.5" />
            Read-only
          </div>
          <button
            onClick={() => router.push(`/dashboard/bracket-lab/bracket/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={() => router.push(`/dashboard/bracket-lab/bracket/${id}/analysis`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.2)' }}>
            <Zap className="w-3.5 h-3.5" />
            AI Analyze
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Win Probability', value: `${bracket.win_probability}%`, color: '#00FFA3' },
          { label: 'Risk Level', value: bracket.risk_level, color: riskColor },
          { label: 'Uniqueness', value: `${bracket.uniqueness_score}/100`, color: bracket.uniqueness_score >= 65 ? '#00FFA3' : bracket.uniqueness_score >= 35 ? '#F59E0B' : '#FF6B6B' },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-4 py-2.5 rounded-xl text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-xs mb-0.5" style={{ color: '#6B6B80' }}>{label}</div>
            <div className="text-sm font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Read-only notice */}
      <div className="rounded-xl px-4 py-2 flex items-center gap-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: '#6B6B80' }} />
        <p className="text-xs" style={{ color: '#6B6B80' }}>
          This is a read-only view. To change picks, use <strong className="text-white">Edit</strong>.
        </p>
      </div>

      {/* Bracket display — read-only (noop onPick) */}
      <div className="overflow-x-auto rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex gap-6 items-start min-w-max">
          {/* Left side: East + South */}
          <div className="flex flex-col gap-8">
            {(['East', 'South'] as const).map(region => (
              <div key={region}>
                <div className="text-xs font-bold mb-2 px-1" style={{ color: '#F59E0B' }}>{region}</div>
                <div style={{ pointerEvents: 'none' }}>
                  <BracketRegion
                    region={region}
                    teams={regionTeams[region] ?? []}
                    picks={picks}
                    onPick={noop}
                    side="left"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Center: Final Four + Championship */}
          <div className="flex flex-col items-center justify-center gap-4 px-4 py-6 rounded-2xl self-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', minWidth: '180px' }}>
            <div className="text-xs font-bold uppercase tracking-wider text-center" style={{ color: '#F59E0B' }}>Final Four</div>

            {/* FF top matchup (East vs West) */}
            <div className="space-y-1 w-full">
              <div className="text-[10px] text-center mb-1" style={{ color: '#6B6B80' }}>East vs West</div>
              {[eastWinner, westWinner].map((name, i) => (
                <div key={i} className={`px-3 py-1.5 rounded-lg text-xs font-medium text-center`}
                  style={{
                    background: ff1Winner === name && name ? 'rgba(0,255,163,0.12)' : 'rgba(255,255,255,0.04)',
                    border: ff1Winner === name && name ? '1px solid rgba(0,255,163,0.3)' : '1px solid rgba(255,255,255,0.07)',
                    color: ff1Winner === name && name ? '#00FFA3' : name ? '#C0C0D0' : '#3A3A50',
                  }}>
                  {name ?? 'TBD'}
                </div>
              ))}
            </div>

            <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

            {/* FF bottom matchup (South vs Midwest) */}
            <div className="space-y-1 w-full">
              <div className="text-[10px] text-center mb-1" style={{ color: '#6B6B80' }}>South vs Midwest</div>
              {[southWinner, midwestWinner].map((name, i) => (
                <div key={i} className={`px-3 py-1.5 rounded-lg text-xs font-medium text-center`}
                  style={{
                    background: ff2Winner === name && name ? 'rgba(0,255,163,0.12)' : 'rgba(255,255,255,0.04)',
                    border: ff2Winner === name && name ? '1px solid rgba(0,255,163,0.3)' : '1px solid rgba(255,255,255,0.07)',
                    color: ff2Winner === name && name ? '#00FFA3' : name ? '#C0C0D0' : '#3A3A50',
                  }}>
                  {name ?? 'TBD'}
                </div>
              ))}
            </div>

            <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

            {/* Championship */}
            <div className="text-xs font-bold uppercase tracking-wider text-center" style={{ color: '#F59E0B' }}>Champion</div>
            <div className="px-4 py-2.5 rounded-xl text-sm font-black text-center w-full"
              style={{
                background: champion ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                border: champion ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.07)',
                color: champion ? '#F59E0B' : '#3A3A50',
              }}>
              {champion || 'TBD'}
            </div>
          </div>

          {/* Right side: West + Midwest */}
          <div className="flex flex-col gap-8">
            {(['West', 'Midwest'] as const).map(region => (
              <div key={region}>
                <div className="text-xs font-bold mb-2 px-1 text-right" style={{ color: '#F59E0B' }}>{region}</div>
                <div style={{ pointerEvents: 'none' }}>
                  <BracketRegion
                    region={region}
                    teams={regionTeams[region] ?? []}
                    picks={picks}
                    onPick={noop}
                    side="right"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
