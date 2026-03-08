/**
 * GET /api/admin/picks
 *
 * List official picks for admin grading panel.
 * Admin only.
 *
 * Query params:
 *   status  = 'pending' | 'settled' | 'all'  (default: 'pending')
 *   league  = league filter (optional)
 *   scope   = 'today' | 'all-time'  (default: 'today' for pending, 'all-time' for settled/all)
 *
 * When status = 'pending':
 *   - By default only returns picks for the ACTIVE sports day (EST 2 AM boundary)
 *   - Enforces the 5-pick-per-day rule in the UI
 *
 * When status = 'settled':
 *   - Returns all historically graded picks (all-time), most recent first
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getTodaySlateRange } from '@/lib/slateUtils'

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

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'
  const league = searchParams.get('league')
  // Default: scope pending to today only; settled/all shows all-time
  const scope = searchParams.get('scope') ?? (status === 'pending' ? 'today' : 'all-time')

  let query = supabaseAdmin
    .from('official_picks')
    .select(
      'id, league, home_team, away_team, bet_type, pick_team, sportsbook_line, model_line, spread_edge, confidence_score, edge_score, result, created_at, commence_time, result_recorded_at, line_at_pick, closing_line'
    )
    .order('commence_time', { ascending: false })

  // Result filter
  if (status === 'pending') {
    query = query.eq('result', 'pending')
  } else if (status === 'settled') {
    query = query.in('result', ['win', 'loss', 'push'])
  }
  // 'all' = no result filter

  // Scope pending picks to today's EST sports day (2 AM → 2 AM boundary)
  if (scope === 'today') {
    const { start: slateStart, end: slateEnd } = getTodaySlateRange()
    query = query.gte('commence_time', slateStart).lt('commence_time', slateEnd)
  }

  if (league) {
    query = query.eq('league', league)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const picks = data ?? []

  // Always return today's pending count for badge display
  const { start: todayStart, end: todayEnd } = getTodaySlateRange()
  const { data: todayPendingRows } = await supabaseAdmin
    .from('official_picks')
    .select('id')
    .eq('result', 'pending')
    .gte('commence_time', todayStart)
    .lt('commence_time', todayEnd)

  const pendingCount = (todayPendingRows ?? []).length

  return NextResponse.json({ picks, pendingCount })
}
