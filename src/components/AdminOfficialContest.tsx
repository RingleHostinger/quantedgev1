'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, Plus, Lock, Unlock, CheckCircle, XCircle,
  Trophy, Calendar, Clock, Users, AlertTriangle, Play,
  ChevronDown, ChevronRight, Trash2, Crown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ContestGame {
  id: string
  contest_day_id: string
  matchup_key: string
  team1_name: string
  team1_seed: number
  team2_name: string
  team2_seed: number
  region: string
  round_key: string
  winner: string | null
  is_locked: boolean
  status: string
}

interface ContestDay {
  id: string
  day_number: number
  round_label: string
  picks_required: number
  status: string
  lock_time: string | null
  games?: ContestGame[]
}

interface ContestEntry {
  id: string
  user_id: string
  entry_number: number
  status: string
  eliminated_at_day: number | null
  last_advanced_day: number
  created_at: string
}

interface ContestPick {
  id: string
  entry_id: string
  contest_day_id: string
  game_id: string
  team_name: string
  team_seed: number
  result: string
}

interface AdminContestData {
  contest: {
    id: string
    bracket_data: Record<string, unknown>
    bracket_confirmed: boolean
    status: string
  }
  days: ContestDay[]
  entries: ContestEntry[]
  picks: ContestPick[]
  stats: {
    totalEntries: number
    activeEntries: number
    eliminatedEntries: number
    winnerEntries: number
  }
}

const ROUND_LABELS = [
  { value: 'Round of 64', label: 'Round of 64' },
  { value: 'Round of 32', label: 'Round of 32' },
  { value: 'Sweet 16', label: 'Sweet 16' },
  { value: 'Elite 8', label: 'Elite 8' },
  { value: 'Final Four', label: 'Final Four' },
  { value: 'Championship', label: 'Championship' },
]

const REGIONS = ['east', 'west', 'south', 'midwest']

export function AdminOfficialContest() {
  const [data, setData] = useState<AdminContestData | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Section toggles
  const [sections, setSections] = useState({
    status: true,
    bracket: true,
    days: true,
    games: true,
    entries: true,
  })

  // Bracket editor state
  const [bracketData, setBracketData] = useState<Record<string, unknown> | null>(null)
  const [bracketEditing, setBracketEditing] = useState(false)

  // Day management state
  const [newDay, setNewDay] = useState({
    day_number: 1,
    round_label: 'Round of 64',
    picks_required: 8,
    lock_time: '',
  })
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)

  // Game posting state
  const [newGame, setNewGame] = useState({
    team1_name: '',
    team1_seed: 1,
    team2_name: '',
    team2_seed: 16,
    region: 'east',
    round_key: 'round64',
    matchup_key: '',
  })
  const [pendingGames, setPendingGames] = useState<typeof newGame[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/survivor-contest')
      const json = await res.json()
      if (res.ok) {
        setData(json)
        if (json.contest?.bracket_data) {
          setBracketData(json.contest.bracket_data as Record<string, unknown>)
        }
      } else {
        setMsg(json.error || 'Failed to load data')
      }
    } catch {
      setMsg('Error loading data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleSection = (section: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // API mutation helper
  const mutate = async (action: string, payload?: Record<string, unknown>) => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/survivor-contest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      const json = await res.json()
      if (res.ok) {
        setMsg(json.message || 'Success')
        await loadData()
      } else {
        setMsg(json.error || 'Action failed')
      }
    } catch {
      setMsg('Error performing action')
    } finally {
      setLoading(false)
    }
  }

  // Bracket functions
  const handleLoadTeams = async () => {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/survivor-contest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load_teams' }),
      })
      const json = await res.json()
      if (res.ok && json.regions) {
        setBracketData({
          regions: json.regions,
          results: {}
        })
        setMsg('Teams loaded from database')
      } else {
        setMsg(json.error || 'No teams found')
      }
    } catch {
      setMsg('Error loading teams')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBracket = () => {
    if (!bracketData) return
    mutate('save_bracket', { bracketData })
    setBracketEditing(false)
  }

  const handleConfirmBracket = () => {
    if (!bracketData) return
    if (!confirm('Are you sure you want to confirm the bracket? This cannot be undone.')) return
    mutate('confirm_bracket', { bracketData })
    setBracketEditing(false)
  }

  const handleActivateContest = () => {
    mutate('activate_contest')
  }

  // Day management
  const handleCreateDay = () => {
    mutate('create_day', {
      day_number: newDay.day_number,
      round_label: newDay.round_label,
      picks_required: newDay.picks_required,
      lock_time: newDay.lock_time || null,
    })
    setNewDay({
      day_number: data ? Math.max(...data.days.map(d => d.day_number), 0) + 1 : 1,
      round_label: 'Round of 64',
      picks_required: 8,
      lock_time: '',
    })
  }

  const handleUpdateDay = (dayId: string, status: string) => {
    mutate('update_day', { day_id: dayId, status })
  }

  const handleCompleteDay = (dayId: string) => {
    mutate('complete_day', { day_id: dayId })
  }

  // Game management
  const handleAddGameToList = () => {
    if (!newGame.team1_name || !newGame.team2_name) return
    setPendingGames(prev => [...prev, { ...newGame, matchup_key: `m${prev.length}` }])
    setNewGame({
      team1_name: '',
      team1_seed: 1,
      team2_name: '',
      team2_seed: 16,
      region: 'east',
      round_key: 'round64',
      matchup_key: '',
    })
  }

  const handlePostGames = () => {
    if (!selectedDayId || pendingGames.length === 0) return
    mutate('post_games', {
      day_id: selectedDayId,
      games: pendingGames,
    })
    setPendingGames([])
  }

  const handleLockGame = (gameId: string, locked: boolean) => {
    mutate('lock_game', { game_id: gameId, locked })
  }

  const handleGradeGame = (gameId: string, winner: string) => {
    mutate('grade_game', { game_id: gameId, winner })
  }

  const selectedDay = data?.days.find(d => d.id === selectedDayId)

  // Update suggested day number when data loads
  useEffect(() => {
    if (data && data.days.length > 0) {
      const maxDay = Math.max(...data.days.map(d => d.day_number))
      setNewDay(prev => ({ ...prev, day_number: maxDay + 1 }))
    }
  }, [data])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#00FFA3'
      case 'locked': return '#F59E0B'
      case 'open': return '#00FFA3'
      default: return '#A0A0B0'
    }
  }

  const getContestStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#00FFA3'
      case 'completed': return '#F59E0B'
      default: return '#A0A0B0'
    }
  }

  // Helper to update bracket team name
  const updateBracketTeam = (region: string, seed: number, name: string) => {
    if (!bracketData || !bracketData.regions) return
    const regions = { ...bracketData.regions } as Record<string, Array<{ seed: number; name: string }>>
    const regionArray = [...regions[region]]
    const idx = regionArray.findIndex(t => t.seed === seed)
    if (idx >= 0) {
      regionArray[idx] = { ...regionArray[idx], name }
    } else {
      regionArray.push({ seed, name })
    }
    regions[region] = regionArray
    setBracketData({ ...bracketData, regions })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Official Survivor — Contest Management</h2>
          <p className="text-sm mt-0.5" style={{ color: '#A0A0B0' }}>
            Manage bracket setup, contest days, games, and view entries.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadData}
            disabled={loading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {data?.contest?.status === 'setup' && data?.contest?.bracket_confirmed && (
            <Button
              onClick={handleActivateContest}
              disabled={loading}
              size="sm"
              className="gap-2"
              style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }}
            >
              <Play className="w-4 h-4" />
              Activate Contest
            </Button>
          )}
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className="text-sm px-4 py-2 rounded-xl"
          style={{
            background: msg.toLowerCase().includes('error') ? 'rgba(255,107,107,0.1)' : 'rgba(0,255,163,0.08)',
            color: msg.toLowerCase().includes('error') ? '#FF6B6B' : '#00FFA3',
            border: msg.toLowerCase().includes('error') ? '1px solid rgba(255,107,107,0.2)' : '1px solid rgba(0,255,163,0.15)'
          }}>
          {msg}
        </div>
      )}

      {/* Contest Status Section */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <button
          onClick={() => toggleSection('status')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Contest Status</span>
          </div>
          {sections.status ? <ChevronDown className="w-4 h-4" style={{ color: '#6B6B80' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#6B6B80' }} />}
        </button>

        {sections.status && data && (
          <div className="px-4 pb-4 space-y-4">
            {/* Status badge */}
            <div className="flex items-center gap-3">
              <span
                className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{
                  background: `${getContestStatusColor(data.contest.status)}15`,
                  color: getContestStatusColor(data.contest.status),
                  border: `1px solid ${getContestStatusColor(data.contest.status)}30`
                }}
              >
                {data.contest.status?.toUpperCase() || 'SETUP'}
              </span>
              {data.contest.bracket_confirmed && (
                <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
                  Bracket Confirmed
                </span>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-lg font-bold" style={{ color: '#E6E6FA' }}>{data.stats.totalEntries}</div>
                <div className="text-xs" style={{ color: '#6B6B80' }}>Total Entries</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-lg font-bold" style={{ color: '#00FFA3' }}>{data.stats.activeEntries}</div>
                <div className="text-xs" style={{ color: '#6B6B80' }}>Active</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-lg font-bold" style={{ color: '#FF6B6B' }}>{data.stats.eliminatedEntries}</div>
                <div className="text-xs" style={{ color: '#6B6B80' }}>Eliminated</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-lg font-bold" style={{ color: '#F59E0B' }}>{data.stats.winnerEntries}</div>
                <div className="text-xs" style={{ color: '#6B6B80' }}>Winners</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bracket Setup Section */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <button
          onClick={() => toggleSection('bracket')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Bracket Setup</span>
          </div>
          {sections.bracket ? <ChevronDown className="w-4 h-4" style={{ color: '#6B6B80' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#6B6B80' }} />}
        </button>

        {sections.bracket && (
          <div className="px-4 pb-4 space-y-4">
            {!data?.contest?.bracket_confirmed ? (
              <>
                {/* Bracket editor */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {REGIONS.map(region => (
                    <div key={region}>
                      <div className="text-xs font-bold mb-2 capitalize" style={{ color: '#A0A0B0' }}>{region}</div>
                      <div className="space-y-1">
                        {Array.from({ length: 16 }, (_, i) => i + 1).map(seed => {
                          const team = (bracketData?.regions as Record<string, Array<{ seed: number; name: string }>>)?.[region]?.find(t => t.seed === seed)
                          return (
                            <div key={seed} className="flex items-center gap-2">
                              <span className="text-xs w-6 text-right" style={{ color: '#6B6B80' }}>{seed}</span>
                              <Input
                                value={team?.name || ''}
                                onChange={(e) => updateBracketTeam(region, seed, e.target.value)}
                                placeholder={`Seed ${seed}`}
                                className="h-7 text-xs"
                                style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={handleLoadTeams}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    Load Teams
                  </Button>
                  <Button
                    onClick={handleSaveBracket}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                  >
                    Save Bracket
                  </Button>
                  <Button
                    onClick={handleConfirmBracket}
                    disabled={loading}
                    size="sm"
                    style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Confirm Bracket
                  </Button>
                </div>
              </>
            ) : (
              /* Read-only bracket view */
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {REGIONS.map(region => (
                  <div key={region}>
                    <div className="text-xs font-bold mb-2 capitalize" style={{ color: '#A0A0B0' }}>{region}</div>
                    <div className="space-y-0.5">
                      {(bracketData?.regions as Record<string, Array<{ seed: number; name: string }>>)?.[region]?.map(team => (
                        <div key={team.seed} className="flex items-center gap-2 text-xs">
                          <span className="w-5 text-right" style={{ color: '#6B6B80' }}>{team.seed}</span>
                          <span style={{ color: '#E6E6FA' }}>{team.name || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contest Days Section */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <button
          onClick={() => toggleSection('days')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Contest Days</span>
          </div>
          {sections.days ? <ChevronDown className="w-4 h-4" style={{ color: '#6B6B80' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#6B6B80' }} />}
        </button>

        {sections.days && (
          <div className="px-4 pb-4 space-y-4">
            {/* Create new day form */}
            <div className="flex gap-2 flex-wrap items-end p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <label className="text-xs block mb-1" style={{ color: '#6B6B80' }}>Day #</label>
                <Input
                  type="number"
                  value={newDay.day_number}
                  onChange={(e) => setNewDay(prev => ({ ...prev, day_number: parseInt(e.target.value) || 1 }))}
                  className="w-20 h-8"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: '#6B6B80' }}>Round</label>
                <select
                  value={newDay.round_label}
                  onChange={(e) => setNewDay(prev => ({ ...prev, round_label: e.target.value }))}
                  className="h-8 rounded-lg px-2 text-xs border"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#E6E6FA' }}
                >
                  {ROUND_LABELS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: '#6B6B80' }}>Picks Req</label>
                <Input
                  type="number"
                  value={newDay.picks_required}
                  onChange={(e) => setNewDay(prev => ({ ...prev, picks_required: parseInt(e.target.value) || 1 }))}
                  className="w-20 h-8"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: '#6B6B80' }}>Lock Time</label>
                <Input
                  type="datetime-local"
                  value={newDay.lock_time}
                  onChange={(e) => setNewDay(prev => ({ ...prev, lock_time: e.target.value }))}
                  className="h-8 text-xs"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                />
              </div>
              <Button
                onClick={handleCreateDay}
                disabled={loading}
                size="sm"
                className="h-8 gap-1"
                style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }}
              >
                <Plus className="w-3 h-3" />
                Add Day
              </Button>
            </div>

            {/* Days list */}
            <div className="space-y-2">
              {data?.days.map(day => (
                <div
                  key={day.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    background: selectedDayId === day.id ? 'rgba(0,255,163,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selectedDayId === day.id ? 'rgba(0,255,163,0.2)' : 'rgba(255,255,255,0.05)'}`
                  }}
                >
                  <button
                    onClick={() => setSelectedDayId(selectedDayId === day.id ? null : day.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div>
                      <div className="text-xs font-bold" style={{ color: '#E6E6FA' }}>Day {day.day_number}</div>
                      <div className="text-xs" style={{ color: '#6B6B80' }}>{day.round_label}</div>
                    </div>
                    <div className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: `${getStatusColor(day.status)}15`,
                        color: getStatusColor(day.status)
                      }}>
                      {day.status}
                    </div>
                    <div className="text-xs" style={{ color: '#6B6B80' }}>
                      {day.picks_required} picks
                    </div>
                  </button>
                  <div className="flex gap-1">
                    {day.status === 'pending' && (
                      <Button onClick={() => handleUpdateDay(day.id, 'open')} size="sm" variant="ghost" className="h-7 text-xs">
                        Open
                      </Button>
                    )}
                    {day.status === 'open' && (
                      <Button onClick={() => handleUpdateDay(day.id, 'locked')} size="sm" variant="ghost" className="h-7 text-xs">
                        <Lock className="w-3 h-3" />
                      </Button>
                    )}
                    {day.status === 'locked' && (
                      <Button onClick={() => handleCompleteDay(day.id)} size="sm" variant="ghost" className="h-7 text-xs" style={{ color: '#00FFA3' }}>
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {data?.days.length === 0 && (
                <div className="text-center py-6 text-sm" style={{ color: '#6B6B80' }}>
                  No contest days yet. Create one above.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Game Management Section */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <button
          onClick={() => toggleSection('games')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Game Management</span>
          </div>
          {sections.games ? <ChevronDown className="w-4 h-4" style={{ color: '#6B6B80' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#6B6B80' }} />}
        </button>

        {sections.games && (
          <div className="px-4 pb-4 space-y-4">
            {!selectedDay ? (
              <div className="text-center py-4 text-sm" style={{ color: '#6B6B80' }}>
                Select a contest day above to manage games
              </div>
            ) : (
              <>
                {/* Post games form */}
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-xs font-bold mb-2" style={{ color: '#A0A0B0' }}>Add Games to Day {selectedDay.day_number}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <Input
                      placeholder="Team 1 Name"
                      value={newGame.team1_name}
                      onChange={(e) => setNewGame(prev => ({ ...prev, team1_name: e.target.value }))}
                      className="h-8 text-xs"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                    />
                    <Input
                      type="number"
                      placeholder="Seed"
                      value={newGame.team1_seed || ''}
                      onChange={(e) => setNewGame(prev => ({ ...prev, team1_seed: parseInt(e.target.value) || 1 }))}
                      className="h-8 text-xs w-16"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                    />
                    <Input
                      placeholder="Team 2 Name"
                      value={newGame.team2_name}
                      onChange={(e) => setNewGame(prev => ({ ...prev, team2_name: e.target.value }))}
                      className="h-8 text-xs"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                    />
                    <Input
                      type="number"
                      placeholder="Seed"
                      value={newGame.team2_seed || ''}
                      onChange={(e) => setNewGame(prev => ({ ...prev, team2_seed: parseInt(e.target.value) || 16 }))}
                      className="h-8 text-xs w-16"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <select
                      value={newGame.region}
                      onChange={(e) => setNewGame(prev => ({ ...prev, region: e.target.value }))}
                      className="h-8 rounded-lg px-2 text-xs border"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#E6E6FA' }}
                    >
                      {REGIONS.map(r => (
                        <option key={r} value={r} className="capitalize">{r}</option>
                      ))}
                    </select>
                    <select
                      value={newGame.round_key}
                      onChange={(e) => setNewGame(prev => ({ ...prev, round_key: e.target.value }))}
                      className="h-8 rounded-lg px-2 text-xs border"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#E6E6FA' }}
                    >
                      <option value="round64">Round of 64</option>
                      <option value="round32">Round of 32</option>
                      <option value="sweet16">Sweet 16</option>
                      <option value="elite8">Elite 8</option>
                      <option value="finalFour">Final Four</option>
                      <option value="championship">Championship</option>
                    </select>
                    <div className="flex gap-1">
                      <Button
                        onClick={handleAddGameToList}
                        disabled={!newGame.team1_name || !newGame.team2_name}
                        size="sm"
                        variant="outline"
                        className="h-8"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      {pendingGames.length > 0 && (
                        <Button
                          onClick={handlePostGames}
                          disabled={loading}
                          size="sm"
                          className="h-8 gap-1"
                          style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }}
                        >
                          Post ({pendingGames.length})
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pending games list */}
                {pendingGames.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-bold" style={{ color: '#6B6B80' }}>Pending Games</div>
                    {pendingGames.map((g, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <span style={{ color: '#E6E6FA' }}>{g.team1_name}</span>
                        <span style={{ color: '#6B6B80' }}>({g.team1_seed})</span>
                        <span style={{ color: '#6B6B80' }}>vs</span>
                        <span style={{ color: '#E6E6FA' }}>{g.team2_name}</span>
                        <span style={{ color: '#6B6B80' }}>({g.team2_seed})</span>
                        <span className="capitalize" style={{ color: '#6B6B80' }}>| {g.region}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Games list for selected day */}
                {selectedDay.games && selectedDay.games.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold" style={{ color: '#6B6B80' }}>Posted Games</div>
                    {selectedDay.games.map(game => (
                      <div
                        key={game.id}
                        className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-sm">
                            <span style={{ color: '#E6E6FA' }}>{game.team1_name}</span>
                            <span className="mx-1.5" style={{ color: '#6B6B80' }}>({game.team1_seed})</span>
                            <span style={{ color: '#6B6B80' }}>vs</span>
                            <span className="mx-1.5" style={{ color: '#E6E6FA' }}>{game.team2_name}</span>
                            <span style={{ color: '#6B6B80' }}>({game.team2_seed})</span>
                          </div>
                          <span className="text-xs capitalize px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#6B6B80' }}>
                            {game.region}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded"
                            style={{
                              background: game.winner ? 'rgba(0,255,163,0.1)' : 'rgba(255,255,255,0.05)',
                              color: game.winner ? '#00FFA3' : '#6B6B80'
                            }}>
                            {game.winner ? `Winner: ${game.winner}` : game.status}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {!game.winner && (
                            <>
                              <Button
                                onClick={() => handleLockGame(game.id, !game.is_locked)}
                                size="sm"
                                variant="ghost"
                                className="h-7"
                              >
                                {game.is_locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                              </Button>
                              <Button
                                onClick={() => handleGradeGame(game.id, game.team1_name)}
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                style={{ color: '#00FFA3' }}
                              >
                                {game.team1_name}
                              </Button>
                              <Button
                                onClick={() => handleGradeGame(game.id, game.team2_name)}
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                style={{ color: '#00FFA3' }}
                              >
                                {game.team2_name}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Entries Section */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <button
          onClick={() => toggleSection('entries')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Entries</span>
            {data && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: '#6B6B80' }}>
                {data.entries.length}
              </span>
            )}
          </div>
          {sections.entries ? <ChevronDown className="w-4 h-4" style={{ color: '#6B6B80' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#6B6B80' }} />}
        </button>

        {sections.entries && (
          <div className="px-4 pb-4">
            {data?.entries.length === 0 ? (
              <div className="text-center py-6 text-sm" style={{ color: '#6B6B80' }}>
                No entries yet
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data?.entries.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2 rounded-lg text-xs"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#E6E6FA' }}>{entry.user_id.slice(0, 8)}...</span>
                      <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#A0A0B0' }}>
                        #{entry.entry_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px]"
                        style={{
                          background: entry.status === 'active' ? 'rgba(0,255,163,0.1)' : 'rgba(255,107,107,0.1)',
                          color: entry.status === 'active' ? '#00FFA3' : '#FF6B6B'
                        }}>
                        {entry.status}
                      </span>
                      {entry.eliminated_at_day && (
                        <span style={{ color: '#6B6B80' }}>Elim Day {entry.eliminated_at_day}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
