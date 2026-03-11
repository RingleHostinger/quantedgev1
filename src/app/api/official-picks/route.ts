/**
 * GET /api/official-picks
 *
 * Returns official AI picks for the user-facing Official Picks page.
 *
 * Query params:
 *   tab = 'pending' | 'settled'  (default: 'pending')
 *
 * Pending tab:
 *   - Only returns picks for the ACTIVE sports day (EST 2 AM boundary)
 *   - Max 5 picks (enforced at insert time, reflected here)
 *   - Sorted by edge_score descending
 *
 * Settled tab:
 *   - All-time graded picks (win/loss/push), most recent first
 *   - Used for historical record / model performance context
 *
 * Authentication: requires a valid user session (free or premium).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getTodaySlateRange } from '@/lib/slateUtils'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab') ?? 'pending'

  const SELECT_COLS = 'id, league, home_team, away_team, bet_type, pick_team, sportsbook_line, model_line, spread_edge, confidence_score, edge_score, result, commence_time, result_recorded_at, line_at_pick, closing_line'

  if (tab === 'pending') {
    // Only today's active slate — max 1 pick
    const { start: slateStart, end: slateEnd } = getTodaySlateRange()

    // Use .lt() only — nubase drops .gte() when combined with .lt() on same column
    const { data: allRows, error } = await supabaseAdmin
      .from('official_picks')
      .select(SELECT_COLS)
      .eq('result', 'pending')
      .lt('commence_time', slateEnd)
      .order('edge_score', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // JS-filter for lower bound >= slateStart
    const slateStartMs = new Date(slateStart).getTime()
    const rows = (allRows ?? []).filter((r) => {
      const t = r.commence_time
      if (!t) return false
      return new Date(t).getTime() >= slateStartMs
    })

    // Return top 1 (single daily pick)
    const picks = rows.slice(0, 1)

    return NextResponse.json({
      picks,
      tab: 'pending',
      slateStart,
      slateEnd,
    })
  }

  // Settled tab — all-time history, most recent first
  const { data, error } = await supabaseAdmin
    .from('official_picks')
    .select(SELECT_COLS)
    .in('result', ['win', 'loss', 'push'])
    .order('commence_time', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Compute all-time stats for the settled tab header
  const picks = data ?? []
  const wins = picks.filter((p) => p.result === 'win').length
  const losses = picks.filter((p) => p.result === 'loss').length
  const pushes = picks.filter((p) => p.result === 'push').length
  const total = wins + losses + pushes
  const winRate = total > 0 ? Math.round((wins / (total - pushes || 1)) * 100) : 0

  return NextResponse.json({
    picks,
    tab: 'settled',
    stats: { wins, losses, pushes, total, winRate },
  })
}
