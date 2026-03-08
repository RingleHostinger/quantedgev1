'use client'

import { useEffect, useState } from 'react'
import { Newspaper, Zap, AlertTriangle, TrendingUp, Brain, RefreshCw, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316', NFL: '#3B82F6', MLB: '#EF4444',
  NHL: '#A78BFA', NCAAB: '#F59E0B', EPL: '#00FFA3', UCL: '#06B6D4',
}

const INSIGHT_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  spread_edge:  { color: '#00FFA3', icon: Zap },
  underdog:     { color: '#FF6B6B', icon: AlertTriangle },
  confidence:   { color: '#3B82F6', icon: Brain },
  disagreement: { color: '#F59E0B', icon: TrendingUp },
}

interface Insight {
  type: string
  label: string
  headline: string
  sub: string
  league: string
  game: string
}

interface MarketGame {
  home_team: string
  away_team: string
  league: string
  commence_time: string
  sportsbook_spread: number | null
  model_spread: number | null
  spread_edge: number | null
}

interface UnderdogEntry {
  team: string
  opponent: string
  league: string
  commence_time: string
  moneyline: string | null
  implied_prob_pct: number | null
  model_prob_pct: number | null
  edge_pct: number | null
}

interface Storyline {
  edgeCount: number
  avgEdgeSize: number
  topMatchup: string | null
  totalPredictions: number
  lastRun: string | null
}

interface BriefingResponse {
  isPremium: boolean
  generatedAt: string
  insights: Insight[]
  marketDisagreement: MarketGame[]
  underdogRadar: UnderdogEntry[]
  storyline: Storyline
}

function formatSpread(v: number | null) {
  if (v == null) return 'N/A'
  return v > 0 ? `+${v}` : `${v}`
}

function LeagueBadge({ league }: { league: string }) {
  const color = LEAGUE_COLORS[league] || '#A0A0B0'
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
      {league}
    </span>
  )
}

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#A0A0B0' }}>{children}</h2>
      {action}
    </div>
  )
}

function PremiumGate({ title }: { title: string }) {
  return (
    <div
      className="rounded-2xl p-10 text-center"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.25)' }}>
        <span className="text-2xl">🔒</span>
      </div>
      <h3 className="text-base font-black mb-2" style={{ color: '#E6E6FA' }}>Premium Feature</h3>
      <p className="text-sm mb-5" style={{ color: '#A0A0B0' }}>
        {title} is available to Premium subscribers.
      </p>
      <a href="/dashboard/settings">
        <button
          className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
          style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }}
        >
          Upgrade to Premium
        </button>
      </a>
    </div>
  )
}

export default function BriefingPage() {
  const [data, setData] = useState<BriefingResponse | null>(null)
  const [loading, setLoading] = useState(true)

  function fetchBriefing() {
    setLoading(true)
    fetch('/api/briefing')
      .then(r => r.json())
      .then((d: BriefingResponse) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchBriefing() }, [])

  // Format generated timestamp: "March 18 – 2:05 PM"
  const generatedLabel = data?.generatedAt
    ? (() => {
        const d = new Date(data.generatedAt)
        const datePart = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
        const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        return `${datePart} – ${timePart}`
      })()
    : null

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8" style={{ minHeight: '100%' }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Newspaper className="w-5 h-5" style={{ color: '#00FFA3' }} />
            <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>AI Daily Briefing</h1>
          </div>
          <p className="text-xs" style={{ color: '#6B6B80' }}>
            {generatedLabel ? `Generated: ${generatedLabel}` : 'Loading briefing...'}
          </p>
        </div>
        <button
          onClick={fetchBriefing}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors mt-1"
          style={{ color: '#6B6B80', border: '1px solid rgba(255,255,255,0.07)' }}
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : !data ? (
        <div className="text-center py-16">
          <p style={{ color: '#A0A0B0' }}>Could not load briefing data.</p>
        </div>
      ) : !data.isPremium ? (
        <div className="space-y-6">
          {/* Teaser: Top Storylines visible to all */}
          <div>
            <SectionHeader>Top Storylines Today</SectionHeader>
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.15)' }}>
              <div className="flex flex-wrap gap-6 mb-4">
                <div>
                  <div className="text-2xl font-black" style={{ color: '#00FFA3' }}>{data.storyline.edgeCount}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Edges detected today</div>
                </div>
                <div>
                  <div className="text-2xl font-black" style={{ color: '#00FFA3' }}>
                    {data.storyline.avgEdgeSize > 0 ? `+${data.storyline.avgEdgeSize}` : '—'}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Average edge size</div>
                </div>
                <div>
                  <div className="text-2xl font-black" style={{ color: '#A0A0B0' }}>{data.storyline.totalPredictions}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Predictions generated</div>
                </div>
              </div>
              <p className="text-sm" style={{ color: '#C0C0D0' }}>
                {data.storyline.edgeCount === 0
                  ? 'No meaningful edges detected today.'
                  : `The model identified ${data.storyline.edgeCount} edge${data.storyline.edgeCount > 1 ? 's' : ''} today.`}
              </p>
            </div>
          </div>
          {/* Gate the rest */}
          <PremiumGate title="Full AI Daily Briefing (Key Insights, Market Disagreements, Underdog Radar)" />
        </div>
      ) : (
        <>
          {/* ── 1. Key Insights ── */}
          <div>
            <SectionHeader>Key Insights</SectionHeader>

            {data.insights.length === 0 ? (
              <div className="rounded-2xl px-5 py-8 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-sm" style={{ color: '#6B6B80' }}>No insights available — predictions haven&apos;t run yet today.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {data.insights.map((insight, i) => {
                  const cfg = INSIGHT_CONFIG[insight.type] ?? { color: '#A0A0B0', icon: Zap }
                  const Icon = cfg.icon
                  return (
                    <div key={i} className="rounded-2xl p-4"
                      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${cfg.color}20` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
                          {insight.label}
                        </span>
                        <LeagueBadge league={insight.league} />
                      </div>
                      <div className="text-lg font-black mb-0.5" style={{ color: '#E6E6FA' }}>{insight.headline}</div>
                      <div className="text-xs font-semibold" style={{ color: cfg.color }}>{insight.sub}</div>
                      <div className="text-[10px] mt-1" style={{ color: '#4A4A60' }}>{insight.game}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 2. Top Storylines ── */}
          <div>
            <SectionHeader>Top Storylines Today</SectionHeader>
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.15)' }}>
              <div className="flex flex-wrap gap-6 mb-4">
                <div>
                  <div className="text-2xl font-black" style={{ color: '#00FFA3' }}>{data.storyline.edgeCount}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Edges detected today</div>
                </div>
                <div>
                  <div className="text-2xl font-black" style={{ color: '#00FFA3' }}>
                    {data.storyline.avgEdgeSize > 0 ? `+${data.storyline.avgEdgeSize}` : '—'}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Average edge size</div>
                </div>
                <div>
                  <div className="text-2xl font-black" style={{ color: '#A0A0B0' }}>{data.storyline.totalPredictions}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Predictions generated</div>
                </div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#C0C0D0' }}>
                {data.storyline.edgeCount === 0
                  ? 'The model has not detected any meaningful spread edges today. No official picks will be published until the model finds sufficient value against the sportsbook lines.'
                  : data.storyline.edgeCount === 1
                  ? `The model identified 1 meaningful spread edge today.${data.storyline.topMatchup ? ` The value appears in the ${data.storyline.topMatchup} matchup.` : ''}`
                  : `The model identified ${data.storyline.edgeCount} meaningful spread edges today. The largest value appears in the ${data.storyline.topMatchup ?? 'top matchup'} matchup. Average edge size is +${data.storyline.avgEdgeSize} points against the sportsbook line.`
                }
              </p>
            </div>
          </div>

          {/* ── 3. Market Disagreement Games ── */}
          <div>
            <SectionHeader
              action={
                <Link href="/dashboard/edges"
                  className="text-xs font-semibold flex items-center gap-0.5 hover:underline"
                  style={{ color: '#00FFA3' }}>
                  View All Edges <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              }
            >
              Market Disagreement Games
            </SectionHeader>

            {data.marketDisagreement.length === 0 ? (
              <div className="rounded-2xl px-5 py-6 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs" style={{ color: '#6B6B80' }}>No significant model disagreements detected today.</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {/* Header row */}
                <div className="grid grid-cols-4 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border-b"
                  style={{ color: '#6B6B80', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="col-span-2">Matchup</span>
                  <span className="text-center">Book / Model</span>
                  <span className="text-right">Edge</span>
                </div>
                {data.marketDisagreement.map((g, i) => {
                  const leagueColor = LEAGUE_COLORS[g.league] || '#A0A0B0'
                  const edge = Math.abs(g.spread_edge ?? 0).toFixed(1)
                  return (
                    <div key={i} className="grid grid-cols-4 items-center px-4 py-3 border-b last:border-0"
                      style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <div className="col-span-2 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: `${leagueColor}15`, color: leagueColor }}>{g.league}</span>
                        </div>
                        <div className="text-xs font-semibold truncate" style={{ color: '#E6E6FA' }}>
                          {g.away_team} @ {g.home_team}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs" style={{ color: '#A0A0B0' }}>{formatSpread(g.sportsbook_spread)}</div>
                        <div className="text-xs font-bold" style={{ color: '#00FFA3' }}>{formatSpread(g.model_spread)}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black" style={{ color: '#00FFA3' }}>+{edge}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 4. Underdog Radar ── */}
          <div>
            <SectionHeader
              action={
                <Link href="/dashboard/upset"
                  className="text-xs font-semibold flex items-center gap-0.5 hover:underline"
                  style={{ color: '#FF6B6B' }}>
                  Upset Radar <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              }
            >
              Underdog Radar
            </SectionHeader>

            {data.underdogRadar.length === 0 ? (
              <div className="rounded-2xl px-5 py-6 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs" style={{ color: '#6B6B80' }}>No underdog value opportunities detected today.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.underdogRadar.map((u, i) => (
                  <div key={i} className="rounded-2xl p-4"
                    style={{ background: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.15)' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <LeagueBadge league={u.league} />
                          <span className="text-xs" style={{ color: '#6B6B80' }}>vs {u.opponent}</span>
                        </div>
                        <div className="text-base font-black" style={{ color: '#E6E6FA' }}>
                          {u.team}{' '}
                          <span style={{ color: '#FF6B6B' }}>{u.moneyline ?? ''}</span>
                        </div>
                      </div>
                      {u.edge_pct != null && (
                        <div className="shrink-0 text-right">
                          <div className="text-xs mb-0.5" style={{ color: '#6B6B80' }}>ML Edge</div>
                          <div className="text-xl font-black" style={{ color: '#FF6B6B' }}>+{u.edge_pct}%</div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="rounded-xl px-3 py-2 text-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="text-[10px] mb-0.5" style={{ color: '#6B6B80' }}>Market Probability</div>
                        <div className="text-sm font-bold" style={{ color: '#A0A0B0' }}>
                          {u.implied_prob_pct != null ? `${u.implied_prob_pct}%` : '—'}
                        </div>
                      </div>
                      <div className="rounded-xl px-3 py-2 text-center"
                        style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}>
                        <div className="text-[10px] mb-0.5" style={{ color: '#6B6B80' }}>Model Win Prob</div>
                        <div className="text-sm font-bold" style={{ color: '#FF6B6B' }}>
                          {u.model_prob_pct != null ? `${u.model_prob_pct}%` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
