import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { runPredictionEngine } from '@/lib/prediction-engine'

/**
 * POST /api/engine/run
 * Triggers a prediction engine run for scheduled games.
 * Admin only.
 *
 * Body (all optional):
 *   league       — run only for a specific league (NBA, NFL, etc.)
 *   forceRefresh — re-run predictions even if recently generated
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify admin role
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()

  if (userRow?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  let options: { leagueFilter?: string; forceRefresh?: boolean } = {}
  try {
    const body = await req.json()
    options = {
      leagueFilter: body.league || undefined,
      forceRefresh: body.forceRefresh || false,
    }
  } catch {
    // No body is fine
  }

  const result = await runPredictionEngine(options)

  return NextResponse.json({
    success: result.errors.length === 0,
    ...result,
  })
}

/**
 * GET /api/engine/run
 * Returns the latest engine run logs (last 10 runs).
 * Admin only.
 */
export async function GET() {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()

  if (userRow?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: runs } = await supabaseAdmin
    .from('engine_runs')
    .select('*')
    .order('run_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ runs: runs || [] })
}
