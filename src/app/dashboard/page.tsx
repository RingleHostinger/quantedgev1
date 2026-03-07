'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Zap, ChevronRight, FlaskConical, Trophy, BarChart2 } from 'lucide-react'

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316', NFL: '#3B82F6', MLB: '#EF4444',
  NHL: '#A78BFA', NCAAB: '#F59E0B', EPL: '#00FFA3', UCL: '#06B6D4',
}

interface EdgePick {
  id: string
  home_team: string
  away_team: string
  league: string
  commence_time: string
  sportsbook_spread: number | null
  model_spread: number | null
  spread_edge: number | null
  total_edge: number | null
  confidence_score: number
  edge_score: number
  model_prob_home: number | null
  model_prob_away: number | null
}

interface GamePick {
  id: string
  league: string
  home_team_name: string
  away_team_name: string
  scheduled_at: string
  sportsbook_spread: number | null
  ai_spread: number | null
  home_win_probability: number
  away_win_probability: number
  games: {
    league: string
    home_team_name: string
    away_team_name: string
    scheduled_at: string
    sportsbook_spread: number | null
  }
}

interface ModelPerf {
  last_7_days: { record: string; win_percentage: number; roi: number }
  all_time: { record: string; win_percentage: number; roi: number }
  total_official_picks: number
}

function formatSpread(v: number | null) {
  if (v == null) return 'N/A'
  return v > 0 ? `+${v}` : `${v}`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Derive the pick team and line from spread comparison
function pickFromSpread(
  modelSpread: number | null,
  sbSpread: number | null,
  homeTeam: string,
  awayTeam: string,
): { team: string; line: string } {
  if (modelSpread == null || sbSpread == null) return { team: homeTeam, line: formatSpread(sbSpread) }
  // model > sb → softer on favorite → underdog has value
  if (modelSpread > sbSpread) {
    const awayLine = sbSpread === null ? 'N/A' : `+${Math.abs(sbSpread)}`
    return { team: awayTeam, line: awayLine }
  }
  // model < sb → more bullish on favorite → favorite has value
  return { team: homeTeam, line: formatSpread(sbSpread) }
}

export default function DashboardPage() {
  const [edges, setEdges] = useState<EdgePick[]>([])
  const [edgesMsg, setEdgesMsg] = useState<string | null>(null)
  const [games, setGames] = useState<GamePick[]>([])
  const [perf, setPerf] = useState<ModelPerf | null>(null)
  const [perfUpdatedAt, setPerfUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/edges').then(r => r.json()),
      fetch('/api/predictions').then(r => r.json()),
      fetch('/api/model-performance').then(r => r.json()),
    ]).then(([edgeData, predData, perfData]) => {
      setEdges(edgeData.edges || [])
      setEdgesMsg(edgeData.message || null)
      setGames((predData.predictions || []).slice(0, 5))
      setPerf(perfData)
      setPerfUpdatedAt(new Date().toISOString())
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  const topEdge = edges[0] ?? null
  const previewEdges = edges.slice(0, 3)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8" style={{ minHeight: '100%' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>AI Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: '#6B6B80' }}>{today}</p>
      </div>

      {/* ── 1. Credibility Stats ── */}
      <div>
        <div className="grid grid-cols-3 gap-3">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl h-24 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))
          ) : (
            <>
              {[
                {
                  label: 'AI Record',
                  value: perf?.all_time.record ?? '—',
                  color: '#00FFA3',
                  icon: Trophy,
                },
                {
                  label: 'Win %',
                  value: perf ? `${perf.all_time.win_percentage}%` : '—',
                  color: '#3B82F6',
                  icon: BarChart2,
                },
                {
                  label: 'ROI',
                  value: perf ? `${perf.all_time.roi > 0 ? '+' : ''}${perf.all_time.roi}%` : '—',
                  color: perf && perf.all_time.roi >= 0 ? '#00FFA3' : '#FF6B6B',
                  icon: TrendingUp,
                },
              ].map(({ label, value, color, icon: Icon }) => (
                <Link
                  key={label}
                  href="/dashboard/model-performance"
                  className="rounded-2xl p-4 block transition-all hover:brightness-110"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                    <span className="text-xs" style={{ color: '#6B6B80' }}>{label}</span>
                  </div>
                  <div className="text-xl font-black" style={{ color }}>{value}</div>
                </Link>
              ))}
            </>
          )}
        </div>
        {perfUpdatedAt && (
          <p className="text-[11px] mt-2" style={{ color: '#4A4A60' }}>
            Last Updated: {new Date(perfUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &middot; Odds Refresh: Hourly
          </p>
        )}
      </div>

      {/* ── 2. AI Pick of the Day ── */}
      <div>
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(0,255,163,0.07), rgba(59,130,246,0.05))',
            border: '1px solid rgba(0,255,163,0.2)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🔥</span>
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#00FFA3' }}>AI Pick of the Day</h2>
          </div>

          {loading ? (
            <div className="h-20 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ) : topEdge ? (() => {
            const { team, line } = pickFromSpread(
              topEdge.model_spread,
              topEdge.sportsbook_spread,
              topEdge.home_team,
              topEdge.away_team,
            )
            const edge = Math.abs(topEdge.spread_edge ?? 0).toFixed(1)
            const leagueColor = LEAGUE_COLORS[topEdge.league] || '#A0A0B0'
            return (
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                        style={{ background: `${leagueColor}18`, color: leagueColor, border: `1px solid ${leagueColor}30` }}
                      >
                        {topEdge.league}
                      </span>
                      <span className="text-xs" style={{ color: '#6B6B80' }}>{formatTime(topEdge.commence_time)}</span>
                    </div>
                    <div className="text-2xl font-black" style={{ color: '#E6E6FA' }}>
                      {team} <span style={{ color: '#00FFA3' }}>{line}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>
                      {topEdge.away_team} vs {topEdge.home_team}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs mb-1" style={{ color: '#6B6B80' }}>Confidence</div>
                    <div className="text-2xl font-black" style={{ color: '#00FFA3' }}>{topEdge.confidence_score}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Model Line', value: formatSpread(topEdge.model_spread) },
                    { label: 'Book Line', value: formatSpread(topEdge.sportsbook_spread) },
                    { label: 'Edge', value: `+${edge}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl px-3 py-2 text-center"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="text-[10px] mb-0.5" style={{ color: '#6B6B80' }}>{label}</div>
                      <div className="text-sm font-bold" style={{ color: label === 'Edge' ? '#00FFA3' : '#E6E6FA' }}>{value}</div>
                    </div>
                  ))}
                </div>

                <Link href="/dashboard/edges">
                  <button
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }}
                  >
                    View Full Edge Analysis <ChevronRight className="inline w-4 h-4 -mt-0.5" />
                  </button>
                </Link>
              </div>
            )
          })() : (
            <div className="py-4 text-center">
              <p className="text-sm font-medium" style={{ color: '#A0A0B0' }}>
                {edgesMsg ?? 'No strong AI edges available right now.'}
              </p>
              <p className="text-xs mt-1" style={{ color: '#6B6B80' }}>
                The model only publishes picks when meaningful value is detected.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Top AI Edges Preview ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <h2 className="text-sm font-bold" style={{ color: '#E6E6FA' }}>Top AI Edges Today</h2>
          </div>
          <Link href="/dashboard/edges"
            className="text-xs font-semibold flex items-center gap-0.5 hover:underline"
            style={{ color: '#00FFA3' }}>
            View All <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
          </div>
        ) : previewEdges.length === 0 ? (
          <div className="rounded-xl px-4 py-5 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs" style={{ color: '#6B6B80' }}>No strong edges available today.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Table header */}
            <div className="grid grid-cols-4 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border-b"
              style={{ color: '#6B6B80', borderColor: 'rgba(255,255,255,0.06)' }}>
              <span>Team</span>
              <span className="text-center">Spread</span>
              <span className="text-center">Edge</span>
              <span className="text-right">Confidence</span>
            </div>
            {previewEdges.map((e) => {
              const { team, line } = pickFromSpread(e.model_spread, e.sportsbook_spread, e.home_team, e.away_team)
              const edge = Math.abs(e.spread_edge ?? 0).toFixed(1)
              const leagueColor = LEAGUE_COLORS[e.league] || '#A0A0B0'
              return (
                <div key={e.id} className="grid grid-cols-4 items-center px-4 py-3 border-b last:border-0"
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${leagueColor}15`, color: leagueColor }}>{e.league}</span>
                    </div>
                    <div className="text-xs font-semibold truncate" style={{ color: '#E6E6FA' }}>{team}</div>
                  </div>
                  <div className="text-xs font-bold text-center" style={{ color: '#E6E6FA' }}>{line}</div>
                  <div className="text-center">
                    <span className="text-xs font-black" style={{ color: '#00FFA3' }}>+{edge}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold" style={{ color: '#A0A0B0' }}>{e.confidence_score}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {previewEdges.length > 0 && (
          <Link href="/dashboard/edges">
            <button className="w-full mt-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.08)' }}>
              View All AI Edges
            </button>
          </Link>
        )}
      </div>

      {/* ── 4. Upcoming Games Preview ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4" style={{ color: '#3B82F6' }} />
            <h2 className="text-sm font-bold" style={{ color: '#E6E6FA' }}>Upcoming Games</h2>
          </div>
          <Link href="/dashboard/picks"
            className="text-xs font-semibold flex items-center gap-0.5 hover:underline"
            style={{ color: '#3B82F6' }}>
            View All <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-xl px-4 py-5 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs" style={{ color: '#6B6B80' }}>No upcoming games available.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Table header */}
            <div className="grid grid-cols-4 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border-b"
              style={{ color: '#6B6B80', borderColor: 'rgba(255,255,255,0.06)' }}>
              <span className="col-span-2">Matchup</span>
              <span className="text-center">Book / AI Spread</span>
              <span className="text-right">Win Prob</span>
            </div>
            {games.map((p) => {
              const game = p.games ?? p
              const leagueColor = LEAGUE_COLORS[game.league] || '#A0A0B0'
              const sbSpread = game.sportsbook_spread
              const aiSpread = p.ai_spread
              const homeProb = p.home_win_probability
              const awayProb = p.away_win_probability ?? (100 - homeProb)
              const favTeam = homeProb >= awayProb ? game.home_team_name : game.away_team_name
              const favProb = Math.max(homeProb, awayProb)
              return (
                <div key={p.id} className="grid grid-cols-4 items-center px-4 py-3 border-b last:border-0"
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="col-span-2 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${leagueColor}15`, color: leagueColor }}>{game.league}</span>
                      <span className="text-[10px]" style={{ color: '#4A4A60' }}>{formatTime(game.scheduled_at)}</span>
                    </div>
                    <div className="text-xs font-semibold truncate" style={{ color: '#E6E6FA' }}>
                      {game.away_team_name} @ {game.home_team_name}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs" style={{ color: '#A0A0B0' }}>{formatSpread(sbSpread)}</div>
                    <div className="text-xs font-bold" style={{ color: '#00FFA3' }}>{formatSpread(aiSpread)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold" style={{ color: '#E6E6FA' }}>{favProb}%</div>
                    <div className="text-[10px] truncate" style={{ color: '#6B6B80' }}>{favTeam.split(' ').pop()}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {games.length > 0 && (
          <Link href="/dashboard/picks">
            <button className="w-full mt-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.08)' }}>
              View All Games
            </button>
          </Link>
        )}
      </div>

      {/* ── 5. Bracket Lab Promo ── */}
      <div>
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <FlaskConical className="w-5 h-5" style={{ color: '#F59E0B' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">🏀</span>
                <h3 className="text-sm font-bold" style={{ color: '#E6E6FA' }}>Bracket Lab</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>Premium</span>
              </div>
              <p className="text-xs mb-3" style={{ color: '#A0A0B0' }}>
                Create or import your tournament bracket and let AI analyze it.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
                {[
                  'Pool win probability',
                  'Duplicate bracket risk',
                  'Optimal alternative picks',
                  'Upset radar',
                ].map(f => (
                  <span key={f} className="text-xs flex items-center gap-1" style={{ color: '#A0A0B0' }}>
                    <span style={{ color: '#F59E0B' }}>•</span> {f}
                  </span>
                ))}
              </div>
              <Link href="/dashboard/bracket-lab">
                <button
                  className="px-5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
                >
                  Open Bracket Lab <ChevronRight className="inline w-3.5 h-3.5 -mt-0.5" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
