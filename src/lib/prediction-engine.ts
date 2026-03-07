/**
 * QuantEdge AI Prediction Engine  —  v1.0
 *
 * Core prediction model for NBA, NFL, MLB, NHL, NCAAB, EPL, UCL.
 *
 * Produces for each game:
 *   - AI predicted home/away scores
 *   - AI spread and total
 *   - Confidence score (0–100)
 *   - Spread edge and total edge vs sportsbook
 *   - Edge tier and confidence tier labels
 *   - AI reasoning text
 *   - Model inputs snapshot (for auditability)
 *
 * Architecture:
 *   fetchGameData()  →  buildModelInputs()  →  runModel()  →  generateInsight()
 *   →  PredictionOutput  →  stored in DB via upsertPrediction()
 *
 * Modular by design: swap runModel() or generateInsight() independently.
 */

import {
  NormalizedGameData,
  TeamStats,
  InjuryReport,
  SPORT_DEFAULTS,
  fetchGameData,
} from './sports-data-adapter'
import { supabaseAdmin } from '@/integrations/supabase/server'

export const ENGINE_VERSION = 'v1.0'

// ─── Output types ─────────────────────────────────────────────────────────

export interface ModelInputs {
  homeOffEff: number
  homeDefEff: number
  awayOffEff: number
  awayDefEff: number
  homePace: number
  awayPace: number
  homeFormScore: number       // 0–1 based on last 5
  awayFormScore: number
  homeAdvantage: number       // 0–1 scale
  injuryImpactHome: number    // summed impact scores for key injured players (home)
  injuryImpactAway: number
  h2hWinRateHome: number      // 0–1
  homeRestDays: number
  awayRestDays: number
  homeStrengthOfSchedule: number
  awayStrengthOfSchedule: number
  sbSpread: number | null
  sbTotal: number | null
  leagueAvgTotal: number
  spreadVariance: number
}

export interface PredictionOutput {
  gameId: string
  predictedHomeScore: number
  predictedAwayScore: number
  aiSpread: number            // negative = home favored
  aiTotal: number
  confidence: number          // 0–100
  homeWinProbability: number
  awayWinProbability: number
  drawProbability: number
  spreadEdge: number | null   // vs sportsbook
  totalEdge: number | null
  edgeTier: 'strong' | 'moderate' | 'lean' | 'none'
  confidenceTier: 'high' | 'medium' | 'low'
  aiReasoning: string
  isTrending: boolean
  isUpsetPick: boolean
  modelInputs: ModelInputs
}

// ─── Confidence tier thresholds ───────────────────────────────────────────

export function getConfidenceTier(confidence: number): PredictionOutput['confidenceTier'] {
  if (confidence >= 80) return 'high'
  if (confidence >= 65) return 'medium'
  return 'low'
}

export function getEdgeTier(spreadEdge: number | null, totalEdge: number | null): PredictionOutput['edgeTier'] {
  const maxEdge = Math.max(Math.abs(spreadEdge ?? 0), Math.abs(totalEdge ?? 0))
  if (maxEdge > 5) return 'strong'
  if (maxEdge >= 3) return 'moderate'
  if (maxEdge >= 1) return 'lean'
  return 'none'
}

// ─── Model input builder ──────────────────────────────────────────────────

function buildModelInputs(data: NormalizedGameData): ModelInputs {
  const { homeStats, awayStats, sbLine, injuries, h2h, league } = data
  const defaults = SPORT_DEFAULTS[league] || SPORT_DEFAULTS.NBA

  const homeFormScore = homeStats.last5Wins / Math.max(homeStats.last5Wins + homeStats.last5Losses, 1)
  const awayFormScore = awayStats.last5Wins / Math.max(awayStats.last5Wins + awayStats.last5Losses, 1)

  const injuryImpactHome = injuries
    .filter((i: InjuryReport) => i.teamName === data.homeTeam && i.status === 'Out')
    .reduce((sum: number, i: InjuryReport) => sum + i.impactScore, 0)
  const injuryImpactAway = injuries
    .filter((i: InjuryReport) => i.teamName === data.awayTeam && i.status === 'Out')
    .reduce((sum: number, i: InjuryReport) => sum + i.impactScore, 0)

  const totalH2H = (h2h?.teamAWins ?? 0) + (h2h?.teamBWins ?? 0) + (h2h?.draws ?? 0)
  const h2hWinRateHome = totalH2H > 0 ? (h2h?.teamAWins ?? 0) / totalH2H : 0.5

  return {
    homeOffEff: homeStats.offensiveEfficiency,
    homeDefEff: homeStats.defensiveEfficiency,
    awayOffEff: awayStats.offensiveEfficiency,
    awayDefEff: awayStats.defensiveEfficiency,
    homePace: homeStats.pace,
    awayPace: awayStats.pace,
    homeFormScore,
    awayFormScore,
    homeAdvantage: 0.03,  // ~3% base home advantage; adjustable per league
    injuryImpactHome,
    injuryImpactAway,
    h2hWinRateHome,
    homeRestDays: homeStats.restDays,
    awayRestDays: awayStats.restDays,
    homeStrengthOfSchedule: homeStats.strengthOfSchedule,
    awayStrengthOfSchedule: awayStats.strengthOfSchedule,
    sbSpread: sbLine?.spread ?? null,
    sbTotal: sbLine?.total ?? null,
    leagueAvgTotal: defaults.avgTotal,
    spreadVariance: defaults.spreadVariance,
  }
}

// ─── Core prediction model ────────────────────────────────────────────────
//
// Model approach:
//   Score = offEff × pace_factor × (1 - opp_defEff_factor) × form × injury × home_adj
//
// This is a linear efficiency model. In a production system this would be
// replaced with a trained ML model (XGBoost, neural net, etc.).

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function runModel(inputs: ModelInputs, league: string): {
  homeScore: number
  awayScore: number
  homeWinProb: number
  awayWinProb: number
  drawProb: number
  confidence: number
} {
  const defaults = SPORT_DEFAULTS[league] || SPORT_DEFAULTS.NBA
  const isSoccer = league === 'EPL' || league === 'UCL'

  // Normalize efficiencies relative to league avg
  const avgOff = defaults.avgTotal * 0.52
  const avgDef = defaults.avgTotal * 0.48

  const homeOffFactor = inputs.homeOffEff / avgOff
  const homeDefFactor = avgDef / Math.max(inputs.homeDefEff, 0.1)
  const awayOffFactor = inputs.awayOffEff / avgOff
  const awayDefFactor = avgDef / Math.max(inputs.awayDefEff, 0.1)

  // Pace factor — average of both teams' paces
  const avgLeaguePace = 100
  const paceFactor = ((inputs.homePace + inputs.awayPace) / 2) / avgLeaguePace

  // Form adjustment (0.9 to 1.1 multiplier)
  const homeFormAdj = 0.9 + inputs.homeFormScore * 0.2
  const awayFormAdj = 0.9 + inputs.awayFormScore * 0.2

  // Injury penalty (each impact point = ~0.5% score reduction)
  const homeInjuryAdj = Math.max(0.8, 1 - inputs.injuryImpactHome * 0.005)
  const awayInjuryAdj = Math.max(0.8, 1 - inputs.injuryImpactAway * 0.005)

  // H2H adjustment (±2%)
  const h2hHomeAdj = 1 + (inputs.h2hWinRateHome - 0.5) * 0.04

  // Rest advantage (extra rest day = +0.5%)
  const restAdj = (inputs.homeRestDays - inputs.awayRestDays) * 0.005

  // Home court advantage
  const homeAdj = 1 + inputs.homeAdvantage + restAdj

  // Score calculation
  let rawHomeScore = avgOff * homeOffFactor * homeDefFactor * paceFactor
    * homeFormAdj * homeInjuryAdj * h2hHomeAdj * homeAdj
  let rawAwayScore = avgOff * awayOffFactor * awayDefFactor * paceFactor
    * awayFormAdj * awayInjuryAdj * (1 / h2hHomeAdj) * (1 / homeAdj)

  // Soccer: scores are goals, not points — keep small
  if (isSoccer) {
    rawHomeScore = clamp(rawHomeScore, 0.3, 5.0)
    rawAwayScore = clamp(rawAwayScore, 0.3, 4.5)
  } else {
    // For points sports, scale to realistic range
    const scale = defaults.avgTotal / (rawHomeScore + rawAwayScore)
    rawHomeScore *= scale
    rawAwayScore *= scale
  }

  const homeScore = Math.round(rawHomeScore * 10) / 10
  const awayScore = Math.round(rawAwayScore * 10) / 10

  // Win probabilities — logistic based on score difference
  const scoreDiff = homeScore - awayScore
  const scale = isSoccer ? 0.8 : 0.045
  const homeWinProb = clamp(1 / (1 + Math.exp(-scoreDiff * scale)), 0.05, 0.95)
  const drawProb = isSoccer ? clamp(0.28 - Math.abs(scoreDiff) * 0.05, 0.05, 0.35) : 0
  const awayWinProb = clamp(1 - homeWinProb - drawProb, 0.05, 0.95)

  // Confidence calculation — factors that add certainty:
  let confidence = 50

  // Form clarity
  const formDiff = Math.abs(inputs.homeFormScore - inputs.awayFormScore)
  confidence += formDiff * 20

  // H2H clarity
  const h2hDiff = Math.abs(inputs.h2hWinRateHome - 0.5)
  confidence += h2hDiff * 15

  // Large score diff = more confident
  const normalizedDiff = Math.abs(scoreDiff) / (defaults.avgTotal * 0.15)
  confidence += Math.min(normalizedDiff * 10, 15)

  // Injury impact boosts confidence if opponent is hurt
  confidence += Math.min(inputs.injuryImpactAway * 0.5, 8)
  confidence -= Math.min(inputs.injuryImpactHome * 0.3, 5)

  // Rest advantage
  const restDiff = inputs.homeRestDays - inputs.awayRestDays
  confidence += clamp(restDiff * 1.5, -4, 4)

  // SOS confidence — if home team has harder schedule, slight discount
  if (inputs.homeStrengthOfSchedule > 0.6) confidence -= 3

  confidence = clamp(Math.round(confidence), 40, 96)

  return {
    homeScore,
    awayScore,
    homeWinProb: Math.round(homeWinProb * 1000) / 10,
    awayWinProb: Math.round(awayWinProb * 1000) / 10,
    drawProb: Math.round(drawProb * 1000) / 10,
    confidence,
  }
}

// ─── AI insight generator ─────────────────────────────────────────────────

function generateInsight(data: NormalizedGameData, inputs: ModelInputs, output: {
  homeScore: number; awayScore: number; homeWinProb: number; confidence: number
}): string {
  const { homeTeam, awayTeam, league } = data
  const isSoccer = league === 'EPL' || league === 'UCL'
  const parts: string[] = []

  // Form analysis
  const homeFormPct = Math.round(inputs.homeFormScore * 100)
  const awayFormPct = Math.round(inputs.awayFormScore * 100)
  if (homeFormPct >= 70) {
    parts.push(`${homeTeam} are in strong form, winning ${Math.round(inputs.homeFormScore * 5)} of their last 5.`)
  } else if (awayFormPct >= 70) {
    parts.push(`${awayTeam} arrive in top form with ${Math.round(inputs.awayFormScore * 5)} wins in their last 5 games.`)
  }

  // Efficiency edge
  if (inputs.homeOffEff > inputs.awayDefEff * 1.08) {
    parts.push(`${homeTeam}'s offensive efficiency is significantly above ${awayTeam}'s defensive rating — expect them to generate quality chances.`)
  } else if (inputs.awayOffEff > inputs.homeDefEff * 1.08) {
    parts.push(`${awayTeam} rank highly in offensive output and face a ${homeTeam} defense that has struggled with efficiency this season.`)
  }

  // Injury impact
  if (inputs.injuryImpactAway > 4) {
    parts.push(`${awayTeam} are dealing with significant injury absences (impact score: ${inputs.injuryImpactAway.toFixed(1)}) that weaken their key rotations.`)
  } else if (inputs.injuryImpactHome > 4) {
    parts.push(`${homeTeam} are hampered by injuries (impact score: ${inputs.injuryImpactHome.toFixed(1)}) which reduces their margin for error.`)
  }

  // Pace and totals insight
  const leagueDefaults = SPORT_DEFAULTS[league] || SPORT_DEFAULTS.NBA
  const projTotal = output.homeScore + output.awayScore
  if (!isSoccer) {
    if (projTotal > leagueDefaults.avgTotal * 1.05) {
      parts.push(`Both teams play at above-average pace, suggesting a higher-scoring ${isSoccer ? 'match' : 'game'}.`)
    } else if (projTotal < leagueDefaults.avgTotal * 0.95) {
      parts.push(`Defensive profiles for both sides point toward a slower-paced, lower-scoring affair.`)
    }
  }

  // H2H
  if (inputs.h2hWinRateHome > 0.65) {
    parts.push(`${homeTeam} hold a dominant head-to-head record against ${awayTeam}.`)
  } else if (inputs.h2hWinRateHome < 0.35) {
    parts.push(`Historically ${awayTeam} have the edge in head-to-head matchups with ${homeTeam}.`)
  }

  // Rest
  const restDiff = inputs.homeRestDays - inputs.awayRestDays
  if (restDiff >= 2) {
    parts.push(`${homeTeam} carry a ${restDiff}-day rest advantage.`)
  } else if (restDiff <= -2) {
    parts.push(`${awayTeam} are better rested, entering with ${Math.abs(restDiff)} additional days off.`)
  }

  // Confidence summary
  if (output.confidence >= 80) {
    parts.push(`Model confidence is high at ${output.confidence}% based on the weight of available factors.`)
  } else if (output.confidence < 65) {
    parts.push(`This is a close matchup — confidence is ${output.confidence}%, reflecting uncertainty across key variables.`)
  }

  // Edge vs sportsbook
  if (inputs.sbSpread != null) {
    const aiSpread = -(output.homeScore - output.awayScore)
    const edgeAbs = Math.abs(Math.abs(aiSpread) - Math.abs(inputs.sbSpread))
    if (edgeAbs >= 3) {
      parts.push(`The AI projects a larger margin than the current sportsbook line, flagging a potential ${edgeAbs.toFixed(1)}-point edge.`)
    }
  }

  return parts.length > 0
    ? parts.join(' ')
    : `AI model projects ${homeTeam} ${output.homeScore} – ${awayTeam} ${output.awayScore} with ${output.confidence}% confidence.`
}

// ─── Main prediction runner ───────────────────────────────────────────────

export function generatePrediction(data: NormalizedGameData): PredictionOutput {
  const inputs = buildModelInputs(data)
  const modelOut = runModel(inputs, data.league)

  const aiSpread = parseFloat((-(modelOut.homeScore - modelOut.awayScore)).toFixed(1))
  const aiTotal = parseFloat((modelOut.homeScore + modelOut.awayScore).toFixed(1))

  // Edge vs sportsbook
  const spreadEdge = inputs.sbSpread != null
    ? parseFloat((Math.abs(aiSpread) - Math.abs(inputs.sbSpread)).toFixed(1))
    : null
  const totalEdge = inputs.sbTotal != null
    ? parseFloat((aiTotal - inputs.sbTotal).toFixed(1))
    : null

  const edgeTier = getEdgeTier(spreadEdge, totalEdge)
  const confidenceTier = getConfidenceTier(modelOut.confidence)

  const isTrending = modelOut.homeWinProb > 75 || modelOut.awayWinProb > 75
  const isUpsetPick = inputs.sbSpread != null
    && Math.abs(inputs.sbSpread) > 10
    && Math.abs(aiSpread) < Math.abs(inputs.sbSpread) * 0.7

  const aiReasoning = generateInsight(data, inputs, {
    homeScore: modelOut.homeScore,
    awayScore: modelOut.awayScore,
    homeWinProb: modelOut.homeWinProb,
    confidence: modelOut.confidence,
  })

  return {
    gameId: data.gameId,
    predictedHomeScore: Math.round(modelOut.homeScore),
    predictedAwayScore: Math.round(modelOut.awayScore),
    aiSpread,
    aiTotal,
    confidence: modelOut.confidence,
    homeWinProbability: modelOut.homeWinProb,
    awayWinProbability: modelOut.awayWinProb,
    drawProbability: modelOut.drawProb,
    spreadEdge,
    totalEdge,
    edgeTier,
    confidenceTier,
    aiReasoning,
    isTrending,
    isUpsetPick,
    modelInputs: inputs,
  }
}

// ─── DB persistence ───────────────────────────────────────────────────────

export async function upsertPrediction(output: PredictionOutput): Promise<{ updated: boolean }> {
  // Check if a prediction already exists for this game
  const { data: existing } = await supabaseAdmin
    .from('predictions')
    .select('id')
    .eq('game_id', output.gameId)
    .single()

  const record = {
    game_id: output.gameId,
    predicted_home_score: output.predictedHomeScore,
    predicted_away_score: output.predictedAwayScore,
    ai_spread: output.aiSpread,
    ai_total: output.aiTotal,
    confidence: output.confidence,
    home_win_probability: output.homeWinProbability,
    away_win_probability: output.awayWinProbability,
    draw_probability: output.drawProbability,
    ai_reasoning: output.aiReasoning,
    spread_edge: output.spreadEdge,
    total_edge: output.totalEdge,
    edge_tier: output.edgeTier,
    confidence_tier: output.confidenceTier,
    is_trending: output.isTrending,
    is_upset_pick: output.isUpsetPick,
    engine_version: ENGINE_VERSION,
    model_inputs: output.modelInputs,
  }

  if (existing?.id) {
    await supabaseAdmin
      .from('predictions')
      .update(record)
      .eq('id', existing.id)
    return { updated: true }
  } else {
    await supabaseAdmin
      .from('predictions')
      .insert(record)
    return { updated: false }
  }
}

// ─── Batch engine run ─────────────────────────────────────────────────────

export interface EngineRunResult {
  gamesProcessed: number
  predictionsGenerated: number
  predictionsUpdated: number
  errors: { gameId: string; error: string }[]
  durationMs: number
  engineVersion: string
}

export async function runPredictionEngine(options?: {
  leagueFilter?: string
  forceRefresh?: boolean
}): Promise<EngineRunResult> {
  const startTime = Date.now()
  let generated = 0
  let updated = 0
  const errors: { gameId: string; error: string }[] = []

  // Fetch scheduled games (status = 'scheduled' or recent)
  let query = supabaseAdmin
    .from('games')
    .select('*')
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true })

  if (options?.leagueFilter) {
    query = query.eq('league', options.leagueFilter)
  }

  const { data: games, error: gamesError } = await query

  if (gamesError || !games) {
    return {
      gamesProcessed: 0,
      predictionsGenerated: 0,
      predictionsUpdated: 0,
      errors: [{ gameId: 'all', error: gamesError?.message || 'Failed to fetch games' }],
      durationMs: Date.now() - startTime,
      engineVersion: ENGINE_VERSION,
    }
  }

  // Skip games that already have fresh predictions unless forceRefresh
  const gamesToProcess = options?.forceRefresh
    ? games
    : games.filter((g) => {
        const engineRanAt = g.engine_run_at ? new Date(g.engine_run_at) : null
        if (!engineRanAt) return true
        const hoursSince = (Date.now() - engineRanAt.getTime()) / 3600000
        return hoursSince > 1 // Re-run if older than 1 hour
      })

  // Process each game
  for (const game of gamesToProcess) {
    try {
      const storedLine = {
        spread: game.sportsbook_spread ?? null,
        total: game.sportsbook_total ?? null,
        moneylineHome: game.sportsbook_moneyline_home ?? null,
        moneylineAway: game.sportsbook_moneyline_away ?? null,
      }

      const gameData = await fetchGameData(
        game.id,
        game.home_team_name,
        game.away_team_name,
        game.league || 'NBA',
        game.sport || 'Basketball',
        new Date(game.scheduled_at),
        storedLine,
      )

      const prediction = generatePrediction(gameData)
      const result = await upsertPrediction(prediction)

      if (result.updated) updated++
      else generated++

      // Mark game as engine-processed
      await supabaseAdmin
        .from('games')
        .update({ engine_run_at: new Date().toISOString() })
        .eq('id', game.id)
    } catch (err) {
      errors.push({
        gameId: game.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const durationMs = Date.now() - startTime

  // Log the run
  await supabaseAdmin.from('engine_runs').insert({
    run_at: new Date().toISOString(),
    games_processed: gamesToProcess.length,
    predictions_generated: generated,
    predictions_updated: updated,
    status: errors.length === 0 ? 'completed' : 'partial',
    error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : null,
    engine_version: ENGINE_VERSION,
    data_sources: { provider: 'MockProvider', real_api_connected: false },
  })

  return {
    gamesProcessed: gamesToProcess.length,
    predictionsGenerated: generated,
    predictionsUpdated: updated,
    errors,
    durationMs,
    engineVersion: ENGINE_VERSION,
  }
}
