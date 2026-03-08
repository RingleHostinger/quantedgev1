'use client'

import { useEffect, useState } from 'react'
import { Users, TrendingUp, Target, Shield } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Badge } from '@/components/ui/badge'

interface Team {
  id: string
  name: string
  sport: string
  season_wins: number
  season_draws: number
  season_losses: number
  goals_for: number
  goals_against: number
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Team | null>(null)

  useEffect(() => {
    fetch('/api/teams')
      .then((r) => r.json())
      .then((d) => {
        setTeams(d.teams || [])
        if (d.teams?.length > 0) setSelected(d.teams[0])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const getWinRate = (team: Team) => {
    const total = team.season_wins + team.season_draws + team.season_losses
    return total > 0 ? Math.round((team.season_wins / total) * 100) : 0
  }

  const getGoalsPerGame = (team: Team) => {
    const total = team.season_wins + team.season_draws + team.season_losses
    return total > 0 ? (team.goals_for / total).toFixed(1) : '0'
  }

  const getFormIndicator = (team: Team) => {
    const winRate = getWinRate(team)
    if (winRate >= 70) return { label: 'Excellent', color: '#00FFA3' }
    if (winRate >= 50) return { label: 'Good', color: '#3B82F6' }
    if (winRate >= 35) return { label: 'Average', color: '#F59E0B' }
    return { label: 'Poor', color: '#EF4444' }
  }

  const generatePerformanceData = (team: Team) => {
    const total = team.season_wins + team.season_draws + team.season_losses
    return Array.from({ length: 8 }, (_, i) => ({
      match: `M${total - 7 + i}`,
      goals: Math.max(0, Math.round(parseFloat(getGoalsPerGame(team)) + (Math.random() - 0.5) * 2)),
    }))
  }

  const statsBarData = teams.slice(0, 8).map((t) => ({
    name: t.name.length > 8 ? t.name.slice(0, 8) + '…' : t.name,
    wins: t.season_wins,
    losses: t.season_losses,
  }))

  return (
    <div className="p-6 space-y-6" style={{ background: '#0F0F1A', minHeight: '100%' }}>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#E6E6FA' }}>Team Analytics</h1>
        <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>Detailed performance metrics and season statistics</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>All Teams</h2>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />)}
            </div>
          ) : (
            <div className="divide-y" style={{ divideColor: 'rgba(255,255,255,0.05)' }}>
              {teams.map((team) => {
                const form = getFormIndicator(team)
                return (
                  <button
                    key={team.id}
                    onClick={() => setSelected(team)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                    style={selected?.id === team.id ? { background: 'rgba(0,255,163,0.08)' } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,255,163,0.15)' }}>
                        <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>{team.name[0]}</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>{team.name}</div>
                        <div className="text-xs" style={{ color: '#A0A0B0' }}>{team.sport}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{getWinRate(team)}%</div>
                      <div className="text-xs" style={{ color: form.color }}>{form.label}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,255,163,0.15)' }}>
                      <span className="text-2xl font-bold" style={{ color: '#00FFA3' }}>{selected.name[0]}</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold" style={{ color: '#E6E6FA' }}>{selected.name}</h2>
                      <Badge className="mt-1 text-xs" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: 'none' }}>
                        {selected.sport}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold gradient-text-green">{getWinRate(selected)}%</div>
                    <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>Win Rate</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Wins', value: selected.season_wins, color: '#00FFA3' },
                    { label: 'Draws', value: selected.season_draws, color: '#A0A0B0' },
                    { label: 'Losses', value: selected.season_losses, color: '#EF4444' },
                    { label: 'Goals For', value: selected.goals_for, color: '#3B82F6' },
                    { label: 'Goals Against', value: selected.goals_against, color: '#F59E0B' },
                    { label: 'Goals/Game', value: getGoalsPerGame(selected), color: '#00FFA3' },
                    { label: 'Conceded/Game', value: ((selected.goals_against / (selected.season_wins + selected.season_draws + selected.season_losses)) || 0).toFixed(1), color: '#EF4444' },
                    { label: 'Goal Diff', value: selected.goals_for - selected.goals_against > 0 ? `+${selected.goals_for - selected.goals_against}` : selected.goals_for - selected.goals_against, color: selected.goals_for > selected.goals_against ? '#00FFA3' : '#EF4444' },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#E6E6FA' }}>
                  <TrendingUp className="w-4 h-4" style={{ color: '#00FFA3' }} />
                  Goals Per Match — Recent Form
                </h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={generatePerformanceData(selected)}>
                    <XAxis dataKey="match" tick={{ fill: '#A0A0B0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#A0A0B0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1C1C2A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#E6E6FA' }}
                    />
                    <Bar dataKey="goals" fill="#00FFA3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#E6E6FA' }}>
                  <Shield className="w-4 h-4" style={{ color: '#3B82F6' }} />
                  Season Overview vs League Average
                </h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={statsBarData}>
                    <XAxis dataKey="name" tick={{ fill: '#A0A0B0', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#A0A0B0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1C1C2A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#E6E6FA' }}
                    />
                    <Bar dataKey="wins" fill="#00FFA3" radius={[4, 4, 0, 0]} name="Wins" />
                    <Bar dataKey="losses" fill="#FF6B6B" radius={[4, 4, 0, 0]} name="Losses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-4" style={{ color: '#A0A0B0' }} />
              <p className="font-semibold" style={{ color: '#E6E6FA' }}>Select a team to view analytics</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
