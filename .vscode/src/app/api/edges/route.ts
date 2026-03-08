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

  // Fetch from prediction_cache for today's slate only, sorted by edge_score descending
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
      sportsbook_total,
      moneyline_home,
      moneyline_away,
      model_spread,
      model_total,
      spread_edge,
      total_edge,
      model_prob_home,
      model_prob_away,
      implied_prob_home,
      implied_prob_away,
      moneyline_edge_home,
      moneyline_edge_away,
      confidence_score,
      edge_score,
      upset_flag
    `)
    .lt('commence_time', slateEnd)
    .order('edge_score', { ascending: false })

  // JS-filter for lower bound (nubase .gte+.lt bug workaround)
  const rows = filterToWindow(rawRows ?? [], 'commence_time', slateStart).slice(0, 10)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch edges' }, { status: 500 })
  }

  // Filter: only include games where abs(spread_edge) >= 1.5
  const qualified = rows.filter(
    (r) => Math.abs(r.spread_edge ?? 0) >= 1.5
  )

  if (qualified.length === 0) {
    return NextResponse.json({
      edges: [],
      isPremium,
      message: 'No strong AI edges available right now.',
    })
  }

  // Also join prediction reasoning from predictions table
  const gameIds = qualified.map((r) => r.game_id)
  let predMap: Record<string, { ai_reasoning: string; is_trending: boolean; predicted_home_score: number; predicted_away_score: number; ai_spread: number | null; ai_total: number | null; home_win_probability: number; away_win_probability: number; is_upset_pick: boolean }> = {}

  if (gameIds.length > 0) {
    const { data: preds } = await supabaseAdmin
      .from('predictions')
      .select('game_id, ai_reasoning, is_trending, predicted_home_score, predicted_away_score, ai_spread, ai_total, home_win_probability, away_win_probability, is_upset_pick')
      .in('game_id', gameIds)

    for (const p of preds || []) {
      predMap[p.game_id] = p
    }
  }

  const edges = qualified.map((row) => {
    const pred = predMap[row.game_id] || {}
    return {
      id: row.id,
      game_id: row.game_id,
      league: row.league,
      home_team: row.home_team,
      away_team: row.away_team,
      commence_time: row.commence_time,

      // Sportsbook lines
      sportsbook_spread: row.sportsbook_spread,
      sportsbook_total: row.sportsbook_total,
      moneyline_home: row.moneyline_home,
      moneyline_away: row.moneyline_away,

      // Model outputs
      model_spread: row.model_spread,
      model_total: row.model_total,

      // Edge calculations
      spread_edge: row.spread_edge,
      total_edge: row.total_edge,

      // Probabilities
      model_prob_home: row.model_prob_home,
      model_prob_away: row.model_prob_away,
      implied_prob_home: row.implied_prob_home,
      implied_prob_away: row.implied_prob_away,
      moneyline_edge_home: row.moneyline_edge_home,
      moneyline_edge_away: row.moneyline_edge_away,

      // Ranking
      confidence_score: row.confidence_score,
      edge_score: row.edge_score,
      upset_flag: row.upset_flag,

      // From predictions table
      ai_reasoning: pred.ai_reasoning || null,
      is_trending: pred.is_trending || false,
      is_upset_pick: pred.is_upset_pick || row.upset_flag,
      predicted_home_score: pred.predicted_home_score ?? null,
      predicted_away_score: pred.predicted_away_score ?? null,

      // Legacy aliases for frontend compatibility
      confidence: row.confidence_score,
      ai_spread: pred.ai_spread ?? row.model_spread,
      ai_total: pred.ai_total ?? row.model_total,
      home_win_probability: pred.home_win_probability ?? row.model_prob_home,
      away_win_probability: pred.away_win_probability ?? row.model_prob_away,
      max_edge: Math.max(Math.abs(row.spread_edge ?? 0), Math.abs(row.total_edge ?? 0)),

      // Inject game shape for existing frontend EdgeCard component
      games: {
        id: row.game_id,
        home_team_name: row.home_team,
        away_team_name: row.away_team,
        sport: row.league === 'EPL' || row.league === 'UCL' ? 'Soccer' : 'Basketball',
        league: row.league,
        scheduled_at: row.commence_time,
        status: 'scheduled',
        sportsbook_spread: row.sportsbook_spread,
        sportsbook_total: row.sportsbook_total,
        sportsbook_moneyline_home: row.moneyline_home,
        sportsbook_moneyline_away: row.moneyline_away,
        is_free_pick: false,
      },
    }
  })

  return NextResponse.json({ edges, isPremium })
}
