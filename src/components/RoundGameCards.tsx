'use client'

import { CheckCircle, Lock, Ban } from 'lucide-react'
import {
  type BracketMatchup,
  parseMatchupIndex,
  getRegionForMatchup,
  sortMatchupEntries,
} from '@/lib/bracketTypes'

export interface PickSelection {
  teamName: string
  teamSeed: number
  opponentName: string
  opponentSeed: number
}

interface RoundGameCardsProps {
  roundKey: string
  roundNumber: number
  matchups: Record<string, BracketMatchup>
  selectedTeam: string | null
  usedTeams: string[]
  isLocked: boolean
  isEliminated: boolean
  onTeamSelect: (pick: PickSelection) => void
}

function GameCard({
  matchup,
  matchupIndex,
  roundKey,
  selectedTeam,
  usedTeams,
  isLocked,
  isEliminated,
  onTeamSelect,
}: {
  matchup: BracketMatchup
  matchupIndex: number
  roundKey: string
  selectedTeam: string | null
  usedTeams: string[]
  isLocked: boolean
  isEliminated: boolean
  onTeamSelect: (pick: PickSelection) => void
}) {
  const hasWinner = matchup.winner != null && matchup.winner !== ''
  const team1Empty = !matchup.team1 || matchup.team1 === ''
  const team2Empty = !matchup.team2 || matchup.team2 === ''
  const isTBD = team1Empty || team2Empty

  const team1Used = usedTeams.some((t) => t.toLowerCase() === matchup.team1?.toLowerCase())
  const team2Used = usedTeams.some((t) => t.toLowerCase() === matchup.team2?.toLowerCase())

  const team1Selected = selectedTeam?.toLowerCase() === matchup.team1?.toLowerCase()
  const team2Selected = selectedTeam?.toLowerCase() === matchup.team2?.toLowerCase()

  const team1Won = hasWinner && matchup.winner === matchup.team1
  const team2Won = hasWinner && matchup.winner === matchup.team2

  const regionLabel = roundKey === 'round64' ? getRegionForMatchup(matchupIndex) : null

  const canClick = !isLocked && !isEliminated && !hasWinner && !isTBD

  function handleTeamClick(team: 'team1' | 'team2') {
    if (!canClick) return
    const isUsed = team === 'team1' ? team1Used : team2Used
    if (isUsed) return

    const teamName = team === 'team1' ? matchup.team1 : matchup.team2
    const teamSeed = team === 'team1' ? matchup.team1Seed : matchup.team2Seed
    const oppName = team === 'team1' ? matchup.team2 : matchup.team1
    const oppSeed = team === 'team1' ? matchup.team2Seed : matchup.team1Seed

    onTeamSelect({ teamName, teamSeed, opponentName: oppName, opponentSeed: oppSeed })
  }

  // Determine card border color
  let borderColor = 'rgba(255,255,255,0.06)'
  if (team1Selected || team2Selected) borderColor = 'rgba(0,255,163,0.4)'
  else if (hasWinner) borderColor = 'rgba(255,255,255,0.08)'

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#1A1A2E', border: `1px solid ${borderColor}` }}>
      {/* Game header */}
      <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#4A4A60' }}>
          {regionLabel ? `${regionLabel} Region` : `Game ${matchupIndex + 1}`}
        </span>
        {hasWinner && (
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
            Final
          </span>
        )}
        {isTBD && !hasWinner && (
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#4A4A60' }}>
            TBD
          </span>
        )}
        {isLocked && !hasWinner && !isTBD && (
          <Lock className="w-3 h-3" style={{ color: '#4A4A60' }} />
        )}
      </div>

      {/* Team 1 row */}
      <TeamRow
        teamName={matchup.team1}
        teamSeed={matchup.team1Seed}
        isEmpty={team1Empty}
        isWinner={team1Won}
        isLoser={hasWinner && !team1Won}
        isSelected={team1Selected}
        isUsed={team1Used}
        canClick={canClick && !team1Used && !team1Empty}
        onClick={() => handleTeamClick('team1')}
      />

      <div className="h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />

      {/* Team 2 row */}
      <TeamRow
        teamName={matchup.team2}
        teamSeed={matchup.team2Seed}
        isEmpty={team2Empty}
        isWinner={team2Won}
        isLoser={hasWinner && !team2Won}
        isSelected={team2Selected}
        isUsed={team2Used}
        canClick={canClick && !team2Used && !team2Empty}
        onClick={() => handleTeamClick('team2')}
      />
    </div>
  )
}

function TeamRow({
  teamName,
  teamSeed,
  isEmpty,
  isWinner,
  isLoser,
  isSelected,
  isUsed,
  canClick,
  onClick,
}: {
  teamName: string
  teamSeed: number
  isEmpty: boolean
  isWinner: boolean
  isLoser: boolean
  isSelected: boolean
  isUsed: boolean
  canClick: boolean
  onClick: () => void
}) {
  let bgStyle = 'transparent'
  if (isSelected) bgStyle = 'rgba(0,255,163,0.1)'
  else if (isWinner) bgStyle = 'rgba(0,255,163,0.05)'

  let nameColor = '#E6E6FA'
  if (isEmpty) nameColor = '#4A4A60'
  else if (isLoser) nameColor = '#4A4A60'
  else if (isSelected) nameColor = '#00FFA3'
  else if (isWinner) nameColor = '#00FFA3'
  else if (isUsed) nameColor = '#6B6B80'

  return (
    <button
      onClick={onClick}
      disabled={!canClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 transition-all text-left"
      style={{
        background: bgStyle,
        opacity: isLoser ? 0.4 : 1,
        cursor: canClick ? 'pointer' : 'default',
      }}
    >
      {/* Seed */}
      <span className="text-[11px] font-bold w-5 text-center tabular-nums flex-shrink-0" style={{ color: '#6B6B80' }}>
        {isEmpty ? '-' : teamSeed}
      </span>

      {/* Team name */}
      <span className="text-sm font-semibold truncate flex-1" style={{ color: nameColor }}>
        {isEmpty ? 'TBD' : teamName}
      </span>

      {/* Status indicator */}
      <div className="flex-shrink-0">
        {isSelected && <CheckCircle className="w-4 h-4" style={{ color: '#00FFA3' }} />}
        {isUsed && !isSelected && !isLoser && (
          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>
            <Ban className="w-2.5 h-2.5" /> Used
          </span>
        )}
        {isWinner && !isSelected && <CheckCircle className="w-3.5 h-3.5" style={{ color: '#00FFA3' }} />}
      </div>
    </button>
  )
}

export function RoundGameCards({
  roundKey,
  roundNumber,
  matchups,
  selectedTeam,
  usedTeams,
  isLocked,
  isEliminated,
  onTeamSelect,
}: RoundGameCardsProps) {
  const entries = sortMatchupEntries(
    Object.entries(matchups) as [string, BracketMatchup][]
  )

  if (entries.length === 0) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-xs" style={{ color: '#6B6B80' }}>No matchups available for this round yet.</p>
      </div>
    )
  }

  return (
    <div>
      {isEliminated && (
        <div className="rounded-xl p-3 mb-3 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Ban className="w-4 h-4 flex-shrink-0" style={{ color: '#F87171' }} />
          <span className="text-xs font-semibold" style={{ color: '#F87171' }}>
            This entry has been eliminated. You can view the bracket but cannot make picks.
          </span>
        </div>
      )}
      {isLocked && !isEliminated && (
        <div className="rounded-xl p-3 mb-3 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Lock className="w-4 h-4 flex-shrink-0" style={{ color: '#6B6B80' }} />
          <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>
            This round is locked. Wait for the previous round to complete.
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map(([key, matchup]) => (
          <GameCard
            key={key}
            matchup={matchup}
            matchupIndex={parseMatchupIndex(key)}
            roundKey={roundKey}
            selectedTeam={selectedTeam}
            usedTeams={usedTeams}
            isLocked={isLocked}
            isEliminated={isEliminated}
            onTeamSelect={onTeamSelect}
          />
        ))}
      </div>
    </div>
  )
}
