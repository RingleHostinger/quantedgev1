'use client'

import { getModelStrength } from '@/lib/analytics-utils'

interface ModelStrengthMeterProps {
  confidence: number
  compact?: boolean
}

export function ModelStrengthMeter({ confidence, compact = false }: ModelStrengthMeterProps) {
  const strength = getModelStrength(confidence)
  const filled = Math.round(confidence / 10)
  const empty = 10 - filled
  const blocks = '█'.repeat(filled) + '░'.repeat(empty)

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono tracking-tight" style={{ color: strength.color }}>
          {blocks}
        </span>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{ background: strength.bgColor, color: strength.color }}
        >
          {strength.label}
        </span>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#A0A0B0' }}>
          Model Strength
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: strength.bgColor, color: strength.color }}
        >
          {strength.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="text-sm font-mono tracking-tight"
          style={{ color: strength.color, textShadow: `0 0 8px ${strength.color}60` }}
        >
          {blocks}
        </span>
        <span className="text-sm font-bold" style={{ color: strength.color }}>
          {confidence}%
        </span>
      </div>
    </div>
  )
}
