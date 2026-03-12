'use client'

import { Check } from 'lucide-react'

interface TeamData {
  seed: number
  name: string
}

interface MatchupResult {
  team1: string
  team2: string
  team1Seed: number
  team2Seed: number
  winner?: string
}

interface BracketData {
  regions?: Record<string, Array<{ seed: number; name: string }>>
  results?: Record<string, Record<string, MatchupResult>>
}

interface EntryPick {
  team_name: string
  result: 'pending' | 'won' | 'lost'
}

interface SurvivorBracketProps {
  bracketData: BracketData
  entryPicks?: EntryPick[]
}

// Seed pairings for R64
const R64_PAIRS = [[1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]]

// Get team from region by seed
function getTeamBySeed(teams: Array<{ seed: number; name: string }>, seed: number): { seed: number; name: string } | null {
  return teams.find(t => t.seed === seed) ?? null
}

// Get winner from results
function getMatchupWinner(results: Record<string, Record<string, MatchupResult>> | undefined, roundKey: string, matchupKey: string): string | null {
  return results?.[roundKey]?.[matchupKey]?.winner ?? null
}

// Get pick status for a team
function getPickStatus(entryPicks: EntryPick[] | undefined, teamName: string): 'pending' | 'won' | 'lost' | null {
  if (!entryPicks) return null
  const pick = entryPicks.find(p => p.team_name === teamName)
  return pick?.result ?? null
}

// Region component for left/right sides
function RegionColumn({
  region,
  teams,
  results,
  entryPicks,
  side,
  roundLabels
}: {
  region: string
  teams: Array<{ seed: number; name: string }>
  results: Record<string, Record<string, MatchupResult>> | undefined
  entryPicks: EntryPick[] | undefined
  side: 'left' | 'right'
  roundLabels: string[]
}) {
  // Build matchups for each round
  const r64Matchups = R64_PAIRS.map(([s1, s2], i) => ({
    key: `${region}_r64_${i}`,
    top: getTeamBySeed(teams, s1),
    bottom: getTeamBySeed(teams, s2),
  }))

  // R32: winners from adjacent R64 pairs
  const r32Matchups = [0, 1, 2, 3].map(i => {
    const key1 = `${region}_r64_${i * 2}`
    const key2 = `${region}_r64_${i * 2 + 1}`
    const w1 = getMatchupWinner(results, 'round64', key1)
    const w2 = getMatchupWinner(results, 'round64', key2)
    const t1 = w1 ? teams.find(t => t.name === w1) ?? null : null
    const t2 = w2 ? teams.find(t => t.name === w2) ?? null : null
    return { key: `${region}_r32_${i}`, top: t1, bottom: t2 }
  })

  // S16: winners from adjacent R32 pairs
  const s16Matchups = [0, 1].map(i => {
    const key1 = `${region}_r32_${i * 2}`
    const key2 = `${region}_r32_${i * 2 + 1}`
    const w1 = getMatchupWinner(results, 'round32', key1)
    const w2 = getMatchupWinner(results, 'round32', key2)
    const t1 = w1 ? teams.find(t => t.name === w1) ?? null : null
    const t2 = w2 ? teams.find(t => t.name === w2) ?? null : null
    return { key: `${region}_sweet16_${i}`, top: t1, bottom: t2 }
  })

  // E8: regional championship
  const e8W1 = getMatchupWinner(results, 'sweet16', `${region}_sweet16_0`)
  const e8W2 = getMatchupWinner(results, 'sweet16', `${region}_sweet16_1`)
  const e8Top = e8W1 ? teams.find(t => t.name === e8W1) ?? null : null
  const e8Bottom = e8W2 ? teams.find(t => t.name === e8W2) ?? null : null
  const e8Matchup = { key: `${region}_elite8_0`, top: e8Top, bottom: e8Bottom }

  const rounds = [
    { label: roundLabels[0], matchups: r64Matchups, roundKey: 'round64' },
    { label: roundLabels[1], matchups: r32Matchups, roundKey: 'round32' },
    { label: roundLabels[2], matchups: s16Matchups, roundKey: 'sweet16' },
    { label: roundLabels[3], matchups: [e8Matchup], roundKey: 'elite8' },
  ]

  const orderedRounds = side === 'right' ? [...rounds].reverse() : rounds

  return (
    <div className="flex gap-3 items-start">
      {orderedRounds.map(({ label, matchups, roundKey }) => (
        <div key={label} className="flex flex-col gap-2">
          <div
            className="text-center text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ color: '#6B6B80', background: 'rgba(255,255,255,0.04)' }}
          >
            {label}
          </div>
          <div className="flex flex-col justify-around" style={{ minHeight: `${matchups.length * 80}px` }}>
            {matchups.map(m => (
              <div key={m.key} className="my-1">
                <MatchupSlot
                  topTeam={m.top}
                  bottomTeam={m.bottom}
                  winner={getMatchupWinner(results, roundKey, m.key)}
                  entryPicks={entryPicks}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Final Four component
function FinalFourColumn({
  results,
  entryPicks,
}: {
  results: Record<string, Record<string, MatchupResult>> | undefined
  entryPicks: EntryPick[] | undefined
}) {
  // Get E8 winners for each region
  const eastWinner = getMatchupWinner(results, 'elite8', 'East_elite8_0')
  const westWinner = getMatchupWinner(results, 'elite8', 'West_elite8_0')
  const southWinner = getMatchupWinner(results, 'elite8', 'South_elite8_0')
  const midwestWinner = getMatchupWinner(results, 'elite8', 'Midwest_elite8_0')

  // Final Four matchups: East vs West (top), South vs Midwest (bottom)
  const ff1Matchup = {
    key: 'final4_0',
    top: eastWinner ? { seed: 0, name: eastWinner } : null,
    bottom: westWinner ? { seed: 0, name: westWinner } : null,
  }

  const ff2Matchup = {
    key: 'final4_1',
    top: southWinner ? { seed: 0, name: southWinner } : null,
    bottom: midwestWinner ? { seed: 0, name: midwestWinner } : null,
  }

  // Championship: winners of FF matchups
  const champW1 = getMatchupWinner(results, 'finalFour', 'final4_0')
  const champW2 = getMatchupWinner(results, 'final4_1')
  const champMatchup = {
    key: 'championship',
    top: champW1 ? { seed: 0, name: champW1 } : null,
    bottom: champW2 ? { seed: 0, name: champW2 } : null,
  }

  return (
    <div className="flex flex-col gap-6 items-center">
      {/* Final Four Round */}
      <div className="flex flex-col gap-2">
        <div
          className="text-center text-[10px] font-semibold px-2 py-0.5 rounded"
          style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.15)' }}
        >
          FINAL FOUR
        </div>
        <div className="flex flex-col gap-8">
          <MatchupSlot
            topTeam={ff1Matchup.top}
            bottomTeam={ff1Matchup.bottom}
            winner={getMatchupWinner(results, 'finalFour', ff1Matchup.key)}
            entryPicks={entryPicks}
          />
          <MatchupSlot
            topTeam={ff2Matchup.top}
            bottomTeam={ff2Matchup.bottom}
            winner={getMatchupWinner(results, 'finalFour', ff2Matchup.key)}
            entryPicks={entryPicks}
          />
        </div>
      </div>

      {/* Championship */}
      <div className="flex flex-col gap-2">
        <div
          className="text-center text-[10px] font-semibold px-2 py-0.5 rounded"
          style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.2)' }}
        >
          CHAMPIONSHIP
        </div>
        <MatchupSlot
          topTeam={champMatchup.top}
          bottomTeam={champMatchup.bottom}
          winner={getMatchupWinner(results, 'championship', champMatchup.key)}
          entryPicks={entryPicks}
          isChampionship
        />
      </div>
    </div>
  )
}

// Matchup slot component
function MatchupSlot({
  topTeam,
  bottomTeam,
  winner,
  entryPicks,
  isChampionship = false
}: {
  topTeam: { seed: number; name: string } | null
  bottomTeam: { seed: number; name: string } | null
  winner: string | null
  entryPicks: EntryPick[] | undefined
  isChampionship?: boolean
}) {
  const height = isChampionship ? 'h-10' : 'h-8'
  const textSize = isChampionship ? 'text-xs' : 'text-xs'
  const seedSize = isChampionship ? 'w-6 text-[10px]' : 'w-5 text-[10px]'

  function TeamSlot({ team, position }: { team: { seed: number; name: string } | null; position: 'top' | 'bottom' }) {
    if (!team) {
      return (
        <div
          className={`flex items-center gap-1.5 px-2 ${height} rounded`}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span className={`${seedSize} text-center font-mono`} style={{ color: '#3A3A50' }}>
            -
          </span>
          <span className={`${textSize} truncate max-w-[100px]`} style={{ color: '#3A3A50' }}>
            TBD
          </span>
        </div>
      )
    }

    const isWinner = winner === team.name
    const isLoser = winner && winner !== team.name
    const pickStatus = getPickStatus(entryPicks, team.name)

    // Determine styling based on winner/loser and pick status
    let bgColor = 'rgba(255,255,255,0.03)'
    let borderColor = 'rgba(255,255,255,0.07)'
    let textColor = '#C0C0D0'

    if (isWinner) {
      bgColor = 'rgba(0,255,163,0.12)'
      borderColor = 'rgba(0,255,163,0.35)'
      textColor = '#00FFA3'
    } else if (isLoser) {
      textColor = '#4A4A60'
    } else if (pickStatus === 'won') {
      bgColor = 'rgba(0,255,163,0.15)'
      borderColor = 'rgba(0,255,163,0.4)'
      textColor = '#00FFA3'
    } else if (pickStatus === 'lost') {
      bgColor = 'rgba(239,68,68,0.15)'
      borderColor = 'rgba(239,68,68,0.4)'
      textColor = '#EF4444'
    } else if (pickStatus === 'pending') {
      bgColor = 'rgba(245,158,11,0.15)'
      borderColor = 'rgba(245,158,11,0.4)'
      textColor = '#F59E0B'
    }

    return (
      <div
        className={`flex items-center gap-1.5 px-2 ${height} rounded w-full`}
        style={{
          background: bgColor,
          border: `1px solid ${borderColor}`,
          opacity: isLoser && !pickStatus ? 0.35 : 1,
        }}
      >
        <span className={`${seedSize} text-center font-bold font-mono shrink-0`} style={{ color: textColor }}>
          {team.seed > 0 ? team.seed : ''}
        </span>
        <span className={`${textSize} truncate max-w-[100px] font-medium`} style={{ color: textColor }}>
          {team.name}
        </span>
        {isWinner && (
          <Check className="ml-auto w-3 h-3 shrink-0" style={{ color: textColor }} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 w-36">
      <TeamSlot team={topTeam} position="top" />
      <div className="h-px mx-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <TeamSlot team={bottomTeam} position="bottom" />
    </div>
  )
}

// Region label badge
function RegionBadge({ region, side }: { region: string; side: 'left' | 'right' | 'center' }) {
  const colors = {
    left: { bg: 'rgba(0,255,163,0.15)', text: '#00FFA3', border: 'rgba(0,255,163,0.3)' },
    right: { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6', border: 'rgba(59,130,246,0.3)' },
    center: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  }

  const c = colors[side]

  return (
    <div
      className="text-xs font-bold px-3 py-1 rounded"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {region}
    </div>
  )
}

export function SurvivorBracket({ bracketData, entryPicks }: SurvivorBracketProps) {
  const { regions = {}, results = {} } = bracketData

  // Get teams for each region
  const eastTeams = regions.East || []
  const southTeams = regions.South || []
  const midwestTeams = regions.Midwest || []
  const westTeams = regions.West || []

  // Round labels - left side (R64 -> E8), right side (reversed)
  const leftRoundLabels = ['R64', 'R32', 'S16', 'E8']
  const rightRoundLabels = ['E8', 'S16', 'R32', 'R64']

  return (
    <div className="relative w-full overflow-x-auto">
      {/* Sponsor watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <span
          className="text-[120px] font-bold uppercase opacity-[0.04] select-none"
          style={{ color: '#6B6B80' }}
        >
          SPONSOR
        </span>
      </div>

      {/* Main bracket container */}
      <div className="relative z-10 flex items-start justify-center gap-4 min-w-[1100px] py-8 px-4">
        {/* LEFT SIDE: East + South */}
        <div className="flex flex-col gap-8">
          <RegionBadge region="EAST" side="left" />
          <RegionColumn
            region="East"
            teams={eastTeams}
            results={results}
            entryPicks={entryPicks}
            side="left"
            roundLabels={leftRoundLabels}
          />
        </div>

        <div className="flex flex-col gap-8 mt-[120px]">
          <RegionBadge region="SOUTH" side="left" />
          <RegionColumn
            region="South"
            teams={southTeams}
            results={results}
            entryPicks={entryPicks}
            side="left"
            roundLabels={leftRoundLabels}
          />
        </div>

        {/* CENTER: Final Four + Championship */}
        <div className="mt-[60px]">
          <RegionBadge region="FINAL FOUR" side="center" />
          <div className="mt-4">
            <FinalFourColumn results={results} entryPicks={entryPicks} />
          </div>
        </div>

        {/* RIGHT SIDE: Midwest + West (reversed) */}
        <div className="flex flex-col gap-8 mt-[120px]">
          <RegionBadge region="MIDWEST" side="right" />
          <RegionColumn
            region="Midwest"
            teams={midwestTeams}
            results={results}
            entryPicks={entryPicks}
            side="right"
            roundLabels={rightRoundLabels}
          />
        </div>

        <div className="flex flex-col gap-8">
          <RegionBadge region="WEST" side="right" />
          <RegionColumn
            region="West"
            teams={westTeams}
            results={results}
            entryPicks={entryPicks}
            side="right"
            roundLabels={rightRoundLabels}
          />
        </div>
      </div>
    </div>
  )
}
