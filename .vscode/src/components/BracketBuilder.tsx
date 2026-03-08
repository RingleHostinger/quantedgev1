'use client'

import { useState, useMemo } from 'react'
import { BracketTeam, BracketPicks } from '@/lib/bracket-analysis'
import { BracketRegion, getRegionE8Winner } from './BracketRegion'
import { BracketMatchup } from './BracketMatchup'

interface BracketBuilderProps {
  teams: BracketTeam[]
  initialPicks?: BracketPicks
  /** Legacy single-action callback (new builder page) */
  onSubmit?: (picks: BracketPicks) => void
  /** Edit-page callbacks for Save vs Analyze separately */
  onSave?: (picks: BracketPicks) => void
  onAnalyze?: (picks: BracketPicks) => void
  /** Called whenever any pick changes (for unsaved-change tracking) */
  onPicksChange?: (picks: BracketPicks) => void
  submitting?: boolean
  saving?: boolean
  analyzing?: boolean
  hasUnsavedChanges?: boolean
}

const REGIONS = ['East', 'West', 'South', 'Midwest']
// Left side: East + South; Right side: West + Midwest
// Final Four pairings: East vs West (top), South vs Midwest (bottom)
const FF_TOP_REGIONS = ['East', 'West']
const FF_BOTTOM_REGIONS = ['South', 'Midwest']

function emptyPicks(): BracketPicks {
  return {
    round64: {},
    round32: {},
    sweet16: {},
    elite8: {},
    finalFour: {},
    championship: '',
    champion: '',
  }
}

export function BracketBuilder({
  teams,
  initialPicks,
  onSubmit,
  onSave,
  onAnalyze,
  onPicksChange,
  submitting = false,
  saving = false,
  analyzing = false,
  hasUnsavedChanges = false,
}: BracketBuilderProps) {
  const [picks, setPicks] = useState<BracketPicks>(initialPicks ?? emptyPicks())

  const regionTeams = useMemo(() => {
    const map: Record<string, BracketTeam[]> = {}
    for (const region of REGIONS) {
      map[region] = teams.filter(t => t.region === region).sort((a, b) => a.seed - b.seed)
    }
    return map
  }, [teams])

  function handlePick(roundKey: keyof BracketPicks, matchupKey: string, team: BracketTeam) {
    setPicks(prev => {
      const updated = { ...prev }

      // Set this round's pick
      if (roundKey !== 'championship' && roundKey !== 'champion') {
        const roundPicks = { ...(updated[roundKey] as Record<string, string> ?? {}) }
        roundPicks[matchupKey] = team.team_name
        ;(updated[roundKey] as Record<string, string>) = roundPicks
      }

      // Cascade: if a team advances and then we pick differently in a later round,
      // clear all downstream picks that referenced the old winner
      onPicksChange?.(updated)
      return updated
    })
  }

  function handleFFPick(ffKey: string, team: BracketTeam) {
    setPicks(prev => {
      const updated = {
        ...prev,
        finalFour: { ...(prev.finalFour ?? {}), [ffKey]: team.team_name },
        championship: '',
        champion: '',
      }
      onPicksChange?.(updated)
      return updated
    })
  }

  function handleChampionshipPick(team: BracketTeam) {
    setPicks(prev => {
      const updated = {
        ...prev,
        championship: team.team_name,
        champion: team.team_name,
      }
      onPicksChange?.(updated)
      return updated
    })
  }

  // Count total picks made (63 needed for full bracket)
  const totalPicks = useMemo(() => {
    let count = 0
    count += Object.keys(picks.round64 ?? {}).length
    count += Object.keys(picks.round32 ?? {}).length
    count += Object.keys(picks.sweet16 ?? {}).length
    count += Object.keys(picks.elite8 ?? {}).length
    count += Object.keys(picks.finalFour ?? {}).length
    if (picks.champion) count += 1
    return count
  }, [picks])

  // Final Four: 4 regional winners
  const ffTeams = useMemo(() => {
    return REGIONS.map(region => {
      const winner = getRegionE8Winner(region, picks)
      return winner ? teams.find(t => t.team_name === winner) ?? null : null
    })
  }, [picks, teams])

  // Championship: 2 Final Four winners
  const ffTopWinner = picks.finalFour?.['ff_top'] ?? null
  const ffBottomWinner = picks.finalFour?.['ff_bottom'] ?? null
  const champTop = ffTopWinner ? teams.find(t => t.team_name === ffTopWinner) ?? null : null
  const champBottom = ffBottomWinner ? teams.find(t => t.team_name === ffBottomWinner) ?? null : null

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(totalPicks / 63) * 100}%`, background: 'linear-gradient(90deg, #00FFA3, #00CC82)' }}
          />
        </div>
        <span className="text-sm font-mono shrink-0" style={{ color: totalPicks === 63 ? '#00FFA3' : '#A0A0B0' }}>
          {totalPicks} / 63 picks
        </span>
      </div>

      {/* Horizontal scrollable bracket */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[1100px]">

          {/* Region labels */}
          <div className="grid grid-cols-2 gap-6 mb-3">
            {/* Left: East + South */}
            <div className="grid grid-cols-2 gap-4">
              {['East', 'South'].map(r => (
                <div key={r} className="text-center">
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
                    {r} Region
                  </span>
                </div>
              ))}
            </div>
            {/* Right: West + Midwest */}
            <div className="grid grid-cols-2 gap-4">
              {['Midwest', 'West'].map(r => (
                <div key={r} className="text-center">
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>
                    {r} Region
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Main bracket area */}
          <div className="flex gap-4 items-start justify-center">

            {/* Left regions (East, South) — left to right */}
            <div className="flex flex-col gap-6">
              {['East', 'South'].map(region => (
                <BracketRegion
                  key={region}
                  region={region}
                  teams={regionTeams[region] ?? []}
                  picks={picks}
                  onPick={handlePick}
                  side="left"
                />
              ))}
            </div>

            {/* Center: Final Four + Championship */}
            <div className="flex flex-col items-center justify-center gap-6 px-4 min-w-[200px]">
              <div className="text-center mb-2">
                <span className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                  Final Four
                </span>
              </div>

              {/* Final Four matchup 1: East vs West */}
              <div className="space-y-1">
                <p className="text-[10px] text-center mb-1" style={{ color: '#6B6B80' }}>East vs West</p>
                <BracketMatchup
                  roundKey="finalFour"
                  topTeam={ffTeams[0]}
                  bottomTeam={ffTeams[1]}
                  winner={picks.finalFour?.['ff_top'] ?? null}
                  onPick={(team) => handleFFPick('ff_top', team)}
                />
              </div>

              {/* Championship */}
              <div className="my-2 space-y-1">
                <p className="text-[10px] text-center mb-1" style={{ color: '#F59E0B' }}>Championship</p>
                <BracketMatchup
                  roundKey="championship"
                  topTeam={champTop}
                  bottomTeam={champBottom}
                  winner={picks.champion || null}
                  onPick={handleChampionshipPick}
                />
                {picks.champion && (
                  <div className="text-center mt-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }}>
                      Champion: {picks.champion}
                    </span>
                  </div>
                )}
              </div>

              {/* Final Four matchup 2: South vs Midwest */}
              <div className="space-y-1">
                <p className="text-[10px] text-center mb-1" style={{ color: '#6B6B80' }}>South vs Midwest</p>
                <BracketMatchup
                  roundKey="finalFour"
                  topTeam={ffTeams[2]}
                  bottomTeam={ffTeams[3]}
                  winner={picks.finalFour?.['ff_bottom'] ?? null}
                  onPick={(team) => handleFFPick('ff_bottom', team)}
                />
              </div>
            </div>

            {/* Right regions (Midwest, West) — right to left */}
            <div className="flex flex-col gap-6">
              {['Midwest', 'West'].map(region => (
                <BracketRegion
                  key={region}
                  region={region}
                  teams={regionTeams[region] ?? []}
                  picks={picks}
                  onPick={handlePick}
                  side="right"
                />
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Action buttons */}
      {onSave || onAnalyze ? (
        /* Edit-page mode: Save + Analyze side by side */
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onSave?.(picks)}
            disabled={saving || analyzing}
            className="px-8 py-3 rounded-xl font-bold text-sm transition-all duration-200 min-w-[160px]"
            style={{
              background: 'linear-gradient(135deg, #00FFA3, #00CC82)',
              color: '#000',
              cursor: saving || analyzing ? 'not-allowed' : 'pointer',
              opacity: saving || analyzing ? 0.7 : 1,
              boxShadow: '0 0 20px rgba(0,255,163,0.3)',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => onAnalyze?.(picks)}
            disabled={hasUnsavedChanges || analyzing || saving || totalPicks < 63}
            className="px-8 py-3 rounded-xl font-bold text-sm transition-all duration-200 min-w-[160px]"
            style={{
              background: hasUnsavedChanges || totalPicks < 63
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(59,130,246,0.15)',
              color: hasUnsavedChanges || totalPicks < 63 ? '#6B6B80' : '#3B82F6',
              border: hasUnsavedChanges || totalPicks < 63
                ? '1px solid rgba(255,255,255,0.08)'
                : '1px solid rgba(59,130,246,0.3)',
              cursor: hasUnsavedChanges || analyzing || saving || totalPicks < 63 ? 'not-allowed' : 'pointer',
              opacity: hasUnsavedChanges || totalPicks < 63 ? 0.5 : 1,
            }}
            title={hasUnsavedChanges ? 'Save your changes before analyzing' : totalPicks < 63 ? `Complete bracket (${63 - totalPicks} picks left)` : ''}
          >
            {analyzing ? 'Analyzing...' : 'Analyze Bracket'}
          </button>
        </div>
      ) : (
        /* New-bracket mode: single submit button */
        <div className="flex justify-center pt-2">
          <button
            onClick={() => onSubmit?.(picks)}
            disabled={totalPicks < 63 || submitting}
            className="px-8 py-3 rounded-xl font-bold text-sm transition-all duration-200"
            style={{
              background: totalPicks === 63 ? 'linear-gradient(135deg, #00FFA3, #00CC82)' : 'rgba(255,255,255,0.08)',
              color: totalPicks === 63 ? '#000' : '#6B6B80',
              cursor: totalPicks === 63 ? 'pointer' : 'not-allowed',
              boxShadow: totalPicks === 63 ? '0 0 20px rgba(0,255,163,0.3)' : 'none',
            }}
          >
            {submitting ? 'Analyzing...' : totalPicks < 63 ? `Complete bracket (${63 - totalPicks} picks left)` : 'Analyze My Bracket'}
          </button>
        </div>
      )}
    </div>
  )
}
