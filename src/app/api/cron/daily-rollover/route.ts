/**
 * POST /api/cron/daily-rollover
 *
 * Runs once per day at 2:00 AM EST (07:00 UTC) via Vercel Cron.
 *
 * ⚠️  TEMPORARILY DISABLED (Vercel Hobby plan — only one daily cron allowed)
 *
 * To re-enable when upgrading to Vercel Pro:
 *   1. Add back to vercel.json:
 *        { "path": "/api/cron/daily-rollover", "schedule": "0 7 * * *" }
 *   2. Also re-add /api/cron/odds-refresh for hourly refreshes.
 *   3. Remove /api/cron/daily-full from vercel.json (it was the Hobby consolidation).
 *
 * Steps performed:
 *   1. Grade all pending official picks whose games have a final score.
 *   2. Update closing lines for picks nearing game time.
 *   3. Log the rollover in engine_runs (so the data freshness indicator knows).
 *
 * After this runs, the slate filter in getTodaySlateRange() automatically
 * shifts the active window to the new day — no additional DB changes needed.
 *
 * Security: Requires either a valid admin session OR the CRON_SECRET header/bearer token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import {
  resolveOfficialPickResults,
  updateClosingLines,
} from '@/lib/officialPicksService'

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
  console.log('[daily-rollover] Starting daily rollover at', new Date().toISOString())

  // Step 1: Capture closing lines for picks approaching game time
  const closingResult = await updateClosingLines()
  console.log('[daily-rollover] Closing lines updated:', closingResult)

  // Step 2: Grade all pending official picks that have final scores
  const gradeResult = await resolveOfficialPickResults()
  console.log('[daily-rollover] Picks graded:', gradeResult)

  // Step 3: Update model performance stats (win/loss totals)
  let statsResult: { wins: number; losses: number; pushes: number } | null = null
  try {
    const { data: resolvedPicks } = await supabaseAdmin
      .from('official_picks')
      .select('result')
      .in('result', ['win', 'loss', 'push'])

    if (resolvedPicks) {
      const wins = resolvedPicks.filter((p) => p.result === 'win').length
      const losses = resolvedPicks.filter((p) => p.result === 'loss').length
      const pushes = resolvedPicks.filter((p) => p.result === 'push').length
      statsResult = { wins, losses, pushes }
      console.log('[daily-rollover] Model performance stats:', statsResult)
    }
  } catch (err) {
    console.warn('[daily-rollover] Could not compute stats:', err)
  }

  const durationMs = Date.now() - startMs

  return NextResponse.json({
    success: true,
    durationMs,
    closingLines: closingResult,
    grading: gradeResult,
    modelStats: statsResult,
    rolledOverAt: new Date().toISOString(),
  })
}

// Vercel Cron also uses GET for health checks — return status
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: pendingRows } = await supabaseAdmin
    .from('official_picks')
    .select('id')
    .eq('result', 'pending')
  const pendingCount = (pendingRows ?? []).length

  return NextResponse.json({
    endpoint: '/api/cron/daily-rollover',
    schedule: '0 7 * * *',
    description: 'Grades yesterday picks and rolls slate to new day (2 AM EST)',
    pendingPicksToGrade: pendingCount,
  })
}
