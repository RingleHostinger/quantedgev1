'use client'

import { useEffect, useState, useMemo } from 'react'
import { Zap, Lock, Star, TrendingUp, ChevronDown, ChevronUp, Trophy, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { GameSearchBar, GameSearchItem } from '@/components/GameSearchBar'

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316',
  NFL: '#3B82F6',
  MLB: '#EF4444',
  NHL: '#A78BFA',
  NCAAB: '#F59E0B',
  EPL: '#00FFA3',
  UCL: '#06B6D4',
}

const SPORT_ICONS: Record<string, string> = {
  Basketball: '🏀',
  'American Football': '🏈',
  Baseball: '⚾',
  Hockey: '🏒',
  Soccer: '⚽',
}

interface Game {
  id: string
  home_team_name: string
  away_team_name: string
  sport: string
  league: string
  scheduled_at: string
  status: string
  sportsbook_spread: number | null
  sportsbook_total: number | null
  sportsbook_moneyline_home: number | null
  sportsbook_moneyline_away: number | null
  is_free_pick: boolean
}

interface EdgePick {
  id: string
  game_id: string
  predicted_home_score: number
  predicted_away_score: number
  confidence: number
  home_win_probability: number
  away_win_probability: number
  ai_reasoning: string
  is_trending: boolean
  is_upset_pick: boolean
  ai_spread: number | null
  ai_total: number | null
  spread_edge: number | null
  total_edge: number | null
  max_edge: number
  model_spread: number | null
  sportsbook_spread: number | null
  games: Game
}

function edgeStrength(edge: number | null): { label: string; color: string; glow: string; bg: string } {
  if (edge == null || edge === 0) return { label: 'None', color: '#6B6B80', glow: 'none', bg: 'rgba(255,255,255,0.04)' }
  if (edge >= 6) return { label: 'Strong', color: '#00FFA3', glow: '0 0 14px rgba(0,255,163,0.5)', bg: 'rgba(0,255,163,0.12)' }
  if (edge >= 3) return { label: 'Medium', color: '#F59E0B', glow: '0 0 10px rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.10)' }
  return { label: 'Small', color: '#A0A0B0', glow: 'none', bg: 'rgba(255,255,255,0.05)' }
}

function formatSpread(spread: number | null, team?: string): string {
  if (spread == null) return 'N/A'
  const line = spread > 0 ? `+${spread}` : `${spread}`
  return team ? `${team} ${line}` : line
}

/** Determine which side has value and the bet to display */
function recommendedBet(
  modelSpread: number | null,
  sbSpread: number | null,
  homeTeam: string,
  awayTeam: string,
): { team: string; line: string } {
  if (modelSpread == null || sbSpread == null) {
    return { team: homeTeam, line: formatSpread(sbSpread) }
  }
  if (modelSpread > sbSpread) {
    // model thinks home is less of a favorite → underdog (away) has value
    const awayLine = -sbSpread
    return { team: awayTeam, line: awayLine >= 0 ? `+${awayLine}` : `${awayLine}` }
  }
  // model thinks home team is a bigger favorite → home has value
  return { team: homeTeam, line: formatSpread(sbSpread) }
}

function EdgeCard({ pick, rank }: { pick: EdgePick; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const game = pick.games
  const leagueColor = LEAGUE_COLORS[game.league] || '#A0A0B0'
  const sportIcon = SPORT_ICONS[game.sport] || '🏆'
  const gameTime = new Date(game.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const overallStrength = edgeStrength(pick.max_edge)
  const edgeAbs = Math.abs(pick.spread_edge ?? 0)
  const { color: edgeColor, label: edgeLabel, bg: edgeBg, glow: edgeGlow } = edgeStrength(edgeAbs)

  const bet = recommendedBet(
    pick.model_spread ?? pick.ai_spread,
    pick.sportsbook_spread ?? game.sportsbook_spread,
    game.home_team_name,
    game.away_team_name,
  )

  // Sportsbook line for display: always shown as home-perspective (e.g. "Spurs -7.5")
  const sbLine = game.sportsbook_spread != null
    ? `${game.home_team_name} ${game.sportsbook_spread > 0 ? '+' : ''}${game.sportsbook_spread}`
    : 'N/A'

  // Model line for display (home-perspective)
  const modelLine = (pick.model_spread ?? pick.ai_spread) != null
    ? `${game.home_team_name} ${(pick.model_spread ?? pick.ai_spread)! > 0 ? '+' : ''}${pick.model_spread ?? pick.ai_spread}`
    : 'N/A'

  const hasScores = pick.predicted_home_score != null && pick.predicted_away_score != null

  return (
    <div
      id={`game-card-${pick.id}`}
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${overallStrength.color}25`,
        boxShadow: pick.max_edge >= 6 ? `0 0 20px ${overallStrength.color}18` : undefined,
      }}
    >
      {/* ── Header: rank + league + matchup + time ── */}
      <div
        className="px-5 py-4 flex items-start gap-3"
        style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Rank bubble */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black mt-0.5"
          style={{
            background: rank <= 3 ? overallStrength.bg : 'rgba(255,255,255,0.06)',
            color: rank <= 3 ? overallStrength.color : '#A0A0B0',
            border: `1px solid ${rank <= 3 ? overallStrength.color + '40' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          {/* League + trending badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-base">{sportIcon}</span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${leagueColor}18`, color: leagueColor, border: `1px solid ${leagueColor}30` }}
            >
              {game.league}
            </span>
            {pick.is_trending && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: 'rgba(59,130,246,0.12)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.25)' }}>
                <TrendingUp className="w-2.5 h-2.5" />Trending
              </span>
            )}
          </div>

          {/* Matchup */}
          <div className="text-base font-black" style={{ color: '#E6E6FA' }}>
            {game.away_team_name} @ {game.home_team_name}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>{gameTime}</div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-5 py-5 space-y-5">

        {/* 1. Recommended Bet — hero section */}
        <div
          className="rounded-xl px-4 py-4"
          style={{ background: edgeBg, border: `1px solid ${edgeColor}35`, boxShadow: edgeGlow !== 'none' ? edgeGlow : undefined }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: edgeColor }}>Recommended Bet</span>
          </div>
          <div className="text-2xl font-black" style={{ color: '#FFFFFF' }}>
            {bet.team} {bet.line}
          </div>
        </div>

        {/* 2. Edge + Confidence row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl px-4 py-3 flex flex-col" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-xs font-semibold mb-1" style={{ color: '#6B6B80' }}>Edge</span>
            <span className="text-xl font-black" style={{ color: edgeColor }}>
              {edgeAbs > 0 ? '+' : ''}{edgeAbs.toFixed(1)}
            </span>
            <span className="text-xs font-bold uppercase tracking-wide mt-0.5" style={{ color: edgeColor }}>{edgeLabel}</span>
          </div>
          <div className="rounded-xl px-4 py-3 flex flex-col" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-xs font-semibold mb-1" style={{ color: '#6B6B80' }}>Confidence</span>
            <span className="text-xl font-black" style={{ color: '#E6E6FA' }}>{pick.confidence}%</span>
            <span className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>AI score</span>
          </div>
        </div>

        {/* 3. Sportsbook vs Model line */}
        <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Sportsbook Line</span>
            <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{sbLine}</span>
          </div>
          <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Model Line</span>
            <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>{modelLine}</span>
          </div>
        </div>

        {/* 4. Expand toggle for secondary details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-white/5"
          style={{ color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Hide Details' : 'More Details'}
        </button>

        {/* 5. Expanded secondary metrics */}
        {expanded && (
          <div className="space-y-3">
            {/* Win probability */}
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Target className="w-3.5 h-3.5" style={{ color: '#A0A0B0' }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#A0A0B0' }}>Model Win Probability</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs mb-0.5" style={{ color: '#6B6B80' }}>{game.home_team_name}</div>
                  <div className="text-lg font-black" style={{ color: '#E6E6FA' }}>{Math.round(pick.home_win_probability)}%</div>
                </div>
                <div>
                  <div className="text-xs mb-0.5" style={{ color: '#6B6B80' }}>{game.away_team_name}</div>
                  <div className="text-lg font-black" style={{ color: '#E6E6FA' }}>{Math.round(pick.away_win_probability)}%</div>
                </div>
              </div>
            </div>

            {/* Predicted score */}
            {hasScores && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#A0A0B0' }}>Predicted Score</div>
                <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>
                  {game.home_team_name} {Math.round(pick.predicted_home_score)} – {game.away_team_name} {Math.round(pick.predicted_away_score)}
                </div>
              </div>
            )}

            {/* AI reasoning */}
            {pick.ai_reasoning && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(0,255,163,0.04)', border: '1px solid rgba(0,255,163,0.12)' }}
              >
                <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#00FFA3' }}>AI Breakdown</div>
                <p className="text-xs leading-relaxed" style={{ color: '#C0C0D0' }}>{pick.ai_reasoning}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Blurred preview card for free users
function LockedPreviewCard({ rank }: { rank: number }) {
  const mockLeagues = ['NBA', 'NFL', 'EPL', 'NHL', 'UCL']
  const league = mockLeagues[(rank - 1) % mockLeagues.length]
  const leagueColor = LEAGUE_COLORS[league]

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Blurred content */}
      <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
            style={{ background: 'rgba(0,255,163,0.12)', color: '#00FFA3' }}>{rank}</div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${leagueColor}18`, color: leagueColor }}>{league}</span>
            </div>
            <div className="text-base font-black" style={{ color: '#E6E6FA' }}>Team A @ Team B</div>
            <div className="text-xs" style={{ color: '#6B6B80' }}>7:30 PM</div>
          </div>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div className="rounded-xl px-4 py-4" style={{ background: 'rgba(0,255,163,0.12)', border: '1px solid rgba(0,255,163,0.25)' }}>
            <div className="text-xs font-bold mb-2" style={{ color: '#00FFA3' }}>🔥 Recommended Bet</div>
            <div className="text-2xl font-black text-white">Team A +7.5</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-xs mb-1" style={{ color: '#6B6B80' }}>Edge</div>
              <div className="text-xl font-black" style={{ color: '#00FFA3' }}>+{(rank * 1.5 + 2).toFixed(1)}</div>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-xs mb-1" style={{ color: '#6B6B80' }}>Confidence</div>
              <div className="text-xl font-black" style={{ color: '#E6E6FA' }}>87%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ background: 'rgba(15,15,26,0.55)' }}>
        <Lock className="w-5 h-5 mb-1" style={{ color: '#A0A0B0' }} />
      </div>
    </div>
  )
}

export default function TopEdgesPage() {
  const [edges, setEdges] = useState<EdgePick[]>([])
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/edges')
      .then((r) => r.json())
      .then((data) => {
        setEdges(data.edges || [])
        setIsPremium(data.isPremium || false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const searchItems = useMemo<GameSearchItem[]>(() =>
    edges.map((e) => ({
      id: e.id,
      homeTeam: e.games.home_team_name,
      awayTeam: e.games.away_team_name,
      league: e.games.league,
    })),
  [edges])

  // --- FREE USER LOCKED VIEW ---
  if (!loading && !isPremium) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5" style={{ color: '#00FFA3' }} />
            <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Top AI Betting Edges Today</h1>
          </div>
          <p className="text-sm" style={{ color: '#A0A0B0' }}>
            These are the biggest differences between sportsbook odds and our AI projections.
          </p>
          <p className="text-xs mt-1" style={{ color: '#6B6B80' }}>Top AI Edges – {today}</p>
        </div>

        <div
          className="rounded-2xl p-8 mb-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(0,255,163,0.08), rgba(59,130,246,0.08))',
            border: '1px solid rgba(0,255,163,0.2)',
          }}
        >
          <div className="w-14 h-14 rounded-2xl gradient-green flex items-center justify-center mx-auto mb-4 neon-glow">
            <Star className="w-7 h-7 text-black" />
          </div>
          <h2 className="text-xl font-black mb-2" style={{ color: '#E6E6FA' }}>Premium Members Only</h2>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#A0A0B0' }}>
            Premium members get access to our highest value AI betting edges — ranked by the largest gaps between sportsbook lines and AI projections.
          </p>
          <Link href="/dashboard/pricing">
            <Button className="gradient-green text-black font-black text-sm px-8 py-5 rounded-xl border-0 hover:opacity-90 neon-glow">
              <Trophy className="w-4 h-4 mr-2" />
              Unlock Premium Picks
            </Button>
          </Link>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6B6B80' }}>
            Preview — Upgrade to unlock
          </p>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((rank) => (
              <LockedPreviewCard key={rank} rank={rank} />
            ))}
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
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5" style={{ color: '#00FFA3' }} />
            <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Top AI Betting Edges Today</h1>
          </div>
          <p className="text-sm" style={{ color: '#A0A0B0' }}>Loading today&apos;s top edges...</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      </div>
    )
  }

  // --- PREMIUM USER VIEW ---
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5" style={{ color: '#00FFA3' }} />
          <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Top AI Betting Edges Today</h1>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(0,255,163,0.12)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.25)' }}
          >
            PREMIUM
          </span>
        </div>
        <p className="text-sm" style={{ color: '#A0A0B0' }}>
          Biggest gaps between sportsbook lines and AI projections, ranked by edge size.
        </p>
        <p className="text-xs mt-1" style={{ color: '#6B6B80' }}>Top AI Edges – {today}</p>
      </div>

      {/* Jump to game */}
      <GameSearchBar games={searchItems} />

      {/* Edge legend */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Edge Strength:</span>
        {[
          { label: 'Strong (6+)', color: '#00FFA3' },
          { label: 'Medium (3–5)', color: '#F59E0B' },
          { label: 'Small (1–2)', color: '#A0A0B0' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs" style={{ color }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Edge cards */}
      {edges.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Zap className="w-10 h-10 mx-auto mb-4" style={{ color: '#4A4A60' }} />
          <p className="text-lg font-bold mb-2" style={{ color: '#E6E6FA' }}>No strong AI edges available right now.</p>
          <p className="text-sm mb-3" style={{ color: '#A0A0B0' }}>
            The model only publishes picks when it detects meaningful value against the sportsbook lines.
          </p>
          <p className="text-xs" style={{ color: '#6B6B80' }}>
            Check back later as odds move and new edges appear.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {edges.map((pick, i) => (
            <EdgeCard key={pick.id} pick={pick} rank={i + 1} />
          ))}
        </div>
      )}

      {edges.length > 0 && (
        <p className="text-xs text-center mt-8" style={{ color: '#4A4A60' }}>
          Showing top {edges.length} edge{edges.length !== 1 ? 's' : ''} · Ranked by largest AI vs sportsbook gap · Max 10 per day
        </p>
      )}
    </div>
  )
}
