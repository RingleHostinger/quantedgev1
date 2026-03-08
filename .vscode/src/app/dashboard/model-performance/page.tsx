'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, CheckCircle, XCircle, MinusCircle, Clock, ChevronDown, ChevronUp, BarChart3, Lock } from 'lucide-react'

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316', NFL: '#3B82F6', MLB: '#EF4444',
  NHL: '#A78BFA', NCAAB: '#F59E0B', EPL: '#00FFA3', UCL: '#06B6D4',
}

const BET_TYPE_LABELS: Record<string, string> = {
  spread: 'Spread',
  total_over: 'Over',
  total_under: 'Under',
  moneyline: 'ML',
}

interface WindowStats {
  record: string
  wins: number
  losses: number
  pushes: number
  total_picks: number
  win_percentage: number | null
  roi: number | null
}

interface RecentPick {
  id: string
  league: string
  home_team: string
  away_team: string
  pick_team: string
  bet_type: string
  sportsbook_line: number | null
  model_line: number | null
  spread_edge: number | null
  confidence_score: number
  edge_score: number
  result: string
  commence_time: string
  created_at: string
  line_at_pick: number | null
  closing_line: number | null
  clv: number | null
}

interface PerformanceData {
  isPremium: boolean
  last_7_days: WindowStats
  last_30_days: WindowStats
  season: WindowStats
  all_time: WindowStats
  current_streak: string | null
  total_official_picks: number
  pending_picks: number
  avg_clv: number | null
  season_avg_clv: number | null
  by_league: Record<string, { record: { wins: number; losses: number; pushes: number; total: number }; win_pct: number | null }>
  recent_picks: RecentPick[]
}

function ResultIcon({ result }: { result: string }) {
  if (result === 'win') return <CheckCircle className="w-4 h-4" style={{ color: '#00FFA3' }} />
  if (result === 'loss') return <XCircle className="w-4 h-4" style={{ color: '#FF6B6B' }} />
  if (result === 'push') return <MinusCircle className="w-4 h-4" style={{ color: '#A0A0B0' }} />
  return <Clock className="w-4 h-4" style={{ color: '#6B6B80' }} />
}

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    win:     { bg: 'rgba(0,255,163,0.12)',    color: '#00FFA3', label: 'WIN' },
    loss:    { bg: 'rgba(255,107,107,0.12)',  color: '#FF6B6B', label: 'LOSS' },
    push:    { bg: 'rgba(160,160,176,0.12)',  color: '#A0A0B0', label: 'PUSH' },
    pending: { bg: 'rgba(107,107,128,0.10)',  color: '#6B6B80', label: 'PENDING' },
  }
  const s = styles[result] || styles.pending
  return (
    <span
      className="text-xs font-black px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

function StatCard({
  label, value, sub, color = '#E6E6FA', highlight = false
}: {
  label: string
  value: string | number | null
  sub?: string
  color?: string
  highlight?: boolean
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col justify-between"
      style={{
        background: highlight ? 'rgba(0,255,163,0.06)' : 'rgba(255,255,255,0.04)',
        border: highlight ? '1px solid rgba(0,255,163,0.2)' : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B6B80' }}>{label}</div>
      <div className="text-3xl font-black" style={{ color: value == null ? '#4A4A60' : color }}>
        {value == null ? '—' : value}
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: '#6B6B80' }}>{sub}</div>}
    </div>
  )
}

function WindowBlock({ label, stats }: { label: string; stats: WindowStats }) {
  const hasData = stats.total_picks > 0
  const winColor = (stats.win_percentage ?? 0) >= 55 ? '#00FFA3' : (stats.win_percentage ?? 0) >= 50 ? '#F59E0B' : '#FF6B6B'
  const roiColor = (stats.roi ?? 0) >= 0 ? '#00FFA3' : '#FF6B6B'

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#A0A0B0' }}>{label}</div>

      {/* Record display */}
      <div className="text-4xl font-black mb-1" style={{ color: '#E6E6FA' }}>
        {hasData ? stats.record : '—'}
      </div>
      <div className="text-xs mb-4" style={{ color: '#6B6B80' }}>
        {hasData ? `${stats.total_picks} settled picks` : 'No settled picks yet'}
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="text-xs mb-1" style={{ color: '#6B6B80' }}>Win %</div>
          <div className="text-xl font-black" style={{ color: hasData ? winColor : '#4A4A60' }}>
            {stats.win_percentage != null ? `${stats.win_percentage}%` : '—'}
          </div>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="text-xs mb-1" style={{ color: '#6B6B80' }}>ROI</div>
          <div className="text-xl font-black" style={{ color: hasData ? roiColor : '#4A4A60' }}>
            {stats.roi != null ? `${stats.roi > 0 ? '+' : ''}${stats.roi}%` : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

function PickRow({ pick }: { pick: RecentPick }) {
  const [expanded, setExpanded] = useState(false)
  const lc = LEAGUE_COLORS[pick.league] || '#A0A0B0'
  const gameTime = new Date(pick.commence_time).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const formatLine = (line: number | null) => {
    if (line == null) return 'N/A'
    // For spread bets, sportsbook_line is stored from the picked team's perspective
    // (e.g. +7.5 for an away pick, -7.5 for a home pick) — show with sign
    if (pick.bet_type === 'spread') return line > 0 ? `+${line}` : `${line}`
    return `${line}`
  }

  // For spread bets, display pick as "Team +7.5" / "Team -6.5" together on one line
  const pickDisplay = pick.bet_type === 'spread' && pick.sportsbook_line != null
    ? `${pick.pick_team} ${formatLine(pick.sportsbook_line)}`
    : pick.bet_type === 'total_over' ? 'OVER'
    : pick.bet_type === 'total_under' ? 'UNDER'
    : pick.pick_team

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: pick.result === 'win'
          ? '1px solid rgba(0,255,163,0.15)'
          : pick.result === 'loss'
            ? '1px solid rgba(255,107,107,0.15)'
            : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <ResultIcon result={pick.result} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${lc}18`, color: lc }}>
              {pick.league}
            </span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#A0A0B0' }}>
              {BET_TYPE_LABELS[pick.bet_type] || pick.bet_type}
            </span>
          </div>
          <div className="text-sm font-bold mt-0.5 truncate" style={{ color: '#E6E6FA' }}>
            {pick.away_team} @ {pick.home_team}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>
            Pick: <span style={{ color: '#00FFA3', fontWeight: 700 }}>{pickDisplay}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <ResultBadge result={pick.result} />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded"
            style={{ color: '#6B6B80' }}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-0 space-y-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>

          {/* Line metrics row */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2">
            <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#6B6B80' }}>Book Line</div>
              <div className="font-bold mt-0.5" style={{ color: '#E6E6FA' }}>{formatLine(pick.sportsbook_line)}</div>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#6B6B80' }}>AI Line</div>
              <div className="font-bold mt-0.5" style={{ color: '#00FFA3' }}>{formatLine(pick.model_line)}</div>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#6B6B80' }}>Edge Score</div>
              <div className="font-bold mt-0.5" style={{ color: '#F59E0B' }}>{pick.edge_score}</div>
            </div>
          </div>

          {/* CLV row — only rendered when at least one value is available */}
          {(pick.line_at_pick != null || pick.closing_line != null) && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ color: '#6B6B80' }}>Line at Pick</div>
                <div className="font-bold mt-0.5" style={{ color: '#E6E6FA' }}>
                  {pick.line_at_pick != null ? formatLine(pick.line_at_pick) : '—'}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ color: '#6B6B80' }}>Closing Line</div>
                <div className="font-bold mt-0.5" style={{ color: '#E6E6FA' }}>
                  {pick.closing_line != null ? formatLine(pick.closing_line) : '—'}
                </div>
              </div>
              <div className="rounded-lg p-2"
                style={{
                  background: pick.clv == null ? 'rgba(255,255,255,0.03)'
                    : pick.clv > 0 ? 'rgba(0,255,163,0.07)'
                    : pick.clv < 0 ? 'rgba(255,107,107,0.07)'
                    : 'rgba(255,255,255,0.03)',
                }}>
                <div style={{ color: '#6B6B80' }}>CLV</div>
                <div className="font-bold mt-0.5"
                  style={{
                    color: pick.clv == null ? '#6B6B80'
                      : pick.clv > 0 ? '#00FFA3'
                      : pick.clv < 0 ? '#FF6B6B'
                      : '#A0A0B0',
                  }}>
                  {pick.clv != null ? (pick.clv > 0 ? `+${pick.clv}` : `${pick.clv}`) : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Game info row */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#6B6B80' }}>Game Time</div>
              <div className="font-bold mt-0.5" style={{ color: '#A0A0B0' }}>{gameTime}</div>
            </div>
            <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ color: '#6B6B80' }}>Confidence</div>
              <div className="font-bold mt-0.5" style={{ color: '#A0A0B0' }}>{pick.confidence_score}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ModelPerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/model-performance')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <TrendingUp className="w-5 h-5" style={{ color: '#00FFA3' }} />
          <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Model Performance</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <TrendingUp className="w-10 h-10 mx-auto mb-3" style={{ color: '#A0A0B0' }} />
        <p className="font-semibold" style={{ color: '#E6E6FA' }}>Unable to load performance data</p>
        <p className="text-sm mt-1" style={{ color: '#6B6B80' }}>Please try again later</p>
      </div>
    )
  }

  const season = data.season
  const hasSeasonData = season.total_picks > 0
  const avgClv = data.season_avg_clv ?? data.avg_clv

  // League breakdown entries sorted by win_pct desc
  const leagueEntries = Object.entries(data.by_league)
    .filter(([, v]) => v.record.total > 0)
    .sort(([, a], [, b]) => (b.win_pct ?? 0) - (a.win_pct ?? 0))

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5" style={{ color: '#00FFA3' }} />
          <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Model Performance</h1>
        </div>
        <p className="text-sm" style={{ color: '#A0A0B0' }}>
          Official AI picks — top 5 highest edge-score bets selected each day. Results tracked against sportsbook lines.
        </p>
        <p className="text-xs mt-1" style={{ color: '#6B6B80' }}>
          ROI calculated at flat $110 to win $100 (standard -110). Pushes excluded from win %.
        </p>
      </div>

      {/* Top stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Season Record"
          value={hasSeasonData ? season.record : '—'}
          sub={hasSeasonData ? `${season.total_picks} settled` : 'No results yet'}
          highlight
        />
        <StatCard
          label="Win %"
          value={season.win_percentage != null ? `${season.win_percentage}%` : null}
          sub="Pushes excluded"
          color={
            (season.win_percentage ?? 0) >= 55 ? '#00FFA3'
            : (season.win_percentage ?? 0) >= 50 ? '#F59E0B'
            : '#FF6B6B'
          }
        />
        <StatCard
          label="ROI"
          value={season.roi != null ? `${season.roi > 0 ? '+' : ''}${season.roi}%` : null}
          sub="Flat -110 wagering"
          color={(season.roi ?? 0) >= 0 ? '#00FFA3' : '#FF6B6B'}
        />
        <StatCard
          label="Avg CLV"
          value={avgClv != null ? `${avgClv > 0 ? '+' : ''}${avgClv}` : null}
          sub="Line at pick vs close"
          color={avgClv == null ? '#6B6B80' : avgClv > 0 ? '#00FFA3' : avgClv < 0 ? '#FF6B6B' : '#A0A0B0'}
        />
        <StatCard
          label="Current Streak"
          value={data.current_streak ?? '—'}
          sub={`${data.total_official_picks} total picks`}
          color={data.current_streak?.endsWith('W') ? '#00FFA3' : '#FF6B6B'}
        />
      </div>

      {/* Time window breakdown */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#6B6B80' }}>
          Performance by Period
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <WindowBlock label="Last 7 Days" stats={data.last_7_days} />
          <WindowBlock label="Last 30 Days" stats={data.last_30_days} />
          <WindowBlock label="All Time" stats={data.all_time} />
        </div>
      </div>

      {/* Pending picks notice */}
      {data.pending_picks > 0 && (
        <div
          className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: 'rgba(107,107,128,0.08)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#6B6B80' }} />
          <p className="text-sm" style={{ color: '#A0A0B0' }}>
            <span className="font-bold" style={{ color: '#E6E6FA' }}>{data.pending_picks} picks</span> are awaiting game results and will be resolved automatically when scores are recorded.
          </p>
        </div>
      )}

      {/* League breakdown */}
      {leagueEntries.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#6B6B80' }}>
            Season Record by League
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {leagueEntries.map(([league, stats]) => {
              const lc = LEAGUE_COLORS[league] || '#A0A0B0'
              const wpct = stats.win_pct
              const wpctColor = (wpct ?? 0) >= 55 ? '#00FFA3' : (wpct ?? 0) >= 50 ? '#F59E0B' : '#FF6B6B'
              return (
                <div
                  key={league}
                  className="rounded-xl p-4"
                  style={{ background: `${lc}08`, border: `1px solid ${lc}20` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${lc}18`, color: lc }}>
                      {league}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>
                      {stats.record.total} picks
                    </span>
                  </div>
                  <div className="text-2xl font-black" style={{ color: '#E6E6FA' }}>
                    {stats.record.wins}-{stats.record.losses}{stats.record.pushes > 0 ? `-${stats.record.pushes}` : ''}
                  </div>
                  <div className="text-sm font-bold mt-0.5" style={{ color: wpct != null ? wpctColor : '#6B6B80' }}>
                    {wpct != null ? `${wpct}%` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent picks log */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: '#A0A0B0' }} />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#6B6B80' }}>
              Official Pick Log
            </h2>
          </div>
          {!data.isPremium && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.2)' }}>
              <Lock className="w-2.5 h-2.5" /> Premium
            </span>
          )}
        </div>

        {!data.isPremium ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)' }}>
              <Lock className="w-5 h-5" style={{ color: '#00FFA3' }} />
            </div>
            <p className="font-bold mb-1" style={{ color: '#E6E6FA' }}>Pick Log is Premium Only</p>
            <p className="text-sm mb-5" style={{ color: '#6B6B80' }}>
              View every official pick with bet details, lines, edge scores, and CLV tracking.
            </p>
            <Link href="/dashboard/settings">
              <button
                className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }}
              >
                Upgrade to Premium
              </button>
            </Link>
          </div>
        ) : data.recent_picks.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ color: '#4A4A60' }} />
            <p className="font-semibold" style={{ color: '#E6E6FA' }}>No official picks recorded yet</p>
            <p className="text-sm mt-1" style={{ color: '#6B6B80' }}>
              Official picks are selected automatically after each prediction refresh.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.recent_picks.map((pick) => (
              <PickRow key={pick.id} pick={pick} />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-center pb-4" style={{ color: '#4A4A60' }}>
        Official picks = top 5 by edge score per day · Results auto-resolve from game scores · Past performance does not guarantee future results
      </p>
    </div>
  )
}
