import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'
import { getUpsetProbability } from '@/lib/analytics-utils'
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

  // Fetch upset candidates from prediction_cache for today's slate only.
  // Workaround: nubase drops .lt() when combined with .gte() on same column.
  // Use .lt(end) in DB query, then JS-filter for >= start.
  const { slateStart, slateEnd } = await getTodaySlateGameIds().then(
    ({ slateStart, slateEnd }) => ({ slateStart, slateEnd })
  )

  const { data: rawRows } = await supabaseAdmin
    .from('prediction_cache')
    .select(`
      id, game_id, league, home_team, away_team, commence_time,
      sportsbook_spread,
      moneyline_away,
      model_prob_home, model_prob_away,
      implied_prob_away,
      moneyline_edge_away,
      confidence_score, upset_flag
    `)
    .lt('commence_time', slateEnd)
    .or('upset_flag.eq.true,model_prob_away.gte.30')
    .order('moneyline_edge_away', { ascending: false, nullsFirst: false })

  // JS-filter for lower bound, then apply limit
  const rows = filterToWindow(rawRows ?? [], 'commence_time', slateStart).slice(0, 15)

  const valid = rows.filter((r) => r.model_prob_away != null)

  const candidates = valid.map((row) => {
    const spread = row.sportsbook_spread ?? 4
    const awayWinProb = row.model_prob_away ?? 35
    const upsetProb = getUpsetProbability(awayWinProb, Math.abs(spread))

    // moneyline edge as percentage (stored as 0–1 decimal)
    const mlEdgePct = row.moneyline_edge_away != null
      ? Math.round(row.moneyline_edge_away * 1000) / 10
      : null

    // implied prob as percentage (stored as 0–1 decimal)
    const impliedProbPct = row.implied_prob_away != null
      ? Math.round(row.implied_prob_away * 1000) / 10
      : null

    return {
      id: row.id,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      league: row.league,
      scheduledAt: row.commence_time,
      vegasSpread: Math.abs(spread),
      aiUpsetProb: upsetProb,
      awayWinProb: Math.round(awayWinProb),
      homeWinProb: Math.round(row.model_prob_home ?? 65),
      confidence: row.confidence_score,
      moneylineAway: row.moneyline_away,
      impliedProbPct,
      mlEdgePct,
      upsetFlag: row.upset_flag,
      isNcaab: row.league === 'NCAAB',
    }
  })
    // Only meaningful upset candidates: upset prob >= 20% OR moneyline edge > 5%
    .filter((c) => c.aiUpsetProb >= 20 || (c.mlEdgePct != null && c.mlEdgePct > 5))
    .sort((a, b) => b.aiUpsetProb - a.aiUpsetProb)
    .slice(0, 10)

  return NextResponse.json({ upsets: candidates, isPremium })
}
