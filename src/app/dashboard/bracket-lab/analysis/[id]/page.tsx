'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Zap, TrendingUp, TrendingDown, AlertTriangle,
  Star, Shield, Target, Users, ChevronDown, ChevronUp, Radio
} from 'lucide-react'
import { BracketAnalysis, GRADE_COLORS, RISK_COLORS, getPoolSizeLabel } from '@/lib/bracket-analysis'
import { useAuth } from '@/hooks/useAuth'

interface Bracket {
  id: string
  name: string
  pool_size: number
  bracket_score: string
  win_probability: number
  risk_level: string
  uniqueness_score: number
  analysis: BracketAnalysis
  created_at: string
  updated_at: string
}

const POOL_SIZES = [10, 25, 50, 100, 500]

function WinProbBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs" style={{ color: '#A0A0B0' }}>{label}</span>
        <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${(value / max) * 100}%`, background: 'linear-gradient(90deg, #00FFA3, #00CC82)' }}
        />
      </div>
    </div>
  )
}

function RiskMeter({ score, label }: { score: number; label: string }) {
  const pct = score
  const color = RISK_COLORS[label] ?? '#F59E0B'
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs" style={{ color: '#6B6B80' }}>
        <span>Safe</span>
        <span>Balanced</span>
        <span>Aggressive</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, #00FFA3 0%, #F59E0B 50%, #FF6B6B 100%)`,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white transition-all duration-700"
          style={{ left: `calc(${pct}% - 8px)`, background: color }}
        />
      </div>
      <div className="text-center">
        <span className="text-sm font-bold px-3 py-1 rounded-full"
          style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}>
          {label}
        </span>
      </div>
    </div>
  )
}

function UniquenessBlock({ score }: { score: number }) {
  const blocks = 10
  const filled = Math.round(score / 10)
  const color = score >= 65 ? '#00FFA3' : score >= 35 ? '#F59E0B' : '#FF6B6B'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs" style={{ color: '#A0A0B0' }}>Uniqueness Score</span>
        <span className="text-xl font-bold font-mono" style={{ color }}>{score}</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: blocks }).map((_, i) => (
          <div key={i} className="flex-1 h-2.5 rounded-sm transition-all"
            style={{ background: i < filled ? color : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>
    </div>
  )
}

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isPremium, loading: authLoading } = useAuth()
  const router = useRouter()
  const [bracket, setBracket] = useState<Bracket | null>(null)
  const [loading, setLoading] = useState(true)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [showWinProbs, setShowWinProbs] = useState(true)

  useEffect(() => {
    if (!authLoading && !isPremium) router.push('/dashboard/pricing')
  }, [authLoading, isPremium, router])

  useEffect(() => {
    if (!id) return
    fetch(`/api/brackets/${id}`)
      .then(r => r.json())
      .then(d => { setBracket(d.bracket); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function handleReanalyze() {
    setReanalyzing(true)
    try {
      const res = await fetch(`/api/brackets/${id}/analyze`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setBracket(prev => prev ? { ...prev, analysis: data.analysis, bracket_score: data.analysis.scoreGrade, win_probability: data.analysis.winProbs[prev.pool_size], risk_level: data.analysis.riskLevel, uniqueness_score: data.analysis.uniquenessScore } : prev)
      }
    } finally {
      setReanalyzing(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#00FFA3', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!bracket || !bracket.analysis) {
    return (
      <div className="text-center py-20">
        <p style={{ color: '#A0A0B0' }}>Bracket not found.</p>
        <button onClick={() => router.push('/dashboard/bracket-lab')} className="mt-4 text-sm underline" style={{ color: '#00FFA3' }}>
          Back to My Brackets
        </button>
      </div>
    )
  }

  const a = bracket.analysis
  const gradeColor = GRADE_COLORS[bracket.bracket_score] ?? '#A0A0B0'
  const maxWinProb = Math.max(...Object.values(a.winProbs))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button onClick={() => router.push('/dashboard/bracket-lab')}
            className="text-xs mb-2 hover:underline flex items-center gap-1" style={{ color: '#6B6B80' }}>
            ← My Brackets
          </button>
          <h1 className="text-2xl font-bold text-white">{bracket.name}</h1>
          <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>
            Pool: {getPoolSizeLabel(bracket.pool_size)} · Last analyzed {new Date(bracket.updated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <RefreshCw className={`w-4 h-4 ${reanalyzing ? 'animate-spin' : ''}`} />
            Reanalyze
          </button>
          <button
            onClick={() => router.push(`/dashboard/bracket-lab/compare?id=${id}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all gradient-green text-black hover:opacity-90"
          >
            <Zap className="w-4 h-4" />
            Optimize My Bracket
          </button>
        </div>
      </div>

      {/* Grade + Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Grade */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl p-5 flex flex-col items-center justify-center text-center"
          style={{ background: `${gradeColor}10`, border: `1px solid ${gradeColor}30` }}>
          <div className="text-5xl font-black mb-1" style={{ color: gradeColor }}>{bracket.bracket_score}</div>
          <div className="text-xs font-medium" style={{ color: gradeColor }}>Bracket Grade</div>
        </div>
        {[
          { icon: TrendingUp, label: 'Win Probability', value: `${bracket.win_probability}%`, color: '#00FFA3', sub: getPoolSizeLabel(bracket.pool_size) },
          { icon: Shield, label: 'Risk Level', value: bracket.risk_level, color: RISK_COLORS[bracket.risk_level], sub: `Score: ${a.riskScore}` },
          { icon: Target, label: 'Uniqueness', value: `${bracket.uniqueness_score}/100`, color: bracket.uniqueness_score >= 65 ? '#00FFA3' : bracket.uniqueness_score >= 35 ? '#F59E0B' : '#FF6B6B', sub: a.duplicationRisk + ' dupe risk' },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Icon className="w-4 h-4 mb-2" style={{ color }} />
            <div className="text-lg font-bold" style={{ color }}>{value}</div>
            <div className="text-xs font-medium text-white">{label}</div>
            <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Win Probability Chart */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={() => setShowWinProbs(v => !v)}
          className="flex items-center justify-between w-full mb-4"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <h3 className="text-sm font-bold text-white">Win Probability by Pool Size</h3>
          </div>
          {showWinProbs ? <ChevronUp className="w-4 h-4" style={{ color: '#6B6B80' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#6B6B80' }} />}
        </button>
        {showWinProbs && (
          <div className="space-y-3">
            {POOL_SIZES.map(size => (
              <WinProbBar
                key={size}
                label={size === 500 ? '500+ entries' : `${size} entries`}
                value={a.winProbs[size] ?? 0}
                max={maxWinProb}
              />
            ))}
          </div>
        )}
      </div>

      {/* Risk Meter */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4" style={{ color: RISK_COLORS[a.riskLevel] }} />
          <h3 className="text-sm font-bold text-white">Risk Assessment</h3>
        </div>
        <RiskMeter score={a.riskScore} label={a.riskLevel} />
      </div>

      {/* Duplicate Bracket Risk */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4" style={{ color: '#A78BFA' }} />
          <h3 className="text-sm font-bold text-white">Duplicate Bracket Risk</h3>
        </div>
        <UniquenessBlock score={bracket.uniqueness_score} />
        <p className="text-sm mt-3" style={{ color: '#A0A0B0' }}>{a.duplicationNote}</p>
      </div>

      {/* Final Four Leverage */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <h3 className="text-sm font-bold text-white">Final Four Leverage</h3>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{
              color: a.finalFourUniqueness === 'Contrarian' ? '#00FFA3' : a.finalFourUniqueness === 'Balanced' ? '#F59E0B' : '#FF6B6B',
              background: a.finalFourUniqueness === 'Contrarian' ? 'rgba(0,255,163,0.1)' : a.finalFourUniqueness === 'Balanced' ? 'rgba(245,158,11,0.1)' : 'rgba(255,107,107,0.1)',
            }}>
            {a.finalFourUniqueness}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {a.finalFourTeams.map(t => {
            const labelColor = t.label === 'Contrarian' ? '#00FFA3' : t.label === 'Balanced' ? '#F59E0B' : '#FF6B6B'
            return (
              <div key={t.team} className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-xs font-medium text-white mb-0.5 truncate">{t.team}</div>
                <div className="text-[10px] mb-1" style={{ color: '#6B6B80' }}>#{t.seed} · {t.region}</div>
                <div className="text-sm font-bold mb-1" style={{ color: labelColor }}>{t.popularityPct}%</div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ color: labelColor, background: `${labelColor}15` }}>{t.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weak Picks */}
      {a.weakPicks.length > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4" style={{ color: '#FF6B6B' }} />
            <h3 className="text-sm font-bold text-white">Weak Picks</h3>
          </div>
          <div className="space-y-3">
            {a.weakPicks.map((wp, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.15)' }}>
                <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5"
                  style={{ background: i === 0 ? 'rgba(255,107,107,0.2)' : 'rgba(245,158,11,0.15)',
                    color: i === 0 ? '#FF6B6B' : '#F59E0B' }}>
                  {i === 0 ? 'WORST' : `#${i+1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">
                    Picking {wp.pickedTeam} in {wp.round}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>
                    Reduces your pool equity by {wp.equityLoss}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optimal Alternative Picks */}
      {a.altPicks.length > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <h3 className="text-sm font-bold text-white">Optimal Alternative Picks</h3>
          </div>
          <div className="space-y-3">
            {a.altPicks.map((ap, i) => (
              <div key={i} className="p-3 rounded-xl"
                style={{ background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.15)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs" style={{ color: '#6B6B80' }}>{ap.round}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ background: 'rgba(255,107,107,0.1)', color: '#FF6B6B' }}>{ap.currentPick}</span>
                  <span style={{ color: '#6B6B80' }}>→</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>{ap.suggestedPick}</span>
                  <span className="text-xs ml-auto font-bold" style={{ color: '#00FFA3' }}>
                    {ap.winProbBefore}% → {ap.winProbAfter}% win prob
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upset Radar */}
      {a.upsetRadar.length > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <h3 className="text-sm font-bold text-white">Upset Radar</h3>
          </div>
          <div className="space-y-3">
            {a.upsetRadar.map((u, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-white">{u.underdogTeam}</span>
                    <span className="text-[10px]" style={{ color: '#6B6B80' }}>over {u.favoriteTeam}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: '#A0A0B0' }}>
                      Upset prob: <span className="font-bold" style={{ color: '#F59E0B' }}>{u.upsetProb}%</span>
                    </span>
                    <span className="text-xs" style={{ color: '#A0A0B0' }}>
                      Leverage: <span className="font-bold" style={{ color: '#00FFA3' }}>{u.leverageScore}</span>
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${u.userPicked ? '' : ''}`}
                  style={{
                    background: u.userPicked ? 'rgba(0,255,163,0.15)' : 'rgba(255,107,107,0.1)',
                    color: u.userPicked ? '#00FFA3' : '#FF6B6B',
                  }}>
                  {u.userPicked ? 'TAKEN' : 'MISSED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pool Strategy */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.15)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4" style={{ color: '#00FFA3' }} />
          <h3 className="text-sm font-bold text-white">Pool Strategy</h3>
          <span className="text-xs px-2 py-0.5 rounded-full ml-auto"
            style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
            {getPoolSizeLabel(bracket.pool_size)}
          </span>
        </div>
        <p className="text-sm" style={{ color: '#C0C0D0' }}>{a.poolStrategyNote}</p>
      </div>

      {/* Live Bracket Edge Placeholder */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)' }}>
        <div className="absolute top-3 right-3">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(107,107,128,0.2)', color: '#6B6B80' }}>COMING SOON</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Radio className="w-5 h-5" style={{ color: '#6B6B80' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Live Bracket Edge</h3>
            <p className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>
              Real-time win probability tracking during the tournament
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
