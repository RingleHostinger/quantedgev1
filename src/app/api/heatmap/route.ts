import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'
import { getTodaySlateGameIds, filterToWindow } from '@/lib/slateUtils'

export async function GET() {
  const session = await getSession()

  let isPremium = false
  if (session?.userId) {
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('plan_type')
      .eq('id', session.userId)
      .single()
    isPremium = userRow?.plan_type === 'premium'
  }

  // Fetch from prediction_cache for today's slate only.
  // Workaround: nubase drops .lt() when combined with .gte() on same column.
  // Use .lt(end) in DB query, then JS-filter for >= start.
  const { slateStart, slateEnd } = await getTodaySlateGameIds().then(
    ({ slateStart, slateEnd }) => ({ slateStart, slateEnd })
  )

  const { data: rawRows, error } = await supabaseAdmin
    .from('prediction_cache')
    .select(`
      id,
      game_id,
      league,
      home_team,
      away_team,
      commence_time,
      sportsbook_spread,
      model_spread,
      spread_edge,
      model_prob_home,
      model_prob_away,
      confidence_score,
      edge_score
    `)
    .lt('commence_time', slateEnd)
    .order('edge_score', { ascending: false })

  // JS-filter for lower bound (nubase .gte+.lt bug workaround)
  const rows = filterToWindow(rawRows ?? [], 'commence_time', slateStart).slice(0, 30)

  if (error) {
    return NextResponse.json({ heatmap: [], isPremium, error: 'Failed to fetch data' }, { status: 500 })
  }

  // Filter: only show games where abs(spread_edge) >= 1 (suppress noise)
  const qualified = rows.filter(
    (r) => Math.abs(r.spread_edge ?? 0) >= 1
  )

  // Get the last engine run timestamp for the "Model Updated" display
  const { data: lastRun } = await supabaseAdmin
    .from('engine_runs')
    .select('run_at')
    .order('run_at', { ascending: false })
    .limit(1)
    .single()

  const modelUpdatedAt = lastRun?.run_at ?? null

  const heatmap = qualified.map((row) => ({
    id: row.id,
    game_id: row.game_id,
    league: row.league,
    home_team: row.home_team,
    away_team: row.away_team,
    commence_time: row.commence_time,
    sportsbook_spread: row.sportsbook_spread,
    model_spread: row.model_spread,
    spread_edge: row.spread_edge,
    model_prob_home: row.model_prob_home,
    model_prob_away: row.model_prob_away,
    confidence: row.confidence_score,
  }))

  return NextResponse.json({ heatmap, isPremium, modelUpdatedAt })
}
