/**
 * POST /api/cron/daily-full
 *
 * Unified daily cron — runs once at 2:00 AM EST (07:00 UTC).
 *
 * Designed for Vercel Hobby plan which only supports one daily cron job.
 * When upgrading to Vercel Pro, split this back into:
 *   - /api/cron/daily-rollover  (0 7 * * *)   — grading + closing lines
 *   - /api/cron/odds-refresh    (0 * * * *)   — hourly odds + predictions
 *
 * This endpoint is idempotent — safe to rerun manually from the admin panel
 * without duplicating picks or corrupting same-day slate data.
 *
 * Execution order:
 *   1. Grade any pending picks from the previous sports day (final scores)
 *   2. Capture closing lines for picks that started/finished
 *   3. Log previous-day model performance stats
 *   4. Fetch current sports day odds from The Odds API → cached_odds
 *   5. Sync cached_odds → games table
 *   6. Run prediction engine → predictions + prediction_cache + edges
 *   7. Replace official picks for today (max 5, idempotent, clears stale pending picks)
 *   8. Log run to engine_runs
 *
 * Security: Requires a valid admin session OR CRON_SECRET bearer token.
 * Vercel sends: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { refreshOddsCache, fetchAndUpdateGameScores } from '@/lib/oddsCacheService'
import { syncOddsToGamesAndPredictions } from '@/lib/oddsSyncService'
import {
  resolveOfficialPickResults,
  updateClosingLines,
  replaceOfficialPicksForDay,
} from '@/lib/officialPicksService'
import { getTodaySlateRange } from '@/lib/slateUtils'

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // Option 1: valid admin session
  const session = await getSession()
  if (session?.userId) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', session.userId)
      .single()
    if (data?.role === 'admin') return true
  }

  // Option 2: CRON_SECRET bearer token (Vercel Cron sends this automatically)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const header =
      req.headers.get('x-cron-secret') ??
      req.headers.get('authorization')?.replace('Bearer ', '')
    if (header === cronSecret) return true
  }

  return false
}

// ─── POST — main daily run ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runStart = Date.now()
  const runAt = new Date().toISOString()
  console.log('[cron/daily-full] Starting full daily run at', runAt)

  // ── Phase 1: Grade previous sports day ──────────────────────────────────────

  let closingLinesResult: { updated: number; errors: string[] } = { updated: 0, errors: [] }
  let scoresResult: { updated: number; errors: string[] } = { updated: 0, errors: [] }
  let gradingResult: { resolved: number; errors: string[] } = { resolved: 0, errors: [] }
  let previousDayStats: { wins: number; losses: number; pushes: number } | null = null

  try {
    // Capture closing lines for picks that approached/passed tipoff
    closingLinesResult = await updateClosingLines()
    console.log('[cron/daily-full] Closing lines updated:', closingLinesResult)
  } catch (err) {
    console.warn('[cron/daily-full] Closing lines error:', err)
    closingLinesResult = { updated: 0, errors: [String(err)] }
  }

  try {
    // Fetch final scores from The Odds API and mark completed games as 'final'
    // This must run before grading so resolveOfficialPickResults() finds completed games
    scoresResult = await fetchAndUpdateGameScores()
    console.log('[cron/daily-full] Game scores updated:', scoresResult)
  } catch (err) {
    console.warn('[cron/daily-full] Score fetch error:', err)
    scoresResult = { updated: 0, errors: [String(err)] }
  }

  try {
    // Grade any pending picks that now have final scores
    gradingResult = await resolveOfficialPickResults()
    console.log('[cron/daily-full] Picks graded:', gradingResult)
  } catch (err) {
    console.warn('[cron/daily-full] Grading error:', err)
    gradingResult = { resolved: 0, errors: [String(err)] }
  }

  try {
    // Compute all-time model performance stats
    const { data: resolvedPicks } = await supabaseAdmin
      .from('official_picks')
      .select('result')
      .in('result', ['win', 'loss', 'push'])

    if (resolvedPicks) {
      const wins = resolvedPicks.filter((p) => p.result === 'win').length
      const losses = resolvedPicks.filter((p) => p.result === 'loss').length
      const pushes = resolvedPicks.filter((p) => p.result === 'push').length
      previousDayStats = { wins, losses, pushes }
      console.log('[cron/daily-full] Model stats:', previousDayStats)
    }
  } catch (err) {
    console.warn('[cron/daily-full] Stats error:', err)
  }

  // ── Phase 2: Load current sports day ────────────────────────────────────────

  // Determine today's slate window (EST-based, 2 AM boundary)
  const { start: slateStart, end: slateEnd } = getTodaySlateRange()
  console.log('[cron/daily-full] Today slate:', slateStart, '→', slateEnd)

  // Step 2a: Fetch fresh odds from The Odds API → cached_odds table
  let oddsResult: Awaited<ReturnType<typeof refreshOddsCache>> | { success: false; error: string } = {
    success: false,
    error: 'Not attempted',
  }

  try {
    oddsResult = await refreshOddsCache()
    console.log('[cron/daily-full] Odds refreshed:', oddsResult.success)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/daily-full] Odds refresh error:', msg)
    oddsResult = { success: false, error: msg }
  }

  // Step 2b: Sync cached_odds → games + run prediction engine → prediction_cache
  let syncResult: Awaited<ReturnType<typeof syncOddsToGamesAndPredictions>> | { error: string } | null = null

  if (oddsResult.success) {
    try {
      syncResult = await syncOddsToGamesAndPredictions()
      console.log('[cron/daily-full] Sync + predictions done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[cron/daily-full] Sync error:', msg)
      syncResult = { error: msg }
    }
  } else {
    console.warn('[cron/daily-full] Skipping sync — odds refresh failed')
  }

  // Step 2c: Replace official picks for today's slate (idempotent, max 5)
  // This deletes any pending picks for the current slate window and reselects
  // the top 5 by edge_score. Already-graded picks are never touched.
  let picksResult: { inserted: number; skipped: number; errors: string[] } = {
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  if (oddsResult.success && syncResult && !('error' in syncResult)) {
    try {
      picksResult = await replaceOfficialPicksForDay(slateStart, slateEnd)
      console.log('[cron/daily-full] Official picks replaced:', picksResult)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[cron/daily-full] Picks error:', msg)
      picksResult = { inserted: 0, skipped: 0, errors: [msg] }
    }
  }

  // ── Phase 3: Log run ─────────────────────────────────────────────────────────

  const durationMs = Date.now() - runStart

  try {
    await supabaseAdmin.from('engine_runs').insert({
      run_at: runAt,
      trigger: 'cron_daily_full',
      duration_ms: durationMs,
      games_processed: syncResult && !('error' in syncResult)
        ? (syncResult as { gamesProcessed?: number }).gamesProcessed ?? 0
        : 0,
      predictions_generated: syncResult && !('error' in syncResult)
        ? (syncResult as { predictionsGenerated?: number }).predictionsGenerated ?? 0
        : 0,
      notes: JSON.stringify({
        slateStart,
        slateEnd,
        closingLines: closingLinesResult.updated,
        graded: gradingResult.resolved,
        picksInserted: picksResult.inserted,
        oddsSuccess: oddsResult.success,
      }),
    })
  } catch (logErr) {
    console.warn('[cron/daily-full] Failed to log to engine_runs:', logErr)
  }

  console.log('[cron/daily-full] Completed in', durationMs, 'ms')

  return NextResponse.json({
    success: true,
    durationMs,
    runAt,
    slateWindow: { slateStart, slateEnd },
    phase1_previousDay: {
      closingLines: closingLinesResult,
      scoresUpdated: scoresResult,
      grading: gradingResult,
      modelStats: previousDayStats,
    },
    phase2_currentDay: {
      odds: oddsResult,
      sync: syncResult,
      officialPicks: picksResult,
    },
  })
}

// ─── GET — health check ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Count pending picks for today's slate
  const { start: slateStart, end: slateEnd } = getTodaySlateRange()

  const { data: pendingRows } = await supabaseAdmin
    .from('official_picks')
    .select('id')
    .eq('result', 'pending')
    .gte('commence_time', slateStart)
    .lt('commence_time', slateEnd)

  const pendingCount = (pendingRows ?? []).length

  return NextResponse.json({
    endpoint: '/api/cron/daily-full',
    schedule: '0 7 * * *',
    description: [
      'Unified daily cron for Vercel Hobby plan (2 AM EST).',
      'Grades previous-day picks, fetches new odds, runs predictions,',
      'and replaces official picks for the current sports day.',
      'Split into /api/cron/daily-rollover + /api/cron/odds-refresh when upgrading to Vercel Pro.',
    ].join(' '),
    todaySlate: { slateStart, slateEnd },
    pendingPicksToday: pendingCount,
  })
}
