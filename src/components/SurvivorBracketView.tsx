'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  type OfficialBracketData,
  type BracketMatchup,
  ROUND_KEYS,
  ROUND_LABELS,
  sortMatchupEntries,
  parseMatchupIndex,
  getRegionForMatchup,
} from '@/lib/bracketTypes'

interface UserPick {
  round_number: number
  team_name: string
  team_seed: number | null
  result: 'pending' | 'won' | 'eliminated'
}

interface SurvivorBracketViewProps {
  bracketData: OfficialBracketData
  activeRound: number
  userPicks?: UserPick[]  // User's picks to highlight
  entryStatus?: 'alive' | 'eliminated'  // Entry status for elimination indication
}

function MatchupCard({ matchup, roundKey, matchupIndex, userPicks, roundNumber, entryStatus }: {
  matchup: BracketMatchup
  roundKey: string
  matchupIndex: number
  userPicks?: UserPick[]
  roundNumber: number
  entryStatus?: 'alive' | 'eliminated'
}) {
  const hasWinner = matchup.winner != null && matchup.winner !== ''
  const team1Won = hasWinner && matchup.winner === matchup.team1
  const team2Won = hasWinner && matchup.winner === matchup.team2
  const team1Empty = !matchup.team1 || matchup.team1 === ''
  const team2Empty = !matchup.team2 || matchup.team2 === ''

  // Find user's pick for this round
  const userPick = userPicks?.find(p => p.round_number === roundNumber)
  const team1IsPicked = userPick?.team_name === matchup.team1
  const team2IsPicked = userPick?.team_name === matchup.team2

  // Determine highlight state:
  // - Yellow glow: user selected this team (pending)
  // - Green glow: user selected and team won
  // - Red glow: user selected and team lost (but entry not yet marked eliminated - will show in later rounds)
  const team1SelectedPending = team1IsPicked && userPick?.result === 'pending'
  const team1SelectedWon = team1IsPicked && userPick?.result === 'won'
  const team1SelectedLost = team1IsPicked && userPick?.result === 'eliminated'

  const team2SelectedPending = team2IsPicked && userPick?.result === 'pending'
  const team2SelectedWon = team2IsPicked && userPick?.result === 'won'
  const team2SelectedLost = team2IsPicked && userPick?.result === 'eliminated'

  // Show region label only for round64
  const regionLabel = roundKey === 'round64' ? getRegionForMatchup(matchupIndex) : null

  // Determine background based on selection state
  const getTeam1Bg = () => {
    if (team1SelectedWon) return 'rgba(0,255,163,0.15)'
    if (team1SelectedLost) return 'rgba(248,113,113,0.15)'
    if (team1SelectedPending) return 'rgba(250,204,21,0.12)'
    if (team1Won) return 'rgba(0,255,163,0.06)'
    return 'transparent'
  }

  const getTeam2Bg = () => {
    if (team2SelectedWon) return 'rgba(0,255,163,0.15)'
    if (team2SelectedLost) return 'rgba(248,113,113,0.15)'
    if (team2SelectedPending) return 'rgba(250,204,21,0.12)'
    if (team2Won) return 'rgba(0,255,163,0.06)'
    return 'transparent'
  }

  // Determine border for selection highlight
  const getTeam1Border = () => {
    if (team1SelectedPending) return '2px solid rgba(250,204,21,0.6)'
    if (team1SelectedWon) return '2px solid rgba(0,255,163,0.6)'
    if (team1SelectedLost) return '2px solid rgba(248,113,113,0.6)'
    return '1px solid rgba(255,255,255,0.06)'
  }

  const getTeam2Border = () => {
    if (team2SelectedPending) return '2px solid rgba(250,204,21,0.6)'
    if (team2SelectedWon) return '2px solid rgba(0,255,163,0.6)'
    if (team2SelectedLost) return '2px solid rgba(248,113,113,0.6)'
    return '1px solid rgba(255,255,255,0.06)'
  }

  return (
    <div className="rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {regionLabel && (
        <div className="px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-center"
          style={{ background: 'rgba(255,255,255,0.03)', color: '#4A4A60' }}>
          {regionLabel}
        </div>
      )}
      {/* Team 1 */}
      <div
        className="flex items-center gap-1 px-1 py-0.5 border-b"
        style={{
          borderColor: 'rgba(255,255,255,0.04)',
          opacity: hasWinner && !team1Won ? 0.35 : 1,
          background: getTeam1Bg(),
          borderLeft: getTeam1Border(),
        }}
      >
        <span className="text-[8px] font-bold w-3 text-center tabular-nums" style={{ color: '#6B6B80' }}>
          {team1Empty ? '-' : matchup.team1Seed}
        </span>
        <span className="text-[9px] font-medium truncate flex-1" style={{
          color: team1Empty ? '#4A4A60' : team1SelectedWon ? '#00FFA3' : team1SelectedLost ? '#F87171' : team1SelectedPending ? '#FACC15' : team1Won ? '#00FFA3' : '#E6E6FA',
        }}>
          {team1Empty ? 'TBD' : matchup.team1}
        </span>
        {team1Won && <span className="text-[7px]" style={{ color: '#00FFA3' }}>W</span>}
        {team1SelectedPending && <span className="text-[7px]" style={{ color: '#FACC15' }}>PICK</span>}
      </div>
      {/* Team 2 */}
      <div
        className="flex items-center gap-1 px-1 py-0.5"
        style={{
          opacity: hasWinner && !team2Won ? 0.35 : 1,
          background: getTeam2Bg(),
          borderLeft: getTeam2Border(),
        }}
      >
        <span className="text-[8px] font-bold w-3 text-center tabular-nums" style={{ color: '#6B6B80' }}>
          {team2Empty ? '-' : matchup.team2Seed}
        </span>
        <span className="text-[9px] font-medium truncate flex-1" style={{
          color: team2Empty ? '#4A4A60' : team2SelectedWon ? '#00FFA3' : team2SelectedLost ? '#F87171' : team2SelectedPending ? '#FACC15' : team2Won ? '#00FFA3' : '#E6E6FA',
        }}>
          {team2Empty ? 'TBD' : matchup.team2}
        </span>
        {team2Won && <span className="text-[7px]" style={{ color: '#00FFA3' }}>W</span>}
        {team2SelectedPending && <span className="text-[7px]" style={{ color: '#FACC15' }}>PICK</span>}
      </div>
    </div>
  )
}

export function SurvivorBracketView({ bracketData, activeRound, userPicks, entryStatus }: SurvivorBracketViewProps) {
  const [expanded, setExpanded] = useState(true)
  const results = bracketData.results

  if (!results) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-xs" style={{ color: '#6B6B80' }}>Bracket data not available yet.</p>
      </div>
    )
  }

  // Calculate visual priority based on active round
  const getRoundStyle = (roundNum: number, totalMatchups: number) => {
    const isActive = roundNum === activeRound
    const isPast = roundNum < activeRound

    // Active round: full size, green highlight
    // Past rounds: smaller, muted
    // Future rounds: smallest, most compact
    if (isActive) {
      return {
        scale: 1,
        opacity: 1,
        minWidth: '140px',
        padding: '8px',
        headerColor: '#00FFA3',
        borderColor: 'rgba(0,255,163,0.4)',
        background: 'rgba(0,255,163,0.03)',
      }
    } else if (isPast) {
      return {
        scale: 0.7,
        opacity: 0.8,
        minWidth: '80px',
        padding: '4px',
        headerColor: '#6B6B80',
        borderColor: 'rgba(255,255,255,0.04)',
        background: 'transparent',
      }
    } else {
      // Future rounds
      return {
        scale: 0.55,
        opacity: 0.6,
        minWidth: '60px',
        padding: '2px',
        headerColor: '#4A4A60',
        borderColor: 'rgba(255,255,255,0.02)',
        background: 'transparent',
      }
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B6B80' }}>
          Tournament Bracket
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: '#4A4A60' }}>
            {expanded ? 'Collapse' : 'Expand'}
          </span>
          {expanded
            ? <ChevronUp className="w-4 h-4" style={{ color: '#6B6B80' }} />
            : <ChevronDown className="w-4 h-4" style={{ color: '#6B6B80' }} />
          }
        </div>
      </button>

      {expanded && (
        <div className="border-t overflow-x-auto py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {/* Traditional bracket layout - active round prominent */}
          <div className="flex items-start gap-2 px-2" style={{ minWidth: '900px' }}>
            {ROUND_KEYS.map((roundKey, idx) => {
              const roundNum = idx + 1
              const roundMatchups = results[roundKey] ?? {}
              const entries = sortMatchupEntries(
                Object.entries(roundMatchups) as [string, BracketMatchup][]
              )
              const style = getRoundStyle(roundNum, entries.length)

              return (
                <div
                  key={roundKey}
                  className="flex-shrink-0 rounded-lg"
                  style={{
                    minWidth: style.minWidth,
                    padding: style.padding,
                    background: style.background,
                    border: `1px solid ${style.borderColor}`,
                    transform: `scale(${style.scale})`,
                    transformOrigin: 'top center',
                    opacity: style.opacity,
                  }}
                >
                  {/* Round header */}
                  <div className="text-center mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{
                      color: style.headerColor,
                    }}>
                      {ROUND_LABELS[roundKey]}
                    </div>
                  </div>

                  {/* Matchups */}
                  <div className="space-y-1.5">
                    {entries.map(([key, matchup]) => (
                      <MatchupCard
                        key={key}
                        matchup={matchup}
                        roundKey={roundKey}
                        matchupIndex={parseMatchupIndex(key)}
                        userPicks={userPicks}
                        roundNumber={roundNum}
                        entryStatus={entryStatus}
                      />
                    ))}
                    {entries.length === 0 && (
                      <div className="text-center py-2">
                        <span className="text-[8px]" style={{ color: '#4A4A60' }}>—</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
