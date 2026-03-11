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

interface SurvivorBracketViewProps {
  bracketData: OfficialBracketData
  activeRound: number
}

function MatchupCard({ matchup, roundKey, matchupIndex }: {
  matchup: BracketMatchup
  roundKey: string
  matchupIndex: number
}) {
  const hasWinner = matchup.winner != null && matchup.winner !== ''
  const team1Won = hasWinner && matchup.winner === matchup.team1
  const team2Won = hasWinner && matchup.winner === matchup.team2
  const team1Empty = !matchup.team1 || matchup.team1 === ''
  const team2Empty = !matchup.team2 || matchup.team2 === ''

  // Show region label only for round64
  const regionLabel = roundKey === 'round64' ? getRegionForMatchup(matchupIndex) : null

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {regionLabel && (
        <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-center"
          style={{ background: 'rgba(255,255,255,0.03)', color: '#4A4A60' }}>
          {regionLabel}
        </div>
      )}
      {/* Team 1 */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 border-b"
        style={{
          borderColor: 'rgba(255,255,255,0.04)',
          opacity: hasWinner && !team1Won ? 0.35 : 1,
          background: team1Won ? 'rgba(0,255,163,0.06)' : 'transparent',
        }}
      >
        <span className="text-[10px] font-bold w-4 text-center tabular-nums" style={{ color: '#6B6B80' }}>
          {team1Empty ? '-' : matchup.team1Seed}
        </span>
        <span className="text-[11px] font-medium truncate flex-1" style={{
          color: team1Empty ? '#4A4A60' : team1Won ? '#00FFA3' : '#E6E6FA',
        }}>
          {team1Empty ? 'TBD' : matchup.team1}
        </span>
        {team1Won && <span className="text-[9px]" style={{ color: '#00FFA3' }}>W</span>}
      </div>
      {/* Team 2 */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5"
        style={{
          opacity: hasWinner && !team2Won ? 0.35 : 1,
          background: team2Won ? 'rgba(0,255,163,0.06)' : 'transparent',
        }}
      >
        <span className="text-[10px] font-bold w-4 text-center tabular-nums" style={{ color: '#6B6B80' }}>
          {team2Empty ? '-' : matchup.team2Seed}
        </span>
        <span className="text-[11px] font-medium truncate flex-1" style={{
          color: team2Empty ? '#4A4A60' : team2Won ? '#00FFA3' : '#E6E6FA',
        }}>
          {team2Empty ? 'TBD' : matchup.team2}
        </span>
        {team2Won && <span className="text-[9px]" style={{ color: '#00FFA3' }}>W</span>}
      </div>
    </div>
  )
}

export function SurvivorBracketView({ bracketData, activeRound }: SurvivorBracketViewProps) {
  const [expanded, setExpanded] = useState(false)
  const results = bracketData.results

  if (!results) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-xs" style={{ color: '#6B6B80' }}>Bracket data not available yet.</p>
      </div>
    )
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
        <div className="border-t overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex gap-3 p-4" style={{ minWidth: '900px' }}>
            {ROUND_KEYS.map((roundKey, idx) => {
              const roundNum = idx + 1
              const roundMatchups = results[roundKey] ?? {}
              const entries = sortMatchupEntries(
                Object.entries(roundMatchups) as [string, BracketMatchup][]
              )
              const isActive = roundNum === activeRound

              return (
                <div key={roundKey} className="flex-1 min-w-[130px]">
                  {/* Round header */}
                  <div
                    className="text-center mb-2 pb-1.5 border-b"
                    style={{
                      borderColor: isActive ? 'rgba(0,255,163,0.3)' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{
                      color: isActive ? '#00FFA3' : '#6B6B80',
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
                      />
                    ))}
                    {entries.length === 0 && (
                      <div className="text-center py-4">
                        <span className="text-[10px]" style={{ color: '#4A4A60' }}>No matchups</span>
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
