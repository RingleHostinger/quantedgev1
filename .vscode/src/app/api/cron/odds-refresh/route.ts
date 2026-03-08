/**
 * POST /api/cron/odds-refresh
 *
 * Hourly cron wrapper — calls the main odds refresh + sync pipeline.
 *
 * ⚠️  TEMPORARILY DISABLED (Vercel Hobby plan — only one daily cron allowed)
 *
 * To re-enable when upgrading to Vercel Pro:
 *   1. Add back to vercel.json:
 *        { "path": "/api/cron/odds-refresh", "schedule": "0 * * * *" }
 *   2. Remove /api/cron/daily-rollover from vercel.json if also re-adding that.
 *   3. Remove /api/cron/daily-full from vercel.json (it was the Hobby consolidation).
 *
 * This is a thin forwarder that:
 *   1. Fetches fresh odds from The Odds API
 *   2. Syncs cached_odds → games table
 *   3. Runs the prediction engine to update prediction_cache
 *
 * Security: Requires either a valid admin session OR the CRON_SECRET header/bearer token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { refreshOddsCache } from '@/lib/oddsCacheService'
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

  // Option 2: CRON_SECRET header (for Vercel Cron or external callers)
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
  console.log('[cron/odds-refresh] Starting hourly odds refresh at', new Date().toISOString())

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
        console.error('[cron/odds-refresh] Sync error:', msg)
        syncResult = { error: msg }
      }
    }

    const durationMs = Date.now() - startMs
    console.log('[cron/odds-refresh] Done in', durationMs, 'ms')

    return NextResponse.json({
      success: oddsResult.success,
      durationMs,
      oddsResult,
      syncResult,
      refreshedAt: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/odds-refresh] Error:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    endpoint: '/api/cron/odds-refresh',
    schedule: '0 * * * *',
    description: 'Refreshes odds from The Odds API + syncs predictions hourly',
  })
}
