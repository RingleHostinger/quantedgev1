/**
 * POST /api/survivor/simulate
 *
 * Monte Carlo tournament simulation for the Survivor Pool.
 * Runs 10,000 simulated tournaments to calculate:
 *   - survival probability per round
 *   - most common elimination round
 *   - best survival path
 *   - expected value vs average pool participant
 *
 * Body: { picks: SimulatePick[], poolFormat: string, teamReuse: boolean }
 * where SimulatePick = { round: number; team: string; winPct: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export interface SimulatePick {
  round: number
  team: string
  winPct: number // 0–100
}

export interface SimulationResult {
  survivalProbability: number       // % surviving all picked rounds
  roundSurvivalRates: Record<number, number>  // per-round survival %
  mostCommonElimRound: number | null
  eliminationBreakdown: Record<number, number> // round → % eliminated
  bestPath: string[]                // teams in order of highest probability
  evVsPool: number                  // EV advantage over random pool participant
  simCount: number
}

const SIMULATIONS = 10_000

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { picks: SimulatePick[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const picks = body.picks ?? []
  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: 'No picks provided' }, { status: 400 })
  }

  // Sort picks by round ascending
  const sortedPicks = [...picks].sort((a, b) => a.round - b.round)

  // Track per-round elimination counts
  const elimCounts: Record<number, number> = {}
  const roundSurvivalCounts: Record<number, number> = {}
  let fullSurvivalCount = 0

  for (const pick of sortedPicks) {
    elimCounts[pick.round] = 0
    roundSurvivalCounts[pick.round] = 0
  }

  // Run Monte Carlo simulations
  for (let sim = 0; sim < SIMULATIONS; sim++) {
    let survived = true

    for (const pick of sortedPicks) {
      if (!survived) break

      const winProb = Math.max(0, Math.min(100, pick.winPct)) / 100
      const won = Math.random() < winProb

      if (won) {
        roundSurvivalCounts[pick.round] = (roundSurvivalCounts[pick.round] ?? 0) + 1
      } else {
        elimCounts[pick.round] = (elimCounts[pick.round] ?? 0) + 1
        survived = false
      }
    }

    if (survived) fullSurvivalCount++
  }

  // Calculate survival probability
  const survivalProbability = Math.round((fullSurvivalCount / SIMULATIONS) * 100 * 10) / 10

  // Per-round survival rates
  const roundSurvivalRates: Record<number, number> = {}
  for (const pick of sortedPicks) {
    roundSurvivalRates[pick.round] =
      Math.round((roundSurvivalCounts[pick.round] / SIMULATIONS) * 100 * 10) / 10
  }

  // Elimination breakdown (% eliminated in each round)
  const eliminationBreakdown: Record<number, number> = {}
  for (const pick of sortedPicks) {
    eliminationBreakdown[pick.round] =
      Math.round((elimCounts[pick.round] / SIMULATIONS) * 100 * 10) / 10
  }

  // Most common elimination round
  let mostCommonElimRound: number | null = null
  let maxElim = -1
  for (const [round, count] of Object.entries(elimCounts)) {
    if (count > maxElim) {
      maxElim = count
      mostCommonElimRound = Number(round)
    }
  }
  // If survived more than any single elim round, mostCommonElimRound = null (survival is most common)
  if (fullSurvivalCount > maxElim) {
    mostCommonElimRound = null
  }

  // Best path: picks sorted by their win probability (highest first)
  const bestPath = [...sortedPicks]
    .sort((a, b) => b.winPct - a.winPct)
    .map((p) => p.team)

  // EV vs pool: estimate based on average competitor using 50% win rate each round
  // Our EV = product of our win probs; Pool EV = 0.5^numRounds (random picks)
  const ourEV = sortedPicks.reduce((acc, p) => acc * (p.winPct / 100), 1)
  const poolEV = Math.pow(0.5, sortedPicks.length)
  const evVsPool = Math.round((ourEV / poolEV - 1) * 100 * 10) / 10 // % above average

  const result: SimulationResult = {
    survivalProbability,
    roundSurvivalRates,
    mostCommonElimRound,
    eliminationBreakdown,
    bestPath,
    evVsPool,
    simCount: SIMULATIONS,
  }

  return NextResponse.json(result)
}
