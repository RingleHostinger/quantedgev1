/**
 * oddsSyncService
 *
 * Syncs live cached_odds → games table, then runs the prediction engine.
 *
 * Flow:
 *   cached_odds (from The Odds API)
 *     → upsert into games (keyed by odds_game_id)
 *     → runPredictionEngine() generates predictions for each game
 *
 * Called automatically after every odds cache refresh.
 */

import { supabaseAdmin } from '@/integrations/supabase/server'
import { generatePrediction, upsertPrediction, getEdgeTier, getConfidenceTier, ENGINE_VERSION } from './prediction-engine'
import { fetchGameData } from './sports-data-adapter'
import { selectAndInsertOfficialPicks, updateClosingLines } from './officialPicksService'

// Map league labels → sport labels (for games.sport column)
const LEAGUE_TO_SPORT: Record<string, string> = {
  NBA:   'Basketball',
  NCAAB: 'Basketball',
  NFL:   'American Football',
  MLB:   'Baseball',
  NHL:   'Hockey',
  EPL:   'Soccer',
  UCL:   'Soccer',
}

export interface SyncResult {
  gamesUpserted: number
  predictionsGenerated: number
  predictionsUpdated: number
  errors: string[]
  durationMs: number
}

/**
 * Calculates implied win probability from American odds.
 * Favorite: -ML odds  → prob = |ML| / (|ML| + 100)
 * Underdog: +ML odds  → prob = 100 / (ML + 100)
 */
export function impliedProbFromMoneyline(ml: number | null): number | null {
  if (ml == null) return null
  if (ml < 0) return Math.abs(ml) / (Math.abs(ml) + 100)
  return 100 / (ml + 100)
}

/**
 * Pick which game from cached_odds to use for each unique game_id.
 * We prefer the row with the most complete data (spread + total + moneylines).
 */
function pickBestRow(rows: Record<string, unknown>[]): Record<string, unknown> {
  return rows.reduce((best, row) => {
    const bestScore = [best.spread, best.total, best.moneyline_home, best.moneyline_away]
      .filter((v) => v != null).length
    const rowScore = [row.spread, row.total, row.moneyline_home, row.moneyline_away]
      .filter((v) => v != null).length
    return rowScore > bestScore ? row : best
  })
}

/**
 * Main sync function.
 * 1. Reads all rows from cached_odds.
 * 2. Groups by game_id and picks the best bookmaker row.
 * 3. Upserts into games table.
 * 4. Runs prediction engine for each upserted game.
 */
export async function syncOddsToGamesAndPredictions(): Promise<SyncResult> {
  const startMs = Date.now()
  const errors: string[] = []
  let gamesUpserted = 0
  let predictionsGenerated = 0
  let predictionsUpdated = 0

  // Step 1: Fetch all cached odds
  const { data: oddsRows, error: oddsError } = await supabaseAdmin
    .from('cached_odds')
    .select('*')
    .order('last_updated', { ascending: false })

  if (oddsError || !oddsRows) {
    return {
      gamesUpserted: 0,
      predictionsGenerated: 0,
      predictionsUpdated: 0,
      errors: [`Failed to read cached_odds: ${oddsError?.message}`],
      durationMs: Date.now() - startMs,
    }
  }

  // Step 2: Group by game_id
  const byGameId = new Map<string, Record<string, unknown>[]>()
  for (const row of oddsRows as Record<string, unknown>[]) {
    const gid = row.game_id as string
    if (!byGameId.has(gid)) byGameId.set(gid, [])
    byGameId.get(gid)!.push(row)
  }

  // Step 3: Build game rows to upsert
  const gameRows: Record<string, unknown>[] = []
  for (const [gameId, rows] of byGameId) {
    const best = pickBestRow(rows)
    const league = (best.league as string) || 'NBA'
    const sport = LEAGUE_TO_SPORT[league] || 'Basketball'

    gameRows.push({
      odds_game_id:            gameId,
      home_team_name:          best.home_team as string,
      away_team_name:          best.away_team as string,
      sport,
      league,
      scheduled_at:            best.commence_time as string,
      status:                  'scheduled',
      sportsbook_spread:       best.spread ?? null,
      sportsbook_total:        best.total ?? null,
      sportsbook_moneyline_home: best.moneyline_home ?? null,
      sportsbook_moneyline_away: best.moneyline_away ?? null,
    })
  }

  if (!gameRows.length) {
    return {
      gamesUpserted: 0,
      predictionsGenerated: 0,
      predictionsUpdated: 0,
      errors: ['No odds rows to sync'],
      durationMs: Date.now() - startMs,
    }
  }

  // Step 4: Upsert games (conflict on odds_game_id)
  const { error: upsertError } = await supabaseAdmin
    .from('games')
    .upsert(gameRows, { onConflict: 'odds_game_id' })

  if (upsertError) {
    return {
      gamesUpserted: 0,
      predictionsGenerated: 0,
      predictionsUpdated: 0,
      errors: [`games upsert failed: ${upsertError.message}`],
      durationMs: Date.now() - startMs,
    }
  }
  gamesUpserted = gameRows.length

  // Step 5: Fetch the freshly-upserted games (to get DB-assigned UUIDs)
  const oddsGameIds = gameRows.map((r) => r.odds_game_id as string)
  const { data: freshGames, error: fetchError } = await supabaseAdmin
    .from('games')
    .select('id, odds_game_id, home_team_name, away_team_name, league, sport, scheduled_at, sportsbook_spread, sportsbook_total, sportsbook_moneyline_home, sportsbook_moneyline_away, engine_run_at')
    .in('odds_game_id', oddsGameIds)

  if (fetchError || !freshGames) {
    errors.push(`Could not re-fetch games after upsert: ${fetchError?.message}`)
    return { gamesUpserted, predictionsGenerated, predictionsUpdated, errors, durationMs: Date.now() - startMs }
  }

  // Step 6: Run prediction engine for each game
  for (const game of freshGames) {
    try {
      const storedLine = {
        spread:        game.sportsbook_spread   ?? null,
        total:         game.sportsbook_total    ?? null,
        moneylineHome: game.sportsbook_moneyline_home ?? null,
        moneylineAway: game.sportsbook_moneyline_away ?? null,
      }

      // Build model inputs via the data adapter (uses sportsbook line from DB)
      const gameData = await fetchGameData(
        game.id,
        game.home_team_name,
        game.away_team_name,
        game.league || 'NBA',
        game.sport || 'Basketball',
        new Date(game.scheduled_at),
        storedLine,
      )

      // Calculate implied win probabilities from live moneylines
      const mlHome = game.sportsbook_moneyline_home
      const mlAway = game.sportsbook_moneyline_away
      const impliedHome = impliedProbFromMoneyline(mlHome)
      const impliedAway = impliedProbFromMoneyline(mlAway)

      // Generate AI prediction
      const prediction = generatePrediction(gameData)

      // When a sportsbook total exists, rescale AI scores so the total is anchored
      // near the sportsbook line. This prevents large total edges from being model
      // scale artifacts (e.g. NCAAB model always outputs 145 while book says 165).
      // We preserve the AI home/away ratio (spread direction) but rescale the total
      // to be within ±8 of the sportsbook total using the AI's score ratio as signal.
      const sbTotal = game.sportsbook_total
      if (sbTotal != null && prediction.aiTotal > 0) {
        const ratio = prediction.predictedHomeScore / (prediction.predictedHomeScore + prediction.predictedAwayScore)
        // AI total adjustment: ±8 max, driven by model efficiency signals
        const modelRatio = prediction.aiTotal / (storedLine.total ?? prediction.aiTotal)
        const aiAdjustment = Math.max(-8, Math.min(8, (modelRatio - 1) * sbTotal))
        const anchoredTotal = Math.round((sbTotal + aiAdjustment) * 10) / 10
        prediction.predictedHomeScore = Math.round(anchoredTotal * ratio)
        prediction.predictedAwayScore = Math.round(anchoredTotal * (1 - ratio))
        prediction.aiTotal = parseFloat(anchoredTotal.toFixed(1))
        prediction.totalEdge = parseFloat((anchoredTotal - sbTotal).toFixed(1))
      }

      // When a sportsbook spread exists, anchor AI spread to be within ±6 of the book.
      // This prevents the model's spread from being wildly off from the market.
      const sbSpread = game.sportsbook_spread
      if (sbSpread != null) {
        const rawSpread = prediction.aiSpread
        const maxDeviation = 6
        const clampedSpread = Math.max(
          sbSpread - maxDeviation,
          Math.min(sbSpread + maxDeviation, rawSpread)
        )
        prediction.aiSpread = parseFloat(clampedSpread.toFixed(1))
        prediction.spreadEdge = parseFloat((Math.abs(prediction.aiSpread) - Math.abs(sbSpread)).toFixed(1))
      }

      // Blend AI win probabilities with moneyline-implied probs (50/50 weight)
      if (impliedHome != null && impliedAway != null) {
        const totalImplied = impliedHome + impliedAway
        // Normalize implied probs (remove vig)
        const normalHome = impliedHome / totalImplied
        const normalAway = impliedAway / totalImplied
        prediction.homeWinProbability = Math.round(
          (prediction.homeWinProbability * 0.5 + normalHome * 100 * 0.5) * 10
        ) / 10
        prediction.awayWinProbability = Math.round(
          (prediction.awayWinProbability * 0.5 + normalAway * 100 * 0.5) * 10
        ) / 10
      }

      // Recalculate edge tiers with calibrated edges
      prediction.edgeTier = getEdgeTier(prediction.spreadEdge, prediction.totalEdge)
      prediction.confidenceTier = getConfidenceTier(prediction.confidence)

      const result = await upsertPrediction(prediction)
      if (result.updated) predictionsUpdated++
      else predictionsGenerated++

      // Populate prediction_cache with full edge + moneyline edge data
      await upsertPredictionCache({
        gameId: game.id,
        league: game.league || 'NBA',
        homeTeam: game.home_team_name,
        awayTeam: game.away_team_name,
        commenceTime: game.scheduled_at,
        sbSpread: storedLine.spread,
        sbTotal: storedLine.total,
        moneylineHome: storedLine.moneylineHome,
        moneylineAway: storedLine.moneylineAway,
        modelSpread: prediction.aiSpread,
        modelTotal: prediction.aiTotal,
        spreadEdge: prediction.spreadEdge,
        totalEdge: prediction.totalEdge,
        modelProbHome: prediction.homeWinProbability,
        modelProbAway: prediction.awayWinProbability,
        impliedHome,
        impliedAway,
        confidence: prediction.confidence,
      })

      // Mark game as engine-processed
      await supabaseAdmin
        .from('games')
        .update({ engine_run_at: new Date().toISOString() })
        .eq('id', game.id)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`game ${game.id} (${game.home_team_name} vs ${game.away_team_name}): ${msg}`)
    }
  }

  // Step 7: Select top 5 official AI picks for the day
  try {
    await selectAndInsertOfficialPicks()
  } catch {
    // Non-critical — picks selected on next refresh if this fails
  }

  // Step 7b: Capture closing lines for picks whose games are approaching tipoff.
  // CLV = line_at_pick - closing_line. Runs silently — never blocks the pipeline.
  try {
    await updateClosingLines()
  } catch {
    // Non-critical
  }

  // Step 8: Log to engine_runs
  try {
    await supabaseAdmin.from('engine_runs').insert({
      run_at: new Date().toISOString(),
      games_processed: freshGames.length,
      predictions_generated: predictionsGenerated,
      predictions_updated: predictionsUpdated,
      status: errors.length === 0 ? 'completed' : 'partial',
      error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : null,
      engine_version: ENGINE_VERSION,
      data_sources: { provider: 'TheOddsAPI', real_api_connected: true },
    })
  } catch {
    // Log failure is non-critical
  }

  return {
    gamesUpserted,
    predictionsGenerated,
    predictionsUpdated,
    errors,
    durationMs: Date.now() - startMs,
  }
}

// ─── Prediction Cache upsert ──────────────────────────────────────────────

interface PredictionCacheInput {
  gameId: string
  league: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  sbSpread: number | null
  sbTotal: number | null
  moneylineHome: number | null
  moneylineAway: number | null
  modelSpread: number
  modelTotal: number
  spreadEdge: number | null
  totalEdge: number | null
  modelProbHome: number   // 0–100 scale
  modelProbAway: number   // 0–100 scale
  impliedHome: number | null  // raw (with vig), 0–1 scale
  impliedAway: number | null
  confidence: number
}

/**
 * Upserts a row into prediction_cache with all computed edge fields.
 *
 * - implied_prob_home/away: vig-removed implied probabilities from moneylines
 * - moneyline_edge_home/away: model_prob minus implied_prob (positive = model
 *   thinks team is better than market implies)
 * - upset_flag: true when the away team (underdog) has moneyline_edge > 0.05
 * - edge_score: abs(spread_edge) × confidence (ranking score)
 */
async function upsertPredictionCache(input: PredictionCacheInput): Promise<void> {
  const {
    gameId, league, homeTeam, awayTeam, commenceTime,
    sbSpread, sbTotal, moneylineHome, moneylineAway,
    modelSpread, modelTotal, spreadEdge, totalEdge,
    modelProbHome, modelProbAway,
    impliedHome, impliedAway, confidence,
  } = input

  // Vig-removed implied probs (0–1 scale)
  let impliedProbHome: number | null = null
  let impliedProbAway: number | null = null
  if (impliedHome != null && impliedAway != null) {
    const totalRaw = impliedHome + impliedAway
    impliedProbHome = parseFloat((impliedHome / totalRaw).toFixed(4))
    impliedProbAway = parseFloat((impliedAway / totalRaw).toFixed(4))
  }

  // Moneyline edges: model_prob (0–1 scale) minus implied_prob
  const modelProbHomeDecimal = modelProbHome / 100
  const modelProbAwayDecimal = modelProbAway / 100
  const moneylineEdgeHome = impliedProbHome != null
    ? parseFloat((modelProbHomeDecimal - impliedProbHome).toFixed(4))
    : null
  const moneylineEdgeAway = impliedProbAway != null
    ? parseFloat((modelProbAwayDecimal - impliedProbAway).toFixed(4))
    : null

  // Upset flag: away underdog has moneyline edge > 5%
  const upsetFlag = moneylineEdgeAway != null && moneylineEdgeAway > 0.05

  // Edge score for ranking: |spread_edge| × confidence
  const absSpreadEdge = Math.abs(spreadEdge ?? 0)
  const edgeScore = parseFloat((absSpreadEdge * confidence).toFixed(2))

  await supabaseAdmin
    .from('prediction_cache')
    .upsert(
      {
        game_id: gameId,
        league,
        home_team: homeTeam,
        away_team: awayTeam,
        commence_time: commenceTime,
        sportsbook_spread: sbSpread,
        sportsbook_total: sbTotal,
        moneyline_home: moneylineHome,
        moneyline_away: moneylineAway,
        model_spread: modelSpread,
        model_total: modelTotal,
        spread_edge: spreadEdge,
        total_edge: totalEdge,
        model_prob_home: parseFloat(modelProbHome.toFixed(2)),
        model_prob_away: parseFloat(modelProbAway.toFixed(2)),
        implied_prob_home: impliedProbHome,
        implied_prob_away: impliedProbAway,
        moneyline_edge_home: moneylineEdgeHome,
        moneyline_edge_away: moneylineEdgeAway,
        confidence_score: confidence,
        edge_score: edgeScore,
        upset_flag: upsetFlag,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'game_id' }
    )
}
