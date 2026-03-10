/**
 * POST /api/cron/odds-refresh
 *
 * Hourly cron — runs every hour at :00 via Vercel Cron.
 * Schedule: 0 * * * *
 *
 * Responsibilities (every hour):
 *   1. Capture closing line value (CLV) for picks near tip-off
 *   2. Refresh sportsbook odds via SportsDataIO → cached_odds   [CORE]
 *   3. Sync cached_odds → games + predictions + official picks   [CORE]
 *   4. Fetch final scores via SportsDataIO → games table         [CORE]
 *   5. Cache injuries + betting splits via SportsDataIO          [ENRICHMENT]
 *   6. Grade pending official picks with final scores            [CORE]
 *   7. Log run to engine_runs
 *
 * Data sources:
 *   - SportsDataIO → all steps (odds, scores, injuries, betting splits)
 *   - TheOddsAPI   → PAUSED (code retained; not called)
 *
 * Security: Requires either a valid admin session OR the CRON_SECRET header/bearer token.
 * Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
// TheOddsAPI — PAUSED. Imports retained for potential future restoration.
// import { refreshOddsCache, fetchAndUpdateGameScores } from '@/lib/oddsCacheService'
import { syncOddsToGamesAndPredictions } from '@/lib/oddsSyncService'
import { resolveOfficialPickResults, updateClosingLines } from '@/lib/officialPicksService'
import {
  cacheInjuries,
  cacheBettingSplits,
  isSdioConfigured,
  refreshOddsCacheFromSdio,
  updateGameScoresFromSdio,
} from '@/lib/sportsDataIOService'

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const session = await getSession()
  if (session?.userId) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', session.userId)
      .single()
    if (data?.role === 'admin') return true
  }

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const header =
      req.headers.get('x-cron-secret') ??
      req.headers.get('authorization')?.replace('Bearer ', '')
    if (header === cronSecret) return true
  }

  return false
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  const runAt = new Date().toISOString()
  console.log('[cron/odds-refresh] Starting hourly run at', runAt)

  // ── Step 1: Closing line value capture ───────────────────────────────────
  // Run first so CLV is recorded at the correct pre-game line before odds change.
  let clvResult: { updated: number; errors: string[] } = { updated: 0, errors: [] }
  try {
    clvResult = await updateClosingLines()
    console.log('[cron/odds-refresh] CLV captured:', clvResult)
  } catch (err) {
    console.warn('[cron/odds-refresh] CLV capture error:', err)
    clvResult = { updated: 0, errors: [String(err)] }
  }

  // ── Step 2: Refresh odds from SportsDataIO ───────────────────────────────
  // TheOddsAPI is PAUSED — refreshOddsCache() is not called.
  let oddsResult: Awaited<ReturnType<typeof refreshOddsCacheFromSdio>> | { success: false; error: string; errors?: string[] } = {
    success: false,
    error: 'Not attempted',
  }
  if (isSdioConfigured()) {
    try {
      oddsResult = await refreshOddsCacheFromSdio()
      if (oddsResult.success) {
        console.log('[cron/odds-refresh] SDIO odds refreshed — leagues:', (oddsResult as Awaited<ReturnType<typeof refreshOddsCacheFromSdio>>).leaguesRefreshed?.join(', '))
      } else {
        const errs = (oddsResult as { errors?: string[] }).errors ?? []
        console.warn('[cron/odds-refresh] SDIO odds refresh returned success=false. Errors:', errs.join(' | '))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[cron/odds-refresh] SDIO odds refresh threw:', msg)
      oddsResult = { success: false, error: msg }
    }
  } else {
    oddsResult = { success: false, error: 'SPORTSDATAIO_API_KEY not configured', errors: [] }
  }

  // ── Step 3: Sync odds → games + recalculate predictions ──────────────────
  // Always attempt sync even if odds refresh failed — the cache may still have
  // valid data from a previous successful run, and syncing it ensures predictions
  // and official picks stay up to date.
  let syncResult: Awaited<ReturnType<typeof syncOddsToGamesAndPredictions>> | { error: string } | null = null
  try {
    syncResult = await syncOddsToGamesAndPredictions()
    console.log('[cron/odds-refresh] Sync + predictions complete')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/odds-refresh] Sync error:', msg)
    syncResult = { error: msg }
  }

  // ── Step 4: Fetch final scores from SportsDataIO ─────────────────────────
  // TheOddsAPI fetchAndUpdateGameScores() is PAUSED — using SDIO equivalent.
  let scoresResult: { updated: number; errors: string[] } = { updated: 0, errors: [] }
  if (isSdioConfigured()) {
    try {
      scoresResult = await updateGameScoresFromSdio()
      console.log('[cron/odds-refresh] SDIO scores updated:', scoresResult)
    } catch (err) {
      console.warn('[cron/odds-refresh] SDIO score fetch error:', err)
      scoresResult = { updated: 0, errors: [String(err)] }
    }
  }

  // ── Step 5a: Cache injuries from SportsDataIO ─────────────────────────────
  let injuriesResult: { cached: number; errors: string[]; cachedAt: string } = { cached: 0, errors: [], cachedAt: '' }
  let splitsResult: { cached: number; errors: string[]; cachedAt: string } = { cached: 0, errors: [], cachedAt: '' }
  if (isSdioConfigured()) {
    try {
      [injuriesResult, splitsResult] = await Promise.all([
        cacheInjuries(),
        cacheBettingSplits(),
      ])
      console.log('[cron/odds-refresh] Injuries cached:', injuriesResult.cached, '| Splits cached:', splitsResult.cached)
    } catch (err) {
      console.warn('[cron/odds-refresh] Injury/splits cache error:', err)
    }
  }

  // ── Step 5: Grade pending official picks ──────────────────────────────────
  // Runs after score fetch so any newly-final games are immediately gradeable.
  let gradingResult: { resolved: number; errors: string[] } = { resolved: 0, errors: [] }
  try {
    gradingResult = await resolveOfficialPickResults()
    console.log('[cron/odds-refresh] Picks graded:', gradingResult)
  } catch (err) {
    console.warn('[cron/odds-refresh] Grading error:', err)
    gradingResult = { resolved: 0, errors: [String(err)] }
  }

  // ── Step 6: Log run ───────────────────────────────────────────────────────
  const durationMs = Date.now() - startMs
  try {
    await supabaseAdmin.from('engine_runs').insert({
      run_at: runAt,
      trigger: 'cron_hourly',
      duration_ms: durationMs,
      games_processed: syncResult && !('error' in syncResult)
        ? (syncResult as { gamesUpserted?: number }).gamesUpserted ?? 0
        : 0,
      predictions_generated: syncResult && !('error' in syncResult)
        ? (syncResult as { predictionsGenerated?: number }).predictionsGenerated ?? 0
        : 0,
      notes: JSON.stringify({
        clvCaptured: clvResult.updated,
        scoresUpdated: scoresResult.updated,
        picksGraded: gradingResult.resolved,
        oddsSuccess: oddsResult.success,
        oddsErrors: (oddsResult as { errors?: string[] }).errors?.slice(0, 3) ?? [],
        leaguesRefreshed: (oddsResult as { leaguesRefreshed?: string[] }).leaguesRefreshed ?? [],
        syncErrors: syncResult && 'error' in syncResult ? [(syncResult as { error: string }).error] : [],
        injuriesCached: injuriesResult.cached,
        splitsCached: splitsResult.cached,
      }),
    })
  } catch (logErr) {
    console.warn('[cron/odds-refresh] Failed to log to engine_runs:', logErr)
  }

  console.log('[cron/odds-refresh] Completed in', durationMs, 'ms')

  return NextResponse.json({
    success: true,
    durationMs,
    runAt,
    clv: clvResult,
    odds: oddsResult,
    sync: syncResult,
    scores: scoresResult,
    grading: gradingResult,
  })
}

// Vercel Cron Jobs send GET requests — this handler runs the full pipeline
// when called by the cron scheduler, and also accepts a ?status=1 query
// param to return status info without running the pipeline (for monitoring).
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ?status=1 → return info without running the pipeline
  if (req.nextUrl.searchParams.get('status')) {
    const { data: pendingPicks } = await supabaseAdmin
      .from('official_picks')
      .select('id')
      .eq('result', 'pending')

    return NextResponse.json({
      endpoint: '/api/cron/odds-refresh',
      schedule: '0 * * * *',
      description: [
        'Hourly run: refreshes odds, recalculates predictions, captures CLV,',
        'fetches final scores, and grades any newly-completed official picks.',
      ].join(' '),
      pendingPicksToGrade: (pendingPicks ?? []).length,
    })
  }

  // No ?status param — run the full pipeline (Vercel cron calls GET)
  return POST(req)
}
