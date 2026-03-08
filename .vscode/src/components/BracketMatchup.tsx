'use client'

import { BracketTeam } from '@/lib/bracket-analysis'

interface BracketMatchupProps {
  topTeam: BracketTeam | null
  bottomTeam: BracketTeam | null
  winner: string | null
  onPick: (team: BracketTeam) => void
  compact?: boolean
  roundKey: string
}

export function BracketMatchup({ topTeam, bottomTeam, winner, onPick, compact = false }: BracketMatchupProps) {
  const height = compact ? 'h-7' : 'h-8'
  const textSize = compact ? 'text-[10px]' : 'text-xs'
  const seedSize = compact ? 'w-4 text-[9px]' : 'w-5 text-[10px]'

  function TeamSlot({ team }: { team: BracketTeam | null }) {
    if (!team) {
      return (
        <div className={`flex items-center gap-1 px-2 ${height} rounded`}
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span className={`${seedSize} text-center font-mono`} style={{ color: '#3A3A50' }}>-</span>
          <span className={`${textSize} truncate max-w-[90px]`} style={{ color: '#3A3A50' }}>TBD</span>
        </div>
      )
    }

    const isWinner = winner === team.team_name
    const isLoser = winner && winner !== team.team_name

    return (
      <button
        onClick={() => onPick(team)}
        className={`flex items-center gap-1.5 px-2 ${height} rounded w-full text-left transition-all duration-150 ${
          isWinner
            ? 'border'
            : isLoser
            ? 'opacity-35'
            : 'hover:border'
        }`}
        style={{
          background: isWinner
            ? 'rgba(0,255,163,0.12)'
            : 'rgba(255,255,255,0.03)',
          border: isWinner
            ? '1px solid rgba(0,255,163,0.35)'
            : '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <span
          className={`${seedSize} text-center font-bold font-mono shrink-0`}
          style={{ color: isWinner ? '#00FFA3' : '#6B6B80' }}
        >
          {team.seed}
        </span>
        <span
          className={`${textSize} truncate max-w-[100px] font-medium`}
          style={{ color: isWinner ? '#00FFA3' : isLoser ? '#4A4A60' : '#C0C0D0' }}
        >
          {team.team_name}
        </span>
        {isWinner && (
          <span className="ml-auto text-[9px] font-bold shrink-0" style={{ color: '#00FFA3' }}>✓</span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 w-36">
      <TeamSlot team={topTeam} />
      <div className="h-px mx-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <TeamSlot team={bottomTeam} />
    </div>
  )
}
