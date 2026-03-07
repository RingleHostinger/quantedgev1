import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'
import { getEdgeTier, getConfidenceTier } from '@/lib/prediction-engine'
import { getTodaySlateGameIds } from '@/lib/slateUtils'

export async function GET() {
  const session = await getSession()

  // Always fetch plan_type fresh from DB — JWT may be stale after upgrade
  let isPremium = false
  if (session?.userId) {
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('plan_type')
      .eq('id', session.userId)
      .single()
    isPremium = userRow?.plan_type === 'premium'
  }

  // Fetch predictions for TODAY's slate only (EST sports day: 2 AM ET boundary).
  // Uses lt-only + JS-filter workaround for nubase .gte+.lt bug.
  const { gameIds: todayGameIds } = await getTodaySlateGameIds()

  // If no games for today's slate, return empty immediately
  if (todayGameIds.length === 0) {
    const { data: lastRun0 } = await supabaseAdmin
      .from('engine_runs')
      .select('run_at')
      .order('run_at', { ascending: false })
      .limit(1)
      .single()
    return NextResponse.json({
      predictions: [],
      isPremium,
      lastUpdated: lastRun0?.run_at ?? null,
    })
  }

  const { data: predictions, error } = await supabaseAdmin
    .from('predictions')
    .select(`
      *,
      games (
        id,
        home_team_name,
        away_team_name,
        sport,
        league,
        scheduled_at,
        status,
        actual_home_score,
        actual_away_score,
        sportsbook_spread,
        sportsbook_total,
        sportsbook_moneyline_home,
        sportsbook_moneyline_away,
        is_free_pick,
        home_rest_days,
        away_rest_days,
        venue,
        engine_run_at
      )
    `)
    .in('game_id', todayGameIds)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 })
  }

  // Filter out predictions where game relation is null
  const filtered = (predictions || []).filter((p) => p.games !== null)

  const enriched = filtered.map((p) => {
    const game = p.games as Record<string, unknown>
    const isFreePickGame = game?.is_free_pick === true

    // Use pre-computed engine edges if available, otherwise compute on-the-fly
    const spreadEdge = p.spread_edge != null
      ? p.spread_edge
      : p.ai_spread != null && game?.sportsbook_spread != null
        ? parseFloat((Math.abs(p.ai_spread) - Math.abs(game.sportsbook_spread as number)).toFixed(1))
        : null

    const totalEdge = p.total_edge != null
      ? p.total_edge
      : p.ai_total != null && game?.sportsbook_total != null
        ? parseFloat((p.ai_total - (game.sportsbook_total as number)).toFixed(1))
        : null

    const edgeTier = p.edge_tier || getEdgeTier(spreadEdge, totalEdge)
    const confidenceTier = p.confidence_tier || getConfidenceTier(p.confidence || 0)

    // Free users: only see the daily free pick unlocked, everything else locked
    const locked = !isPremium && !isFreePickGame

    return {
      ...p,
      spread_edge: spreadEdge,
      total_edge: totalEdge,
      edge_tier: edgeTier,
      confidence_tier: confidenceTier,
      locked,
      is_free_pick_game: isFreePickGame,
    }
  })

  // Get last engine run timestamp for "Last Updated" display
  const { data: lastRun } = await supabaseAdmin
    .from('engine_runs')
    .select('run_at')
    .order('run_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    predictions: enriched,
    isPremium,
    lastUpdated: lastRun?.run_at ?? null,
  })
}
