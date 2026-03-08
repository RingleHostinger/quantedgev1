'use client'

import { useEffect, useState, useMemo } from 'react'
import { Brain, AlertTriangle, Zap, Activity, ArrowRight, Clock } from 'lucide-react'
import Link from 'next/link'

interface Game {
  id: string
  home_team_name: string
  away_team_name: string
  sport: string
  league: string
  scheduled_at: string
  sportsbook_spread: number | null
  sportsbook_total: number | null
  home_rest_days: number | null
  away_rest_days: number | null
  is_free_pick: boolean
}

interface Prediction {
  id: string
  game_id: string
  confidence: number
  home_win_probability: number
  away_win_probability: number
  ai_spread: number | null
  ai_total: number | null
  spread_edge: number | null
  total_edge: number | null
  is_trending: boolean
  is_upset_pick: boolean
  locked: boolean
  games: Game
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B6B80' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

function InsightCard({
  icon,
  iconColor,
  title,
  matchup,
  children,
}: {
  icon: React.ReactNode
  iconColor: string
  title: string
  matchup: string
  children: React.ReactNode
}) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span style={{ color: iconColor }}>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: iconColor }}>
          {title}
        </span>
      </div>
      <div className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
        {matchup}
      </div>
      <div className="space-y-1.5 text-sm" style={{ color: '#A0A0B0' }}>
        {children}
      </div>
    </div>
  )
}

function TrendCard({
  label,
  matchup,
  detail,
  badge,
  badgeColor,
}: {
  label: string
  matchup: string
  detail: string
  badge: string
  badgeColor: string
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="space-y-0.5 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B6B80' }}>
          {label}
        </div>
        <div className="text-sm font-semibold truncate" style={{ color: '#E6E6FA' }}>
          {matchup}
        </div>
        <div className="text-xs" style={{ color: '#A0A0B0' }}>
          {detail}
        </div>
      </div>
      <span
        className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
        style={{ background: `${badgeColor}18`, color: badgeColor }}
      >
        {badge}
      </span>
    </div>
  )
}

// ─── Derived insight helpers ──────────────────────────────────────────────────

function formatLine(val: number | null): string {
  if (val == null) return '—'
  return val > 0 ? `+${val}` : `${val}`
}

function spreadDisagreement(p: Prediction): number | null {
  if (p.ai_spread == null || p.games.sportsbook_spread == null) return null
  return Math.abs(p.ai_spread - p.games.sportsbook_spread)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [hasInjuries, setHasInjuries] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/predictions').then((r) => r.json()),
      fetch('/api/injuries').then((r) => r.json()),
    ]).then(([pData, iData]) => {
      setPredictions(pData.predictions || [])
      setGeneratedAt(pData.lastUpdated ?? new Date().toISOString())
      setHasInjuries((iData.injuries || []).length > 0)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Only work with unlocked predictions that have spread data
  const usable = useMemo(
    () => predictions.filter((p) => !p.locked && p.games),
    [predictions]
  )

  // Key insights
  const largestDisagreement = useMemo(() => {
    return [...usable]
      .filter((p) => spreadDisagreement(p) != null)
      .sort((a, b) => (spreadDisagreement(b) ?? 0) - (spreadDisagreement(a) ?? 0))[0] ?? null
  }, [usable])

  const biggestUnderdog = useMemo(() => {
    return [...usable]
      .filter((p) => p.is_upset_pick)
      .sort((a, b) => Math.abs(b.spread_edge ?? 0) - Math.abs(a.spread_edge ?? 0))[0]
      ?? usable.find((p) => p.is_upset_pick)
      ?? null
  }, [usable])

  const highestConfidence = useMemo(() => {
    return [...usable].sort((a, b) => b.confidence - a.confidence)[0] ?? null
  }, [usable])

  // Game Trends — top 3 by spread disagreement
  const topTrends = useMemo(() => {
    return [...usable]
      .filter((p) => spreadDisagreement(p) != null)
      .sort((a, b) => (spreadDisagreement(b) ?? 0) - (spreadDisagreement(a) ?? 0))
      .slice(0, 3)
  }, [usable])

  // Situational: rest advantage
  const restAdvantages = useMemo(() => {
    return usable
      .filter((p) => {
        const g = p.games
        return g.home_rest_days != null && g.away_rest_days != null
          && Math.abs((g.home_rest_days ?? 0) - (g.away_rest_days ?? 0)) >= 1
      })
      .slice(0, 3)
  }, [usable])

  const hasSituational = restAdvantages.length > 0

  function formatTimestamp(iso: string | null) {
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        hour12: true,
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  function matchup(p: Prediction) {
    return `${p.games.away_team_name} vs ${p.games.home_team_name}`
  }

  return (
    <div className="p-6 space-y-8" style={{ background: '#0F0F1A', minHeight: '100%' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#E6E6FA' }}>AI Game Insights</h1>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock className="w-3.5 h-3.5" style={{ color: '#6B6B80' }} />
          <p className="text-xs" style={{ color: '#6B6B80' }}>
            Insights Generated: {formatTimestamp(generatedAt)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : usable.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Brain className="w-10 h-10 mx-auto mb-3" style={{ color: '#A0A0B0' }} />
          <p className="font-semibold" style={{ color: '#E6E6FA' }}>No insights available yet</p>
          <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>
            Insights will appear once today's predictions are generated.
          </p>
        </div>
      ) : (
        <>
          {/* Key Insights */}
          <section>
            <SectionHeader label="Key Insights" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {largestDisagreement && (
                <InsightCard
                  icon={<Zap className="w-4 h-4" />}
                  iconColor="#F59E0B"
                  title="Largest Spread Disagreement"
                  matchup={matchup(largestDisagreement)}
                >
                  <div className="flex justify-between">
                    <span>Market:</span>
                    <span style={{ color: '#E6E6FA' }}>
                      {formatLine(largestDisagreement.games.sportsbook_spread)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Model:</span>
                    <span style={{ color: '#00FFA3' }}>
                      {formatLine(largestDisagreement.ai_spread)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span>Edge:</span>
                    <span style={{ color: '#F59E0B' }}>
                      +{spreadDisagreement(largestDisagreement)?.toFixed(1)}
                    </span>
                  </div>
                </InsightCard>
              )}

              {biggestUnderdog && (
                <InsightCard
                  icon={<AlertTriangle className="w-4 h-4" />}
                  iconColor="#FF6B6B"
                  title="Biggest Underdog Opportunity"
                  matchup={matchup(biggestUnderdog)}
                >
                  <div className="flex justify-between">
                    <span>Away win prob:</span>
                    <span style={{ color: '#E6E6FA' }}>{biggestUnderdog.away_win_probability}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Model confidence:</span>
                    <span style={{ color: '#00FFA3' }}>{biggestUnderdog.confidence}%</span>
                  </div>
                  {biggestUnderdog.spread_edge != null && (
                    <div className="flex justify-between font-semibold pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span>Spread edge:</span>
                      <span style={{ color: '#FF6B6B' }}>
                        {biggestUnderdog.spread_edge > 0 ? '+' : ''}{biggestUnderdog.spread_edge}
                      </span>
                    </div>
                  )}
                </InsightCard>
              )}

              {highestConfidence && (
                <InsightCard
                  icon={<Brain className="w-4 h-4" />}
                  iconColor="#00FFA3"
                  title="Highest Model Confidence"
                  matchup={matchup(highestConfidence)}
                >
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span style={{ color: '#00FFA3' }}>{highestConfidence.confidence}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Home win prob:</span>
                    <span style={{ color: '#E6E6FA' }}>{highestConfidence.home_win_probability}%</span>
                  </div>
                  {highestConfidence.spread_edge != null && (
                    <div className="flex justify-between font-semibold pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span>Spread edge:</span>
                      <span style={{ color: '#00FFA3' }}>
                        {highestConfidence.spread_edge > 0 ? '+' : ''}{highestConfidence.spread_edge}
                      </span>
                    </div>
                  )}
                </InsightCard>
              )}
            </div>
          </section>

          {/* Injury notice */}
          <section>
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,107,107,0.07)', border: '1px solid rgba(255,107,107,0.15)' }}
            >
              <div className="flex items-center gap-2 text-sm" style={{ color: '#FF6B6B' }}>
                <Activity className="w-4 h-4 shrink-0" />
                {hasInjuries
                  ? 'Injury impacts detected for today\'s games.'
                  : 'No injury reports for today\'s games.'}
              </div>
              <Link
                href="/dashboard/injury-reports"
                className="flex items-center gap-1 text-xs font-semibold shrink-0 ml-4 hover:underline"
                style={{ color: '#FF6B6B' }}
              >
                View Injury Reports
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          {/* Game Trends */}
          {topTrends.length > 0 && (
            <section>
              <SectionHeader label="Game Trends" />
              <div className="space-y-3">
                {topTrends.map((p, idx) => {
                  const disagree = spreadDisagreement(p)
                  const labels = [
                    'Largest Model Disagreement',
                    'High Volatility Matchup',
                    'Model Confidence Outlier',
                  ]
                  const label = labels[idx] ?? 'Notable Matchup'
                  const detail = `Market ${formatLine(p.games.sportsbook_spread)} · Model ${formatLine(p.ai_spread)} · Conf ${p.confidence}%`
                  return (
                    <TrendCard
                      key={p.id}
                      label={label}
                      matchup={matchup(p)}
                      detail={detail}
                      badge={`Edge +${disagree?.toFixed(1)}`}
                      badgeColor={idx === 0 ? '#F59E0B' : idx === 1 ? '#3B82F6' : '#00FFA3'}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* Situational Insights */}
          <section>
            <SectionHeader label="Situational Insights" />
            {hasSituational ? (
              <div className="space-y-3">
                {restAdvantages.map((p) => {
                  const g = p.games
                  const homeRest = g.home_rest_days ?? 0
                  const awayRest = g.away_rest_days ?? 0
                  const advantaged = homeRest > awayRest ? g.home_team_name : g.away_team_name
                  const diff = Math.abs(homeRest - awayRest)
                  return (
                    <TrendCard
                      key={p.id}
                      label="Rest Advantage"
                      matchup={matchup(p)}
                      detail={`${advantaged} has ${diff} extra day${diff !== 1 ? 's' : ''} of rest`}
                      badge={`+${diff}d rest`}
                      badgeColor="#A78BFA"
                    />
                  )
                })}
              </div>
            ) : (
              <div
                className="rounded-xl px-4 py-4 text-sm"
                style={{ background: 'rgba(255,255,255,0.03)', color: '#6B6B80' }}
              >
                Situational analysis coming soon.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
