/**
 * GET /api/admin/picks
 *
 * List official picks for admin grading panel.
 * Admin only.
 *
 * Query params:
 *   status  = 'pending' | 'settled' | 'all'  (default: 'pending')
 *   league  = league filter (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'

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

  let query = supabaseAdmin
    .from('official_picks')
    .select(
      'id, league, home_team, away_team, bet_type, pick_team, sportsbook_line, model_line, spread_edge, confidence_score, edge_score, result, created_at, commence_time, result_recorded_at, line_at_pick, closing_line'
    )
    .order('commence_time', { ascending: false })

  if (status === 'pending') {
    query = query.eq('result', 'pending')
  } else if (status === 'settled') {
    query = query.in('result', ['win', 'loss', 'push'])
  }
  // 'all' = no result filter

  if (league) {
    query = query.eq('league', league)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const picks = data ?? []

  // Summary counts
  const pendingCount = status === 'all'
    ? picks.filter((p) => p.result === 'pending').length
    : status === 'pending' ? picks.length : 0

  return NextResponse.json({ picks, pendingCount })
}
