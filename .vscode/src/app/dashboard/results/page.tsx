'use client'

import { useEffect, useState } from 'react'
import { Trophy, CheckCircle, XCircle, BarChart3, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316', NFL: '#3B82F6', MLB: '#EF4444',
  NHL: '#A78BFA', NCAAB: '#F59E0B', EPL: '#00FFA3', UCL: '#06B6D4',
}

interface ResultGame {
  home_team_name: string
  away_team_name: string
  sport: string
  league: string
  actual_home_score: number
  actual_away_score: number
  sportsbook_spread: number | null
  sportsbook_total: number | null
  scheduled_at: string
}

interface ResultPrediction {
  id: string
  predicted_home_score: number
  predicted_away_score: number
  confidence: number
  ai_spread: number | null
  ai_total: number | null
  games: ResultGame
}

interface Result {
  id: string
  prediction_id: string
  is_correct: boolean
  actual_result: string
  spread_correct: boolean | null
  total_correct: boolean | null
  actual_spread: number | null
  actual_total: number | null
  evaluated_at: string
  predictions: ResultPrediction
}

export default function ResultsPage() {
  const [results, setResults] = useState<Result[]>([])
  const [accuracy, setAccuracy] = useState(0)
  const [spreadAccuracy, setSpreadAccuracy] = useState(0)
  const [totalAccuracy, setTotalAccuracy] = useState(0)
  const [total, setTotal] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/results')
      .then((r) => r.json())
      .then((d) => {
        setResults(d.results || [])
        setAccuracy(d.accuracy || 0)
        setSpreadAccuracy(d.spreadAccuracy || 0)
        setTotalAccuracy(d.totalAccuracy || 0)
        setTotal(d.total || 0)
        setCorrect(d.correct || 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const chartData = [
    { name: 'Score', correct: accuracy, incorrect: 100 - accuracy },
    { name: 'Spread', correct: spreadAccuracy, incorrect: 100 - spreadAccuracy },
    { name: 'Total', correct: totalAccuracy, incorrect: 100 - totalAccuracy },
  ]

  const leagueStats = results.reduce<Record<string, { total: number; correct: number; league: string }>>((acc, r) => {
    const league = r.predictions?.games?.league || 'Unknown'
    if (!acc[league]) acc[league] = { total: 0, correct: 0, league }
    acc[league].total++
    if (r.is_correct) acc[league].correct++
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6" style={{ background: '#0F0F1A', minHeight: '100%' }}>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#E6E6FA' }}>Results History</h1>
        <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>
          Transparent track record — score, spread, and total accuracy
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Score Accuracy', value: `${accuracy}%`, color: '#00FFA3', icon: Trophy },
              { label: 'Spread Accuracy', value: `${spreadAccuracy}%`, color: '#3B82F6', icon: TrendingUp },
              { label: 'Total Accuracy', value: `${totalAccuracy}%`, color: '#A78BFA', icon: BarChart3 },
              { label: 'Games Graded', value: `${correct}/${total}`, color: '#F59E0B', icon: CheckCircle },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  <span className="text-xs" style={{ color: '#A0A0B0' }}>{stat.label}</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Accuracy chart */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#E6E6FA' }}>
              <BarChart3 className="w-4 h-4" style={{ color: '#00FFA3' }} />
              Accuracy Breakdown
            </h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barSize={40}>
                <XAxis dataKey="name" tick={{ fill: '#A0A0B0', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#A0A0B0', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#1C1C2A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#E6E6FA' }}
                  formatter={(value: number) => [`${value}%`]}
                />
                <Bar dataKey="correct" radius={[6, 6, 0, 0]} name="Correct %">
                  <Cell fill="#00FFA3" />
                  <Cell fill="#3B82F6" />
                  <Cell fill="#A78BFA" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* League breakdown */}
          {Object.keys(leagueStats).length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: '#E6E6FA' }}>Accuracy by League</h2>
              <div className="space-y-3">
                {Object.values(leagueStats).map((ls) => {
                  const pct = ls.total > 0 ? Math.round((ls.correct / ls.total) * 100) : 0
                  const color = LEAGUE_COLORS[ls.league] || '#A0A0B0'
                  return (
                    <div key={ls.league}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color }}>{ls.league}</span>
                        <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{pct}% ({ls.correct}/{ls.total})</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '999px' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Results table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>All Graded Results</h2>
            </div>
            {results.length === 0 ? (
              <div className="p-10 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: '#A0A0B0' }} />
                <p className="font-semibold" style={{ color: '#E6E6FA' }}>No results yet</p>
                <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>Completed games will appear here</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {results.map((r) => {
                  const pred = r.predictions
                  const game = pred?.games
                  if (!game) return null
                  const leagueColor = LEAGUE_COLORS[game.league] || '#A0A0B0'
                  const date = new Date(game.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })

                  return (
                    <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${leagueColor}20`, color: leagueColor }}>{game.league}</span>
                          <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>{game.home_team_name} vs {game.away_team_name}</span>
                          <span className="text-xs" style={{ color: '#A0A0B0' }}>{date}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: '#A0A0B0' }}>
                          <span>AI: <span style={{ color: '#E6E6FA' }}>{pred.predicted_home_score}–{pred.predicted_away_score}</span></span>
                          <span>Actual: <span style={{ color: '#E6E6FA' }}>{game.actual_home_score}–{game.actual_away_score}</span></span>
                          {r.actual_spread != null && <span>Spread: <span style={{ color: r.spread_correct ? '#00FFA3' : '#FF6B6B' }}>{r.actual_spread > 0 ? '+' : ''}{r.actual_spread} {r.spread_correct ? '✓' : '✗'}</span></span>}
                          {r.actual_total != null && <span>Total: <span style={{ color: r.total_correct ? '#00FFA3' : '#FF6B6B' }}>{r.actual_total} {r.total_correct ? '✓' : '✗'}</span></span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {r.is_correct
                          ? <CheckCircle className="w-5 h-5" style={{ color: '#00FFA3' }} />
                          : <XCircle className="w-5 h-5" style={{ color: '#FF6B6B' }} />
                        }
                        <span className="text-xs" style={{ color: '#A0A0B0' }}>{pred.confidence}% conf</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
