'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Zap, Shield, Target, TrendingUp, Check } from 'lucide-react'
import { BracketAnalysis, GRADE_COLORS, RISK_COLORS, getPoolSizeLabel } from '@/lib/bracket-analysis'
import { useAuth } from '@/hooks/useAuth'

interface OptimizedVersion {
  label: string
  tagline: string
  accentColor: string
  picks: Record<string, unknown>
  analysis: BracketAnalysis
}

function CompareContent() {
  const { isPremium, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const bracketId = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [bracketName, setBracketName] = useState('My Bracket')
  const [poolSize, setPoolSize] = useState(25)
  const [versions, setVersions] = useState<OptimizedVersion[]>([])
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isPremium) router.push('/dashboard/pricing')
  }, [authLoading, isPremium, router])

  useEffect(() => {
    if (!bracketId) { setLoading(false); return }
    Promise.all([
      fetch(`/api/brackets/${bracketId}`).then(r => r.json()),
      fetch(`/api/brackets/${bracketId}/analyze`, { method: 'POST' }).then(r => r.json()),
    ]).then(([bracketData, analysisData]) => {
      setBracketName(bracketData.bracket?.name ?? 'My Bracket')
      setPoolSize(bracketData.bracket?.pool_size ?? 25)
      if (analysisData.optimized) {
        setVersions([
          {
            label: 'Version A — Safe',
            tagline: 'Chalk-heavy, minimize risk',
            accentColor: '#00FFA3',
            picks: analysisData.optimized.safe.picks,
            analysis: analysisData.optimized.safe.analysis,
          },
          {
            label: 'Version B — Balanced',
            tagline: 'Recommended strategy',
            accentColor: '#3B82F6',
            picks: analysisData.optimized.balanced.picks,
            analysis: analysisData.optimized.balanced.analysis,
          },
          {
            label: 'Version C — Aggressive',
            tagline: 'High risk, high reward',
            accentColor: '#FF6B6B',
            picks: analysisData.optimized.aggressive.picks,
            analysis: analysisData.optimized.aggressive.analysis,
          },
        ])
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [bracketId])

  async function handleUseVersion(version: OptimizedVersion) {
    setSaving(version.label)
    try {
      const res = await fetch('/api/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${bracketName} (${version.label.split('—')[1].trim()})`,
          pool_size: poolSize,
          source: 'builder',
          picks: version.picks,
        }),
      })
      const data = await res.json()
      if (res.ok && data.bracket?.id) {
        router.push(`/dashboard/bracket-lab/analysis/${data.bracket.id}`)
      }
    } finally {
      setSaving(null)
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <button onClick={() => router.push(bracketId ? `/dashboard/bracket-lab/analysis/${bracketId}` : '/dashboard/bracket-lab')}
          className="text-xs mb-2 hover:underline" style={{ color: '#6B6B80' }}>
          ← Back to Analysis
        </button>
        <h1 className="text-2xl font-bold text-white">Bracket Optimizer</h1>
        <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>
          AI-generated optimized versions of <span className="text-white font-medium">{bracketName}</span>. Pick one to use.
        </p>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-16" style={{ color: '#A0A0B0' }}>
          No optimized versions available. Go back and reanalyze.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {versions.map((v) => {
            const a = v.analysis
            const gradeColor = GRADE_COLORS[a.scoreGrade] ?? '#A0A0B0'
            const riskColor = RISK_COLORS[a.riskLevel] ?? '#F59E0B'
            const isSaving = saving === v.label

            return (
              <div key={v.label} className="rounded-2xl overflow-hidden flex flex-col"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${v.accentColor}25` }}>
                {/* Version header */}
                <div className="p-4 border-b" style={{ borderColor: `${v.accentColor}20`, background: `${v.accentColor}08` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-white">{v.label}</span>
                    <span className="text-2xl font-black" style={{ color: gradeColor }}>{a.scoreGrade}</span>
                  </div>
                  <p className="text-xs" style={{ color: '#A0A0B0' }}>{v.tagline}</p>
                </div>

                {/* Stats */}
                <div className="p-4 flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" style={{ color: '#00FFA3' }} />
                      <span className="text-xs" style={{ color: '#A0A0B0' }}>Win Prob ({getPoolSizeLabel(poolSize)})</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>
                      {a.winProbs[poolSize] ?? a.winProbs[25]}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" style={{ color: riskColor }} />
                      <span className="text-xs" style={{ color: '#A0A0B0' }}>Risk Level</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ color: riskColor, background: `${riskColor}15` }}>
                      {a.riskLevel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />
                      <span className="text-xs" style={{ color: '#A0A0B0' }}>Uniqueness</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: '#A78BFA' }}>{a.uniquenessScore}/100</span>
                  </div>

                  {/* Key differences */}
                  <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-semibold mb-2 uppercase tracking-wide" style={{ color: '#6B6B80' }}>
                      Key Differences
                    </p>
                    {[
                      `Champion: ${(v.picks as { champion?: string }).champion ?? '—'}`,
                      `Grade: ${a.scoreGrade} (${a.winProbs[poolSize] ?? a.winProbs[25]}% win prob)`,
                      `Risk: ${a.riskLevel} (Score: ${a.riskScore})`,
                    ].map((diff, i) => (
                      <div key={i} className="flex items-start gap-1.5 mb-1">
                        <Check className="w-3 h-3 shrink-0 mt-0.5" style={{ color: v.accentColor }} />
                        <span className="text-xs" style={{ color: '#C0C0D0' }}>{diff}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Use button */}
                <div className="p-4 pt-0">
                  <button
                    onClick={() => handleUseVersion(v)}
                    disabled={isSaving}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: v.accentColor, color: '#000' }}
                  >
                    {isSaving ? 'Saving...' : 'Use This Version'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-2xl p-4 text-sm text-center" style={{ color: '#6B6B80' }}>
        Selecting a version saves it as a new bracket in your account. Your original bracket is preserved.
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#00FFA3', borderTopColor: 'transparent' }} />
      </div>
    }>
      <CompareContent />
    </Suspense>
  )
}
