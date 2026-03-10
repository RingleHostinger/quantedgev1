/**
 * officialPicksService
 *
 * Selects the top 5 highest edge-score predictions each day and records
 * them as "official AI picks" in the official_picks table.
 *
 * Rules:
 * - Only runs after prediction_cache has been freshly populated
 * - Picks are never overwritten once inserted (historical record)
 * - One pick per game_id (UNIQUE constraint enforced via ON CONFLICT DO NOTHING)
 * - Only games with a future commence_time are eligible
 * - bet_type is determined by which edge is larger: spread or total
 * - pick_team is the AI-favoured team (model spread determines direction)
 */

import { supabaseAdmin } from '@/integrations/supabase/server'
import { spreadPickSide } from '@/lib/spreadPickUtils'
import { getTodaySlateRange } from '@/lib/slateUtils'

export interface OfficialPicksResult {
  inserted: number
  skipped: number
  errors: string[]
}

/**
 * Determine bet_type from the model spread and total edges.
 * Prefers spread bets when the spread_edge is larger or equal.
 */
function determineBetType(
  spreadEdge: number | null,
  totalEdge: number | null,
  modelSpread: number | null,
  modelTotal: number | null,
  sbTotal: number | null,
): { betType: string; modelLine: number | null; sbLine: number | null } {
  const absSpread = Math.abs(spreadEdge ?? 0)
  const absTotal = Math.abs(totalEdge ?? 0)

  if (absSpread >= absTotal) {
    return {
      betType: 'spread',
      modelLine: modelSpread,
      sbLine: null, // sportsbook_spread filled separately
    }
  }

  // Total bet: if model total > sportsbook total → OVER, else UNDER
  const me = totalEdge ?? 0
  return {
    betType: me >= 0 ? 'total_over' : 'total_under',
    modelLine: modelTotal,
    sbLine: sbTotal,
  }
}

/**
 * Determine which team the AI is recommending and the correct line from
 * that team's perspective.
 *
 * Delegates to spreadPickSide() for spread bets to ensure consistent logic
 * across all pages (Model Performance, Edges, Home Dashboard, Briefing).
 *
 * For total bets: pick_team is 'OVER' or 'UNDER'.
 */
function determinePickSide(
  betType: string,
  modelSpread: number | null,
  sbSpread: number | null,
  homeTeam: string,
  awayTeam: string,
): { pickTeam: string; pickLine: number | null } {
  if (betType === 'total_over') return { pickTeam: 'OVER', pickLine: null }
  if (betType === 'total_under') return { pickTeam: 'UNDER', pickLine: null }

  const pick = spreadPickSide(modelSpread, sbSpread, homeTeam, awayTeam)
  if (!pick) return { pickTeam: homeTeam, pickLine: sbSpread }

  // Return the line from the PICKED TEAM's perspective:
  //   home pick → sportsbook_spread as-is (e.g. -7.5)
  //   away pick → negated sportsbook_spread (e.g. +7.5)
  return { pickTeam: pick.team, pickLine: pick.line }
}

/**
 * Select and insert the top 5 official AI picks for today from prediction_cache.
 * Only inserts new picks — does not overwrite existing records.
 *
 * Uses the EST sports day window (2 AM ET → 2 AM ET next day) so picks only
 * come from the current day's slate — never from adjacent calendar dates.
 */
export async function selectAndInsertOfficialPicks(): Promise<OfficialPicksResult> {
  const errors: string[] = []
  let inserted = 0
  let skipped = 0

  // Use the current EST sports day window — NOT a rolling 2-hour cutoff.
  // This guarantees picks only come from today's slate regardless of when this runs.
  const { start: slateStart, end: slateEnd } = getTodaySlateRange()

  console.info(`[officialPicksService] Selecting picks for slate window: ${slateStart} → ${slateEnd}`)

  // Fetch top 10 from prediction_cache within the slate window
  // nubase drops .lt() upper bound when combined with .gte(), so query with .lt() only
  // and JS-filter for the lower bound (same pattern as filterToWindow in slateUtils).
  const { data: allRows, error } = await supabaseAdmin
    .from('prediction_cache')
    .select(`
      id, game_id, league, home_team, away_team, commence_time,
      sportsbook_spread, sportsbook_total,
      model_spread, model_total,
      spread_edge, total_edge,
      confidence_score, edge_score
    `)
    .lt('commence_time', slateEnd)
    .order('edge_score', { ascending: false })
    .limit(50) // fetch more since we JS-filter below

  // JS-filter lower bound (workaround for nubase .gte + .lt bug)
  const slateStartMs = new Date(slateStart).getTime()
  const rows = (allRows ?? []).filter(
    (r) => r.commence_time != null && new Date(r.commence_time).getTime() >= slateStartMs
  ).slice(0, 10)

  if (error || !rows) {
    return { inserted: 0, skipped: 0, errors: [`Failed to read prediction_cache: ${error?.message}`] }
  }

  // Filter: only games with abs(spread_edge) >= 1.5 qualify for official picks
  const qualified = rows.filter((r) => Math.abs(r.spread_edge ?? 0) >= 1.5)

  console.info(`[officialPicksService] Candidates from prediction_cache: ${rows.length}, qualified (edge>=1.5): ${qualified.length}`)

  // No strong edges today — skip inserts entirely
  if (qualified.length === 0) {
    console.info('[officialPicksService] No picks qualify — minimum edge threshold not met')
    return { inserted: 0, skipped: 0, errors: [] }
  }

  // Take top 5 from qualified games
  const top5 = qualified.slice(0, 5)

  for (const row of top5) {
    try {
      const { betType, modelLine } = determineBetType(
        row.spread_edge,
        row.total_edge,
        row.model_spread,
        row.model_total,
        row.sportsbook_total,
      )

      // Determine pick side — for spread bets, pickLine is from the picked team's perspective
      // (e.g. away pick on Clippers = +7.5, not the home-perspective -7.5)
      const { pickTeam, pickLine } = determinePickSide(betType, row.model_spread, row.sportsbook_spread, row.home_team, row.away_team)

      const sbLine = betType === 'spread'
        ? pickLine                  // picked team's perspective (e.g. +7.5 for away pick)
        : row.sportsbook_total

      const { error: insertError } = await supabaseAdmin
        .from('official_picks')
        .insert({
          game_id: row.game_id,
          league: row.league,
          home_team: row.home_team,
          away_team: row.away_team,
          pick_team: pickTeam,
          bet_type: betType,
          sportsbook_line: sbLine,  // from picked team's perspective for spread bets
          // line_at_pick captures the market line at the moment this pick was generated.
          // For spread bets this mirrors sportsbook_line (picked-team perspective).
          // For totals it's the sportsbook total. Used later to calculate CLV.
          line_at_pick: sbLine,
          model_line: modelLine ?? (betType === 'spread' ? row.model_spread : row.model_total),
          spread_edge: row.spread_edge,
          confidence_score: row.confidence_score,
          edge_score: row.edge_score,
          commence_time: row.commence_time,
          result: 'pending',
        })

      if (insertError) {
        // ON CONFLICT (game_id) — pick already recorded for this game
        if (insertError.code === '23505') {
          skipped++
        } else {
          errors.push(`game ${row.game_id}: ${insertError.message}`)
        }
      } else {
        inserted++
      }
    } catch (err) {
      errors.push(`game ${row.game_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { inserted, skipped, errors }
}

/**
 * Replace official picks for the current sports day.
 *
 * Unlike selectAndInsertOfficialPicks() (which skips on conflict), this function:
 *   1. Deletes any existing PENDING picks whose commence_time falls within [slateStart, slateEnd)
 *   2. Selects the new top-5 and inserts them fresh
 *
 * This makes the daily cron idempotent — safe to rerun without duplicating picks.
 * Already-graded picks (result != 'pending') are never touched.
 *
 * Max 5 picks enforced: only the top 5 by edge_score are inserted.
 */
export async function replaceOfficialPicksForDay(
  slateStart: string,
  slateEnd: string,
): Promise<OfficialPicksResult> {
  const errors: string[] = []

  // Step 1: Delete pending picks for this sports day (graded picks are preserved)
  const { error: deleteError } = await supabaseAdmin
    .from('official_picks')
    .delete()
    .eq('result', 'pending')
    .gte('commence_time', slateStart)
    .lt('commence_time', slateEnd)

  if (deleteError) {
    errors.push(`Failed to clear existing picks: ${deleteError.message}`)
    return { inserted: 0, skipped: 0, errors }
  }

  // Step 2: Fetch top candidates from prediction_cache within the slate window
  const { data: rows, error: fetchError } = await supabaseAdmin
    .from('prediction_cache')
    .select(`
      id, game_id, league, home_team, away_team, commence_time,
      sportsbook_spread, sportsbook_total,
      model_spread, model_total,
      spread_edge, total_edge,
      confidence_score, edge_score
    `)
    .gte('commence_time', slateStart)
    .lt('commence_time', slateEnd)
    .order('edge_score', { ascending: false })
    .limit(10)

  if (fetchError || !rows) {
    errors.push(`Failed to read prediction_cache: ${fetchError?.message}`)
    return { inserted: 0, skipped: 0, errors }
  }

  // Step 3: Filter for minimum edge quality, take top 5
  const qualified = rows.filter((r) => Math.abs(r.spread_edge ?? 0) >= 1.5)
  console.info(`[officialPicksService:replace] Slate window: ${slateStart} → ${slateEnd}. Candidates: ${rows.length}, qualified (edge>=1.5): ${qualified.length}`)
  if (qualified.length === 0) return { inserted: 0, skipped: 0, errors: [] }

  const top5 = qualified.slice(0, 5)
  let inserted = 0
  let skipped = 0

  for (const row of top5) {
    try {
      const { betType, modelLine } = determineBetType(
        row.spread_edge,
        row.total_edge,
        row.model_spread,
        row.model_total,
        row.sportsbook_total,
      )

      const { pickTeam, pickLine } = determinePickSide(
        betType,
        row.model_spread,
        row.sportsbook_spread,
        row.home_team,
        row.away_team,
      )

      const sbLine = betType === 'spread' ? pickLine : row.sportsbook_total

      const { error: insertError } = await supabaseAdmin
        .from('official_picks')
        .insert({
          game_id: row.game_id,
          league: row.league,
          home_team: row.home_team,
          away_team: row.away_team,
          pick_team: pickTeam,
          bet_type: betType,
          sportsbook_line: sbLine,
          line_at_pick: sbLine,
          model_line: modelLine ?? (betType === 'spread' ? row.model_spread : row.model_total),
          spread_edge: row.spread_edge,
          confidence_score: row.confidence_score,
          edge_score: row.edge_score,
          commence_time: row.commence_time,
          result: 'pending',
        })

      if (insertError) {
        if (insertError.code === '23505') {
          skipped++
        } else {
          errors.push(`game ${row.game_id}: ${insertError.message}`)
        }
      } else {
        inserted++
      }
    } catch (err) {
      errors.push(`game ${row.game_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { inserted, skipped, errors }
}

/**
 * Resolve results for finished games.
 * Called when game scores become available.
 *
 * Logic:
 * - Spread bet: pick_team wins if (pick_team_score - opp_score) > |sportsbook_line|
 * - Total over: home_score + away_score > sportsbook_line
 * - Total under: home_score + away_score < sportsbook_line
 * - Push: exactly on the line
 */
export async function resolveOfficialPickResults(): Promise<{ resolved: number; errors: string[] }> {
  const errors: string[] = []
  let resolved = 0

  // Find pending picks where the game has a result
  const { data: pendingPicks } = await supabaseAdmin
    .from('official_picks')
    .select('id, game_id, pick_team, bet_type, sportsbook_line, home_team, away_team')
    .eq('result', 'pending')

  if (!pendingPicks || pendingPicks.length === 0) return { resolved: 0, errors: [] }

  const gameIds = pendingPicks.map((p) => p.game_id)

  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id, actual_home_score, actual_away_score, status')
    .in('id', gameIds)
    .in('status', ['completed', 'final'])

  const gameMap: Record<string, { actual_home_score: number | null; actual_away_score: number | null }> = {}
  for (const g of games || []) {
    if (g.actual_home_score != null && g.actual_away_score != null) {
      gameMap[g.id] = g
    }
  }

  for (const pick of pendingPicks) {
    const game = gameMap[pick.game_id]
    if (!game) continue // no score yet

    try {
      const homeScore = game.actual_home_score!
      const awayScore = game.actual_away_score!
      const line = pick.sportsbook_line ?? 0
      let result: 'win' | 'loss' | 'push'

      if (pick.bet_type === 'spread') {
        // sportsbook_line is now stored from the PICKED TEAM's perspective:
        //   home pick:  line = sportsbook_spread as-is  (e.g. -7.5 means home gives 7.5)
        //   away pick:  line = -sportsbook_spread        (e.g. +7.5 means away gets 7.5)
        //
        // Cover formula: picked_team_score - opponent_score + line > 0
        //   Home pick example: home 110, away 100, line -7.5 → (110-100) + (-7.5) = +2.5 ✓ WIN
        //   Away pick example: away 106, home 110, line +7.5 → (106-110) + 7.5 = +3.5 ✓ WIN
        const isHomePick = pick.pick_team === pick.home_team
        const pickedScore = isHomePick ? homeScore : awayScore
        const oppScore = isHomePick ? awayScore : homeScore
        const margin = pickedScore - oppScore + line
        if (margin > 0) result = 'win'
        else if (margin < 0) result = 'loss'
        else result = 'push'
      } else if (pick.bet_type === 'total_over') {
        const total = homeScore + awayScore
        if (total > line) result = 'win'
        else if (total < line) result = 'loss'
        else result = 'push'
      } else if (pick.bet_type === 'total_under') {
        const total = homeScore + awayScore
        if (total < line) result = 'win'
        else if (total > line) result = 'loss'
        else result = 'push'
      } else {
        continue
      }

      await supabaseAdmin
        .from('official_picks')
        .update({
          result,
          actual_home_score: homeScore,
          actual_away_score: awayScore,
          result_recorded_at: new Date().toISOString(),
        })
        .eq('id', pick.id)

      resolved++
    } catch (err) {
      errors.push(`pick ${pick.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { resolved, errors }
}

/**
 * Update closing_line for picks that are pending and approaching tipoff (or past it).
 *
 * CLV = line_at_pick - closing_line
 * A positive CLV means the model got a better number than the closing market.
 *
 * Strategy:
 *   - Find pending picks whose commence_time is within the next 2 hours OR already started.
 *   - For each pick, read the current sportsbook_spread / sportsbook_total from
 *     prediction_cache (which is updated by the odds sync service).
 *   - Convert to picked-team perspective the same way line_at_pick was stored.
 *   - Write to closing_line if not already set.
 */
export async function updateClosingLines(): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = []
  let updated = 0

  const now = new Date()
  const windowStart = now.toISOString()                                      // past games
  const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString() // up to 2h ahead

  // Pending picks whose game is about to start or has started (closing line available)
  const { data: picks } = await supabaseAdmin
    .from('official_picks')
    .select('id, game_id, bet_type, pick_team, home_team, away_team, closing_line')
    .eq('result', 'pending')
    .lte('commence_time', windowEnd)
    .is('closing_line', null)   // only update if not already captured

  if (!picks || picks.length === 0) return { updated: 0, errors: [] }

  const gameIds = picks.map((p) => p.game_id)

  const { data: cacheRows } = await supabaseAdmin
    .from('prediction_cache')
    .select('game_id, sportsbook_spread, sportsbook_total')
    .in('game_id', gameIds)

  const cacheMap: Record<string, { sportsbook_spread: number | null; sportsbook_total: number | null }> = {}
  for (const r of cacheRows || []) {
    cacheMap[r.game_id] = r
  }

  for (const pick of picks) {
    const cache = cacheMap[pick.game_id]
    if (!cache) continue

    let closingLine: number | null = null

    if (pick.bet_type === 'spread') {
      const sbSpread = cache.sportsbook_spread
      if (sbSpread == null) continue
      // Convert to picked-team perspective (same logic as line_at_pick)
      const isHomePick = pick.pick_team === pick.home_team
      closingLine = isHomePick ? sbSpread : -sbSpread
    } else {
      closingLine = cache.sportsbook_total
    }

    if (closingLine == null) continue

    const { error } = await supabaseAdmin
      .from('official_picks')
      .update({ closing_line: closingLine })
      .eq('id', pick.id)

    if (error) {
      errors.push(`pick ${pick.id}: ${error.message}`)
    } else {
      updated++
    }
  }

  return { updated, errors }
}
