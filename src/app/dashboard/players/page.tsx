'use client'

import { useEffect, useState } from 'react'
import { User, Target, TrendingUp, Zap, Brain } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Player {
  id: string
  name: string
  position: string
  sport: string
  league: string
  goals: number
  assists: number
  shots: number
  points: number
  minutes_per_game: number
  recent_form_rating: number
  ai_insight: string
  team_id: string
}

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316', NFL: '#3B82F6', MLB: '#EF4444',
  NHL: '#A78BFA', NCAAB: '#F59E0B', EPL: '#00FFA3', UCL: '#06B6D4',
}

const MOCK_PLAYERS: Player[] = [
  { id: '1', name: 'LeBron James', position: 'SF', sport: 'Basketball', league: 'NBA', goals: 0, assists: 8, shots: 0, points: 28, minutes_per_game: 35, recent_form_rating: 8.7, ai_insight: 'LeBron is in exceptional form with 5 consecutive 25+ point games. High usage rate and elite playmaking make him a must-watch.', team_id: '' },
  { id: '2', name: 'Stephen Curry', position: 'PG', sport: 'Basketball', league: 'NBA', goals: 0, assists: 6, shots: 0, points: 31, minutes_per_game: 34, recent_form_rating: 9.2, ai_insight: 'Curry is shooting 48% from three over his last 10 games. Warriors offense runs through him — elite upside.', team_id: '' },
  { id: '3', name: 'Patrick Mahomes', position: 'QB', sport: 'American Football', league: 'NFL', goals: 0, assists: 0, shots: 0, points: 0, minutes_per_game: 0, recent_form_rating: 8.9, ai_insight: 'Mahomes has 7 TDs and 0 INTs over 3 games. His ability to extend plays is unmatched — elite pick to cover spread.', team_id: '' },
  { id: '4', name: 'Erling Haaland', position: 'ST', sport: 'Soccer', league: 'EPL', goals: 22, assists: 4, shots: 68, points: 0, minutes_per_game: 89, recent_form_rating: 9.1, ai_insight: 'Haaland has scored in 7 consecutive home matches. Opposition defenders struggle with his physical dominance.', team_id: '' },
  { id: '5', name: 'Mohamed Salah', position: 'RW', sport: 'Soccer', league: 'EPL', goals: 18, assists: 9, shots: 52, points: 0, minutes_per_game: 87, recent_form_rating: 8.6, ai_insight: 'Salah is in red-hot form with 5 goals in 4 games. Liverpool attack heavily relies on his right flank.', team_id: '' },
  { id: '6', name: 'Nikola Jokic', position: 'C', sport: 'Basketball', league: 'NBA', goals: 0, assists: 9, shots: 0, points: 27, minutes_per_game: 33, recent_form_rating: 9.5, ai_insight: 'The best player in basketball right now. Triple-double machine averaging 27/12/9 — every game is a potential masterclass.', team_id: '' },
  { id: '7', name: 'Connor McDavid', position: 'C', sport: 'Hockey', league: 'NHL', goals: 18, assists: 32, shots: 0, points: 50, minutes_per_game: 22, recent_form_rating: 9.3, ai_insight: 'McDavid is on pace for another 150-point season. He creates scoring chances out of nothing — game-winner potential every night.', team_id: '' },
  { id: '8', name: 'Vinicius Jr', position: 'LW', sport: 'Soccer', league: 'UCL', goals: 8, assists: 5, shots: 34, points: 0, minutes_per_game: 85, recent_form_rating: 8.4, ai_insight: 'Vini Jr is Real Madrid\'s most dangerous weapon in UCL. His dribbling and pace create chaos in any defense.', team_id: '' },
]

function getFormColor(rating: number) {
  if (rating >= 9) return '#00FFA3'
  if (rating >= 8) return '#3B82F6'
  if (rating >= 7) return '#F59E0B'
  return '#FF6B6B'
}

function getFormLabel(rating: number) {
  if (rating >= 9) return 'Elite'
  if (rating >= 8) return 'Excellent'
  if (rating >= 7) return 'Good'
  return 'Average'
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Player | null>(null)
  const [activeLeague, setActiveLeague] = useState('All')

  useEffect(() => {
    fetch('/api/players')
      .then((r) => r.json())
      .then((d) => {
        const fetched = d.players || []
        // Merge with mock data to ensure we always have rich content
        const combined = fetched.length > 0 ? fetched : MOCK_PLAYERS
        setPlayers(combined)
        setSelected(combined[0] || null)
        setLoading(false)
      })
      .catch(() => {
        setPlayers(MOCK_PLAYERS)
        setSelected(MOCK_PLAYERS[0])
        setLoading(false)
      })
  }, [])

  const leagues = ['All', ...Array.from(new Set(players.map((p) => p.league).filter(Boolean)))]
  const filtered = activeLeague === 'All' ? players : players.filter((p) => p.league === activeLeague)

  const barData = selected
    ? [
        { stat: 'Form', value: selected.recent_form_rating * 10 },
        { stat: 'Goals', value: Math.min((selected.goals || selected.points) * 3, 100) },
        { stat: 'Assists', value: Math.min(selected.assists * 4, 100) },
        { stat: 'Shots', value: Math.min(selected.shots * 1.5, 100) },
      ]
    : []

  return (
    <div className="p-6 space-y-6" style={{ background: '#0F0F1A', minHeight: '100%' }}>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#E6E6FA' }}>Player Analytics</h1>
        <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>
          Individual performance insights, form ratings, and AI analysis
        </p>
      </div>

      {/* League filter */}
      <div className="flex gap-2 flex-wrap">
        {leagues.map((league) => (
          <button
            key={league}
            onClick={() => setActiveLeague(league)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={activeLeague === league
              ? { background: 'rgba(0,255,163,0.2)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.4)' }
              : { background: 'rgba(255,255,255,0.05)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            {league !== 'All' && LEAGUE_COLORS[league] && (
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: LEAGUE_COLORS[league], verticalAlign: 'middle' }} />
            )}
            {league}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="h-80 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div className="lg:col-span-2 h-80 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Player list */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Players</h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              {filtered.map((player) => {
                const formColor = getFormColor(player.recent_form_rating)
                const leagueColor = LEAGUE_COLORS[player.league] || '#A0A0B0'
                return (
                  <button
                    key={player.id}
                    onClick={() => setSelected(player)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                    style={selected?.id === player.id ? { background: 'rgba(0,255,163,0.07)' } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${leagueColor}18` }}>
                        <span className="text-sm font-bold" style={{ color: leagueColor }}>{player.name[0]}</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>{player.name}</div>
                        <div className="text-xs" style={{ color: '#A0A0B0' }}>{player.position} · {player.league}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: formColor }}>{player.recent_form_rating}</div>
                      <div className="text-xs" style={{ color: formColor }}>{getFormLabel(player.recent_form_rating)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Player detail */}
          <div className="lg:col-span-2 space-y-4">
            {selected ? (
              <>
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${LEAGUE_COLORS[selected.league] || '#A0A0B0'}18` }}>
                        <span className="text-2xl font-bold" style={{ color: LEAGUE_COLORS[selected.league] || '#A0A0B0' }}>{selected.name[0]}</span>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold" style={{ color: '#E6E6FA' }}>{selected.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge style={{ background: `${LEAGUE_COLORS[selected.league] || '#A0A0B0'}20`, color: LEAGUE_COLORS[selected.league] || '#A0A0B0', border: 'none' }}>
                            {selected.league}
                          </Badge>
                          <span className="text-sm" style={{ color: '#A0A0B0' }}>{selected.position} · {selected.sport}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold" style={{ color: getFormColor(selected.recent_form_rating) }}>{selected.recent_form_rating}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>Form Rating</div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: selected.sport === 'Soccer' ? 'Goals' : selected.sport === 'Basketball' ? 'Points/G' : 'Points', value: selected.sport === 'Soccer' ? selected.goals : selected.points, color: '#00FFA3', icon: Target },
                      { label: 'Assists', value: selected.assists, color: '#3B82F6', icon: TrendingUp },
                      { label: selected.sport === 'Soccer' ? 'Shots' : 'MPG', value: selected.sport === 'Soccer' ? selected.shots : selected.minutes_per_game, color: '#F59E0B', icon: Zap },
                      { label: 'Form', value: `${getFormLabel(selected.recent_form_rating)}`, color: getFormColor(selected.recent_form_rating), icon: User },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <stat.icon className="w-4 h-4 mx-auto mb-1" style={{ color: stat.color }} />
                        <div className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Performance chart */}
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="text-sm font-semibold mb-4" style={{ color: '#E6E6FA' }}>Performance Index</h3>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={barData}>
                      <XAxis dataKey="stat" tick={{ fill: '#A0A0B0', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#A0A0B0', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: '#1C1C2A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#E6E6FA' }}
                      />
                      <Bar dataKey="value" fill="#00FFA3" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* AI Insight */}
                {selected.ai_insight && (
                  <div className="glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-4 h-4" style={{ color: '#00FFA3' }} />
                      <h3 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>AI Player Insight</h3>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: '#A0A0B0' }}>{selected.ai_insight}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="glass-card rounded-2xl p-8 text-center">
                <User className="w-12 h-12 mx-auto mb-4" style={{ color: '#A0A0B0' }} />
                <p className="font-semibold" style={{ color: '#E6E6FA' }}>Select a player to view analytics</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
