'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Trophy, ChevronDown, AlertTriangle, CheckCircle, XCircle, ExternalLink, PartyPopper } from 'lucide-react'
import { SurvivorBracket } from '@/components/SurvivorBracket'
import { SurvivorGameCards, SurvivorGame } from '@/components/SurvivorGameCards'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface ContestDay {
  id: string
  day_number: number
  round_label: string
  picks_required: number
  status: string // pending | open | locked | completed
  lock_time: string | null
  games: SurvivorGame[]
}

interface Entry {
  id: string
  entry_number: number
  status: string // active | eliminated | winner
  eliminated_at_day: number | null
  last_advanced_day: number
}

interface EntryPick {
  id: string
  entry_id: string
  contest_day_id: string
  game_id: string
  team_name: string
  team_seed: number
  result: string
}

interface ContestData {
  contest: {
    id: string
    bracket_data: Record<string, unknown>
    bracket_confirmed: boolean
    status: string
  } | null
  days: ContestDay[]
  entries: Entry[]
  picks: EntryPick[]
}

export default function OfficialSurvivorPage() {
  const { toast } = useToast()
  const [data, setData] = useState<ContestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [localPicks, setLocalPicks] = useState<Record<string, { team_name: string; team_seed: number }>>({}) // game_id -> pick
  const [submitting, setSubmitting] = useState(false)
  const [showEntryDropdown, setShowEntryDropdown] = useState(false)
  const [shownPopups, setShownPopups] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/survivor/contest')
      const json = await res.json()
      if (res.ok) {
        setData(json)
        // Auto-select first entry if none selected
        if (!selectedEntryId && json.entries?.length > 0) {
          setSelectedEntryId(json.entries[0].id)
        }
        // Auto-select active day
        if (!selectedDayId && json.days?.length > 0) {
          const openDay = json.days.find((d: ContestDay) => d.status === 'open')
          const lastCompleted = [...json.days].reverse().find((d: ContestDay) => d.status === 'completed')
          setSelectedDayId(openDay?.id || lastCompleted?.id || json.days[0].id)
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [selectedEntryId, selectedDayId])

  useEffect(() => { loadData() }, [loadData])

  // Selected entry
  const selectedEntry = useMemo(
    () => data?.entries?.find(e => e.id === selectedEntryId) ?? null,
    [data, selectedEntryId]
  )

  // Picks for selected entry
  const entryPicks = useMemo(
    () => data?.picks?.filter(p => p.entry_id === selectedEntryId) ?? [],
    [data, selectedEntryId]
  )

  // Used teams for selected entry (from completed/locked days only)
  const usedTeams = useMemo(() => {
    if (!selectedDayId) return [] as string[]
    const currentDay = data?.days?.find(d => d.id === selectedDayId)
    return entryPicks
      .filter(p => {
        const pickDay = data?.days?.find(d => d.id === p.contest_day_id)
        return pickDay && pickDay.day_number !== currentDay?.day_number
      })
      .map(p => p.team_name)
  }, [entryPicks, selectedDayId, data])

  // Selected day
  const selectedDay = useMemo(
    () => data?.days?.find(d => d.id === selectedDayId) ?? null,
    [data, selectedDayId]
  )

  // Current day's existing picks for this entry
  const dayPicks = useMemo(
    () => entryPicks.filter(p => p.contest_day_id === selectedDayId),
    [entryPicks, selectedDayId]
  )

  // Initialize local picks from saved picks when day changes
  useEffect(() => {
    const newLocal: Record<string, { team_name: string; team_seed: number }> = {}
    dayPicks.forEach(p => {
      newLocal[p.game_id] = { team_name: p.team_name, team_seed: p.team_seed }
    })
    setLocalPicks(newLocal)
  }, [dayPicks])

  // Check for advancement popups
  useEffect(() => {
    if (!selectedEntry || !data?.days) return
    if (selectedEntry.status === 'eliminated' && !shownPopups.has(`elim_${selectedEntry.id}`)) {
      setShownPopups(prev => new Set([...prev, `elim_${selectedEntry.id}`]))
      toast({
        title: 'Entry Eliminated',
        description: `Entry #${selectedEntry.entry_number} has been eliminated.`,
        variant: 'destructive',
      })
    }
    // Check for advancement
    const completedDays = data.days.filter(d => d.status === 'completed').length
    if (
      selectedEntry.status === 'active' &&
      completedDays > 0 &&
      completedDays > selectedEntry.last_advanced_day &&
      !shownPopups.has(`adv_${selectedEntry.id}_${completedDays}`)
    ) {
      setShownPopups(prev => new Set([...prev, `adv_${selectedEntry.id}_${completedDays}`]))
      const nextDay = data.days.find(d => d.day_number === completedDays + 1)
      if (nextDay) {
        toast({
          title: 'You Advanced!',
          description: `Entry #${selectedEntry.entry_number} survived! Welcome to ${nextDay.round_label}.`,
        })
      }
    }
  }, [selectedEntry, data, shownPopups, toast])

  const handleSelectTeam = useCallback((gameId: string, teamName: string, teamSeed: number) => {
    setLocalPicks(prev => {
      const next = { ...prev }
      // If same team already selected, deselect
      if (next[gameId]?.team_name === teamName) {
        delete next[gameId]
        return next
      }
      // If another team in this game selected, replace
      // Check pick limit
      const currentCount = Object.keys(next).filter(k => k !== gameId).length
      const maxPicks = selectedDay?.picks_required ?? 1
      if (currentCount >= maxPicks && !next[gameId]) {
        // At limit, remove oldest pick to make room
        return next
      }
      next[gameId] = { team_name: teamName, team_seed: teamSeed }
      return next
    })
  }, [selectedDay])

  const handleSubmitPicks = async () => {
    if (!selectedEntryId || !selectedDayId) return
    const picks = Object.entries(localPicks).map(([game_id, { team_name, team_seed }]) => ({
      game_id,
      team_name,
      team_seed,
    }))
    setSubmitting(true)
    try {
      const res = await fetch('/api/survivor/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: selectedEntryId, contest_day_id: selectedDayId, picks }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: 'Picks Submitted', description: 'Your picks have been saved.' })
        await loadData()
      } else {
        toast({ title: 'Error', description: json.error || 'Failed to submit picks', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to submit picks', variant: 'destructive' })
    }
    finally { setSubmitting(false) }
  }

  const selectedTeamNames = useMemo(
    () => Object.values(localPicks).map(p => p.team_name),
    [localPicks]
  )

  const isLocked = selectedDay?.status === 'locked' || selectedDay?.status === 'completed'
  const isEntryEliminated = selectedEntry?.status === 'eliminated'
  const picksDisabled = isLocked || isEntryEliminated
  const canSubmit =
    !picksDisabled &&
    selectedTeamNames.length === (selectedDay?.picks_required ?? 1) &&
    !submitting

  // Lock timer display
  const lockTimeStr = selectedDay?.lock_time
    ? new Date(selectedDay.lock_time).toLocaleString()
    : null

  // Bracket pick highlights for the selected entry
  const bracketPickHighlights = useMemo(
    () => entryPicks.map(p => ({ team_name: p.team_name, result: p.result })),
    [entryPicks]
  )

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'rgba(0,255,163,0.3)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#6B6B80' }}>Loading contest...</p>
        </div>
      </div>
    )
  }

  if (!data?.contest) {
    return (
      <div className="p-6">
        <div className="text-center py-20 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Trophy className="w-12 h-12 mx-auto mb-4" style={{ color: '#6B6B80' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: '#E0E0E8' }}>Official Survivor</h2>
          <p className="text-sm" style={{ color: '#6B6B80' }}>
            The contest has not been set up yet. Check back soon!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl lg:text-2xl font-bold" style={{ color: '#E0E0E8' }}>
              Official Survivor
            </h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
              Powered by Sponsor
            </span>
          </div>
          <p className="text-xs" style={{ color: '#6B6B80' }}>
            Pick teams each day. If your pick loses, your entry is eliminated.
          </p>
        </div>

        {/* Entry selector */}
        {data.entries.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowEntryDropdown(!showEntryDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#E0E0E8',
              }}
            >
              <Trophy className="w-4 h-4" style={{ color: selectedEntry?.status === 'eliminated' ? '#EF4444' : '#00FFA3' }} />
              Entry #{selectedEntry?.entry_number ?? 1}
              {selectedEntry?.status === 'eliminated' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                  OUT
                </span>
              )}
              {selectedEntry?.status === 'active' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}>
                  ALIVE
                </span>
              )}
              <ChevronDown className="w-4 h-4" style={{ color: '#6B6B80' }} />
            </button>
            {showEntryDropdown && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-lg py-1 min-w-[180px]"
                style={{ background: '#1A1A2E', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                {data.entries.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => { setSelectedEntryId(entry.id); setShowEntryDropdown(false) }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-white/5"
                    style={{ color: entry.id === selectedEntryId ? '#00FFA3' : '#C0C0D0' }}
                  >
                    <Trophy className="w-3.5 h-3.5"
                      style={{ color: entry.status === 'eliminated' ? '#EF4444' : entry.status === 'winner' ? '#F59E0B' : '#00FFA3' }} />
                    Entry #{entry.entry_number}
                    <span className="ml-auto text-[10px]" style={{
                      color: entry.status === 'eliminated' ? '#EF4444' : entry.status === 'winner' ? '#F59E0B' : '#00FFA3'
                    }}>
                      {entry.status.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bracket */}
      {data.contest.bracket_confirmed && (
        <div className="relative">
          <SurvivorBracket
            bracketData={data.contest.bracket_data as { regions?: Record<string, Array<{ seed: number; name: string }>>; results?: Record<string, Record<string, { team1: string; team2: string; team1Seed: number; team2Seed: number; winner?: string }>> }}
            entryPicks={bracketPickHighlights}
          />
          {/* Sponsor button */}
          <div className="flex justify-center mt-3">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6B6B80' }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Branding / Link Here
            </button>
          </div>
        </div>
      )}

      {/* Eliminated banner */}
      {isEntryEliminated && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <XCircle className="w-5 h-5 shrink-0" style={{ color: '#EF4444' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>Entry #{selectedEntry?.entry_number} Eliminated</p>
            <p className="text-xs" style={{ color: '#A0A0B0' }}>This entry can no longer make picks. Switch to another entry if available.</p>
          </div>
        </div>
      )}

      {/* Pick Area */}
      {data.days.length > 0 && (
        <div className="space-y-4">
          {/* Day header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#E0E0E8' }}>
                {selectedDay?.round_label ?? 'Picks'} — Day {selectedDay?.day_number ?? ''}
              </h2>
              {lockTimeStr && selectedDay?.status === 'open' && (
                <p className="text-xs mt-0.5" style={{ color: '#F59E0B' }}>
                  Picks lock: {lockTimeStr}
                </p>
              )}
              {selectedDay?.status === 'locked' && (
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#F59E0B' }}>
                  <AlertTriangle className="w-3 h-3" /> Picks are locked for this day
                </p>
              )}
              {selectedDay?.status === 'completed' && (
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#00FFA3' }}>
                  <CheckCircle className="w-3 h-3" /> Day completed
                </p>
              )}
            </div>
          </div>

          {/* Day selector tabs */}
          <div className="flex gap-2 flex-wrap">
            {data.days.map(day => {
              const isActive = day.id === selectedDayId
              const dayEntryPicks = entryPicks.filter(p => p.contest_day_id === day.id)
              const hasSubmitted = dayEntryPicks.length > 0
              const dayHasLoss = dayEntryPicks.some(p => p.result === 'lost')
              const dayAllWon = dayEntryPicks.length > 0 && dayEntryPicks.every(p => p.result === 'won')

              let tabBg = 'rgba(255,255,255,0.04)'
              let tabBorder = '1px solid rgba(255,255,255,0.08)'
              let tabColor = '#A0A0B0'

              if (isActive) {
                tabBg = 'rgba(0,255,163,0.1)'
                tabBorder = '1px solid rgba(0,255,163,0.3)'
                tabColor = '#00FFA3'
              } else if (dayHasLoss) {
                tabBg = 'rgba(239,68,68,0.08)'
                tabBorder = '1px solid rgba(239,68,68,0.15)'
                tabColor = '#EF4444'
              } else if (dayAllWon) {
                tabBg = 'rgba(0,255,163,0.06)'
                tabBorder = '1px solid rgba(0,255,163,0.15)'
                tabColor = '#00FFA3'
              }

              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDayId(day.id)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: tabBg, border: tabBorder, color: tabColor }}
                >
                  <div>Day {day.day_number}</div>
                  <div className="text-[9px] mt-0.5 font-normal opacity-70">
                    {day.round_label}
                  </div>
                  {hasSubmitted && day.status !== 'pending' && (
                    <div className="mt-1">
                      {dayHasLoss ? (
                        <XCircle className="w-3 h-3 mx-auto" style={{ color: '#EF4444' }} />
                      ) : dayAllWon ? (
                        <CheckCircle className="w-3 h-3 mx-auto" style={{ color: '#00FFA3' }} />
                      ) : (
                        <div className="w-2 h-2 rounded-full mx-auto" style={{ background: '#F59E0B' }} />
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Game cards */}
          {selectedDay && selectedDay.status !== 'pending' && (
            <SurvivorGameCards
              games={selectedDay.games ?? []}
              selectedTeams={selectedTeamNames}
              usedTeams={usedTeams}
              onSelectTeam={handleSelectTeam}
              disabled={picksDisabled}
              picksRequired={selectedDay.picks_required}
            />
          )}

          {selectedDay?.status === 'pending' && (
            <div className="text-center py-12 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm" style={{ color: '#6B6B80' }}>
                This day has not been opened yet.
              </p>
            </div>
          )}

          {/* Submit button */}
          {selectedDay?.status === 'open' && !isEntryEliminated && (
            <div className="flex justify-center pt-2">
              <Button
                onClick={handleSubmitPicks}
                disabled={!canSubmit}
                className="px-8 py-3 rounded-xl font-bold text-sm min-w-[200px]"
                style={{
                  background: canSubmit
                    ? 'linear-gradient(135deg, #00FFA3, #00CC82)'
                    : 'rgba(255,255,255,0.06)',
                  color: canSubmit ? '#000' : '#6B6B80',
                  border: 'none',
                  boxShadow: canSubmit ? '0 0 20px rgba(0,255,163,0.3)' : 'none',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.6,
                }}
              >
                {submitting ? 'Submitting...' : dayPicks.length > 0 ? 'Update Picks' : 'Submit Picks'}
              </Button>
            </div>
          )}
        </div>
      )}

      {data.days.length === 0 && data.contest.bracket_confirmed && (
        <div className="text-center py-8 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm" style={{ color: '#6B6B80' }}>
            The bracket is set! Contest days will be posted soon.
          </p>
        </div>
      )}
    </div>
  )
}
