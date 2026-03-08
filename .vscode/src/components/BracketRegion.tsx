'use client'

import { BracketTeam, BracketPicks } from '@/lib/bracket-analysis'
import { BracketMatchup } from './BracketMatchup'

interface BracketRegionProps {
  region: string
  teams: BracketTeam[]
  picks: BracketPicks
  onPick: (roundKey: keyof BracketPicks, matchupKey: string, team: BracketTeam) => void
  side: 'left' | 'right'
}

// Build R64 matchups: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
const R64_PAIRS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]]

function getTeam(teams: BracketTeam[], seed: number): BracketTeam | null {
  return teams.find(t => t.seed === seed) ?? null
}

function getRoundWinner(picks: BracketPicks, roundKey: string, matchupKey: string): string | null {
  const roundPicks = (picks as Record<string, Record<string, string>>)[roundKey]
  return roundPicks?.[matchupKey] ?? null
}

export function BracketRegion({ region, teams, picks, onPick, side }: BracketRegionProps) {
  // R64: 8 matchups
  const r64Matchups = R64_PAIRS.map(([s1, s2], i) => ({
    key: `${region}_r64_${i}`,
    top: getTeam(teams, s1),
    bottom: getTeam(teams, s2),
  }))

  // R32: 4 matchups (winners of adjacent R64 pairs)
  const r32Matchups = [0,1,2,3].map(i => {
    const key1 = `${region}_r64_${i*2}`
    const key2 = `${region}_r64_${i*2+1}`
    const w1 = getRoundWinner(picks, 'round64', key1)
    const w2 = getRoundWinner(picks, 'round64', key2)
    const t1 = w1 ? teams.find(t => t.team_name === w1) ?? null : null
    const t2 = w2 ? teams.find(t => t.team_name === w2) ?? null : null
    return { key: `${region}_r32_${i}`, top: t1, bottom: t2 }
  })

  // S16: 2 matchups (winners of adjacent R32 pairs)
  const s16Matchups = [0,1].map(i => {
    const key1 = `${region}_r32_${i*2}`
    const key2 = `${region}_r32_${i*2+1}`
    const w1 = getRoundWinner(picks, 'round32', key1)
    const w2 = getRoundWinner(picks, 'round32', key2)
    const t1 = w1 ? teams.find(t => t.team_name === w1) ?? null : null
    const t2 = w2 ? teams.find(t => t.team_name === w2) ?? null : null
    return { key: `${region}_s16_${i}`, top: t1, bottom: t2 }
  })

  // E8: 1 matchup (regional championship)
  const e8Key = `${region}_e8_0`
  const e8W1 = getRoundWinner(picks, 'sweet16', `${region}_s16_0`)
  const e8W2 = getRoundWinner(picks, 'sweet16', `${region}_s16_1`)
  const e8Top = e8W1 ? teams.find(t => t.team_name === e8W1) ?? null : null
  const e8Bottom = e8W2 ? teams.find(t => t.team_name === e8W2) ?? null : null
  const e8Matchup = { key: e8Key, top: e8Top, bottom: e8Bottom }

  const rounds = [
    { label: 'R64', matchups: r64Matchups, roundKey: 'round64' as keyof BracketPicks },
    { label: 'R32', matchups: r32Matchups, roundKey: 'round32' as keyof BracketPicks },
    { label: 'S16', matchups: s16Matchups, roundKey: 'sweet16' as keyof BracketPicks },
    { label: 'E8',  matchups: [e8Matchup], roundKey: 'elite8' as keyof BracketPicks },
  ]

  const orderedRounds = side === 'right' ? [...rounds].reverse() : rounds

  return (
    <div className="flex gap-3 items-start">
      {orderedRounds.map(({ label, matchups, roundKey }) => (
        <div key={label} className="flex flex-col gap-2">
          <div className="text-center text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ color: '#6B6B80', background: 'rgba(255,255,255,0.04)' }}>
            {label}
          </div>
          <div className="flex flex-col justify-around" style={{ minHeight: `${matchups.length * 80}px` }}>
            {matchups.map(m => (
              <div key={m.key} className="my-1">
                <BracketMatchup
                  roundKey={roundKey as string}
                  topTeam={m.top}
                  bottomTeam={m.bottom}
                  winner={getRoundWinner(picks, roundKey as string, m.key)}
                  onPick={(team) => onPick(roundKey, m.key, team)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function getRegionE8Winner(region: string, picks: BracketPicks): string | null {
  return getRoundWinner(picks, 'elite8', `${region}_e8_0`)
}
