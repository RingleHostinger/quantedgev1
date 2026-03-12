'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  type OfficialBracketData,
  type BracketMatchup,
  ROUND_KEYS,
  ROUND_LABELS,
  REGIONS,
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
  userPicks?: UserPick[]
  entryStatus?: 'alive' | 'eliminated'
  activeContestDay?: number
}

function MatchupCard({ matchup, roundKey, matchupIndex, userPicks, roundNumber }: {
  matchup: BracketMatchup
  roundKey: string
  matchupIndex: number
  userPicks?: UserPick[]
  roundNumber: number
}) {
  const hasWinner = matchup.winner != null && matchup.winner !== ''
  const team1Won = hasWinner && matchup.winner === matchup.team1
  const team2Won = hasWinner && matchup.winner === matchup.team2
  const team1Empty = !matchup.team1 || matchup.team1 === ''
  const team2Empty = !matchup.team2 || matchup.team2 === ''

  const userPick = userPicks?.find(p => p.round_number === roundNumber)
  const team1IsPicked = userPick?.team_name === matchup.team1
  const team2IsPicked = userPick?.team_name === matchup.team2

  const team1SelectedPending = team1IsPicked && userPick?.result === 'pending'
  const team1SelectedWon = team1IsPicked && userPick?.result === 'won'
  const team1SelectedLost = team1IsPicked && userPick?.result === 'eliminated'

  const team2SelectedPending = team2IsPicked && userPick?.result === 'pending'
  const team2SelectedWon = team2IsPicked && userPick?.result === 'won'
  const team2SelectedLost = team2IsPicked && userPick?.result === 'eliminated'

  const regionLabel = roundKey === 'round64' ? getRegionForMatchup(matchupIndex) : null

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
      <div className="flex items-center gap-1 px-1 py-0.5 border-b"
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
      <div className="flex items-center gap-1 px-1 py-0.5"
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

// Get regions for left side (East, West) or right side (South, Midwest)
function getSideRegions(side: 'left' | 'right'): string[] {
  return side === 'left' ? ['East', 'West'] : ['South', 'Midwest']
}

// Get matchups for a specific region in a round
function getRegionMatchups(results: Record<string, Record<string, BracketMatchup>>, roundKey: string, region: string): [string, BracketMatchup][] {
  const roundMatchups = results[roundKey] ?? {}
  const entries = Object.entries(roundMatchups) as [string, BracketMatchup][]
  return entries.filter(([key, matchup]) => {
    const idx = parseMatchupIndex(key)
    const matchupRegion = getRegionForMatchup(idx)
    return matchupRegion === region
  }).sort((a, b) => {
    const aIdx = parseMatchupIndex(a[0])
    const bIdx = parseMatchupIndex(b[0])
    return aIdx - bIdx
  })
}

export function SurvivorBracketView({ bracketData, activeRound, userPicks, entryStatus, activeContestDay = 1 }: SurvivorBracketViewProps) {
  const [expanded, setExpanded] = useState(true)
  const results = bracketData.results

  if (!results) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-xs" style={{ color: '#6B6B80' }}>Bracket data not available yet.</p>
      </div>
    )
  }

  // Determine round priority styling
  const getRoundStyle = (roundNum: number) => {
    const isActive = roundNum === activeRound
    const isPast = roundNum < activeRound

    if (isActive) {
      return { scale: 1, opacity: 1, headerColor: '#00FFA3', borderColor: 'rgba(0,255,163,0.4)', background: 'rgba(0,255,163,0.03)' }
    } else if (isPast) {
      return { scale: 0.75, opacity: 0.8, headerColor: '#6B6B80', borderColor: 'rgba(255,255,255,0.04)', background: 'transparent' }
    } else {
      return { scale: 0.6, opacity: 0.5, headerColor: '#4A4A60', borderColor: 'rgba(255,255,255,0.02)', background: 'transparent' }
    }
  }

  // Round keys for the regional rounds (first 4)
  const regionalRounds = ROUND_KEYS.slice(0, 4) // round64, round32, sweet16, elite8
  const finalRounds = ROUND_KEYS.slice(4) // finalFour, championship

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B6B80' }}>Tournament Bracket</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: '#4A4A60' }}>{expanded ? 'Collapse' : 'Expand'}</span>
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: '#6B6B80' }} /> : <ChevronDown className="w-4 h-4" style={{ color: '#6B6B80' }} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t p-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {/* Compact March Madness Layout: Left | Center | Right */}
          <div className="flex items-stretch justify-between w-full gap-1">
            {/* LEFT SIDE: East + West regions - stacked horizontally */}
            <div className="flex gap-1 flex-1 justify-center">
              {/* East */}
              <div className="flex flex-col">
                <div className="text-center text-[9px] font-bold uppercase mb-1" style={{ color: '#00FFA3' }}>East</div>
                <div className="flex gap-1">
                  {['round64', 'round32', 'sweet16', 'elite8'].map((roundKey) => {
                    const roundNum = ROUND_KEYS.indexOf(roundKey) + 1
                    const isActive = activeRound === roundNum
                    const matchups = getRegionMatchups(results, roundKey, 'East')
                    return (
                      <div key={`east-${roundKey}`} className="flex flex-col justify-center" style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className="text-[7px] font-bold uppercase text-center mb-0.5" style={{ color: isActive ? '#00FFA3' : '#6B6B80' }}>{ROUND_LABELS[roundKey]}</div>
                        <div className="space-y-0.5">
                          {matchups.map(([key, matchup]) => (
                            <CompactMatchupCard key={key} matchup={matchup} roundKey={roundKey} userPicks={userPicks} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* West */}
              <div className="flex flex-col">
                <div className="text-center text-[9px] font-bold uppercase mb-1" style={{ color: '#00FFA3' }}>West</div>
                <div className="flex gap-1">
                  {['round64', 'round32', 'sweet16', 'elite8'].map((roundKey) => {
                    const roundNum = ROUND_KEYS.indexOf(roundKey) + 1
                    const isActive = activeRound === roundNum
                    const matchups = getRegionMatchups(results, roundKey, 'West')
                    return (
                      <div key={`west-${roundKey}`} className="flex flex-col justify-center" style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className="text-[7px] font-bold uppercase text-center mb-0.5" style={{ color: isActive ? '#00FFA3' : '#6B6B80' }}>{ROUND_LABELS[roundKey]}</div>
                        <div className="space-y-0.5">
                          {matchups.map(([key, matchup]) => (
                            <CompactMatchupCard key={key} matchup={matchup} roundKey={roundKey} userPicks={userPicks} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* CENTER: Final Four + Championship */}
            <div className="flex flex-col items-center justify-center gap-1 px-2">
              <div className="text-[9px] font-bold uppercase mb-1" style={{ color: '#F59E0B' }}>Final Four</div>
              <div className="space-y-0.5">
                {(results['finalFour'] ? Object.entries(results['finalFour']) : []).sort((a, b) => parseMatchupIndex(a[0]) - parseMatchupIndex(b[0])).map(([key, matchup]) => (
                  <CompactMatchupCard key={key} matchup={matchup} roundKey="finalFour" userPicks={userPicks} />
                ))}
              </div>
              <div className="text-[9px] font-bold uppercase my-1" style={{ color: '#EF4444' }}>Championship</div>
              <div className="space-y-0.5">
                {(results['championship'] ? Object.entries(results['championship']) : []).sort((a, b) => parseMatchupIndex(a[0]) - parseMatchupIndex(b[0])).map(([key, matchup]) => (
                  <CompactMatchupCard key={key} matchup={matchup} roundKey="championship" userPicks={userPicks} />
                ))}
              </div>
            </div>

            {/* RIGHT SIDE: South + Midwest */}
            <div className="flex gap-1 flex-1 justify-center">
              {/* South */}
              <div className="flex flex-col">
                <div className="text-center text-[9px] font-bold uppercase mb-1" style={{ color: '#F59E0B' }}>South</div>
                <div className="flex gap-1">
                  {['round64', 'round32', 'sweet16', 'elite8'].map((roundKey) => {
                    const roundNum = ROUND_KEYS.indexOf(roundKey) + 1
                    const isActive = activeRound === roundNum
                    const matchups = getRegionMatchups(results, roundKey, 'South')
                    return (
                      <div key={`south-${roundKey}`} className="flex flex-col justify-center" style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className="text-[7px] font-bold uppercase text-center mb-0.5" style={{ color: isActive ? '#F59E0B' : '#6B6B80' }}>{ROUND_LABELS[roundKey]}</div>
                        <div className="space-y-0.5">
                          {matchups.map(([key, matchup]) => (
                            <CompactMatchupCard key={key} matchup={matchup} roundKey={roundKey} userPicks={userPicks} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Midwest */}
              <div className="flex flex-col">
                <div className="text-center text-[9px] font-bold uppercase mb-1" style={{ color: '#F59E0B' }}>Midwest</div>
                <div className="flex gap-1">
                  {['round64', 'round32', 'sweet16', 'elite8'].map((roundKey) => {
                    const roundNum = ROUND_KEYS.indexOf(roundKey) + 1
                    const isActive = activeRound === roundNum
                    const matchups = getRegionMatchups(results, roundKey, 'Midwest')
                    return (
                      <div key={`midwest-${roundKey}`} className="flex flex-col justify-center" style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className="text-[7px] font-bold uppercase text-center mb-0.5" style={{ color: isActive ? '#F59E0B' : '#6B6B80' }}>{ROUND_LABELS[roundKey]}</div>
                        <div className="space-y-0.5">
                          {matchups.map(([key, matchup]) => (
                            <CompactMatchupCard key={key} matchup={matchup} roundKey={roundKey} userPicks={userPicks} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact matchup card for the bracket view
function CompactMatchupCard({ matchup, roundKey, userPicks }: { matchup: BracketMatchup; roundKey: string; userPicks?: UserPick[] }) {
  const team1 = matchup.team1 || 'TBD'
  const team2 = matchup.team2 || 'TBD'
  const winner = matchup.winner

  // Check if user picked either team
  const userPick = userPicks?.find(p => p.team_name === team1 || p.team_name === team2)
  const pickedTeam = userPick?.team_name

  return (
    <div
      className="rounded px-1 py-0.5 text-[7px]"
      style={{
        background: winner ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
        borderLeft: winner === team1 ? '2px solid #00FFA3' : winner === team2 ? '2px solid #F59E0B' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="truncate" style={{ color: winner === team1 ? '#00FFA3' : team1 === 'TBD' ? '#4A4A5A' : '#E6E6FA' }}>
          {matchup.team1Seed ? `${matchup.team1Seed}. ` : ''}{team1}
        </span>
        {pickedTeam === team1 && <span className="text-[6px] text-yellow-400">P</span>}
      </div>
      <div className="flex items-center justify-between">
        <span className="truncate" style={{ color: winner === team2 ? '#00FFA3' : team2 === 'TBD' ? '#4A4A5A' : '#E6E6FA' }}>
          {matchup.team2Seed ? `${matchup.team2Seed}. ` : ''}{team2}
        </span>
        {pickedTeam === team2 && <span className="text-[6px] text-yellow-400">P</span>}
      </div>
    </div>
  )
}
