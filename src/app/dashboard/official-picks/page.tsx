'use client'

import { useEffect, useState, useCallback } from 'react'
import { Trophy, CheckCircle, Clock, TrendingUp, Star, ChevronRight } from 'lucide-react'

interface OfficialPick {
  id: string
  league: string
  home_team: string
  away_team: string
  bet_type: string
  pick_team: string
  sportsbook_line: number | null
  model_line: number | null
  spread_edge: number | null
  confidence_score: number | null
  edge_score: number | null
  result: string
  commence_time: string
  result_recorded_at: string | null
  line_at_pick: number | null
  closing_line: number | null
}

interface SettledStats {
  wins: number
  losses: number
  pushes: number
  total: number
  winRate: number
}

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316',
  NFL: '#3B82F6',
  MLB: '#EF4444',
  NHL: '#A78BFA',
  NCAAB: '#F59E0B',
  EPL: '#00FFA3',
  UCL: '#06B6D4',
}

function leagueColor(league: string) {
  return LEAGUE_COLORS[league] || '#A0A0B0'
}

function formatLine(line: number | null): string {
  if (line == null) return '—'
  return line >= 0 ? `+${line}` : `${line}`
}

function formatTs(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function betLabel(betType: string): string {
  if (betType === 'spread') return 'Spread'
  if (betType === 'total_over') return 'Over'
  if (betType === 'total_under') return 'Under'
  return betType
}

function ResultBadge({ result }: { result: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    win:  { bg: 'rgba(0,255,163,0.12)',  text: '#00FFA3', border: 'rgba(0,255,163,0.3)' },
    loss: { bg: 'rgba(255,107,107,0.12)', text: '#FF6B6B', border: 'rgba(255,107,107,0.3)' },
    push: { bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  }
  const c = colors[result] ?? { bg: 'rgba(255,255,255,0.06)', text: '#A0A0B0', border: 'rgba(255,255,255,0.1)' }
  return (
    <span
      className="text-xs font-bold px-3 py-1 rounded-lg capitalize"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {result}
    </span>
  )
}

function PickCard({ pick, showResult }: { pick: OfficialPick; showResult: boolean }) {
  const lc = leagueColor(pick.league)
  const gameTime = formatTs(pick.commence_time)
  const line = formatLine(pick.sportsbook_line)
  const clv = pick.line_at_pick != null && pick.closing_line != null
    ? (pick.line_at_pick - pick.closing_line).toFixed(1)
    : null

  return (
    <div
      className="rounded-2xl p-5 transition-all"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Top row — league + date */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${lc}20`, color: lc }}
          >
            {pick.league}
          </span>
          <span className="text-xs" style={{ color: '#6B6B80' }}>
            {betLabel(pick.bet_type)}
          </span>
          <span className="text-xs" style={{ color: '#4A4A60' }}>·</span>
          <span className="text-xs" style={{ color: '#6B6B80' }}>{gameTime}</span>
        </div>
        {showResult && <ResultBadge result={pick.result} />}
      </div>

      {/* Matchup */}
      <div className="text-base font-black mb-2" style={{ color: '#E6E6FA' }}>
        {pick.away_team} @ {pick.home_team}
      </div>

      {/* Pick + line */}
      <div
        className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-3"
        style={{ background: 'rgba(0,255,163,0.07)', border: '1px solid rgba(0,255,163,0.18)' }}
      >
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#00FFA3' }} />
        <span className="text-sm font-black" style={{ color: '#FFFFFF' }}>
          {pick.pick_team} {line}
        </span>
        <span className="ml-auto text-xs font-semibold" style={{ color: '#00FFA3' }}>
          AI Pick
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 flex-wrap">
        {pick.spread_edge != null && (
          <div className="text-xs" style={{ color: '#A0A0B0' }}>
            Edge <span style={{ color: '#00FFA3', fontWeight: 700 }}>
              {pick.spread_edge > 0 ? '+' : ''}{pick.spread_edge.toFixed(1)}
            </span>
          </div>
        )}
        {pick.confidence_score != null && (
          <div className="text-xs" style={{ color: '#A0A0B0' }}>
            Confidence <span style={{ color: '#E6E6FA', fontWeight: 700 }}>{pick.confidence_score}%</span>
          </div>
        )}
        {clv != null && (
          <div className="text-xs" style={{ color: '#A0A0B0' }}>
            CLV <span style={{ color: Number(clv) >= 0 ? '#00FFA3' : '#FF6B6B', fontWeight: 700 }}>
              {Number(clv) >= 0 ? '+' : ''}{clv}
            </span>
          </div>
        )}
        {showResult && pick.result_recorded_at && (
          <div className="text-xs ml-auto" style={{ color: '#4A4A60' }}>
            Graded {formatTs(pick.result_recorded_at)}
          </div>
        )}
      </div>
    </div>
  )
}

export default function OfficialPicksPage() {
  const [tab, setTab] = useState<'pending' | 'settled'>('pending')
  const [picks, setPicks] = useState<OfficialPick[]>([])
  const [stats, setStats] = useState<SettledStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [slateInfo, setSlateInfo] = useState<{ slateStart?: string; slateEnd?: string }>({})

  const loadPicks = useCallback(async (t: 'pending' | 'settled') => {
    setLoading(true)
    try {
      const res = await fetch(`/api/official-picks?tab=${t}`)
      const data = await res.json()
      setPicks(data.picks ?? [])
      setStats(data.stats ?? null)
      setSlateInfo({ slateStart: data.slateStart, slateEnd: data.slateEnd })
    } catch {
      setPicks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPicks(tab)
  }, [tab, loadPicks])

  const handleTabChange = (t: 'pending' | 'settled') => {
    setTab(t)
  }

  // Format slate date range label
  const slateLabel = slateInfo.slateStart
    ? new Date(slateInfo.slateStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : null

  return (
    <div className="p-6 space-y-5" style={{ background: '#0F0F1A', minHeight: '100%' }}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Official AI Picks</h1>
        <p className="text-sm mt-1" style={{ color: '#6B6B80' }}>
          Up to 5 highest-edge picks per sports day, selected by the AI model.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => handleTabChange('pending')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={tab === 'pending'
            ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }
            : { background: 'transparent', color: '#6B6B80', border: '1px solid transparent' }
          }
        >
          <Clock className="w-3.5 h-3.5" />
          Pending
        </button>
        <button
          onClick={() => handleTabChange('settled')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={tab === 'settled'
            ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }
            : { background: 'transparent', color: '#6B6B80', border: '1px solid transparent' }
          }
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Settled
        </button>
      </div>

      {/* Pending tab — today's slate */}
      {tab === 'pending' && (
        <>
          {/* Slate label */}
          {slateLabel && (
            <div className="flex items-center gap-2">
              <Star className="w-3.5 h-3.5" style={{ color: '#00FFA3' }} />
              <span className="text-sm font-semibold" style={{ color: '#00FFA3' }}>
                {slateLabel} — Active Slate
              </span>
              {!loading && (
                <span className="text-xs px-2 py-0.5 rounded-full ml-1" style={{ background: 'rgba(255,255,255,0.06)', color: '#6B6B80' }}>
                  {picks.length} / 5 picks
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : picks.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: '#4A4A60' }} />
              <p className="text-base font-bold mb-1" style={{ color: '#E6E6FA' }}>No picks yet for today</p>
              <p className="text-sm" style={{ color: '#6B6B80' }}>
                Official picks are selected automatically each day at 2:00 AM EST.<br />
                Check back after the daily refresh runs.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {picks.map((pick) => (
                <PickCard key={pick.id} pick={pick} showResult={false} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Settled tab — historical graded picks */}
      {tab === 'settled' && (
        <>
          {/* All-time stats bar */}
          {stats && stats.total > 0 && (
            <div
              className="rounded-2xl p-4 grid grid-cols-4 gap-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="text-center">
                <div className="text-lg font-black" style={{ color: '#00FFA3' }}>{stats.wins}</div>
                <div className="text-xs" style={{ color: '#6B6B80' }}>Wins</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black" style={{ color: '#FF6B6B' }}>{stats.losses}</div>
                <div className="text-xs" style={{ color: '#6B6B80' }}>Losses</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black" style={{ color: '#F59E0B' }}>{stats.pushes}</div>
                <div className="text-xs" style={{ color: '#6B6B80' }}>Pushes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black" style={{ color: '#E6E6FA' }}>{stats.winRate}%</div>
                <div className="text-xs" style={{ color: '#6B6B80' }}>Win Rate</div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : picks.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <TrendingUp className="w-10 h-10 mx-auto mb-3" style={{ color: '#4A4A60' }} />
              <p className="text-base font-bold mb-1" style={{ color: '#E6E6FA' }}>No settled picks yet</p>
              <p className="text-sm" style={{ color: '#6B6B80' }}>
                Graded picks will appear here after each game result is recorded.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {picks.map((pick) => (
                <PickCard key={pick.id} pick={pick} showResult={true} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
