'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Eye, Pencil, Zap, Star, FlaskConical, Radio, Lock,
  GitCompare, X, Shield, Target, TrendingUp, Trophy, Check,
} from 'lucide-react'
import { GRADE_COLORS, RISK_COLORS, getPoolSizeLabel } from '@/lib/bracket-analysis'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

interface BracketSummary {
  id: string
  name: string
  pool_size: number
  source: string
  bracket_score: string
  win_probability: number
  risk_level: string
  uniqueness_score: number
  created_at: string
  updated_at: string
  analysis?: {
    finalFourUniqueness?: string
    finalFourTeams?: { team: string; seed: number; region: string; popularityPct: number; label: string }[]
    duplicationRisk?: string
    duplicationNote?: string
    riskScore?: number
  }
}

// ─── Premium gate ────────────────────────────────────────────────────────────

function PremiumGate() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="relative mb-8">
        <div className="flex gap-3 blur-sm opacity-50 pointer-events-none select-none">
          {['A+', 'B', 'A'].map((grade, i) => (
            <div key={i} className="rounded-2xl p-5 w-44"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-3xl font-black mb-2" style={{ color: GRADE_COLORS[grade] }}>{grade}</div>
              <div className="text-xs text-white mb-1">My Bracket #{i+1}</div>
              <div className="text-xs" style={{ color: '#00FFA3' }}>Win Prob: {8 - i * 2}%</div>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.3)' }}>
            <Lock className="w-6 h-6" style={{ color: '#00FFA3' }} />
          </div>
        </div>
      </div>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.2)' }}>
        <FlaskConical className="w-5 h-5" style={{ color: '#00FFA3' }} />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Bracket Lab — Premium or Madness Special</h2>
      <p className="text-sm mb-2 max-w-md" style={{ color: '#A0A0B0' }}>
        Build or upload your March Madness bracket and get AI-powered analysis to maximize your pool win probability.
        Available on the Madness Special plan ($19.99/mo) or Premium plan ($39.99/mo).
      </p>
      <ul className="text-sm space-y-1 mb-6" style={{ color: '#A0A0B0' }}>
        {[
          'Interactive 68-team bracket builder',
          'AI win probability + bracket grade',
          'Upset radar & pool strategy',
          'Bracket optimizer (3 AI versions)',
          'Duplicate risk & uniqueness scoring',
          'Strategy comparison tool',
        ].map(f => (
          <li key={f} className="flex items-center gap-2">
            <span style={{ color: '#00FFA3' }}>✓</span> {f}
          </li>
        ))}
      </ul>
      <Link href="/dashboard/pricing">
        <button className="px-8 py-3 rounded-xl font-bold gradient-green text-black hover:opacity-90 neon-glow">
          View Plans
        </button>
      </Link>
    </div>
  )
}

// ─── Comparison panel ────────────────────────────────────────────────────────

type MetricWinner = 'a' | 'b' | 'tie'

function MetricRow({
  label,
  icon: Icon,
  iconColor,
  valueA,
  valueB,
  winner,
  rawA,
  rawB,
}: {
  label: string
  icon: React.ElementType
  iconColor: string
  valueA: React.ReactNode
  valueB: React.ReactNode
  winner: MetricWinner
  rawA?: number | string
  rawB?: number | string
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Left (A) */}
      <div className={`flex flex-col items-center text-center px-3 py-2 rounded-xl transition-all ${winner === 'a' ? 'ring-1' : ''}`}
        style={winner === 'a' ? { background: 'rgba(0,255,163,0.07)', ringColor: 'rgba(0,255,163,0.3)' } : {}}>
        <div className="text-sm font-bold text-white">{valueA}</div>
        {winner === 'a' && <Check className="w-3 h-3 mt-1" style={{ color: '#00FFA3' }} />}
      </div>

      {/* Center label */}
      <div className="flex flex-col items-center gap-1 min-w-[90px]">
        <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-center" style={{ color: '#6B6B80' }}>{label}</span>
      </div>

      {/* Right (B) */}
      <div className={`flex flex-col items-center text-center px-3 py-2 rounded-xl transition-all ${winner === 'b' ? 'ring-1' : ''}`}
        style={winner === 'b' ? { background: 'rgba(0,255,163,0.07)', ringColor: 'rgba(0,255,163,0.3)' } : {}}>
        <div className="text-sm font-bold text-white">{valueB}</div>
        {winner === 'b' && <Check className="w-3 h-3 mt-1" style={{ color: '#00FFA3' }} />}
      </div>
    </div>
  )
}

function ComparisonPanel({
  bracketA,
  bracketB,
  onClose,
}: {
  bracketA: BracketSummary
  bracketB: BracketSummary
  onClose: () => void
}) {
  const gradeA = GRADE_COLORS[bracketA.bracket_score] ?? '#A0A0B0'
  const gradeB = GRADE_COLORS[bracketB.bracket_score] ?? '#A0A0B0'
  const riskColorA = RISK_COLORS[bracketA.risk_level] ?? '#F59E0B'
  const riskColorB = RISK_COLORS[bracketB.risk_level] ?? '#F59E0B'

  // Determine overall winner by win probability
  const winnerBracket: 'a' | 'b' | 'tie' =
    bracketA.win_probability > bracketB.win_probability ? 'a'
    : bracketB.win_probability > bracketA.win_probability ? 'b'
    : 'tie'

  const recommendedName = winnerBracket === 'a' ? bracketA.name : winnerBracket === 'b' ? bracketB.name : null

  // Win prob winner: higher is better
  const wpWinner: MetricWinner =
    bracketA.win_probability > bracketB.win_probability ? 'a'
    : bracketB.win_probability > bracketA.win_probability ? 'b'
    : 'tie'

  // Uniqueness winner: higher is better
  const uqWinner: MetricWinner =
    bracketA.uniqueness_score > bracketB.uniqueness_score ? 'a'
    : bracketB.uniqueness_score > bracketA.uniqueness_score ? 'b'
    : 'tie'

  // Grade winner: use GRADE_COLORS order (A+ > A > B+ > B > C+ > C > D)
  const gradeOrder: Record<string, number> = { 'A+': 7, 'A': 6, 'B+': 5, 'B': 4, 'C+': 3, 'C': 2, 'D': 1 }
  const gradeWinner: MetricWinner =
    (gradeOrder[bracketA.bracket_score] ?? 0) > (gradeOrder[bracketB.bracket_score] ?? 0) ? 'a'
    : (gradeOrder[bracketB.bracket_score] ?? 0) > (gradeOrder[bracketA.bracket_score] ?? 0) ? 'b'
    : 'tie'

  // Final Four leverage: Contrarian > Balanced > Popular (for pool strategy)
  const ffOrder: Record<string, number> = { 'Contrarian': 3, 'Balanced': 2, 'Popular': 1 }
  const ffA = bracketA.analysis?.finalFourUniqueness ?? ''
  const ffB = bracketB.analysis?.finalFourUniqueness ?? ''
  const ffWinner: MetricWinner =
    (ffOrder[ffA] ?? 0) > (ffOrder[ffB] ?? 0) ? 'a'
    : (ffOrder[ffB] ?? 0) > (ffOrder[ffA] ?? 0) ? 'b'
    : 'tie'

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4"
        style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4" style={{ color: '#A78BFA' }} />
          <h2 className="text-sm font-bold text-white">Strategy Comparison</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70 transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#A0A0B0' }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Recommended banner */}
      {recommendedName && (
        <div className="flex items-center gap-3 px-5 py-3"
          style={{ background: 'rgba(0,255,163,0.07)', borderBottom: '1px solid rgba(0,255,163,0.15)' }}>
          <Trophy className="w-4 h-4 shrink-0" style={{ color: '#00FFA3' }} />
          <p className="text-sm font-semibold" style={{ color: '#00FFA3' }}>
            Recommended Strategy: <span className="text-white">{recommendedName}</span>
          </p>
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 px-5 pt-4 pb-2">
        {/* Bracket A */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold mb-2"
            style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA' }}>
            Bracket A
          </div>
          <div className="text-sm font-semibold text-white truncate">{bracketA.name}</div>
          <div className="text-2xl font-black mt-1" style={{ color: gradeA }}>{bracketA.bracket_score}</div>
        </div>

        {/* Center spacer */}
        <div className="min-w-[90px]" />

        {/* Bracket B */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold mb-2"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
            Bracket B
          </div>
          <div className="text-sm font-semibold text-white truncate">{bracketB.name}</div>
          <div className="text-2xl font-black mt-1" style={{ color: gradeB }}>{bracketB.bracket_score}</div>
        </div>
      </div>

      {/* Metrics */}
      <div className="px-5 pb-5">

        {/* Bracket Grade */}
        <MetricRow
          label="Bracket Grade"
          icon={Star}
          iconColor="#F59E0B"
          valueA={<span style={{ color: gradeA }}>{bracketA.bracket_score ?? '—'}</span>}
          valueB={<span style={{ color: gradeB }}>{bracketB.bracket_score ?? '—'}</span>}
          winner={gradeWinner}
        />

        {/* Win Probability */}
        <MetricRow
          label="Win Probability"
          icon={TrendingUp}
          iconColor="#00FFA3"
          valueA={
            <span style={{ color: '#00FFA3' }}>
              {bracketA.win_probability != null ? `${bracketA.win_probability}%` : '—'}
            </span>
          }
          valueB={
            <span style={{ color: '#00FFA3' }}>
              {bracketB.win_probability != null ? `${bracketB.win_probability}%` : '—'}
            </span>
          }
          winner={wpWinner}
        />

        {/* Risk Level */}
        <MetricRow
          label="Risk Level"
          icon={Shield}
          iconColor="#F59E0B"
          valueA={
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ color: riskColorA, background: `${riskColorA}15` }}>
              {bracketA.risk_level ?? '—'}
            </span>
          }
          valueB={
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ color: riskColorB, background: `${riskColorB}15` }}>
              {bracketB.risk_level ?? '—'}
            </span>
          }
          winner="tie"
        />

        {/* Duplicate Bracket Risk */}
        <MetricRow
          label="Uniqueness"
          icon={Target}
          iconColor="#A78BFA"
          valueA={
            <span style={{ color: bracketA.uniqueness_score >= 65 ? '#00FFA3' : bracketA.uniqueness_score >= 35 ? '#F59E0B' : '#FF6B6B' }}>
              {bracketA.uniqueness_score != null ? `${bracketA.uniqueness_score}/100` : '—'}
            </span>
          }
          valueB={
            <span style={{ color: bracketB.uniqueness_score >= 65 ? '#00FFA3' : bracketB.uniqueness_score >= 35 ? '#F59E0B' : '#FF6B6B' }}>
              {bracketB.uniqueness_score != null ? `${bracketB.uniqueness_score}/100` : '—'}
            </span>
          }
          winner={uqWinner}
        />

        {/* Final Four Leverage */}
        {(ffA || ffB) && (
          <MetricRow
            label="Final Four Leverage"
            icon={Star}
            iconColor="#F59E0B"
            valueA={
              ffA ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    color: ffA === 'Contrarian' ? '#00FFA3' : ffA === 'Balanced' ? '#F59E0B' : '#FF6B6B',
                    background: ffA === 'Contrarian' ? 'rgba(0,255,163,0.1)' : ffA === 'Balanced' ? 'rgba(245,158,11,0.1)' : 'rgba(255,107,107,0.1)',
                  }}>
                  {ffA}
                </span>
              ) : <span style={{ color: '#6B6B80' }}>—</span>
            }
            valueB={
              ffB ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    color: ffB === 'Contrarian' ? '#00FFA3' : ffB === 'Balanced' ? '#F59E0B' : '#FF6B6B',
                    background: ffB === 'Contrarian' ? 'rgba(0,255,163,0.1)' : ffB === 'Balanced' ? 'rgba(245,158,11,0.1)' : 'rgba(255,107,107,0.1)',
                  }}>
                  {ffB}
                </span>
              ) : <span style={{ color: '#6B6B80' }}>—</span>
            }
            winner={ffWinner}
          />
        )}
      </div>

      {/* Footer note */}
      <div className="px-5 pb-4">
        <p className="text-xs text-center" style={{ color: '#4B4B60' }}>
          Checkmarks indicate the stronger bracket for each metric. Win probability drives the Recommended Strategy.
        </p>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function BracketLabPage() {
  // Both 'premium' and 'madness' plan users can access Bracket Lab
  const { hasMadnessAccess: isPremium, loading: authLoading } = useAuth()
  const router = useRouter()
  const [brackets, setBrackets] = useState<BracketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Compare mode
  const [compareMode, setCompareMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const selectedA = useMemo(() => brackets.find(b => b.id === selectedIds[0]) ?? null, [brackets, selectedIds])
  const selectedB = useMemo(() => brackets.find(b => b.id === selectedIds[1]) ?? null, [brackets, selectedIds])
  const showPanel = compareMode && selectedIds.length === 2 && selectedA && selectedB

  useEffect(() => {
    if (!isPremium) return
    fetch('/api/brackets')
      .then(r => r.json())
      .then(d => { setBrackets(d.brackets ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isPremium])

  async function handleDelete(id: string) {
    if (!confirm('Delete this bracket?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/brackets/${id}`, { method: 'DELETE' })
      setBrackets(prev => prev.filter(b => b.id !== id))
      setSelectedIds(prev => prev.filter(sid => sid !== id))
    } finally {
      setDeletingId(null)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id)
      if (prev.length >= 2) return [prev[1], id] // shift: drop oldest, add new
      return [...prev, id]
    })
  }

  function exitCompareMode() {
    setCompareMode(false)
    setSelectedIds([])
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#00FFA3', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!isPremium) return <PremiumGate />

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-5 h-5" style={{ color: '#F59E0B' }} />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
              March Madness 2025
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Bracket Lab</h1>
          <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>
            AI-powered bracket analysis to maximize your pool win probability
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {brackets.length >= 2 && !compareMode && (
            <button
              onClick={() => setCompareMode(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-80"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)' }}
            >
              <GitCompare className="w-4 h-4" />
              Compare
            </button>
          )}
          {compareMode && (
            <button
              onClick={exitCompareMode}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/bracket-lab/builder')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm gradient-green text-black hover:opacity-90 neon-glow"
          >
            <Plus className="w-4 h-4" />
            New Bracket
          </button>
        </div>
      </div>

      {/* Compare mode instruction banner */}
      {compareMode && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.22)' }}>
          <GitCompare className="w-4 h-4 shrink-0" style={{ color: '#A78BFA' }} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: '#A78BFA' }}>
              {selectedIds.length === 0
                ? 'Select two brackets to compare their strategies.'
                : selectedIds.length === 1
                ? 'Now select a second bracket.'
                : 'Comparison ready. See results below.'}
            </p>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(167,139,250,0.2)', color: '#A78BFA' }}>
            {selectedIds.length}/2 selected
          </span>
        </div>
      )}

      {/* My Brackets */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 rounded-2xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : brackets.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.1)' }}>
          <FlaskConical className="w-10 h-10 mx-auto mb-3" style={{ color: '#6B6B80' }} />
          <h3 className="text-white font-semibold mb-2">No brackets yet</h3>
          <p className="text-sm mb-5" style={{ color: '#A0A0B0' }}>
            Build your first bracket or upload a screenshot to get AI analysis
          </p>
          <button
            onClick={() => router.push('/dashboard/bracket-lab/builder')}
            className="px-6 py-2.5 rounded-xl font-bold text-sm gradient-green text-black hover:opacity-90"
          >
            Build Your First Bracket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: '#A0A0B0' }}>
            My Brackets ({brackets.length})
            {compareMode && (
              <span className="ml-2 font-normal" style={{ color: '#6B6B80' }}>— click a bracket to select it</span>
            )}
          </h2>

          {brackets.map(b => {
            const gradeColor = GRADE_COLORS[b.bracket_score] ?? '#A0A0B0'
            const riskColor = RISK_COLORS[b.risk_level] ?? '#F59E0B'
            const createdDate = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            const updatedDate = new Date(b.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            const isSelected = selectedIds.includes(b.id)
            const selectionLabel = isSelected
              ? selectedIds[0] === b.id ? 'A' : 'B'
              : null

            return (
              <div
                key={b.id}
                onClick={compareMode ? () => toggleSelect(b.id) : undefined}
                className={`rounded-2xl p-4 transition-all ${compareMode ? 'cursor-pointer' : ''}`}
                style={{
                  background: isSelected ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.04)',
                  border: isSelected
                    ? '1px solid rgba(167,139,250,0.4)'
                    : compareMode
                    ? '1px solid rgba(255,255,255,0.1)'
                    : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* Top row: grade + info + controls */}
                <div className="flex items-start gap-4">
                  {/* Grade / select indicator */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl"
                      style={{ background: `${gradeColor}15`, color: gradeColor }}>
                      {b.bracket_score ?? '?'}
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                        style={{ background: '#A78BFA', color: '#fff' }}>
                        {selectionLabel}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white truncate">{b.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 uppercase font-medium"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#6B6B80' }}>{b.source}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs" style={{ color: '#A0A0B0' }}>
                      <span>{getPoolSizeLabel(b.pool_size)}</span>
                      <span style={{ color: '#00FFA3' }}>Win: {b.win_probability}%</span>
                      <span style={{ color: riskColor }}>{b.risk_level}</span>
                      <span>Unique: {b.uniqueness_score}/100</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs" style={{ color: '#6B6B80' }}>
                      <span>Created: {createdDate}</span>
                      <span>Updated: {updatedDate}</span>
                    </div>
                  </div>

                  {/* Delete — hidden in compare mode */}
                  {!compareMode && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(b.id) }}
                      disabled={deletingId === b.id}
                      className="p-1.5 rounded-lg transition-all hover:opacity-80 shrink-0"
                      style={{ background: 'rgba(255,107,107,0.1)', color: '#FF6B6B' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Selection badge in compare mode */}
                  {compareMode && isSelected && (
                    <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                      style={{ background: 'rgba(167,139,250,0.2)', color: '#A78BFA' }}>
                      <Check className="w-3 h-3" />
                      {selectionLabel === 'A' ? 'Bracket A' : 'Bracket B'}
                    </div>
                  )}
                </div>

                {/* Action buttons — hidden in compare mode */}
                {!compareMode && (
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button
                      onClick={() => router.push(`/dashboard/bracket-lab/bracket/${b.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: 'rgba(255,255,255,0.07)', color: '#E6E6FA', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <Eye className="w-3.5 h-3.5" />
                      Open
                    </button>
                    <button
                      onClick={() => router.push(`/dashboard/bracket-lab/bracket/${b.id}/edit`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => router.push(`/dashboard/bracket-lab/bracket/${b.id}/analysis`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.2)' }}>
                      <Zap className="w-3.5 h-3.5" />
                      AI Analyze
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Comparison panel */}
      {showPanel && selectedA && selectedB && (
        <ComparisonPanel
          bracketA={selectedA}
          bracketB={selectedB}
          onClose={exitCompareMode}
        />
      )}

      {/* Live Bracket Edge Placeholder */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
        <div className="absolute top-3 right-3">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(107,107,128,0.2)', color: '#6B6B80' }}>COMING SOON</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <Radio className="w-5 h-5" style={{ color: '#6B6B80' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Live Bracket Edge</h3>
              <Star className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>
              Real-time win probability tracking as games are played during the tournament
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
