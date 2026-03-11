'use client'

import { Trophy, Users, Target, Activity } from 'lucide-react'
import { ROUND_KEYS, ROUND_LABELS, type RoundCompletionStatus } from '@/lib/bracketTypes'

interface ContestStatusHeaderProps {
  currentRound: number
  activeRound: number
  totalEntrants: number
  aliveEntrants: number
  myAliveEntries: number
  myTotalEntries: number
  roundCompletionStatus?: Record<string, RoundCompletionStatus>
  hasPendingPick: boolean
  hasSubmittedPick: boolean
}

export function ContestStatusHeader({
  activeRound,
  totalEntrants,
  aliveEntrants,
  myAliveEntries,
  myTotalEntries,
  roundCompletionStatus,
  hasPendingPick,
  hasSubmittedPick,
}: ContestStatusHeaderProps) {
  const activeRoundKey = ROUND_KEYS[activeRound - 1] ?? 'round64'
  const roundLabel = ROUND_LABELS[activeRoundKey] ?? `Round ${activeRound}`
  const roundStatus = roundCompletionStatus?.[activeRoundKey]

  const pickStatusLabel = hasSubmittedPick
    ? 'Submitted'
    : hasPendingPick
      ? 'Unsaved'
      : 'Open'

  const pickStatusColor = hasSubmittedPick
    ? '#00FFA3'
    : hasPendingPick
      ? '#F59E0B'
      : '#A0A0B0'

  return (
    <div
      className="rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-4"
      style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Current Round */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.12)' }}>
          <Trophy className="w-4 h-4" style={{ color: '#F59E0B' }} />
        </div>
        <div>
          <div className="text-xs font-bold" style={{ color: '#E6E6FA' }}>{roundLabel}</div>
          <div className="text-[10px]" style={{ color: '#6B6B80' }}>Current Round</div>
        </div>
      </div>

      {/* Entries Remaining */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(0,255,163,0.08)' }}>
          <Users className="w-4 h-4" style={{ color: '#00FFA3' }} />
        </div>
        <div>
          <div className="text-xs font-bold" style={{ color: '#E6E6FA' }}>
            {aliveEntrants} / {totalEntrants}
          </div>
          <div className="text-[10px]" style={{ color: '#6B6B80' }}>Alive</div>
        </div>
      </div>

      {/* Your Entries */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(139,92,246,0.12)' }}>
          <Target className="w-4 h-4" style={{ color: '#8B5CF6' }} />
        </div>
        <div>
          <div className="text-xs font-bold" style={{ color: '#E6E6FA' }}>
            {myAliveEntries} / {myTotalEntries}
          </div>
          <div className="text-[10px]" style={{ color: '#6B6B80' }}>Your Entries</div>
        </div>
      </div>

      {/* Round Progress */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(59,130,246,0.12)' }}>
          <Activity className="w-4 h-4" style={{ color: '#3B82F6' }} />
        </div>
        <div>
          <div className="text-xs font-bold" style={{ color: '#E6E6FA' }}>
            {roundStatus ? `${roundStatus.completed}/${roundStatus.total}` : '0/0'}
          </div>
          <div className="text-[10px]" style={{ color: '#6B6B80' }}>Games Done</div>
        </div>
      </div>

      {/* Pick Status */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${pickStatusColor}15` }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: pickStatusColor }} />
        </div>
        <div>
          <div className="text-xs font-bold" style={{ color: pickStatusColor }}>
            {pickStatusLabel}
          </div>
          <div className="text-[10px]" style={{ color: '#6B6B80' }}>Pick Status</div>
        </div>
      </div>
    </div>
  )
}
