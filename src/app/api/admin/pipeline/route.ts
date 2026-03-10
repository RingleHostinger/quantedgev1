/**
 * POST /api/admin/pipeline
 *
 * Manual admin controls for the full data pipeline.
 * Allows individual steps or the full daily cycle to be triggered without
 * waiting for Vercel Cron (useful during development and testing).
 *
 * Body: { action: string }
 *
 * Actions:
 *   'refresh_odds'         — fetch fresh odds from SportsDataIO + update cached_odds
 *   'refresh_scores'       — fetch final scores from SportsDataIO + update games table
 *   'run_predictions'      — run the prediction engine (sync cached_odds → prediction_cache)
 *   'recalculate_edges'    — re-run the sync that scores edges (same as run_predictions pipeline)
 *   'refresh_slate'        — no-op (slate filter is computed at query time from slateUtils)
 *   'grade_picks'          — resolve results for pending official picks with final scores
 *   'refresh_injuries'     — fetch injuries from SportsDataIO
 *   'refresh_betting_splits' — fetch public betting splits from SportsDataIO
 *   'refresh_schedules'    — fetch season schedules from SportsDataIO
 *   'full_cycle'           — runs all of the above in sequence
 *
 * TheOddsAPI: PAUSED — code retained but not called.
 *
 * GET /api/admin/pipeline
 *   Returns current pipeline status: last run times, pending picks count, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
// TheOddsAPI — PAUSED. Import retained for potential future restoration.
// import { refreshOddsCache } from '@/lib/oddsCacheService'
import { syncOddsToGamesAndPredictions } from '@/lib/oddsSyncService'
import {
  resolveOfficialPickResults,
  updateClosingLines,
  selectAndInsertOfficialPicks,
} from '@/lib/officialPicksService'
import { getTodaySlateGameIds, getTodaySlateRange, filterToWindow } from '@/lib/slateUtils'
import {
  cacheInjuries,
  cacheBettingSplits,
  cacheSchedules,
  isSdioConfigured,
  refreshOddsCacheFromSdio,
  updateGameScoresFromSdio,
} from '@/lib/sportsDataIOService'

async function verifyAdmin(): Promise<boolean> {
  const session = await getSession()
  if (!session?.userId) return false
  const { data } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()
  return data?.role === 'admin'
}

// ── Individual action handlers ──────────────────────────────────────────────

async function doRefreshOdds() {
  const start = Date.now()
  if (!isSdioConfigured()) {
    return { step: 'refresh_odds', success: false, durationMs: 0, error: 'SportsDataIO not configured (TheOddsAPI paused)' }
  }
  try {
    const result = await refreshOddsCacheFromSdio()
    return {
      step: 'refresh_odds',
      success: result.success,
      durationMs: Date.now() - start,
      detail: result,
    }
  } catch (err) {
    return { step: 'refresh_odds', success: false, durationMs: Date.now() - start, error: String(err) }
  }
}

async function doRefreshScores() {
  const start = Date.now()
  if (!isSdioConfigured()) {
    return { step: 'refresh_scores', success: false, durationMs: 0, error: 'SportsDataIO not configured' }
  }
  try {
    const result = await updateGameScoresFromSdio()
    return {
      step: 'refresh_scores',
      success: result.errors.length === 0,
      durationMs: Date.now() - start,
      detail: result,
    }
  } catch (err) {
    return { step: 'refresh_scores', success: false, durationMs: Date.now() - start, error: String(err) }
  }
}

async function doRunPredictions() {
  const start = Date.now()
  let result = null
  try {
    result = await syncOddsToGamesAndPredictions()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { step: 'run_predictions', success: false, durationMs: Date.now() - start, error: msg }
  }
  return { step: 'run_predictions', success: true, durationMs: Date.now() - start, detail: result }
}

async function doRecalculateEdges() {
  // Edge scores are part of the sync pipeline — re-running sync recalculates them
  const start = Date.now()
  let result = null
  try {
    result = await syncOddsToGamesAndPredictions()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { step: 'recalculate_edges', success: false, durationMs: Date.now() - start, error: msg }
  }
  return { step: 'recalculate_edges', success: true, durationMs: Date.now() - start, detail: result }
}

async function doRefreshSlate() {
  // Slate filtering is computed at query time — no DB action needed.
  // We return the current window so the admin can see what's active.
  // Uses getTodaySlateGameIds() which applies .lt(end) + JS-filter workaround for nubase.
  const { gameIds, slateStart, slateEnd, count } = await getTodaySlateGameIds()

  return {
    step: 'refresh_slate',
    success: true,
    durationMs: 0,
    detail: {
      slateStart,
      slateEnd,
      gamesInSlate: count,
      gameIds,
      note: 'Slate filter is applied at query time — no DB changes required.',
    },
  }
}

async function doGradePicks() {
  const start = Date.now()
  const closingResult = await updateClosingLines()
  const gradeResult = await resolveOfficialPickResults()

  // Compute updated win/loss totals
  const { data: allResolved } = await supabaseAdmin
    .from('official_picks')
    .select('result')
    .in('result', ['win', 'loss', 'push'])

  const wins = (allResolved ?? []).filter((p) => p.result === 'win').length
  const losses = (allResolved ?? []).filter((p) => p.result === 'loss').length
  const pushes = (allResolved ?? []).filter((p) => p.result === 'push').length

  return {
    step: 'grade_picks',
    success: gradeResult.errors.length === 0,
    durationMs: Date.now() - start,
    detail: {
      closingLinesUpdated: closingResult.updated,
      picksGraded: gradeResult.resolved,
      errors: gradeResult.errors,
      modelStats: { wins, losses, pushes },
    },
  }
}

async function doRefreshInjuries() {
  const start = Date.now()
  if (!isSdioConfigured()) {
    return { step: 'refresh_injuries', success: false, durationMs: 0, error: 'SportsDataIO not configured' }
  }
  try {
    const result = await cacheInjuries()
    return {
      step: 'refresh_injuries',
      success: result.errors.length === 0,
      durationMs: Date.now() - start,
      detail: { cached: result.cached, cachedAt: result.cachedAt, errors: result.errors },
    }
  } catch (err) {
    return { step: 'refresh_injuries', success: false, durationMs: Date.now() - start, error: String(err) }
  }
}

async function doRefreshBettingSplits() {
  const start = Date.now()
  if (!isSdioConfigured()) {
    return { step: 'refresh_betting_splits', success: false, durationMs: 0, error: 'SportsDataIO not configured' }
  }
  try {
    const result = await cacheBettingSplits()
    return {
      step: 'refresh_betting_splits',
      success: result.errors.length === 0,
      durationMs: Date.now() - start,
      detail: { cached: result.cached, cachedAt: result.cachedAt, errors: result.errors },
    }
  } catch (err) {
    return { step: 'refresh_betting_splits', success: false, durationMs: Date.now() - start, error: String(err) }
  }
}

async function doRefreshSchedules() {
  const start = Date.now()
  if (!isSdioConfigured()) {
    return { step: 'refresh_schedules', success: false, durationMs: 0, error: 'SportsDataIO not configured' }
  }
  try {
    const result = await cacheSchedules()
    return {
      step: 'refresh_schedules',
      success: result.errors.length === 0,
      durationMs: Date.now() - start,
      detail: { cached: result.cached, leagues: result.leagues, errors: result.errors },
    }
  } catch (err) {
    return { step: 'refresh_schedules', success: false, durationMs: Date.now() - start, error: String(err) }
  }
}

// ── Route handlers ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  let action = 'full_cycle'
  try {
    const body = await req.json()
    action = body.action ?? 'full_cycle'
  } catch { /* no body = full cycle */ }

  const totalStart = Date.now()

  try {
    if (action === 'refresh_odds') {
      const result = await doRefreshOdds()
      return NextResponse.json({ success: result.success, results: [result], totalDurationMs: Date.now() - totalStart })
    }

    if (action === 'refresh_scores') {
      const result = await doRefreshScores()
      return NextResponse.json({ success: result.success, results: [result], totalDurationMs: Date.now() - totalStart })
    }

    if (action === 'run_predictions') {
      const result = await doRunPredictions()
      return NextResponse.json({ success: result.success, results: [result], totalDurationMs: Date.now() - totalStart })
    }

    if (action === 'recalculate_edges') {
      const result = await doRecalculateEdges()
      return NextResponse.json({ success: result.success, results: [result], totalDurationMs: Date.now() - totalStart })
    }

    if (action === 'refresh_slate') {
      const result = await doRefreshSlate()
      return NextResponse.json({ success: true, results: [result], totalDurationMs: Date.now() - totalStart })
    }

    if (action === 'grade_picks') {
      const result = await doGradePicks()
      return NextResponse.json({ success: result.success, results: [result], totalDurationMs: Date.now() - totalStart })
    }

    if (action === 'select_picks') {
      const start = Date.now()
      const result = await selectAndInsertOfficialPicks()
      return NextResponse.json({
        success: result.errors.length === 0,
        results: [{ step: 'select_picks', ...result, durationMs: Date.now() - start }],
        totalDurationMs: Date.now() - totalStart,
      })
    }

    if (action === 'refresh_injuries') {
      const result = await doRefreshInjuries()
      return NextResponse.json({ success: result.success, results: [result], totalDurationMs: Date.now() - totalStart })
    }

    if (action === 'refresh_betting_splits') {
      const result = await doRefreshBettingSplits()
      return NextResponse.json({ success: result.success, results: [result], totalDurationMs: Date.now() - totalStart })
    }

    if (action === 'refresh_schedules') {
      const result = await doRefreshSchedules()
      return NextResponse.json({ success: result.success, results: [result], totalDurationMs: Date.now() - totalStart })
    }

    if (action === 'full_cycle') {
      // Run all steps in sequence
      const results = []

      const oddsResult = await doRefreshOdds()
      results.push(oddsResult)

      const scoresResult = await doRefreshScores()
      results.push(scoresResult)

      const predResult = await doRunPredictions()
      results.push(predResult)

      const slateResult = await doRefreshSlate()
      results.push(slateResult)

      const gradeResult = await doGradePicks()
      results.push(gradeResult)

      const injuriesResult = await doRefreshInjuries()
      results.push(injuriesResult)

      const splitsResult = await doRefreshBettingSplits()
      results.push(splitsResult)

      const schedulesResult = await doRefreshSchedules()
      results.push(schedulesResult)

      const anyFailed = results.some((r) => !r.success)
      return NextResponse.json({
        success: !anyFailed,
        results,
        totalDurationMs: Date.now() - totalStart,
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  // Fetch slate info and other data in parallel.
  // Uses lt-only + JS-filter to work around nubase .gte+.lt bug.
  const { start, end } = getTodaySlateRange()

  const [
    oddsResult,
    engineResult,
    pendingPicksResult,
    slateRows,
    allPicks,
    recentRuns,
  ] = await Promise.all([
    supabaseAdmin.from('cached_odds').select('last_updated, league').order('last_updated', { ascending: false }),
    supabaseAdmin.from('engine_runs').select('run_at, status, notes').order('run_at', { ascending: false }).limit(1).single(),
    supabaseAdmin.from('official_picks').select('id, league, result, commence_time').eq('result', 'pending'),
    supabaseAdmin.from('prediction_cache').select('game_id, league, commence_time').lt('commence_time', end).order('commence_time', { ascending: true }),
    supabaseAdmin.from('official_picks').select('result').in('result', ['win', 'loss', 'push']),
    supabaseAdmin.from('engine_runs').select('run_at, trigger, duration_ms, games_processed, notes').order('run_at', { ascending: false }).limit(5),
  ])

  const wins = (allPicks.data ?? []).filter((p) => p.result === 'win').length
  const losses = (allPicks.data ?? []).filter((p) => p.result === 'loss').length
  const pushes = (allPicks.data ?? []).filter((p) => p.result === 'push').length

  // Per-league slate counts (JS-filter for lower bound)
  const slateGames = filterToWindow(slateRows.data ?? [], 'commence_time', start)
  const slateByLeague: Record<string, number> = {}
  for (const g of slateGames) {
    const league = (g as Record<string, unknown>).league as string
    slateByLeague[league] = (slateByLeague[league] ?? 0) + 1
  }

  // Per-league cached_odds counts
  const oddsByLeague: Record<string, number> = {}
  for (const row of (oddsResult.data ?? [])) {
    const league = (row as Record<string, unknown>).league as string
    oddsByLeague[league] = (oddsByLeague[league] ?? 0) + 1
  }
  const lastOddsRefresh = (oddsResult.data ?? [])[0]?.last_updated ?? null

  return NextResponse.json({
    lastOddsRefresh,
    oddsByLeague,
    lastPredictionRun: engineResult.data?.run_at ?? null,
    lastEngineStatus: engineResult.data?.status ?? null,
    lastRunNotes: engineResult.data?.notes ?? null,
    slateStart: start,
    slateEnd: end,
    gamesInSlate: slateGames.length,
    slateByLeague,
    pendingPicksToGrade: (pendingPicksResult.data ?? []).length,
    modelStats: { wins, losses, pushes },
    recentRuns: recentRuns.data ?? [],
  })
}
