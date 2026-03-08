/**
 * POST /api/cron/daily-rollover
 *
 * Daily cron — runs once at 2:00 AM EST (07:00 UTC) via Vercel Cron.
 * Schedule: 0 7 * * *
 *
 * Responsibilities (daily at 2 AM EST):
 *   1. Fetch final scores for any overnight games that finished late
 *   2. Final grading pass — grade all picks with now-final scores
 *   3. Archive previous slate (getTodaySlateRange shifts automatically at 2 AM ET)
 *   4. Load new day's official picks from fresh prediction_cache
 *   5. Log run to engine_runs
 *
 * Note: Ongoing hourly odds refresh, CLV capture, score fetching, and pick grading
 * run via /api/cron/odds-refresh (0 * * * *). This job handles daily rollover only.
 *
 * Security: Requires either a valid admin session OR the CRON_SECRET header/bearer token.
 * Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { fetchAndUpdateGameScores } from '@/lib/oddsCacheService'
import {
  resolveOfficialPickResults,
  replaceOfficialPicksForDay,
} from '@/lib/officialPicksService'
import { getTodaySlateRange } from '@/lib/slateUtils'

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
  console.log('[daily-rollover] Starting daily rollover at', runAt)

  // ── Step 1: Fetch final scores for late-finishing games ───────────────────
  // Run before grading so picks from overnight games can be resolved.
  let scoresResult: { updated: number; errors: string[] } = { updated: 0, errors: [] }
  try {
    scoresResult = await fetchAndUpdateGameScores()
    console.log('[daily-rollover] Scores updated:', scoresResult)
  } catch (err) {
    console.warn('[daily-rollover] Score fetch error:', err)
    scoresResult = { updated: 0, errors: [String(err)] }
  }

  // ── Step 2: Final grading pass ─────────────────────────────────────────────
  // Grade all pending picks that now have final scores.
  let gradingResult: { resolved: number; errors: string[] } = { resolved: 0, errors: [] }
  try {
    gradingResult = await resolveOfficialPickResults()
    console.log('[daily-rollover] Picks graded:', gradingResult)
  } catch (err) {
    console.warn('[daily-rollover] Grading error:', err)
    gradingResult = { resolved: 0, errors: [String(err)] }
  }

  // ── Step 3 + 4: Load new day's official picks ─────────────────────────────
  // getTodaySlateRange() already reflects the new sports day (2 AM ET boundary
  // has just passed), so this correctly targets the new day's window.
  let picksResult: { inserted: number; skipped: number; errors: string[] } = {
    inserted: 0,
    skipped: 0,
    errors: [],
  }
  try {
    const { start, end } = getTodaySlateRange()
    picksResult = await replaceOfficialPicksForDay(start, end)
    console.log('[daily-rollover] New day picks loaded:', picksResult)
  } catch (err) {
    console.warn('[daily-rollover] Pick load error:', err)
    picksResult = { inserted: 0, skipped: 0, errors: [String(err)] }
  }

  // ── Step 5: Log run ────────────────────────────────────────────────────────
  const durationMs = Date.now() - startMs
  try {
    await supabaseAdmin.from('engine_runs').insert({
      run_at: runAt,
      trigger: 'cron_daily_rollover',
      duration_ms: durationMs,
      games_processed: scoresResult.updated,
      predictions_generated: picksResult.inserted,
      notes: JSON.stringify({
        scoresUpdated: scoresResult.updated,
        picksGraded: gradingResult.resolved,
        newPicksInserted: picksResult.inserted,
        newPicksSkipped: picksResult.skipped,
      }),
    })
  } catch (logErr) {
    console.warn('[daily-rollover] Failed to log to engine_runs:', logErr)
  }

  console.log('[daily-rollover] Completed in', durationMs, 'ms')

  return NextResponse.json({
    success: true,
    durationMs,
    runAt,
    scores: scoresResult,
    grading: gradingResult,
    picks: picksResult,
  })
}

// Vercel Cron Jobs send GET requests — this handler runs the full pipeline
// when called by the cron scheduler. Use ?status=1 to get info without running.
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

    const { start, end } = getTodaySlateRange()

    return NextResponse.json({
      endpoint: '/api/cron/daily-rollover',
      schedule: '0 7 * * *',
      description: [
        'Daily 2 AM EST: fetches overnight scores, grades pending picks,',
        'then loads fresh official picks for the new sports day.',
      ].join(' '),
      pendingPicksToGrade: (pendingPicks ?? []).length,
      currentSlate: { start, end },
    })
  }

  // No ?status param — run the full pipeline (Vercel cron calls GET)
  return POST(req)
}
