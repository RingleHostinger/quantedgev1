'use client'

import { useEffect, useState, useMemo } from 'react'
import { AlertOctagon, Lock, Star, Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { GameSearchBar, GameSearchItem } from '@/components/GameSearchBar'

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316', NFL: '#3B82F6', MLB: '#EF4444',
  NHL: '#A78BFA', NCAAB: '#F59E0B', EPL: '#00FFA3', UCL: '#06B6D4',
}

interface UpsetCandidate {
  id: string
  homeTeam: string
  awayTeam: string
  league: string
  scheduledAt: string
  vegasSpread: number
  aiUpsetProb: number
  awayWinProb: number
  homeWinProb: number
  confidence: number | null
  moneylineAway: number | null
  impliedProbPct: number | null
  mlEdgePct: number | null
  upsetFlag: boolean
  isNcaab: boolean
}

/** Green = high prob (good signal), yellow = medium, gray = low */
function upsetColor(prob: number): { color: string; bg: string; border: string; label: string } {
  if (prob >= 35) return {
    color: '#00FFA3',
    bg: 'rgba(0,255,163,0.10)',
    border: 'rgba(0,255,163,0.30)',
    label: 'Strong Candidate',
  }
  if (prob >= 20) return {
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.28)',
    label: 'Watch Closely',
  }
  return {
    color: '#A0A0B0',
    bg: 'rgba(160,160,176,0.07)',
    border: 'rgba(160,160,176,0.18)',
    label: 'Long Shot',
  }
}

function formatMoneyline(ml: number | null | undefined): string {
  if (ml == null) return 'N/A'
  return ml > 0 ? `+${ml}` : `${ml}`
}

function UpsetCard({ c }: { c: UpsetCandidate }) {
  const [expanded, setExpanded] = useState(false)
  const lc = LEAGUE_COLORS[c.league] || '#A0A0B0'
  const uc = upsetColor(c.aiUpsetProb)
  const gameTime = new Date(c.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const gameDate = new Date(c.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })

  return (
    <div
      id={`game-card-${c.id}`}
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${uc.border}`,
        boxShadow: c.aiUpsetProb >= 35 ? `0 0 16px ${uc.color}12` : undefined,
      }}
    >
      {/* Top accent stripe */}
      <div style={{ height: 3, background: uc.color, opacity: c.aiUpsetProb >= 35 ? 1 : c.aiUpsetProb >= 20 ? 0.65 : 0.35 }} />

      <div className="p-5">
        {/* ── Header: matchup + league ── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${lc}18`, color: lc, border: `1px solid ${lc}30` }}>
                {c.league}
              </span>
              <span className="text-xs" style={{ color: '#6B6B80' }}>{gameDate} · {gameTime}</span>
              {c.upsetFlag && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: uc.bg, color: uc.color, border: `1px solid ${uc.border}` }}>
                  {uc.label}
                </span>
              )}
            </div>
            <div className="text-base font-black" style={{ color: '#E6E6FA' }}>
              {c.awayTeam} @ {c.homeTeam}
            </div>
          </div>

          {/* Upset probability badge */}
          <div
            className="flex flex-col items-center rounded-xl px-4 py-2.5 flex-shrink-0 text-center"
            style={{ background: uc.bg, border: `1px solid ${uc.border}` }}
          >
            <span className="text-xs font-semibold mb-0.5" style={{ color: uc.color }}>Upset Prob</span>
            <span className="text-2xl font-black leading-none" style={{ color: uc.color }}>{c.aiUpsetProb}%</span>
          </div>
        </div>

        {/* ── Upset probability bar ── */}
        <div className="mb-4">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(c.aiUpsetProb, 100)}%`, background: uc.color }}
            />
          </div>
        </div>

        {/* ── Primary section: underdog + confidence ── */}
        <div
          className="rounded-xl px-4 py-3 mb-3"
          style={{ background: uc.bg, border: `1px solid ${uc.border}` }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">🚨</span>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: uc.color }}>Upset Candidate</span>
          </div>
          <div className="text-lg font-black mb-2" style={{ color: '#FFFFFF' }}>{c.awayTeam}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs mb-0.5" style={{ color: '#6B6B80' }}>Upset Probability</div>
              <div className="text-base font-black" style={{ color: uc.color }}>{c.aiUpsetProb}%</div>
            </div>
            <div>
              <div className="text-xs mb-0.5" style={{ color: '#6B6B80' }}>Confidence</div>
              <div className="text-base font-black" style={{ color: '#E6E6FA' }}>
                {c.confidence != null ? `${c.confidence}%` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Secondary section: market data ── */}
        <div
          className="rounded-xl px-4 py-3 mb-3 space-y-2"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Moneyline</span>
            <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{formatMoneyline(c.moneylineAway)}</span>
          </div>
          <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Implied Probability</span>
            <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>
              {c.impliedProbPct != null ? `${c.impliedProbPct}%` : '—'}
            </span>
          </div>
          <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Model Probability</span>
            <span className="text-sm font-bold" style={{ color: uc.color }}>{c.awayWinProb}%</span>
          </div>
          {c.mlEdgePct != null && (
            <>
              <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Moneyline Edge</span>
                <span
                  className="text-sm font-black"
                  style={{ color: c.mlEdgePct > 0 ? uc.color : '#FF6B6B' }}
                >
                  {c.mlEdgePct > 0 ? '+' : ''}{c.mlEdgePct}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── AI reasoning toggle ── */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition-opacity"
          style={{ color: uc.color }}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Hide Details' : 'Why the AI likes it'}
        </button>
      </div>

      {/* ── Expanded: AI reasoning + win probs ── */}
      {expanded && (
        <div
          className="px-5 pb-5 space-y-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="pt-3">
            {/* Win prob comparison */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div
                className="rounded-xl px-3 py-3 text-center"
                style={{ background: uc.bg, border: `1px solid ${uc.border}` }}
              >
                <div className="text-xs mb-1 truncate" style={{ color: uc.color }}>{c.awayTeam}</div>
                <div className="text-xl font-black" style={{ color: uc.color }}>{c.awayWinProb}%</div>
                <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Model Win Prob</div>
              </div>
              <div
                className="rounded-xl px-3 py-3 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="text-xs mb-1 truncate" style={{ color: '#A0A0B0' }}>{c.homeTeam}</div>
                <div className="text-xl font-black" style={{ color: '#E6E6FA' }}>{c.homeWinProb}%</div>
                <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Model Win Prob</div>
              </div>
            </div>

            {/* AI reasoning text */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6B6B80' }}>
                Why the AI likes it
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#C0C0D0' }}>
                The model projects {c.awayTeam} with a {c.awayWinProb}% win probability, compared to only{' '}
                {c.impliedProbPct != null ? `${c.impliedProbPct}%` : 'a lower probability'} implied by the current moneyline.
                {c.mlEdgePct != null && c.mlEdgePct > 0
                  ? ` This creates a +${c.mlEdgePct}% edge — the AI sees meaningful value on the underdog.`
                  : ' The AI sees this game as closer than the market does.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LockedUpsetCard({ idx }: { idx: number }) {
  const leagues = ['NBA', 'NCAAB', 'EPL', 'NFL', 'UCL']
  const league = leagues[idx % leagues.length]
  const lc = LEAGUE_COLORS[league]
  const fakeProb = 38 + idx * 4

  return (
    <div className="rounded-2xl overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,163,0.15)' }}>
      <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }}>
        <div style={{ height: 3, background: '#00FFA3', opacity: 0.6 }} />
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${lc}18`, color: lc }}>{league}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,163,0.10)', color: '#00FFA3' }}>Strong Candidate</span>
              </div>
              <div className="text-base font-black" style={{ color: '#E6E6FA' }}>Team A @ Team B</div>
            </div>
            <div className="flex flex-col items-center rounded-xl px-4 py-2.5" style={{ background: 'rgba(0,255,163,0.10)' }}>
              <span className="text-xs" style={{ color: '#00FFA3' }}>Upset Prob</span>
              <span className="text-2xl font-black" style={{ color: '#00FFA3' }}>{fakeProb}%</span>
            </div>
          </div>
          <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full" style={{ width: `${fakeProb}%`, background: '#00FFA3' }} />
          </div>
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(15,15,26,0.55)' }}>
        <Lock className="w-5 h-5" style={{ color: '#A0A0B0' }} />
      </div>
    </div>
  )
}

export default function UpsetRadarPage() {
  const [upsets, setUpsets] = useState<UpsetCandidate[]>([])
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/upset')
      .then((r) => r.json())
      .then((data) => {
        setUpsets(data.upsets || [])
        setIsPremium(data.isPremium || false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const strongCount = upsets.filter((u) => u.aiUpsetProb >= 35).length
  const watchCount = upsets.filter((u) => u.aiUpsetProb >= 20 && u.aiUpsetProb < 35).length
  const longShotCount = upsets.filter((u) => u.aiUpsetProb < 20).length

  const searchItems = useMemo<GameSearchItem[]>(() =>
    upsets.map((u) => ({
      id: u.id,
      homeTeam: u.homeTeam,
      awayTeam: u.awayTeam,
      league: u.league,
    })),
  [upsets])

  // --- FREE USER LOCKED VIEW ---
  if (!loading && !isPremium) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <AlertOctagon className="w-5 h-5" style={{ color: '#00FFA3' }} />
            <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Upset Radar</h1>
          </div>
          <p className="text-sm" style={{ color: '#A0A0B0' }}>Underdogs the AI believes have real win potential today.</p>
        </div>

        <div
          className="rounded-2xl p-8 mb-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(0,255,163,0.06), rgba(59,130,246,0.06))',
            border: '1px solid rgba(0,255,163,0.2)',
          }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(0,255,163,0.12)', border: '1px solid rgba(0,255,163,0.3)' }}>
            <Trophy className="w-7 h-7" style={{ color: '#00FFA3' }} />
          </div>
          <h2 className="text-xl font-black mb-2" style={{ color: '#E6E6FA' }}>Premium Members Only</h2>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#A0A0B0' }}>
            Upset Radar finds underdogs where the AI model sees significantly more win potential than the sportsbook implies.
          </p>
          <Link href="/dashboard/pricing">
            <Button className="gradient-green text-black font-black text-sm px-8 py-5 rounded-xl border-0 hover:opacity-90 neon-glow">
              <Star className="w-4 h-4 mr-2" />
              Unlock Upset Radar
            </Button>
          </Link>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6B6B80' }}>
            Preview — Upgrade to unlock
          </p>
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => <LockedUpsetCard key={i} idx={i} />)}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/dashboard/pricing">
            <Button variant="outline" className="font-semibold text-sm px-6 border-white/10 hover:bg-white/5" style={{ color: '#A0A0B0' }}>
              View Pricing Plans
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <AlertOctagon className="w-5 h-5" style={{ color: '#00FFA3' }} />
            <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Upset Radar</h1>
          </div>
          <p className="text-sm" style={{ color: '#A0A0B0' }}>Scanning for upset candidates...</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      </div>
    )
  }

  // --- PREMIUM USER VIEW ---
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <AlertOctagon className="w-5 h-5" style={{ color: '#00FFA3' }} />
          <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Upset Radar</h1>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(0,255,163,0.12)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.25)' }}
          >
            PREMIUM
          </span>
        </div>
        <p className="text-sm" style={{ color: '#A0A0B0' }}>
          Underdogs the AI believes have real win potential today.
        </p>
      </div>

      {/* Jump to game */}
      <GameSearchBar games={searchItems} />

      {/* Legend */}
      <div
        className="rounded-xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-2"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#6B6B80' }}>Upset Probability:</span>
        {[
          { label: '35%+  Strong upset candidate', color: '#00FFA3' },
          { label: '20–34%  Watch closely', color: '#F59E0B' },
          { label: 'Below 20%  Long shot', color: '#6B6B80' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-xs" style={{ color }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Strong', count: strongCount, color: '#00FFA3', bg: 'rgba(0,255,163,0.08)', desc: '35%+' },
          { label: 'Watch', count: watchCount, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', desc: '20–34%' },
          { label: 'Long Shot', count: longShotCount, color: '#6B6B80', bg: 'rgba(160,160,176,0.06)', desc: '<20%' },
        ].map(({ label, count, color, bg, desc }) => (
          <div key={label} className="rounded-2xl p-4 text-center" style={{ background: bg, border: `1px solid ${color}22` }}>
            <div className="text-2xl font-black" style={{ color }}>{count}</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
            <div className="text-xs mt-0.5" style={{ color: '#4A4A60' }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Cards */}
      {upsets.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <AlertOctagon className="w-10 h-10 mx-auto mb-4" style={{ color: '#4A4A60' }} />
          <p className="text-lg font-bold mb-2" style={{ color: '#E6E6FA' }}>No strong upset candidates right now.</p>
          <p className="text-sm" style={{ color: '#A0A0B0' }}>
            The AI only highlights underdogs with meaningful value. Check back as odds shift and new games are added.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {upsets.map((c) => <UpsetCard key={c.id} c={c} />)}
        </div>
      )}

      {upsets.length > 0 && (
        <p className="text-xs text-center" style={{ color: '#4A4A60' }}>
          Showing {upsets.length} upset candidate{upsets.length !== 1 ? 's' : ''} · Filtered by upset probability ≥ 20% or moneyline edge &gt; 5%
        </p>
      )}
    </div>
  )
}
