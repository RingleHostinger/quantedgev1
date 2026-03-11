'use client'

import { useEffect, useState } from 'react'
import {
  Trophy, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse'
import { SurvivorBracketView } from '@/components/SurvivorBracketView'
import { RoundGameCards, type PickSelection } from '@/components/RoundGameCards'
import {
  type OfficialBracketData,
  type BracketMatchup,
  ROUND_LABELS,
  roundNumberToKey,
} from '@/lib/bracketTypes'

// ─── Types ─────────────────────────────────────────────────────────────────

interface SurvivorPickRow {
  id: string
  round_number: number
  team_name: string
  team_seed: number | null
  opponent_name: string | null
  result: 'pending' | 'won' | 'eliminated'
  picked_at: string
}

interface LeaderboardRow {
  rank: number
  entryId: string
  userId: string
  entryNumber: number
  displayName: string
  status: 'alive' | 'eliminated'
  roundsSurvived: number
  picksCorrect: number
  currentRound: number
  picks: SurvivorPickRow[]
  createdAt: string
}

interface Pool {
  id: string
  pool_name: string
  is_active: boolean
  bracket_data: OfficialBracketData | null
}

interface OfficialData {
  pool: Pool
  myEntries: LeaderboardRow[]
  leaderboard: LeaderboardRow[]
  currentRound: number
  totalEntrants: number
  bracketData?: OfficialBracketData
  roundCompletionStatus?: Record<string, { total: number; completed: number; allDone: boolean }>
  activeRound?: number
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function OfficialSurvivorPage() {
  const { setCollapsed } = useSidebarCollapse()

  const [data, setData] = useState<OfficialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State for picks
  const [activeEntryIndex, setActiveEntryIndex] = useState(0)
  const [pendingPicks, setPendingPicks] = useState<Record<string, PickSelection | null>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  // Auto-collapse sidebar on mount
  useEffect(() => {
    setCollapsed(true)
    return () => setCollapsed(false)
  }, [setCollapsed])

  // Fetch data
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/survivor/official')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to load')
      }
      const result = await res.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-t-transparent border-green-500 rounded-full animate-spin mx-auto" style={{ borderTopColor: 'transparent' }} />
          <p className="text-sm font-medium" style={{ color: '#A0A0B0' }}>Loading Official Survivor...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <XCircle className="w-10 h-10 mx-auto" style={{ color: '#F87171' }} />
          <p className="text-sm font-medium" style={{ color: '#F87171' }}>{error}</p>
          <Button size="sm" variant="outline" onClick={fetchData}>Retry</Button>
        </div>
      </div>
    )
  }

  if (!data) return null

  // ─── Extract data ───────────────────────────────────────────────────────
  const { pool, myEntries, leaderboard, currentRound, totalEntrants, bracketData, activeRound: apiActiveRound } = data

  const activeRound = apiActiveRound ?? currentRound
  const activeRoundKey = roundNumberToKey(activeRound)
  const activeRoundMatchups = (bracketData?.results?.[activeRoundKey] ?? {}) as Record<string, BracketMatchup>

  // Current entry
  const currentEntry = myEntries[activeEntryIndex] ?? myEntries[0]
  const currentEntryId = currentEntry?.entryId
  const currentPick = currentEntryId ? pendingPicks[currentEntryId] ?? null : null
  const isEntryEliminated = currentEntry?.status === 'eliminated'

  // Determine if current entry already has a pick for the active round
  const existingPick = currentEntry?.picks.find((p) => p.round_number === activeRound)
  const hasSubmittedPick = existingPick != null
  const hasPendingPick = currentPick != null

  // Count alive entries
  const aliveEntrants = leaderboard.filter((r) => r.status === 'alive').length
  const myAliveEntries = myEntries.filter((e) => e.status === 'alive').length

  // Handle team selection
  const handleTeamSelect = (selection: PickSelection) => {
    if (!currentEntryId || isEntryEliminated) return
    setPendingPicks(prev => ({
      ...prev,
      [currentEntryId]: selection
    }))
    setSaveError(null)
    setSaveSuccess(null)
  }

  // Save pick
  const handleSavePick = async () => {
    if (!currentEntryId || !currentPick) return

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(null)

    try {
      const res = await fetch('/api/survivor/official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: currentEntryId,
          round_number: activeRound,
          team_name: currentPick.teamName,
          team_seed: currentPick.teamSeed,
          opponent_name: currentPick.opponentName,
          opponent_seed: currentPick.opponentSeed,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save pick')
      }

      // Clear pending pick and refetch
      setPendingPicks(prev => ({ ...prev, [currentEntryId]: null }))
      setSaveSuccess('Pick locked in successfully!')
      fetchData()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  // Get user's picks for bracket highlighting
  const userPicks = currentEntry?.picks ?? []

  return (
    <div className="px-4 lg:px-6 py-6 max-w-7xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6" style={{ color: '#00FFA3' }} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#E6E6FA' }}>Official Survivor</h1>
            <p className="text-xs" style={{ color: '#6B6B80' }}>{totalEntrants} entrants · {aliveEntrants} alive</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: '#6B6B80' }}>Round</p>
          <p className="text-lg font-bold" style={{ color: '#00FFA3' }}>{ROUND_LABELS[activeRoundKey] || `Round ${activeRound}`}</p>
        </div>
      </div>

      {/* Entry Status Banner - if eliminated */}
      {isEntryEliminated && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <AlertCircle className="w-5 h-5" style={{ color: '#F87171' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#F87171' }}>Eliminated</p>
            <p className="text-xs" style={{ color: '#A0A0B0' }}>Your entry #{currentEntry?.entryNumber} has been eliminated from the pool.</p>
          </div>
        </div>
      )}

      {/* Tournament Bracket - Always visible */}
      {bracketData && (
        <SurvivorBracketView
          bracketData={bracketData}
          activeRound={activeRound}
          userPicks={userPicks}
          entryStatus={currentEntry?.status}
        />
      )}

      {/* No bracket data message */}
      {!bracketData && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: '#4A4A60' }} />
          <p className="text-sm" style={{ color: '#6B6B80' }}>Tournament bracket will appear here once available.</p>
        </div>
      )}

      {/* Entry Selector - if user has entries */}
      {myEntries.length > 0 && (
        <>
          {/* Entry selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Entry:</span>
            <select
              value={activeEntryIndex}
              onChange={(e) => {
                setActiveEntryIndex(Number(e.target.value))
                setSaveError(null)
                setSaveSuccess(null)
              }}
              className="px-3 py-2 rounded-lg text-xs font-semibold"
              style={{
                background: 'rgba(0,255,163,0.08)',
                color: '#00FFA3',
                border: '1px solid rgba(0,255,163,0.2)',
                outline: 'none',
              }}
            >
              {myEntries.map((entry, idx) => (
                <option key={entry.entryId} value={idx}>
                  Entry #{entry.entryNumber} ({entry.status === 'alive' ? 'Alive' : 'Eliminated'})
                </option>
              ))}
            </select>
          </div>

          {/* My Picks Summary */}
          {userPicks.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-3.5 h-3.5" style={{ color: '#00FFA3' }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6B6B80' }}>
                  My Picks
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {userPicks.map((pick) => (
                  <div
                    key={pick.round_number}
                    className="flex items-center gap-2 px-2 py-1 rounded-md text-xs"
                    style={{
                      background: pick.result === 'won' ? 'rgba(0,255,163,0.08)' : pick.result === 'eliminated' ? 'rgba(239,68,68,0.08)' : 'rgba(250,204,21,0.08)',
                      border: `1px solid ${pick.result === 'won' ? 'rgba(0,255,163,0.15)' : pick.result === 'eliminated' ? 'rgba(239,68,68,0.15)' : 'rgba(250,204,21,0.15)'}`,
                    }}
                  >
                    <span className="font-semibold" style={{ color: '#4A4A60' }}>R{pick.round_number}:</span>
                    <span className="font-medium" style={{ color: pick.result === 'won' ? '#00FFA3' : pick.result === 'eliminated' ? '#F87171' : '#FACC15' }}>
                      {pick.team_name}
                    </span>
                    {pick.result === 'won' && <CheckCircle className="w-3 h-3" style={{ color: '#00FFA3' }} />}
                    {pick.result === 'eliminated' && <XCircle className="w-3 h-3" style={{ color: '#F87171' }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Game Cards for Active Round */}
          {activeRoundMatchups && Object.keys(activeRoundMatchups).length > 0 && !isEntryEliminated && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#6B6B80' }}>
                Make Your Pick - {ROUND_LABELS[activeRoundKey]}
              </h2>
              <RoundGameCards
                roundKey={activeRoundKey}
                roundNumber={activeRound}
                matchups={activeRoundMatchups}
                selectedTeam={currentPick?.teamName ?? existingPick?.team_name}
                usedTeams={userPicks.map(p => p.team_name)}
                isLocked={false}
                isEliminated={isEntryEliminated}
                onTeamSelect={handleTeamSelect}
              />

              {/* Save Button */}
              <div className="flex flex-col gap-2">
                {hasPendingPick && (
                  <Button
                    onClick={handleSavePick}
                    disabled={saving}
                    className="font-bold"
                    style={{ background: '#00FFA3', color: '#000' }}
                  >
                    {saving ? 'Locking In...' : 'Lock In Pick'}
                  </Button>
                )}
                {hasSubmittedPick && !hasPendingPick && (
                  <p className="text-xs text-center" style={{ color: '#6B6B80' }}>
                    Pick submitted for this round
                  </p>
                )}
                {!hasSubmittedPick && !hasPendingPick && (
                  <p className="text-xs text-center" style={{ color: '#6B6B80' }}>
                    Select a team above to make your pick
                  </p>
                )}
                {saveError && (
                  <p className="text-xs text-center" style={{ color: '#F87171' }}>{saveError}</p>
                )}
                {saveSuccess && (
                  <p className="text-xs text-center" style={{ color: '#00FFA3' }}>{saveSuccess}</p>
                )}
              </div>
            </div>
          )}

          {/* No active round matchups */}
          {(!activeRoundMatchups || Object.keys(activeRoundMatchups).length === 0) && !isEntryEliminated && (
            <div className="rounded-xl p-6 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-sm" style={{ color: '#6B6B80' }}>No matchups available for the current round.</p>
            </div>
          )}
        </>
      )}

      {/* No entries yet - prompt to enter */}
      {myEntries.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: '#00FFA3' }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: '#E6E6FA' }}>Join the Official Survivor</h2>
          <p className="text-sm mb-4" style={{ color: '#A0A0B0' }}>Entry purchase coming soon. Check back later!</p>
        </div>
      )}
    </div>
  )
}
