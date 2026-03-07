'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Zap, TrendingUp, TrendingDown, AlertTriangle,
  Star, Shield, Target, Users, Radio,
  ArrowLeft, Eye, Pencil, Calendar, Clock, Share2, Check
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B6B80' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

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

// ─── Grade helpers ───────────────────────────────────────────────────────────

function gradeDescription(grade: string): string {
  switch (grade) {
    case 'A+': return 'Elite bracket — strong win probability and low duplicate risk'
    case 'A':  return 'Solid bracket — well-balanced strategy with good differentiation'
    case 'B':  return 'Balanced bracket — competitive but room for improvement'
    case 'C':  return 'Average bracket — consider swapping a high-risk pick'
    default:   return 'High-risk bracket — low win probability or high duplicate risk'
  }
}

// ─── Canvas image generator ──────────────────────────────────────────────────

function generateScorecardImage(opts: {
  bracketName: string
  grade: string
  gradeColor: string
  winProb: number
  riskLevel: string
  riskColor: string
  dupRisk: string
  ffLeverage: string
}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const W = 640
    const H = 380
    const canvas = document.createElement('canvas')
    canvas.width = W * 2   // retina
    canvas.height = H * 2
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, '#0F0F1A')
    bg.addColorStop(1, '#12122A')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

    // Card border glow
    ctx.strokeStyle = `${opts.gradeColor}30`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(12, 12, W - 24, H - 24, 16)
    ctx.stroke()

    // Header bar
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.beginPath()
    ctx.roundRect(12, 12, W - 24, 52, [16, 16, 0, 0])
    ctx.fill()

    // "QuantEdge Bracket Lab" wordmark
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = opts.gradeColor
    ctx.fillText('QuantEdge', 30, 45)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(' Bracket Lab', 30 + ctx.measureText('QuantEdge').width, 45)

    // Bracket name
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = 'rgba(160,160,176,0.8)'
    const nameX = W - 30 - ctx.measureText(opts.bracketName).width
    ctx.fillText(opts.bracketName, nameX, 45)

    // Grade circle
    const gx = 72, gy = 155, gr = 48
    ctx.save()
    ctx.beginPath()
    ctx.arc(gx, gy, gr, 0, Math.PI * 2)
    ctx.fillStyle = `${opts.gradeColor}14`
    ctx.fill()
    ctx.strokeStyle = `${opts.gradeColor}50`
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
    ctx.font = `bold ${opts.grade.length > 1 ? '34px' : '40px'} -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.fillStyle = opts.gradeColor
    ctx.textAlign = 'center'
    ctx.fillText(opts.grade, gx, gy + 14)
    ctx.textAlign = 'left'

    // Grade label
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = 'rgba(160,160,176,0.7)'
    ctx.textAlign = 'center'
    ctx.fillText('AI GRADE', gx, gy + 34)
    ctx.textAlign = 'left'

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(140, 90)
    ctx.lineTo(140, 210)
    ctx.stroke()

    // Metric rows (right of divider)
    const metrics = [
      { label: 'Win Chance', value: `${opts.winProb}%`, color: '#00FFA3' },
      { label: 'Risk Level', value: opts.riskLevel, color: opts.riskColor },
      { label: 'Duplicate Risk', value: opts.dupRisk, color: opts.dupRisk === 'Low' ? '#00FFA3' : opts.dupRisk === 'Moderate' ? '#F59E0B' : '#FF6B6B' },
      { label: 'Final Four', value: opts.ffLeverage, color: opts.ffLeverage === 'Contrarian' ? '#00FFA3' : opts.ffLeverage === 'Balanced' ? '#F59E0B' : '#FF6B6B' },
    ]

    const col1x = 160, col2x = 370
    metrics.forEach((m, i) => {
      const row = i < 2 ? i : i
      const x = row < 2 ? col1x : col2x
      const y = row < 2 ? 110 + (row % 2) * 60 : 110 + ((row - 2) % 2) * 60

      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillStyle = 'rgba(107,107,128,0.9)'
      ctx.fillText(m.label.toUpperCase(), x, y)

      ctx.font = `bold 22px -apple-system, BlinkMacSystemFont, sans-serif`
      ctx.fillStyle = m.color
      ctx.fillText(m.value, x, y + 24)
    })

    // Vertical divider between two metric columns
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(col2x - 20, 90)
    ctx.lineTo(col2x - 20, 210)
    ctx.stroke()

    // Horizontal separator before grade description
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(30, 225)
    ctx.lineTo(W - 30, 225)
    ctx.stroke()

    // Grade description
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = 'rgba(160,160,176,0.75)'
    const desc = gradeDescription(opts.grade)
    ctx.fillText(desc, 30, 250, W - 60)

    // Footer separator
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(30, H - 44)
    ctx.lineTo(W - 30, H - 44)
    ctx.stroke()

    // Footer text
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = 'rgba(107,107,128,0.8)'
    ctx.fillText('Analyze your bracket at QuantEdge', 30, H - 24)

    // Footer accent dot
    ctx.beginPath()
    ctx.arc(W - 30, H - 28, 4, 0, Math.PI * 2)
    ctx.fillStyle = opts.gradeColor
    ctx.fill()

    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/png')
  })
}

// ─── Scorecard panel ─────────────────────────────────────────────────────────

function BracketScorecard({
  bracketName,
  grade,
  gradeColor,
  winProb,
  riskLevel,
  riskColor,
  dupRisk,
  ffLeverage,
  poolSizeLabel,
}: {
  bracketName: string
  grade: string
  gradeColor: string
  winProb: number
  riskLevel: string
  riskColor: string
  dupRisk: string
  ffLeverage: string
  poolSizeLabel: string
}) {
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    setSharing(true)
    try {
      const blob = await generateScorecardImage({
        bracketName, grade, gradeColor, winProb, riskLevel, riskColor, dupRisk, ffLeverage,
      })
      const file = new File([blob], `${bracketName.replace(/\s+/g, '-')}-scorecard.png`, { type: 'image/png' })

      // Try Web Share API first (mobile/supported browsers)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${bracketName} — Bracket Scorecard` })
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
    } catch {
      // user cancelled share or error — silent
    } finally {
      setSharing(false)
    }
  }, [bracketName, grade, gradeColor, winProb, riskLevel, riskColor, dupRisk, ffLeverage])

  const dupColor = dupRisk === 'Low' ? '#00FFA3' : dupRisk === 'Moderate' ? '#F59E0B' : '#FF6B6B'
  const ffColor = ffLeverage === 'Contrarian' ? '#00FFA3' : ffLeverage === 'Balanced' ? '#F59E0B' : '#FF6B6B'

  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${gradeColor}08 0%, rgba(255,255,255,0.03) 100%)`,
        border: `1px solid ${gradeColor}25`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: gradeColor }}>
            Bracket Scorecard
          </div>
          <div className="text-sm font-semibold text-white">{bracketName}</div>
        </div>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
          style={{ background: `${gradeColor}18`, color: gradeColor, border: `1px solid ${gradeColor}35` }}
        >
          {sharing ? (
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: gradeColor, borderTopColor: 'transparent' }} />
          ) : copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          {sharing ? 'Generating...' : copied ? 'Saved!' : 'Share My Bracket Analysis'}
        </button>
      </div>

      {/* Scorecard metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Grade — prominent */}
        <div
          className="flex flex-col items-center justify-center rounded-xl py-4 px-3 text-center"
          style={{ background: `${gradeColor}10`, border: `1px solid ${gradeColor}30` }}
        >
          <div className="text-4xl font-black leading-none mb-1" style={{ color: gradeColor }}>{grade}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: gradeColor }}>AI Grade</div>
        </div>

        <div className="rounded-xl py-4 px-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-2xl font-bold mb-0.5" style={{ color: '#00FFA3' }}>{winProb}%</div>
          <div className="text-[10px] font-semibold text-white">Win Chance</div>
          <div className="text-[10px] mt-0.5" style={{ color: '#6B6B80' }}>{poolSizeLabel}</div>
        </div>

        <div className="rounded-xl py-4 px-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-2xl font-bold mb-0.5" style={{ color: riskColor }}>{riskLevel}</div>
          <div className="text-[10px] font-semibold text-white">Risk Level</div>
        </div>

        <div className="rounded-xl py-4 px-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xl font-bold mb-0.5" style={{ color: dupColor }}>{dupRisk}</div>
          <div className="text-[10px] font-semibold text-white">Duplicate Risk</div>
          <div className="text-[10px] mt-0.5" style={{ color: ffColor }}>{ffLeverage} F4</div>
        </div>
      </div>

      {/* Grade description */}
      <div className="mt-4 text-xs leading-relaxed" style={{ color: '#6B6B80' }}>
        {gradeDescription(grade)}
      </div>
    </div>
  )
}

export default function BracketAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isPremium, loading: authLoading } = useAuth()
  const router = useRouter()
  const [bracket, setBracket] = useState<Bracket | null>(null)
  const [loading, setLoading] = useState(true)
  const [reanalyzing, setReanalyzing] = useState(false)

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
        setBracket(prev => prev ? {
          ...prev,
          analysis: data.analysis,
          bracket_score: data.analysis.scoreGrade,
          win_probability: data.analysis.winProbs[prev.pool_size],
          risk_level: data.analysis.riskLevel,
          uniqueness_score: data.analysis.uniquenessScore,
          updated_at: new Date().toISOString(),
        } : prev)
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
        <button onClick={() => router.push('/dashboard/bracket-lab')}
          className="mt-4 text-sm underline" style={{ color: '#00FFA3' }}>
          Back to My Brackets
        </button>
      </div>
    )
  }

  const a = bracket.analysis
  const gradeColor = GRADE_COLORS[bracket.bracket_score] ?? '#A0A0B0'
  const maxWinProb = Math.max(...Object.values(a.winProbs))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Back nav */}
      <button onClick={() => router.push('/dashboard/bracket-lab')}
        className="text-xs hover:underline flex items-center gap-1" style={{ color: '#6B6B80' }}>
        <ArrowLeft className="w-3 h-3" />
        My Brackets
      </button>

      {/* Bracket metadata header */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{bracket.name}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6B6B80' }}>
                <Calendar className="w-3.5 h-3.5" />
                Created {formatDate(bracket.created_at)}
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6B6B80' }}>
                <Clock className="w-3.5 h-3.5" />
                Last Updated {formatDate(bracket.updated_at)}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#A0A0B0' }}>
                {getPoolSizeLabel(bracket.pool_size)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => router.push(`/dashboard/bracket-lab/bracket/${id}`)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Eye className="w-4 h-4" />
              View
            </button>
            <button
              onClick={() => router.push(`/dashboard/bracket-lab/bracket/${id}/edit`)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <RefreshCw className={`w-4 h-4 ${reanalyzing ? 'animate-spin' : ''}`} />
              Reanalyze
            </button>
            <button
              onClick={() => router.push(`/dashboard/bracket-lab/compare?id=${id}`)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all gradient-green text-black hover:opacity-90"
            >
              <Zap className="w-4 h-4" />
              Optimize
            </button>
          </div>
        </div>
      </div>

      {/* Quick stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* ── Bracket Scorecard ── */}
      <BracketScorecard
        bracketName={bracket.name}
        grade={bracket.bracket_score}
        gradeColor={gradeColor}
        winProb={bracket.win_probability}
        riskLevel={bracket.risk_level}
        riskColor={RISK_COLORS[bracket.risk_level] ?? '#F59E0B'}
        dupRisk={a.duplicationRisk}
        ffLeverage={a.finalFourUniqueness}
        poolSizeLabel={getPoolSizeLabel(bracket.pool_size)}
      />

      {/* ── Section 1: Bracket Win Probability ── */}
      <div className="space-y-3">
        <SectionHeader label="Bracket Win Probability" />
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <h3 className="text-sm font-bold text-white">Pool Size Win Chance</h3>
          </div>
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
        </div>
      </div>

      {/* ── Section 2: Bracket Risk Profile ── */}
      <div className="space-y-3">
        <SectionHeader label="Bracket Risk Profile" />

        {/* Risk Level */}
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4" style={{ color: RISK_COLORS[a.riskLevel] }} />
            <h3 className="text-sm font-bold text-white">Risk Level</h3>
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
      </div>

      {/* ── Section 3: AI Improvement Suggestions ── */}
      {(a.weakPicks.length > 0 || a.altPicks.length > 0) && (
        <div className="space-y-3">
          <SectionHeader label="AI Improvement Suggestions" />

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
        </div>
      )}

      {/* ── Section 4: Upset Opportunities ── */}
      {a.upsetRadar.length > 0 && (
        <div className="space-y-3">
          <SectionHeader label="Upset Opportunities" />
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
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
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
