'use client'

import { Lock, CheckCircle, XCircle, Clock } from 'lucide-react'

export interface SurvivorGame {
  id: string
  matchup_key: string
  team1_name: string
  team1_seed: number
  team2_name: string
  team2_seed: number
  region: string
  round_key: string
  winner: string | null
  is_locked: boolean
  status: string // posted | locked | graded
}

interface SurvivorGameCardsProps {
  games: SurvivorGame[]
  selectedTeams: string[]
  usedTeams: string[]
  onSelectTeam: (gameId: string, teamName: string, teamSeed: number) => void
  disabled?: boolean // picks locked / entry eliminated
  picksRequired: number
}

export function SurvivorGameCards({
  games,
  selectedTeams,
  usedTeams,
  onSelectTeam,
  disabled = false,
  picksRequired,
}: SurvivorGameCardsProps) {
  const selectedCount = selectedTeams.length

  return (
    <div className="space-y-3">
      {/* Pick counter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {Array.from({ length: picksRequired }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-200"
              style={{
                background: i < selectedCount ? '#00FFA3' : 'rgba(255,255,255,0.1)',
                boxShadow: i < selectedCount ? '0 0 8px rgba(0,255,163,0.4)' : 'none',
              }}
            />
          ))}
        </div>
        <span className="text-sm" style={{ color: '#A0A0B0' }}>
          {selectedCount} of {picksRequired} pick{picksRequired > 1 ? 's' : ''} selected
        </span>
      </div>

      {/* Game cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            selectedTeams={selectedTeams}
            usedTeams={usedTeams}
            onSelectTeam={onSelectTeam}
            disabled={disabled}
          />
        ))}
      </div>

      {games.length === 0 && (
        <div
          className="text-center py-12 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: '#6B6B80' }} />
          <p className="text-sm" style={{ color: '#6B6B80' }}>
            No games posted for this day yet.
          </p>
          <p className="text-xs mt-1" style={{ color: '#4A4A60' }}>
            Check back when the admin posts today's matchups.
          </p>
        </div>
      )}
    </div>
  )
}

function GameCard({
  game,
  selectedTeams,
  usedTeams,
  onSelectTeam,
  disabled,
}: {
  game: SurvivorGame
  selectedTeams: string[]
  usedTeams: string[]
  onSelectTeam: (gameId: string, teamName: string, teamSeed: number) => void
  disabled: boolean
}) {
  const isGraded = game.status === 'graded' || game.winner
  const isGameLocked = game.is_locked || game.status === 'locked'

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: isGraded
          ? '1px solid rgba(0,255,163,0.2)'
          : isGameLocked
          ? '1px solid rgba(255,255,255,0.06)'
          : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Card header */}
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#6B6B80' }}>
          {game.region}
        </span>
        {isGraded && (
          <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#00FFA3' }}>
            <CheckCircle className="w-3 h-3" /> Final
          </span>
        )}
        {isGameLocked && !isGraded && (
          <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#F59E0B' }}>
            <Lock className="w-3 h-3" /> Locked
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="p-2 space-y-1.5">
        <TeamButton
          teamName={game.team1_name}
          teamSeed={game.team1_seed}
          gameId={game.id}
          isSelected={selectedTeams.includes(game.team1_name)}
          isUsed={usedTeams.includes(game.team1_name)}
          isWinner={game.winner === game.team1_name}
          isLoser={!!game.winner && game.winner !== game.team1_name}
          isGraded={isGraded}
          isLocked={isGameLocked || disabled}
          onSelect={onSelectTeam}
        />
        <div className="flex items-center gap-2 px-2">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span className="text-[9px] font-bold" style={{ color: '#4A4A60' }}>VS</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
        <TeamButton
          teamName={game.team2_name}
          teamSeed={game.team2_seed}
          gameId={game.id}
          isSelected={selectedTeams.includes(game.team2_name)}
          isUsed={usedTeams.includes(game.team2_name)}
          isWinner={game.winner === game.team2_name}
          isLoser={!!game.winner && game.winner !== game.team2_name}
          isGraded={isGraded}
          isLocked={isGameLocked || disabled}
          onSelect={onSelectTeam}
        />
      </div>
    </div>
  )
}

function TeamButton({
  teamName,
  teamSeed,
  gameId,
  isSelected,
  isUsed,
  isWinner,
  isLoser,
  isGraded,
  isLocked,
  onSelect,
}: {
  teamName: string
  teamSeed: number
  gameId: string
  isSelected: boolean
  isUsed: boolean
  isWinner: boolean
  isLoser: boolean
  isGraded: boolean
  isLocked: boolean
  onSelect: (gameId: string, teamName: string, teamSeed: number) => void
}) {
  const canSelect = !isLocked && !isGraded && !isUsed

  let bg = 'rgba(255,255,255,0.03)'
  let border = '1px solid rgba(255,255,255,0.07)'
  let textColor = '#C0C0D0'
  let seedColor = '#6B6B80'
  let opacity = 1

  if (isSelected && !isGraded) {
    bg = 'rgba(0,255,163,0.12)'
    border = '1px solid rgba(0,255,163,0.4)'
    textColor = '#00FFA3'
    seedColor = '#00FFA3'
  } else if (isWinner) {
    bg = 'rgba(0,255,163,0.12)'
    border = '1px solid rgba(0,255,163,0.35)'
    textColor = '#00FFA3'
    seedColor = '#00FFA3'
  } else if (isLoser) {
    bg = 'rgba(239,68,68,0.08)'
    border = '1px solid rgba(239,68,68,0.2)'
    textColor = '#EF4444'
    seedColor = '#EF4444'
    opacity = 0.6
  } else if (isUsed) {
    bg = 'rgba(255,255,255,0.02)'
    border = '1px solid rgba(255,255,255,0.04)'
    textColor = '#4A4A60'
    seedColor = '#3A3A50'
    opacity = 0.5
  }

  return (
    <button
      onClick={() => canSelect && onSelect(gameId, teamName, teamSeed)}
      disabled={!canSelect}
      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg transition-all duration-150"
      style={{ background: bg, border, opacity, cursor: canSelect ? 'pointer' : 'default' }}
    >
      <span
        className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold font-mono shrink-0"
        style={{
          background: isSelected && !isGraded
            ? 'rgba(0,255,163,0.2)'
            : isWinner
            ? 'rgba(0,255,163,0.2)'
            : isLoser
            ? 'rgba(239,68,68,0.15)'
            : 'rgba(255,255,255,0.06)',
          color: seedColor,
        }}
      >
        {teamSeed}
      </span>
      <span className="text-sm font-medium truncate" style={{ color: textColor }}>
        {teamName}
      </span>
      {isSelected && !isGraded && (
        <CheckCircle className="w-4 h-4 ml-auto shrink-0" style={{ color: '#00FFA3' }} />
      )}
      {isWinner && (
        <CheckCircle className="w-4 h-4 ml-auto shrink-0" style={{ color: '#00FFA3' }} />
      )}
      {isLoser && isSelected && (
        <XCircle className="w-4 h-4 ml-auto shrink-0" style={{ color: '#EF4444' }} />
      )}
      {isUsed && !isSelected && (
        <span className="ml-auto text-[10px] font-semibold shrink-0" style={{ color: '#4A4A60' }}>
          USED
        </span>
      )}
      {isLocked && !isGraded && !isUsed && !isSelected && (
        <Lock className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: '#4A4A60' }} />
      )}
    </button>
  )
}
