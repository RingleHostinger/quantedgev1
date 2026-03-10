import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'
import { getTodaySlateGameIds, filterToWindow } from '@/lib/slateUtils'
// SportsDataIO enrichment — PAUSED. Imports retained for potential future restoration.
// import { analyzeBettingSplit, SdioBettingSplit } from '@/lib/sportsDataIOService'

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

  // Fetch prediction_cache rows for today's slate
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

  const rows = filterToWindow(rawRows ?? [], 'commence_time', slateStart).slice(0, 30)

  if (error) {
    return NextResponse.json({ heatmap: [], isPremium, error: 'Failed to fetch data' }, { status: 500 })
  }

  // Only show games where |spread_edge| >= 1
  const qualified = rows.filter((r) => Math.abs(r.spread_edge ?? 0) >= 1)

  // Fetch last engine run timestamp
  const { data: lastRun } = await supabaseAdmin
    .from('engine_runs')
    .select('run_at')
    .order('run_at', { ascending: false })
    .limit(1)
    .single()

  const modelUpdatedAt = lastRun?.run_at ?? null

  // SportsDataIO enrichment — PAUSED
  // cached_betting_splits and cached_injuries queries removed while SDIO is inactive.
  // Enrichment fields (publicBets, sharpMoney, lineMovement, injuries) are set to null.
  // Re-enable by restoring the SDIO query blocks and analyzeBettingSplit() calls here.

  // ─── Build heatmap rows ───────────────────────────────────────────────────
  const heatmap = qualified.map((row) => {
    return {
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
      // Betting splits — Coming Soon (SportsDataIO paused)
      publicBetsHome:       null,
      publicBetsAway:       null,
      publicMoneyHome:      null,
      publicMoneyAway:      null,
      // Sharp money — Coming Soon (SportsDataIO paused)
      sharpMoneyAlert:      false,
      sharpMoneySide:       null,
      sharpMoneyDesc:       null,
      // Line movement — Coming Soon (SportsDataIO paused)
      openingSpread:        null,
      lineMovementAlert:    false,
      lineMovementDesc:     null,
      totalMovementAlert:   false,
      totalMovementDesc:    null,
      // Injury impact — Coming Soon (SportsDataIO paused)
      hasInjuryImpact:      false,
      homeInjuries:         [],
      awayInjuries:         [],
    }
  })

  return NextResponse.json({ heatmap, isPremium, modelUpdatedAt })
}
