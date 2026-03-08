'use client'

import { getPickDifficulty } from '@/lib/analytics-utils'

interface PickDifficultyBadgeProps {
  winProb: number
  spread: number
  isUnderdog?: boolean
}

export function PickDifficultyBadge({ winProb, spread, isUnderdog = false }: PickDifficultyBadgeProps) {
  const difficulty = getPickDifficulty(winProb, spread, isUnderdog)

  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full border"
      style={{
        color: difficulty.color,
        background: difficulty.bgColor,
        borderColor: difficulty.border,
      }}
    >
      {difficulty.label}
    </span>
  )
}
