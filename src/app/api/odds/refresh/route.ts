/**
 * POST /api/odds/refresh
 *
 * Standalone endpoint to force a fresh fetch from The Odds API and update the cache.
 * After refreshing odds, automatically syncs games + runs the prediction engine.
 * Designed to be called by:
 *   - External cron services (Vercel Cron Jobs, GitHub Actions, cron-job.org, etc.)
 *   - Admin panel "Refresh Odds" button
 *
 * Security: Requires either:
 *   1. A valid admin session cookie (same as other admin routes), OR
 *   2. The CRON_SECRET header matching the CRON_SECRET env variable
 *      (for external cron callers that can't send cookies)
 *
 * GET /api/odds/refresh
 *   Returns cache status (age, count, staleness) without triggering a refresh.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import {
  refreshOddsCache,
  isCacheStale,
  getCacheAgeMinutes,
  getCachedOdds,
} from '@/lib/oddsCacheService'
import { syncOddsToGamesAndPredictions } from '@/lib/oddsSyncService'

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

  // Option 2: CRON_SECRET header (for external cron callers)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const header = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    if (header === cronSecret) return true
  }

  return false
}

// GET — cache status only (no refresh triggered)
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [stale, ageMinutes, rows] = await Promise.all([
    isCacheStale(),
    getCacheAgeMinutes(),
    getCachedOdds({ limit: 1 }), // just to check if any rows exist
  ])

  // Count per league
  const { data: leagueCounts } = await supabaseAdmin
    .from('cached_odds')
    .select('league')

  const byLeague: Record<string, number> = {}
  for (const row of leagueCounts ?? []) {
    byLeague[row.league] = (byLeague[row.league] ?? 0) + 1
  }

  // Prediction counts
  const { count: predCount } = await supabaseAdmin
    .from('predictions')
    .select('id', { count: 'exact', head: true })

  return NextResponse.json({
    status: {
      cacheEmpty: rows.length === 0,
      isStale: stale,
      cacheAgeMinutes: ageMinutes,
      nextRefreshInMinutes: ageMinutes !== null ? Math.max(0, 60 - ageMinutes) : 0,
      rowsByLeague: byLeague,
      totalRows: Object.values(byLeague).reduce((a, b) => a + b, 0),
      predictionsInDb: predCount ?? 0,
    },
  })
}

// POST — force refresh odds + sync games + run prediction engine
export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  const hasApiKey = !!(process.env.ODDS_API_KEY)

  try {
    // Step 1: Refresh odds cache from The Odds API
    const oddsResult = await refreshOddsCache()

    // Step 2: Sync cached_odds → games + run prediction engine
    let syncResult = null
    if (oddsResult.success) {
      try {
        syncResult = await syncOddsToGamesAndPredictions()
      } catch (syncErr) {
        const msg = syncErr instanceof Error ? syncErr.message : String(syncErr)
        console.error('[POST /api/odds/refresh] Sync error:', msg)
        syncResult = { error: msg }
      }
    }

    const durationMs = Date.now() - startMs

    return NextResponse.json({
      success: oddsResult.success,
      durationMs,
      hasApiKey,
      sportsAttempted: 7,
      oddsResult,
      syncResult,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/odds/refresh] Error:', msg)
    return NextResponse.json({ success: false, hasApiKey, error: msg }, { status: 500 })
  }
}
