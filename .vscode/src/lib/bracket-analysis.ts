// Bracket Analysis Engine — deterministic mock AI analysis

import { seedRandom } from './analytics-utils'

export interface BracketTeam {
  id: string
  region: string
  seed: number
  team_name: string
  abbreviation: string | null
  champ_probability: number
  round_probs: {
    r64: number
    r32: number
    s16: number
    e8: number
    f4: number
    final: number
    champ: number
  }
}

export interface BracketPicks {
  firstFour?: Record<string, string>   // gameKey → winning team name
  round64: Record<string, string>      // matchupKey → winning team name
  round32: Record<string, string>
  sweet16: Record<string, string>
  elite8: Record<string, string>
  finalFour: Record<string, string>
  championship: string
  champion: string
}

export interface WeakPick {
  round: string
  matchup: string
  pickedTeam: string
  betterPick: string
  equityLoss: number
}

export interface AltPick {
  round: string
  currentPick: string
  suggestedPick: string
  winProbBefore: number
  winProbAfter: number
}

export interface UpsetOpportunity {
  round: string
  favoriteTeam: string
  underdogTeam: string
  upsetProb: number
  leverageScore: number
  userPicked: boolean
}

export interface FinalFourTeam {
  team: string
  seed: number
  region: string
  popularityPct: number
  label: 'Popular' | 'Balanced' | 'Contrarian'
}

export interface BracketAnalysis {
  scoreGrade: 'A+' | 'A' | 'B' | 'C' | 'D'
  winProbs: Record<number, number>        // pool size → win %
  riskLevel: 'Safe' | 'Balanced' | 'Aggressive'
  riskScore: number                       // 0-100
  uniquenessScore: number                 // 0-100
  duplicationRisk: 'High' | 'Moderate' | 'Low'
  duplicationNote: string
  weakPicks: WeakPick[]
  altPicks: AltPick[]
  upsetRadar: UpsetOpportunity[]
  finalFourTeams: FinalFourTeam[]
  finalFourUniqueness: 'Popular' | 'Balanced' | 'Contrarian'
  poolStrategyNote: string
  analyzedAt: string
}

// Popular Final Four teams (high duplication risk)
const POPULAR_TEAMS = ['Connecticut', 'Houston', 'North Carolina', 'Purdue', 'Tennessee', 'Duke', 'Kentucky', 'Arizona', 'Marquette', 'Iowa State']
const CONTRARIAN_TEAMS = ['Florida Atlantic', 'NC State', 'McNeese', 'Oakland', 'Grand Canyon', 'Drake', 'Duquesne', 'James Madison']

function getTeamPopularity(teamName: string): number {
  if (POPULAR_TEAMS.includes(teamName)) return Math.floor(60 + Math.random() * 30)
  if (CONTRARIAN_TEAMS.includes(teamName)) return Math.floor(2 + Math.random() * 8)
  return Math.floor(15 + Math.random() * 30)
}

function getFinalFourLabel(popularityPct: number): 'Popular' | 'Balanced' | 'Contrarian' {
  if (popularityPct >= 50) return 'Popular'
  if (popularityPct >= 20) return 'Balanced'
  return 'Contrarian'
}

export function analyzeBracket(
  picks: BracketPicks,
  poolSize: number,
  teams: BracketTeam[]
): BracketAnalysis {
  const rng = seedRandom(JSON.stringify(picks) + poolSize)

  const teamMap: Record<string, BracketTeam> = {}
  for (const t of teams) {
    teamMap[t.team_name] = t
  }

  // --- Champion probability ---
  const champion = picks.champion || picks.championship || ''
  const champTeam = teamMap[champion]
  const champProb = champTeam ? champTeam.champ_probability : 1.0

  // --- Win probability per pool size ---
  // Base: champion's champ probability, adjusted for pool competition
  const baseWinProb = champProb * 0.8 + rng() * champProb * 0.4
  const winProbs: Record<number, number> = {
    10: parseFloat(Math.min(baseWinProb * 1.5, 35).toFixed(1)),
    25: parseFloat(Math.min(baseWinProb * 0.8, 20).toFixed(1)),
    50: parseFloat(Math.min(baseWinProb * 0.45, 12).toFixed(1)),
    100: parseFloat(Math.min(baseWinProb * 0.25, 8).toFixed(1)),
    500: parseFloat(Math.min(baseWinProb * 0.06, 2).toFixed(1)),
  }

  // --- Final Four teams ---
  const ff = Object.values(picks.finalFour || {})
  if (champion && !ff.includes(champion)) ff.push(champion)
  const finalFourTeams: FinalFourTeam[] = ff.slice(0, 4).map(name => {
    const t = teamMap[name]
    const pop = getTeamPopularity(name)
    return {
      team: name,
      seed: t?.seed ?? 99,
      region: t?.region ?? 'Unknown',
      popularityPct: pop,
      label: getFinalFourLabel(pop),
    }
  })

  // Final Four uniqueness
  const avgPop = finalFourTeams.reduce((s, t) => s + t.popularityPct, 0) / Math.max(finalFourTeams.length, 1)
  const finalFourUniqueness: 'Popular' | 'Balanced' | 'Contrarian' =
    avgPop >= 50 ? 'Popular' : avgPop >= 25 ? 'Balanced' : 'Contrarian'

  // --- Uniqueness score ---
  const popularFFCount = finalFourTeams.filter(t => POPULAR_TEAMS.includes(t.team)).length
  const uniquenessScore = Math.max(10, Math.min(95, 85 - popularFFCount * 18 + Math.floor(rng() * 15)))

  // --- Duplication risk ---
  let duplicationRisk: 'High' | 'Moderate' | 'Low'
  let duplicationNote: string
  if (uniquenessScore < 35) {
    duplicationRisk = 'High'
    const popularPicks = finalFourTeams.filter(t => POPULAR_TEAMS.includes(t.team)).map(t => t.team)
    duplicationNote = `This bracket has a high chance of duplication due to popular picks like ${popularPicks.slice(0, 2).join(' and ')} in the Final Four.`
  } else if (uniquenessScore < 65) {
    duplicationRisk = 'Moderate'
    duplicationNote = 'This bracket has moderate duplication risk. Consider swapping one popular Final Four pick for a contrarian choice.'
  } else {
    duplicationRisk = 'Low'
    duplicationNote = 'This bracket has strong uniqueness. Your contrarian picks give you a differentiated edge in most pools.'
  }

  // --- Risk score ---
  // Count upsets picked (lower seed beating higher seed)
  const allPicks = [
    ...Object.values(picks.round64 || {}),
    ...Object.values(picks.round32 || {}),
    ...Object.values(picks.sweet16 || {}),
    ...Object.values(picks.elite8 || {}),
    ...Object.values(picks.finalFour || {}),
    champion,
  ].filter(Boolean)

  let upsetCount = 0
  for (const teamName of allPicks) {
    const t = teamMap[teamName]
    if (t && t.seed >= 5) upsetCount++
  }
  const totalPicks = Math.max(allPicks.length, 1)
  const upsetRatio = upsetCount / totalPicks
  const riskScore = Math.min(95, Math.floor(upsetRatio * 200 + rng() * 15))
  const riskLevel: 'Safe' | 'Balanced' | 'Aggressive' =
    riskScore < 35 ? 'Safe' : riskScore < 65 ? 'Balanced' : 'Aggressive'

  // --- Weak picks ---
  const weakPicks: WeakPick[] = []
  const roundNames: Record<string, string> = {
    round64: 'Round of 64', round32: 'Round of 32', sweet16: 'Sweet 16', elite8: 'Elite 8', finalFour: 'Final Four'
  }
  for (const [roundKey, roundPicks] of Object.entries({ round64: picks.round64, round32: picks.round32, sweet16: picks.sweet16, elite8: picks.elite8, finalFour: picks.finalFour })) {
    if (!roundPicks) continue
    for (const picked of Object.values(roundPicks)) {
      const t = teamMap[picked as string]
      if (!t) continue
      const roundProb = t.round_probs[roundKey === 'round64' ? 'r64' : roundKey === 'round32' ? 'r32' : roundKey === 'sweet16' ? 's16' : roundKey === 'elite8' ? 'e8' : 'f4'] ?? 50
      if (roundProb < 20 && weakPicks.length < 5) {
        // Find a better alternative from same region
        const betterTeams = teams
          .filter(bt => bt.region === t.region && bt.seed < t.seed)
          .sort((a, b) => a.seed - b.seed)
        const betterPick = betterTeams[0]?.team_name ?? 'a lower seed'
        const equityLoss = parseFloat((rng() * 4 + 0.5).toFixed(1))
        weakPicks.push({
          round: roundNames[roundKey],
          matchup: `${t.team_name} in the ${roundNames[roundKey]}`,
          pickedTeam: t.team_name,
          betterPick,
          equityLoss,
        })
      }
    }
  }

  // --- Optimal alternative picks ---
  const altPicks: AltPick[] = weakPicks.slice(0, 3).map(wp => {
    const before = parseFloat((winProbs[poolSize] ?? 3).toFixed(1))
    const improvement = parseFloat((rng() * 2.5 + 0.5).toFixed(1))
    return {
      round: wp.round,
      currentPick: wp.pickedTeam,
      suggestedPick: wp.betterPick,
      winProbBefore: before,
      winProbAfter: parseFloat((before + improvement).toFixed(1)),
    }
  })

  // --- Upset radar ---
  const upsetOpportunities: UpsetOpportunity[] = [
    { seed: 12, favSeed: 5, round: 'Round of 64', favProb: 65, upsetProb: 35 },
    { seed: 11, favSeed: 6, round: 'Round of 64', favProb: 60, upsetProb: 40 },
    { seed: 10, favSeed: 7, round: 'Round of 64', favProb: 55, upsetProb: 45 },
    { seed: 9, favSeed: 8, round: 'Round of 64', favProb: 52, upsetProb: 48 },
    { seed: 13, favSeed: 4, round: 'Round of 64', favProb: 80, upsetProb: 20 },
  ]

  const upsetRadar: UpsetOpportunity[] = upsetOpportunities.slice(0, 4).map(u => {
    // find a representative team for each upset slot
    const underdogs = teams.filter(t => t.seed === u.seed && t.region !== 'First Four')
    const favorites = teams.filter(t => t.seed === u.favSeed && t.region !== 'First Four')
    const underdog = underdogs[Math.floor(rng() * underdogs.length)] ?? underdogs[0]
    const favorite = favorites[Math.floor(rng() * favorites.length)] ?? favorites[0]
    if (!underdog || !favorite) return null
    const userPicked = allPicks.includes(underdog.team_name)
    return {
      round: u.round,
      favoriteTeam: `#${u.favSeed} ${favorite.team_name}`,
      underdogTeam: `#${u.seed} ${underdog.team_name}`,
      upsetProb: u.upsetProb + Math.floor(rng() * 10 - 5),
      leverageScore: Math.floor(60 + rng() * 35),
      userPicked,
    }
  }).filter(Boolean) as UpsetOpportunity[]

  // --- Score grade ---
  const winProbForPool = winProbs[Math.min(poolSize, 500)] ?? winProbs[100]
  let scoreGrade: 'A+' | 'A' | 'B' | 'C' | 'D'
  if (winProbForPool >= 8) scoreGrade = 'A+'
  else if (winProbForPool >= 6) scoreGrade = 'A'
  else if (winProbForPool >= 4) scoreGrade = 'B'
  else if (winProbForPool >= 2) scoreGrade = 'C'
  else scoreGrade = 'D'

  // Boost grade for unique brackets
  if (uniquenessScore >= 70 && scoreGrade === 'B') scoreGrade = 'A'
  if (uniquenessScore >= 85 && scoreGrade === 'A') scoreGrade = 'A+'

  // --- Pool strategy note ---
  let poolStrategyNote: string
  if (poolSize <= 10) {
    poolStrategyNote = `With only ${poolSize} entries, chalk picks and top-seed dominance maximize your edge. Focus on getting the champion right.`
  } else if (poolSize <= 25) {
    poolStrategyNote = `In a ${poolSize}-entry pool, a balanced approach works best. One contrarian Final Four pick can set you apart.`
  } else if (poolSize <= 50) {
    poolStrategyNote = `With ${poolSize} entries, consider at least 2 contrarian Final Four teams. The champion pick is critical — avoid the most popular choice.`
  } else if (poolSize <= 100) {
    poolStrategyNote = `A ${poolSize}-entry pool demands differentiation. Pick at least one 3-5 seed in your Final Four and avoid the most chalky champion.`
  } else {
    poolStrategyNote = `In a 500+ entry pool, contrarian strategy is essential. Your champion pick needs to be someone under 15% popularity to have a real chance.`
  }

  return {
    scoreGrade,
    winProbs,
    riskLevel,
    riskScore,
    uniquenessScore,
    duplicationRisk,
    duplicationNote,
    weakPicks,
    altPicks,
    upsetRadar,
    finalFourTeams,
    finalFourUniqueness,
    poolStrategyNote,
    analyzedAt: new Date().toISOString(),
  }
}

export function generateOptimizedBrackets(
  original: BracketPicks,
  teams: BracketTeam[],
  poolSize: number
): { safe: BracketPicks; balanced: BracketPicks; aggressive: BracketPicks } {
  // For the optimizer, we generate 3 variants based on swapping champion/final four
  // Safe: keep top seeds, swap any upset picks for chalk
  // Balanced: one contrarian swap in Final Four
  // Aggressive: two contrarian swaps, different champion

  const topSeeds = teams.filter(t => t.seed <= 2 && t.region !== 'First Four').sort((a, b) => b.champ_probability - a.champ_probability)
  const midSeeds = teams.filter(t => t.seed >= 3 && t.seed <= 5 && t.region !== 'First Four')
  const rng = seedRandom('optimize' + JSON.stringify(original))

  const safeChamp = topSeeds[0]?.team_name ?? original.champion
  const balancedChamp = topSeeds[1]?.team_name ?? original.champion
  const aggressiveChamp = midSeeds[Math.floor(rng() * midSeeds.length)]?.team_name ?? original.champion

  return {
    safe: { ...original, champion: safeChamp, championship: safeChamp },
    balanced: { ...original, champion: balancedChamp, championship: balancedChamp },
    aggressive: { ...original, champion: aggressiveChamp, championship: aggressiveChamp },
  }
}

export function getPoolSizeLabel(size: number): string {
  if (size <= 10) return '10 entries'
  if (size <= 25) return '25 entries'
  if (size <= 50) return '50 entries'
  if (size <= 100) return '100 entries'
  return '500+ entries'
}

export const GRADE_COLORS: Record<string, string> = {
  'A+': '#00FFA3',
  'A':  '#00CC82',
  'B':  '#F59E0B',
  'C':  '#F97316',
  'D':  '#FF6B6B',
}

export const RISK_COLORS: Record<string, string> = {
  Safe:       '#00FFA3',
  Balanced:   '#F59E0B',
  Aggressive: '#FF6B6B',
}
