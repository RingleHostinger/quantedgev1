'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Save, Lock, Download, Trophy, ChevronRight, Check, AlertCircle, RefreshCw, Eye, EyeOff, X, Plus, Trash2, Edit3, CheckCircle, XCircle, Info } from 'lucide-react'

// Types
interface BracketTeam {
  seed: number
  name: string
}

interface BracketMatchup {
  team1: string
  team1Seed: number
  team2: string
  team2Seed: number
  winner: string | null
}

interface OfficialBracketData {
  regions: Record<string, BracketTeam[]>
  results?: Record<string, Record<string, BracketMatchup>>
}

interface AdminBracketEditorProps {
  bracketData: OfficialBracketData | null
  bracketConfirmed: boolean
  onSave: (data: OfficialBracketData) => Promise<void>
  onConfirm: (data: OfficialBracketData) => Promise<void>
  onLoadTeams: () => Promise<Record<string, BracketTeam[]> | null>
  onGradeGame: (roundKey: string, matchupKey: string, winner: string) => Promise<void>
  onLockGame?: (roundKey: string, matchupKey: string, locked: boolean) => Promise<void>
  onSaveTestPreview?: (data: OfficialBracketData) => Promise<void>
}

// Placeholder function to prevent ReferenceError when onSaveTestPreview is not provided
const noop = async () => {}

// Constants
const REGIONS = ['East', 'West', 'South', 'Midwest'] as const
const SEED_PAIRINGS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]
]
const ROUND_KEYS = ['round64', 'round32', 'sweet16', 'elite8', 'finalFour', 'championship'] as const
const ROUND_LABELS: Record<string, string> = {
  round64: 'Round of 64',
  round32: 'Round of 32',
  sweet16: 'Sweet 16',
  elite8: 'Elite 8',
  finalFour: 'Final Four',
  championship: 'Championship'
}
const ROUND_MATCHUP_COUNTS: Record<string, number> = {
  round64: 32,
  round32: 16,
  sweet16: 8,
  elite8: 4,
  finalFour: 2,
  championship: 1
}

// Region colors for visual distinction
const REGION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  East: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3B82F6' },
  West: { bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)', text: '#A855F7' },
  South: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#EF4444' },
  Midwest: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22C55E' }
}

// Helper function to validate team name
function validateTeamName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Team name is required' }
  }
  if (name.trim().length < 2) {
    return { valid: false, error: 'Team name too short' }
  }
  if (name.trim().length > 50) {
    return { valid: false, error: 'Team name too long (max 50 chars)' }
  }
  return { valid: true }
}

// Helper function to check if bracket is complete
function isBracketComplete(regions: Record<string, BracketTeam[]>): { complete: boolean; missing: string[] } {
  const missing: string[] = []

  for (const region of REGIONS) {
    const regionTeams = regions[region] || []
    const seeds = regionTeams.map(t => t.seed).sort((a, b) => a - b)
    const expectedSeeds = SEED_PAIRINGS.flat()

    for (const seed of expectedSeeds) {
      if (!seeds.includes(seed)) {
        missing.push(`${region} Seed ${seed}`)
      }
    }
  }

  return { complete: missing.length === 0, missing }
}

// Helper function to generate initial matchups from regions data
function generateInitialMatchups(regions: Record<string, BracketTeam[]>): Record<string, Record<string, BracketMatchup>> {
  const results: Record<string, Record<string, BracketMatchup>> = {}

  // Generate Round of 64 matchups
  results.round64 = {}
  let matchupIndex = 0

  // For each region, create 8 matchups based on seed pairings
  for (const region of REGIONS) {
    const regionTeams = regions[region] || []
    const teamMap: Record<number, BracketTeam> = {}
    for (const team of regionTeams) {
      teamMap[team.seed] = team
    }

    for (let i = 0; i < SEED_PAIRINGS.length; i++) {
      const [seed1, seed2] = SEED_PAIRINGS[i]
      const team1 = teamMap[seed1]
      const team2 = teamMap[seed2]

      const matchupKey = `${region.toLowerCase()}_${i}`
      results.round64[matchupKey] = {
        team1: team1?.name || `Seed ${seed1}`,
        team1Seed: team1?.seed || seed1,
        team2: team2?.name || `Seed ${seed2}`,
        team2Seed: team2?.seed || seed2,
        winner: null
      }
      matchupIndex++
    }
  }

  // Initialize other rounds with empty matchups
  for (let roundIdx = 1; roundIdx < ROUND_KEYS.length; roundIdx++) {
    const roundKey = ROUND_KEYS[roundIdx]
    const matchupCount = ROUND_MATCHUP_COUNTS[roundKey]
    results[roundKey] = {}

    for (let i = 0; i < matchupCount; i++) {
      const matchupKey = `matchup_${i}`
      results[roundKey][matchupKey] = {
        team1: '',
        team1Seed: 0,
        team2: '',
        team2Seed: 0,
        winner: null
      }
    }
  }

  return results
}

// Helper function to get winners from previous round
function getWinnerFromPreviousRound(
  roundKey: string,
  matchupIndex: number,
  results: Record<string, Record<string, BracketMatchup>>
): { name: string; seed: number }[] | null {
  const roundKeyTyped = roundKey as typeof ROUND_KEYS[number]
  const roundIndex = ROUND_KEYS.indexOf(roundKeyTyped)

  if (roundIndex <= 0) return null

  const prevRoundKey = ROUND_KEYS[roundIndex - 1]
  const prevRoundResults = results[prevRoundKey]

  if (!prevRoundResults) return null

  const prevMatchupIndex1 = Math.floor(matchupIndex / 2) * 2
  const prevMatchupIndex2 = prevMatchupIndex1 + 1

  const prevMatchups = Object.entries(prevRoundResults)
    .sort(([a], [b]) => {
      const idxA = parseInt(a.split('_').pop() || a.split('matchup_').pop() || '0')
      const idxB = parseInt(b.split('_').pop() || b.split('matchup_').pop() || '0')
      return idxA - idxB
    })

  const matchup1 = prevMatchups[prevMatchupIndex1]
  const matchup2 = prevMatchups[prevMatchupIndex2]

  if (!matchup1 || !matchup2) return null

  const winner1 = matchup1[1].winner
  const winner2 = matchup2[1].winner

  if (!winner1 || !winner2) return null

  // Extract seed from team name or stored seed
  const extractSeed = (matchup: BracketMatchup, winner: string): number => {
    if (matchup.team1 === winner) return matchup.team1Seed
    if (matchup.team2 === winner) return matchup.team2Seed
    return 0
  }

  return [
    { name: winner1, seed: extractSeed(matchup1[1], winner1) },
    { name: winner2, seed: extractMatchup(matchup2[1], winner2) }
  ]
}

// Helper to extract seed from matchup
function extractMatchup(matchup: BracketMatchup, winner: string): number {
  if (matchup.team1 === winner) return matchup.team1Seed
  if (matchup.team2 === winner) return matchup.team2Seed
  return 0
}

// Helper to get matchup status
function getMatchupStatus(matchup: BracketMatchup): 'pending' | 'complete' | 'no_teams' {
  if (!matchup.team1 || !matchup.team2 || matchup.team1 === 'TBD' || matchup.team2 === 'TBD') {
    return 'no_teams'
  }
  return matchup.winner ? 'complete' : 'pending'
}

// Count completed games in a round
function countCompletedGames(roundResults: Record<string, BracketMatchup>): number {
  return Object.values(roundResults).filter(m => m.winner !== null).length
}

export default function AdminBracketEditor({
  bracketData,
  bracketConfirmed,
  onSave,
  onConfirm,
  onLoadTeams,
  onGradeGame,
  onSaveTestPreview
}: AdminBracketEditorProps) {
  // Local state for editing
  const [regions, setRegions] = useState<Record<string, BracketTeam[]>>({
    East: [], West: [], South: [], Midwest: []
  })
  const [results, setResults] = useState<Record<string, Record<string, BracketMatchup>>>({})
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [pendingWinners, setPendingWinners] = useState<Record<string, Record<string, string>>>({})
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showTeamValidation, setShowTeamValidation] = useState<Record<string, Record<string, { valid: boolean; error?: string }>>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [expandedRound, setExpandedRound] = useState<string>('round64')

  // Initialize from props
  useEffect(() => {
    if (bracketData) {
      if (bracketData.regions) {
        setRegions(bracketData.regions)
      }
      if (bracketData.results) {
        setResults(bracketData.results)
      } else if (bracketConfirmed && bracketData.regions) {
        // Generate initial matchups when switching to grade mode
        const initialResults = generateInitialMatchups(bracketData.regions)
        setResults(initialResults)
      }
      setIsDirty(false)
    }
  }, [bracketData, bracketConfirmed])

  // Track dirty state
  useEffect(() => {
    if (bracketData) {
      const hasChanges = JSON.stringify(bracketData.regions) !== JSON.stringify(regions) ||
        JSON.stringify(bracketData.results) !== JSON.stringify(results)
      setIsDirty(hasChanges)
    }
  }, [regions, results, bracketData])

  // Handle loading teams from DB
  const handleLoadTeams = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const teams = await onLoadTeams()
      if (teams) {
        setRegions(teams)
        setMessage({ type: 'success', text: 'Teams loaded successfully from database!' })
        setIsDirty(true)
      } else {
        setMessage({ type: 'error', text: 'No teams found in database. Please add teams manually.' })
      }
    } catch (error) {
      console.error('Failed to load teams:', error)
      setMessage({ type: 'error', text: 'Failed to load teams from database' })
    } finally {
      setLoading(false)
    }
  }

  // Handle save draft
  const handleSave = async () => {
    // Validate all teams first
    const validation = validateAllTeams()
    if (!validation.valid) {
      setMessage({ type: 'error', text: `Please fix validation errors: ${validation.errors.join(', ')}` })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      await onSave({ regions, results })
      setMessage({ type: 'success', text: 'Bracket saved successfully!' })
      setIsDirty(false)
    } catch (error) {
      console.error('Failed to save bracket:', error)
      setMessage({ type: 'error', text: 'Failed to save bracket. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  // Validate all teams
  const validateAllTeams = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    const completeness = isBracketComplete(regions)

    if (!completeness.complete) {
      errors.push(`${completeness.missing.length} missing teams`)
    }

    for (const region of REGIONS) {
      const regionTeams = regions[region] || []
      for (const team of regionTeams) {
        const validation = validateTeamName(team.name)
        if (!validation.valid) {
          errors.push(`${region} ${team.seed}: ${validation.error}`)
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }, [regions])

  // Handle confirm with dialog
  const handleConfirmClick = () => {
    // First validate
    const validation = validateAllTeams()
    if (!validation.valid) {
      setMessage({ type: 'error', text: `Cannot confirm: ${validation.errors.join(', ')}` })
      return
    }

    // Check bracket completeness
    const completeness = isBracketComplete(regions)
    if (!completeness.complete) {
      setMessage({ type: 'error', text: `Cannot confirm: Missing ${completeness.missing.length} teams (${completeness.missing.slice(0, 3).join(', ')}...)` })
      return
    }

    setShowConfirmDialog(true)
  }

  // Handle save test preview (for admin testing without locking live bracket)
  const handleSaveTestPreview = async () => {
    // Validate but don't require completeness for test preview
    const validation = validateAllTeams()
    if (!validation.valid) {
      setMessage({ type: 'error', text: `Cannot save test preview: ${validation.errors.join(', ')}` })
      return
    }

    if (!onSaveTestPreview) {
      setMessage({ type: 'error', text: 'Test preview not available' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      await onSaveTestPreview({ regions, results })
      setMessage({ type: 'success', text: 'Test bracket saved! Enable test mode to preview as a user.' })
    } catch (error) {
      console.error('Failed to save test preview:', error)
      setMessage({ type: 'error', text: 'Failed to save test preview' })
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    setShowConfirmDialog(false)
    setMessage(null)
    try {
      // Generate initial matchups before confirming
      const initialResults = generateInitialMatchups(regions)
      setResults(initialResults)

      await onConfirm({ regions, results: initialResults })
      setMessage({ type: 'success', text: 'Bracket confirmed and locked!' })
      setIsDirty(false)
    } catch (error) {
      console.error('Failed to confirm bracket:', error)
      setMessage({ type: 'error', text: 'Failed to confirm bracket. Please try again.' })
    } finally {
      setConfirming(false)
    }
  }

  // Handle team name change with validation
  const handleTeamChange = (region: string, seed: number, name: string) => {
    // Validate the team name
    const validation = validateTeamName(name)
    setShowTeamValidation(prev => ({
      ...prev,
      [region]: {
        ...(prev[region] || {}),
        [seed]: { valid: validation.valid, error: validation.error }
      }
    }))

    setRegions(prev => {
      const regionTeams = [...(prev[region] || [])]
      const existingIndex = regionTeams.findIndex(t => t.seed === seed)

      if (existingIndex >= 0) {
        regionTeams[existingIndex] = { seed, name }
      } else if (name.trim()) {
        regionTeams.push({ seed, name })
      }

      return { ...prev, [region]: regionTeams }
    })
  }

  // Clear all teams in a region
  const clearRegion = (region: string) => {
    setRegions(prev => ({
      ...prev,
      [region]: []
    }))
    setMessage({ type: 'info', text: `${region} region cleared` })
  }

  // Auto-fill region with placeholder names
  const autofillRegion = (region: string) => {
    const newTeams: BracketTeam[] = []
    const seeds = SEED_PAIRINGS.flat()

    for (const seed of seeds) {
      newTeams.push({ seed, name: `${region} ${seed}` })
    }

    setRegions(prev => ({
      ...prev,
      [region]: newTeams
    }))
    setMessage({ type: 'info', text: `${region} region autofilled with placeholder names` })
  }

  // Handle grading a game
  const handleGradeClick = async (roundKey: string, matchupKey: string) => {
    const roundPending = pendingWinners[roundKey]
    const pendingWinner = roundPending?.[matchupKey]

    if (!pendingWinner) return

    try {
      await onGradeGame(roundKey, matchupKey, pendingWinner)

      // Update local results
      setResults(prev => {
        const updated = { ...prev }
        if (updated[roundKey] && updated[roundKey][matchupKey]) {
          updated[roundKey] = {
            ...updated[roundKey],
            [matchupKey]: {
              ...updated[roundKey][matchupKey],
              winner: pendingWinner
            }
          }
        }
        return updated
      })

      // Clear pending winner
      setPendingWinners(prev => {
        const updated = { ...prev }
        if (updated[roundKey]) {
          delete updated[roundKey][matchupKey]
        }
        return updated
      })

      setMessage({ type: 'success', text: 'Game graded successfully!' })
    } catch (error) {
      console.error('Failed to grade game:', error)
      setMessage({ type: 'error', text: 'Failed to grade game' })
    }
  }

  // Handle locking/unlocking a game
  const handleLockGame = async (roundKey: string, matchupKey: string, currentlyLocked: boolean) => {
    try {
      await onLockGame(roundKey, matchupKey, !currentlyLocked)

      // Update local results
      setResults(prev => {
        const updated = { ...prev }
        if (updated[roundKey] && updated[roundKey][matchupKey]) {
          updated[roundKey] = {
            ...updated[roundKey],
            [matchupKey]: {
              ...updated[roundKey][matchupKey],
              locked: !currentlyLocked
            }
          }
        }
        return updated
      })

      setMessage({ type: 'success', text: currentlyLocked ? 'Game unlocked!' : 'Game locked!' })
    } catch (error) {
      console.error('Failed to lock game:', error)
      setMessage({ type: 'error', text: 'Failed to lock game' })
    }
  }

  // Select pending winner
  const selectPendingWinner = (roundKey: string, matchupKey: string, winner: string) => {
    setPendingWinners(prev => ({
      ...prev,
      [roundKey]: {
        ...(prev[roundKey] || {}),
        [matchupKey]: winner
      }
    }))
  }

  // Clear pending winner
  const clearPendingWinner = (roundKey: string, matchupKey: string) => {
    setPendingWinners(prev => {
      const updated = { ...prev }
      if (updated[roundKey]) {
        delete updated[roundKey][matchupKey]
      }
      return updated
    })
  }

  // Get stats for grade mode
  const gradeStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number; pending: number }> = {}

    for (const roundKey of ROUND_KEYS) {
      const roundResults = results[roundKey] || {}
      const completed = countCompletedGames(roundResults)
      const total = ROUND_MATCHUP_COUNTS[roundKey]
      stats[roundKey] = {
        total,
        completed,
        pending: total - completed
      }
    }

    return stats
  }, [results])

  // Determine mode
  const isEditMode = !bracketConfirmed
  const hasResults = bracketConfirmed && results && Object.keys(results).length > 0

  // Render edit mode
  if (isEditMode) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Edit Official Bracket</h2>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                  Unsaved
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>
              Configure the tournament teams and matchups. Save as draft or confirm to lock.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
              Edit Mode
            </span>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{
              background: message.type === 'success' ? 'rgba(0,255,163,0.08)' :
                message.type === 'error' ? 'rgba(255,107,107,0.08)' : 'rgba(59,130,246,0.08)',
              color: message.type === 'success' ? '#00FFA3' :
                message.type === 'error' ? '#FF6B6B' : '#3B82F6'
            }}>
            {message.type === 'success' ? <Check className="w-4 h-4" /> :
              message.type === 'error' ? <AlertCircle className="w-4 h-4" /> :
                <Info className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {/* Validation status */}
        {(() => {
          const validation = validateAllTeams()
          return (
            <div className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-2">
                {validation.valid ? (
                  <CheckCircle className="w-4 h-4" style={{ color: '#00FFA3' }} />
                ) : (
                  <XCircle className="w-4 h-4" style={{ color: '#FF6B6B' }} />
                )}
                <span className="text-sm" style={{ color: validation.valid ? '#00FFA3' : '#FF6B6B' }}>
                  {validation.valid ? 'All teams valid' : `${validation.errors.length} validation issues`}
                </span>
              </div>
              <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <div className="flex items-center gap-2 text-sm" style={{ color: '#A0A0B0' }}>
                <Trophy className="w-4 h-4" />
                {(() => {
                  const completeness = isBracketComplete(regions)
                  return (
                    <>
                      <span>{Object.values(regions).flat().length} / 64 teams</span>
                      {!completeness.complete && (
                        <span className="text-xs" style={{ color: '#FF6B6B' }}>
                          ({completeness.missing.length} missing)
                        </span>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )
        })()}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleLoadTeams}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}
          >
            <Download className="w-4 h-4" />
            {loading ? 'Loading...' : 'Load from DB'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.07)', color: '#E6E6FA', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleConfirmClick}
            disabled={confirming}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #00FFA3, #00CC82)', color: '#000' }}
          >
            <Lock className="w-4 h-4" />
            {confirming ? 'Confirming...' : 'Confirm & Lock'}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => {
              for (const region of REGIONS) {
                autofillRegion(region)
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#A0A0B0' }}
          >
            <RefreshCw className="w-3 h-3" />
            Autofill All
          </button>
        </div>

        {/* Region tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {REGIONS.map(region => {
            const regionTeams = regions[region] || []
            const count = regionTeams.length
            const colors = REGION_COLORS[region]

            return (
              <button
                key={region}
                onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  background: selectedRegion === region ? colors.bg : 'rgba(255,255,255,0.05)',
                  color: selectedRegion === region ? colors.text : '#A0A0B0',
                  border: `1px solid ${selectedRegion === region ? colors.border : 'rgba(255,255,255,0.1)'}`
                }}
              >
                <span>{region}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    background: selectedRegion === region ? colors.border : 'rgba(255,255,255,0.08)',
                    color: selectedRegion === region ? colors.text : '#6B6B80'
                  }}>
                  {count}/16
                </span>
              </button>
            )
          })}
        </div>

        {/* Regions grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {REGIONS.map(region => {
            // Filter by selected region if any
            if (selectedRegion && selectedRegion !== region) return null

            const colors = REGION_COLORS[region]
            const regionTeams = regions[region] || []

            return (
              <div key={region} className="rounded-2xl overflow-hidden" style={{ background: '#12122A' }}>
                {/* Region header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
                  <h3 className="text-sm font-bold" style={{ color: colors.text }}>
                    {region} Region
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => autofillRegion(region)}
                      className="p-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#A0A0B0' }}
                      title="Autofill with placeholders"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => clearRegion(region)}
                      className="p-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: 'rgba(255,107,107,0.1)', color: '#FF6B6B' }}
                      title="Clear region"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Teams grid */}
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {SEED_PAIRINGS.map(([seed1, seed2], pairIndex) => {
                      const team1 = regionTeams.find(t => t.seed === seed1)
                      const team2 = regionTeams.find(t => t.seed === seed2)
                      const validation1 = showTeamValidation[region]?.[seed1]
                      const validation2 = showTeamValidation[region]?.[seed2]

                      return (
                        <div key={pairIndex} className="space-y-2">
                          {/* Seed 1 */}
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: 'rgba(255,255,255,0.08)', color: '#A0A0B0' }}>
                              {seed1}
                            </span>
                            <div className="flex-1 relative">
                              <input
                                type="text"
                                value={team1?.name || ''}
                                onChange={(e) => handleTeamChange(region, seed1, e.target.value)}
                                placeholder={`Seed ${seed1}`}
                                className="w-full px-3 py-2 rounded-lg text-xs bg-transparent border outline-none transition-all"
                                style={{
                                  borderColor: validation1?.valid === false ? '#FF6B6B' :
                                    team1?.name ? 'rgba(0,255,163,0.3)' : 'rgba(255,255,255,0.1)',
                                  color: '#E6E6FA',
                                }}
                              />
                              {validation1?.valid === false && (
                                <div className="absolute -bottom-4 left-0 text-[10px]" style={{ color: '#FF6B6B' }}>
                                  {validation1.error}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* VS divider */}
                          <div className="flex items-center justify-center gap-2 py-0.5">
                            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
                            <span className="text-[10px]" style={{ color: '#6B6B80' }}>VS</span>
                            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
                          </div>

                          {/* Seed 2 */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                              <input
                                type="text"
                                value={team2?.name || ''}
                                onChange={(e) => handleTeamChange(region, seed2, e.target.value)}
                                placeholder={`Seed ${seed2}`}
                                className="w-full px-3 py-2 rounded-lg text-xs bg-transparent border outline-none transition-all"
                                style={{
                                  borderColor: validation2?.valid === false ? '#FF6B6B' :
                                    team2?.name ? 'rgba(0,255,163,0.3)' : 'rgba(255,255,255,0.1)',
                                  color: '#E6E6FA',
                                }}
                              />
                              {validation2?.valid === false && (
                                <div className="absolute -bottom-4 left-0 text-[10px]" style={{ color: '#FF6B6B' }}>
                                  {validation2.error}
                                </div>
                              )}
                            </div>
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: 'rgba(255,255,255,0.08)', color: '#A0A0B0' }}>
                              {seed2}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Confirm Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowConfirmDialog(false)} />
            <div className="relative rounded-2xl p-6 max-w-md w-full" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,255,163,0.1)' }}>
                  <Lock className="w-5 h-5" style={{ color: '#00FFA3' }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirm Bracket?</h3>
                  <p className="text-xs" style={{ color: '#A0A0B0' }}>This action cannot be undone</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm" style={{ color: '#E6E6FA' }}>
                  <CheckCircle className="w-4 h-4" style={{ color: '#00FFA3' }} />
                  <span>{Object.values(regions).flat().length} teams configured</span>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: '#E6E6FA' }}>
                  <CheckCircle className="w-4 h-4" style={{ color: '#00FFA3' }} />
                  <span>4 regions complete</span>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: '#E6E6FA' }}>
                  <CheckCircle className="w-4 h-4" style={{ color: '#00FFA3' }} />
                  <span>All teams validated</span>
                </div>
              </div>

              <p className="text-sm mb-6" style={{ color: '#A0A0B0' }}>
                Once confirmed, the bracket will be locked and used for the official contest.
                You won&apos;t be able to edit it afterwards.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#E6E6FA' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'linear-gradient(135deg, #00FFA3, #00CC82)', color: '#000' }}
                >
                  Yes, Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render grade mode
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Grade Official Bracket</h2>
          <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>
            Set game results as the tournament progresses. Click teams to select winners.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}>
            Grade Mode
          </span>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{
            background: message.type === 'success' ? 'rgba(0,255,163,0.08)' : 'rgba(255,107,107,0.08)',
            color: message.type === 'success' ? '#00FFA3' : '#FF6B6B'
          }}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Round progress */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {ROUND_KEYS.map((roundKey) => {
          const stats = gradeStats[roundKey]
          const isExpanded = expandedRound === roundKey

          return (
            <button
              key={roundKey}
              onClick={() => setExpandedRound(roundKey)}
              className="p-3 rounded-xl text-center transition-all"
              style={{
                background: isExpanded ? 'rgba(0,255,163,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isExpanded ? 'rgba(0,255,163,0.3)' : 'rgba(255,255,255,0.05)'}`
              }}
            >
              <div className="text-[10px] font-medium mb-1" style={{ color: '#A0A0B0' }}>
                {ROUND_LABELS[roundKey]}
              </div>
              <div className="text-lg font-bold" style={{ color: isExpanded ? '#00FFA3' : '#E6E6FA' }}>
                {stats.completed}/{stats.total}
              </div>
              <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(stats.completed / stats.total) * 100}%`,
                    background: stats.completed === stats.total ? '#00FFA3' : '#F59E0B'
                  }}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Horizontally scrollable bracket */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-max">
          <div className="flex gap-4">
            {/* Round columns */}
            {ROUND_KEYS.map((roundKey) => {
              const roundIndex = ROUND_KEYS.indexOf(roundKey)
              const matchupCount = ROUND_MATCHUP_COUNTS[roundKey]
              const roundResults = results[roundKey] || {}
              const isExpanded = expandedRound === roundKey

              // Get matchups sorted by index
              const matchups = Object.entries(roundResults)
                .filter(([, matchup]) => matchup.team1 || matchup.team2)
                .sort(([a], [b]) => {
                  const idxA = parseInt(a.split('_').pop() || a.split('matchup_').pop() || '0')
                  const idxB = parseInt(b.split('_').pop() || b.split('matchup_').pop() || '0')
                  return idxA - idxB
                })

              return (
                <div
                  key={roundKey}
                  className={`flex flex-col shrink-0 transition-all ${isExpanded ? 'w-56' : 'w-40'}`}
                  style={{ opacity: isExpanded ? 1 : 0.6 }}
                >
                  {/* Round header */}
                  <div className="text-center mb-3">
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full inline-block"
                      style={{
                        background: roundKey === 'championship' ? 'rgba(245,158,11,0.15)' : 'rgba(0,255,163,0.1)',
                        color: roundKey === 'championship' ? '#F59E0B' : '#00FFA3'
                      }}>
                      {ROUND_LABELS[roundKey]}
                    </span>
                    <div className="mt-1 text-[10px]" style={{ color: '#6B6B80' }}>
                      {gradeStats[roundKey].completed}/{gradeStats[roundKey].total} games
                    </div>
                  </div>

                  {/* Matchups */}
                  <div className="flex flex-col gap-2">
                    {matchups.slice(0, matchupCount).map(([matchupKey, matchup], idx) => {
                      // For rounds after round64, get teams from previous round
                      let team1Name = matchup.team1
                      let team1Seed = matchup.team1Seed
                      let team2Name = matchup.team2
                      let team2Seed = matchup.team2Seed

                      if (roundIndex > 0) {
                        const prevWinners = getWinnerFromPreviousRound(roundKey, idx, results)
                        if (prevWinners && prevWinners.length === 2) {
                          team1Name = prevWinners[0].name
                          team1Seed = prevWinners[0].seed
                          team2Name = prevWinners[1].name
                          team2Seed = prevWinners[1].seed
                        } else {
                          // Not all previous games decided yet
                          team1Name = 'TBD'
                          team1Seed = 0
                          team2Name = 'TBD'
                          team2Seed = 0
                        }
                      }

                      const winner = matchup.winner
                      const isLocked = matchup.locked || false
                      const pendingWinner = pendingWinners[roundKey]?.[matchupKey]
                      const hasPending = pendingWinner !== undefined

                      // Determine team status
                      const team1Status = !team1Name || team1Name === 'TBD' ? 'unavailable' :
                        winner === team1Name ? 'winner' :
                          winner ? 'loser' : 'pending'
                      const team2Status = !team2Name || team2Name === 'TBD' ? 'unavailable' :
                        winner === team2Name ? 'winner' :
                          winner ? 'loser' : 'pending'

                      return (
                        <div
                          key={matchupKey}
                          className="rounded-lg p-2 transition-all"
                          style={{
                            background: hasPending ? 'rgba(245,158,11,0.05)' : '#0F0F1A',
                            border: hasPending ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.02)'
                          }}
                        >
                          {/* Team 1 */}
                          <button
                            onClick={() => team1Name !== 'TBD' && selectPendingWinner(roundKey, matchupKey, team1Name)}
                            disabled={team1Name === 'TBD'}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all mb-1"
                            style={{
                              background: hasPending && pendingWinner === team1Name
                                ? 'rgba(245,158,11,0.2)'
                                : team1Status === 'winner'
                                  ? 'rgba(0,255,163,0.15)'
                                  : team1Status === 'loser'
                                    ? 'rgba(255,255,255,0.03)'
                                    : team1Status === 'unavailable'
                                      ? 'rgba(255,255,255,0.02)'
                                      : 'rgba(255,255,255,0.05)',
                              color: team1Status === 'winner' ? '#00FFA3' :
                                team1Status === 'loser' ? '#6B6B80' :
                                  team1Status === 'unavailable' ? '#4A4A5A' : '#E6E6FA',
                              textDecoration: team1Status === 'loser' ? 'line-through' : 'none',
                              cursor: team1Name === 'TBD' ? 'not-allowed' : 'pointer',
                              opacity: team1Name === 'TBD' ? 0.5 : 1
                            }}
                          >
                            <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{
                                background: team1Status === 'winner' ? '#00FFA3' : 'rgba(255,255,255,0.08)',
                                color: team1Status === 'winner' ? '#000' : '#A0A0B0'
                              }}>
                              {team1Seed || '-'}
                            </span>
                            <span className="truncate flex-1">{team1Name}</span>
                            {team1Status === 'winner' && <Check className="w-3 h-3 shrink-0" />}
                            {hasPending && pendingWinner === team1Name && !winner && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  clearPendingWinner(roundKey, matchupKey)
                                }}
                                className="p-0.5 rounded hover:bg-white/10"
                              >
                                <X className="w-3 h-3" style={{ color: '#F59E0B' }} />
                              </button>
                            )}
                          </button>

                          {/* Team 2 */}
                          <button
                            onClick={() => team2Name !== 'TBD' && selectPendingWinner(roundKey, matchupKey, team2Name)}
                            disabled={team2Name === 'TBD'}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all"
                            style={{
                              background: hasPending && pendingWinner === team2Name
                                ? 'rgba(245,158,11,0.2)'
                                : team2Status === 'winner'
                                  ? 'rgba(0,255,163,0.15)'
                                  : team2Status === 'loser'
                                    ? 'rgba(255,255,255,0.03)'
                                    : team2Status === 'unavailable'
                                      ? 'rgba(255,255,255,0.02)'
                                      : 'rgba(255,255,255,0.05)',
                              color: team2Status === 'winner' ? '#00FFA3' :
                                team2Status === 'loser' ? '#6B6B80' :
                                  team2Status === 'unavailable' ? '#4A4A5A' : '#E6E6FA',
                              textDecoration: team2Status === 'loser' ? 'line-through' : 'none',
                              cursor: team2Name === 'TBD' ? 'not-allowed' : 'pointer',
                              opacity: team2Name === 'TBD' ? 0.5 : 1
                            }}
                          >
                            <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{
                                background: team2Status === 'winner' ? '#00FFA3' : 'rgba(255,255,255,0.08)',
                                color: team2Status === 'winner' ? '#000' : '#A0A0B0'
                              }}>
                              {team2Seed || '-'}
                            </span>
                            <span className="truncate flex-1">{team2Name}</span>
                            {team2Status === 'winner' && <Check className="w-3 h-3 shrink-0" />}
                            {hasPending && pendingWinner === team2Name && !winner && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  clearPendingWinner(roundKey, matchupKey)
                                }}
                                className="p-0.5 rounded hover:bg-white/10"
                              >
                                <X className="w-3 h-3" style={{ color: '#F59E0B' }} />
                              </button>
                            )}
                          </button>

                          {/* Confirm button for pending winner */}
                          {hasPending && !winner && (
                            <button
                              onClick={() => handleGradeClick(roundKey, matchupKey)}
                              className="w-full mt-2 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-all hover:opacity-80"
                              style={{ background: 'rgba(0,255,163,0.2)', color: '#00FFA3' }}
                            >
                              <Check className="w-3 h-3" />
                              Confirm Winner
                            </button>
                          )}

                          {/* Lock/Unlock Game button */}
                          {onLockGame && !winner && (
                            <button
                              onClick={() => handleLockGame(roundKey, matchupKey, isLocked)}
                              className="w-full mt-2 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-all hover:opacity-80"
                              style={{
                                background: isLocked ? 'rgba(239,68,68,0.2)' : 'rgba(147,51,234,0.2)',
                                color: isLocked ? '#EF4444' : '#A855F7'
                              }}
                            >
                              <Lock className="w-3 h-3" />
                              {isLocked ? 'Unlock Game' : 'Lock Game'}
                            </button>
                          )}
                        </div>
                      )
                    })}

                    {/* Empty slots placeholder */}
                    {matchups.length < matchupCount && (
                      Array.from({ length: matchupCount - matchups.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="rounded-lg p-2 h-[70px] flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.02)', color: '#6B6B80' }}>
                          <span className="text-xs">TBD</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs flex-wrap" style={{ color: '#A0A0B0' }}>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(0,255,163,0.15)' }} />
          <span>Winner</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.3)' }} />
          <span>Pending Selection</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(255,255,255,0.03)' }} />
          <span>Loser (strikethrough)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(255,255,255,0.02)' }} />
          <span>Not yet determined</span>
        </div>
      </div>
    </div>
  )
}
