'use client'

import { useEffect, useState, useMemo } from 'react'
import { Lock, Star, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Zap, Gift, Search, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { GameSearchBar, GameSearchItem } from '@/components/GameSearchBar'

// Soccer leagues that map to the "Soccer" tab
const SOCCER_LEAGUES = new Set(['EPL', 'UCL', 'MLS', 'LaLiga', 'Bundesliga', 'SerieA', 'Ligue1'])

const TABS = ['All', 'NBA', 'NCAAB', 'NFL', 'MLB', 'NHL', 'Soccer']

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316',
  NFL: '#3B82F6',
  MLB: '#EF4444',
  NHL: '#A78BFA',
  NCAAB: '#F59E0B',
  EPL: '#00FFA3',
  UCL: '#06B6D4',
}

function leagueColor(league: string): string {
  return LEAGUE_COLORS[league] || '#A0A0B0'
}

type SortOption = 'time' | 'confidence' | 'edge'

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

interface Prediction {
  id: string
  game_id: string
  predicted_home_score: number
  predicted_away_score: number
  confidence: number
  home_win_probability: number
  away_win_probability: number
  draw_probability: number
  ai_reasoning: string
  is_trending: boolean
  is_upset_pick: boolean
  ai_spread: number | null
  ai_total: number | null
  spread_edge: number | null
  total_edge: number | null
  locked: boolean
  is_free_pick_game: boolean
  games: Game
}

function formatMoneyline(ml: number | null) {
  if (ml == null) return 'N/A'
  return ml > 0 ? `+${ml}` : `${ml}`
}

function formatSpread(spread: number | null, team?: string) {
  if (spread == null) return 'N/A'
  const sign = spread > 0 ? '+' : ''
  const line = `${sign}${spread}`
  return team ? `${team} ${line}` : line
}

function formatTs(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Determine the recommended bet side (mirrors officialPicksService logic) */
function recommendedBet(
  modelSpread: number | null,
  sbSpread: number | null,
  homeTeam: string,
  awayTeam: string,
): { team: string; line: string } | null {
  if (modelSpread == null || sbSpread == null) return null
  const edgeAbs = Math.abs(modelSpread - sbSpread)
  if (edgeAbs < 1) return null // not meaningful enough to show
  if (modelSpread > sbSpread) {
    const awayLine = -sbSpread
    return { team: awayTeam, line: awayLine >= 0 ? `+${awayLine}` : `${awayLine}` }
  }
  return { team: homeTeam, line: formatSpread(sbSpread) }
}

function edgeColor(edge: number | null): string {
  if (edge == null) return '#A0A0B0'
  const abs = Math.abs(edge)
  if (abs >= 4) return '#00FFA3'
  if (abs >= 2) return '#34D399'
  if (abs >= 1) return '#6EE7B7'
  return '#A0A0B0'
}

function PredictionCard({ p, expanded, onToggle }: {
  p: Prediction
  expanded: boolean
  onToggle: () => void
}) {
  const game = p.games
  const lc = leagueColor(game.league)
  const gameTime = new Date(game.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const gameDate = new Date(game.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
  const edgeAbs = Math.abs(p.spread_edge ?? 0)
  const ec = edgeColor(p.spread_edge)
  const bet = recommendedBet(p.ai_spread, game.sportsbook_spread, game.home_team_name, game.away_team_name)
  const homeProb = Math.round(p.home_win_probability)
  const awayProb = Math.round(p.away_win_probability)

  if (p.locked) {
    return (
      <div
        id={`game-card-${p.id}`}
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${lc}20`, color: lc }}>{game.league}</span>
            <span className="text-xs" style={{ color: '#A0A0B0' }}>{gameDate} · {gameTime}</span>
          </div>
          <Lock className="w-4 h-4" style={{ color: '#A0A0B0' }} />
        </div>
        <div className="filter blur-sm select-none pointer-events-none">
          <div className="text-base font-semibold mb-1" style={{ color: '#E6E6FA' }}>
            {game.away_team_name} @ {game.home_team_name}
          </div>
          <div className="flex gap-4 text-sm" style={{ color: '#A0A0B0' }}>
            <span>Spread: {formatSpread(game.sportsbook_spread)}</span>
            <span>Confidence: {p.confidence}%</span>
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(15,15,26,0.7)' }}>
          <Lock className="w-5 h-5 mb-2" style={{ color: '#A0A0B0' }} />
          <p className="text-xs font-semibold mb-2" style={{ color: '#E6E6FA' }}>Premium Pick</p>
          <Link href="/dashboard/pricing">
            <Button size="sm" className="text-xs gradient-green text-black border-0 font-bold">
              Upgrade to Unlock
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      id={`game-card-${p.id}`}
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: p.is_free_pick_game
          ? '1px solid rgba(0,255,163,0.3)'
          : '1px solid rgba(255,255,255,0.07)',
        boxShadow: p.is_free_pick_game ? '0 0 16px rgba(0,255,163,0.08)' : undefined,
      }}
    >
      <div className="p-5">
        {/* ── Top: matchup + badges ── */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${lc}20`, color: lc }}>{game.league}</span>
              <span className="text-xs" style={{ color: '#6B6B80' }}>{gameDate} · {gameTime}</span>
              {p.is_free_pick_game && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}>
                  <Gift className="w-3 h-3" />Free Pick
                </span>
              )}
              {p.is_trending && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                  <TrendingUp className="w-3 h-3" />Trending
                </span>
              )}
              {p.is_upset_pick && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                  <AlertTriangle className="w-3 h-3" />Upset Pick
                </span>
              )}
            </div>
            <div className="text-base font-black" style={{ color: '#E6E6FA' }}>
              {game.away_team_name} @ {game.home_team_name}
            </div>
          </div>
          {/* Confidence badge */}
          <div
            className="text-xs font-bold px-2.5 py-1.5 rounded-xl flex-shrink-0"
            style={p.confidence >= 75
              ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }
              : p.confidence >= 60
                ? { background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }
                : { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }
            }
          >
            {p.confidence}% conf
          </div>
        </div>

        {/* ── Recommended Bet (if meaningful edge) ── */}
        {bet && (
          <div
            className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2"
            style={{ background: 'rgba(0,255,163,0.07)', border: '1px solid rgba(0,255,163,0.2)' }}
          >
            <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#00FFA3' }} />
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Recommended Bet</span>
            <span className="text-sm font-black ml-auto" style={{ color: '#FFFFFF' }}>
              {bet.team} {bet.line}
            </span>
          </div>
        )}

        {/* ── Spread comparison ── */}
        <div
          className="rounded-xl px-3 py-3 mb-3 space-y-1.5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Market Spread</span>
            <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>
              {game.sportsbook_spread != null ? `${game.home_team_name} ${formatSpread(game.sportsbook_spread)}` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Model Spread</span>
            <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>
              {p.ai_spread != null ? `${game.home_team_name} ${formatSpread(p.ai_spread)}` : 'N/A'}
            </span>
          </div>
          {p.spread_edge != null && edgeAbs >= 1 && (
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Spread Edge</span>
              <span className="text-sm font-black" style={{ color: ec }}>
                {p.spread_edge > 0 ? '+' : ''}{p.spread_edge.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* ── Win Probability bar ── */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1" style={{ color: '#6B6B80' }}>
            <span>{game.home_team_name} {homeProb}%</span>
            <span>{awayProb}% {game.away_team_name}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${homeProb}%`, background: 'linear-gradient(90deg, #00FFA3, #3B82F6)' }}
            />
          </div>
          {p.draw_probability > 0 && (
            <div className="text-xs mt-1 text-center" style={{ color: '#6B6B80' }}>Draw: {Math.round(p.draw_probability)}%</div>
          )}
        </div>

        {/* ── Moneyline (compact) ── */}
        {(game.sportsbook_moneyline_home != null || game.sportsbook_moneyline_away != null) && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-xs truncate mb-0.5" style={{ color: '#6B6B80' }}>{game.home_team_name}</div>
              <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{formatMoneyline(game.sportsbook_moneyline_home)}</div>
            </div>
            <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-xs truncate mb-0.5" style={{ color: '#6B6B80' }}>{game.away_team_name}</div>
              <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{formatMoneyline(game.sportsbook_moneyline_away)}</div>
            </div>
          </div>
        )}

        {/* ── Expand toggle ── */}
        {p.ai_reasoning && (
          <button
            onClick={onToggle}
            className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
            style={{ color: '#00FFA3' }}
          >
            AI Analysis
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* ── AI reasoning panel ── */}
      {expanded && p.ai_reasoning && (
        <div className="px-5 pb-5">
          <div
            className="p-4 rounded-xl text-sm leading-relaxed"
            style={{ background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.12)', color: '#A0A0B0' }}
          >
            {p.ai_reasoning}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PicksPage() {
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([])
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('time')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/predictions')
      .then((r) => r.json())
      .then((d) => {
        setAllPredictions(d.predictions || [])
        setIsPremium(d.isPremium || false)
        setLastUpdated(d.lastUpdated || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Derive available tabs dynamically from actual data
  const availableLeagues = useMemo(() => {
    const set = new Set<string>()
    allPredictions.forEach((p) => set.add(p.games.league))
    return set
  }, [allPredictions])

  // Tab filtering — done client-side on the full dataset
  const tabFiltered = useMemo(() => {
    if (activeTab === 'All') return allPredictions
    if (activeTab === 'Soccer') {
      return allPredictions.filter((p) => SOCCER_LEAGUES.has(p.games.league))
    }
    return allPredictions.filter((p) => p.games.league === activeTab)
  }, [allPredictions, activeTab])

  // Search filtering
  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tabFiltered
    return tabFiltered.filter((p) => {
      const g = p.games
      return (
        g.home_team_name.toLowerCase().includes(q) ||
        g.away_team_name.toLowerCase().includes(q) ||
        g.league.toLowerCase().includes(q) ||
        `${g.away_team_name} @ ${g.home_team_name}`.toLowerCase().includes(q)
      )
    })
  }, [tabFiltered, search])

  // Sorting
  const sorted = useMemo(() => {
    return [...searchFiltered].sort((a, b) => {
      if (sortBy === 'time') {
        return new Date(a.games.scheduled_at).getTime() - new Date(b.games.scheduled_at).getTime()
      }
      if (sortBy === 'confidence') {
        return (b.confidence ?? 0) - (a.confidence ?? 0)
      }
      if (sortBy === 'edge') {
        return Math.abs(b.spread_edge ?? 0) - Math.abs(a.spread_edge ?? 0)
      }
      return 0
    })
  }, [searchFiltered, sortBy])

  const freePick = sorted.find((p) => p.is_free_pick_game)
  const otherPicks = sorted.filter((p) => !p.is_free_pick_game)

  const searchItems = useMemo<GameSearchItem[]>(() =>
    allPredictions.map((p) => ({
      id: p.id,
      homeTeam: p.games.home_team_name,
      awayTeam: p.games.away_team_name,
      league: p.games.league,
    })),
  [allPredictions])

  // Show badge count on tabs
  function tabCount(tab: string): number {
    if (tab === 'All') return allPredictions.length
    if (tab === 'Soccer') return allPredictions.filter((p) => SOCCER_LEAGUES.has(p.games.league)).length
    return allPredictions.filter((p) => p.games.league === tab).length
  }

  return (
    <div className="p-6 space-y-5" style={{ background: '#0F0F1A', minHeight: '100%' }}>

      {/* ── Header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Today&apos;s Predictions</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="w-3.5 h-3.5" style={{ color: '#4A4A60' }} />
            <span className="text-xs" style={{ color: '#4A4A60' }}>
              Last Updated: {formatTs(lastUpdated)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isPremium && (
            <Link href="/dashboard/pricing">
              <Button size="sm" className="gradient-green text-black font-bold border-0 neon-glow">
                <Star className="w-3.5 h-3.5 mr-1.5" />
                Unlock All Picks
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Jump to game ── */}
      <GameSearchBar games={searchItems} />

      {/* ── Search + Sort row ── */}
      <div className="flex gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#6B6B80' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams or leagues..."
            className="w-full rounded-xl pl-8 pr-3 py-2 text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#E6E6FA',
            }}
          />
        </div>
        {/* Sort */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {([
            { key: 'time', label: 'Time' },
            { key: 'confidence', label: 'Confidence' },
            { key: 'edge', label: 'Edge' },
          ] as { key: SortOption; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className="px-3 py-2 text-xs font-semibold transition-colors"
              style={sortBy === key
                ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }
                : { background: 'rgba(255,255,255,0.03)', color: '#6B6B80' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── League tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => {
          const count = tabCount(tab)
          const hasGames = count > 0
          return (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setExpandedId(null) }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={activeTab === tab
                ? { background: 'rgba(0,255,163,0.18)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.4)' }
                : { background: 'rgba(255,255,255,0.05)', color: hasGames ? '#A0A0B0' : '#4A4A60', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {tab !== 'All' && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                  style={{
                    background: tab === 'Soccer' ? '#00FFA3' : (leagueColor(tab)),
                    verticalAlign: 'middle',
                    opacity: hasGames ? 1 : 0.3,
                  }}
                />
              )}
              {tab}
              {count > 0 && (
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: activeTab === tab ? 'rgba(0,255,163,0.25)' : 'rgba(255,255,255,0.08)',
                    color: activeTab === tab ? '#00FFA3' : '#6B6B80',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-lg font-bold mb-2" style={{ color: '#E6E6FA' }}>
            {search
              ? 'No games match your search.'
              : `No live predictions available for ${activeTab === 'All' ? 'any league' : activeTab} right now.`}
          </p>
          <p className="text-sm" style={{ color: '#A0A0B0' }}>
            {search ? 'Try a different team name or league.' : 'Check back later or switch to another tab.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Free Pick highlight */}
          {freePick && !isPremium && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-4 h-4" style={{ color: '#00FFA3' }} />
                <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>Daily Free Pick</span>
                <span className="text-xs" style={{ color: '#A0A0B0' }}>— Today&apos;s admin-selected free game</span>
              </div>
              <PredictionCard
                p={freePick}
                expanded={expandedId === freePick.id}
                onToggle={() => setExpandedId(expandedId === freePick.id ? null : freePick.id)}
              />
            </div>
          )}

          {/* All picks (premium) or locked list (free) */}
          <div>
            {!isPremium && otherPicks.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4" style={{ color: '#A0A0B0' }} />
                <span className="text-sm font-semibold" style={{ color: '#A0A0B0' }}>Premium Picks — Upgrade to unlock all</span>
              </div>
            )}
            {isPremium && sorted.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4" style={{ color: '#00FFA3' }} />
                  <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>
                    {activeTab === 'All' ? "All Predictions" : `${activeTab} Predictions`}
                  </span>
                </div>
                <span className="text-xs" style={{ color: '#6B6B80' }}>
                  {sorted.length} game{sorted.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            <div className="grid gap-4">
              {(isPremium ? sorted : otherPicks).map((p) => (
                <PredictionCard
                  key={p.id}
                  p={p}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {!loading && sorted.length > 0 && (
        <p className="text-xs text-center pt-2" style={{ color: '#4A4A60' }}>
          Showing {sorted.length} prediction{sorted.length !== 1 ? 's' : ''} · Sorted by {sortBy} · Powered by QuantEdge AI
        </p>
      )}
    </div>
  )
}
