import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'
import { getTodaySlateGameIds, filterToWindow } from '@/lib/slateUtils'
import { analyzeBettingSplit, SdioBettingSplit } from '@/lib/sportsDataIOService'

const SPLITS_STALE_MINUTES = 60
const INJURIES_STALE_MINUTES = 90

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

  // ─── Load splits from cached_betting_splits table ────────────────────────────
  type SplitEntry = ReturnType<typeof analyzeBettingSplit> & {
    spreadHomeBeats: number | null
    spreadAwayBets: number | null
    spreadHomeMoney: number | null
    spreadAwayMoney: number | null
    openingSpread: number | null
    currentSpread: number | null
    openingTotal: number | null
    currentTotal: number | null
  }
  let splitsMap = new Map<string, SplitEntry>()

  const { data: splitsRows } = await supabaseAdmin
    .from('cached_betting_splits')
    .select('*')
    .order('last_updated', { ascending: false })

  if (splitsRows && splitsRows.length > 0) {
    const mostRecent = splitsRows[0].last_updated as string | null
    const ageMs = mostRecent ? Date.now() - new Date(mostRecent).getTime() : Infinity
    const isStale = ageMs > SPLITS_STALE_MINUTES * 60 * 1000

    if (!isStale) {
      for (const r of splitsRows) {
        const split: SdioBettingSplit = {
          gameId:          r.game_id,
          league:          r.league,
          homeTeam:        r.home_team,
          awayTeam:        r.away_team,
          spreadHomeBeats: r.spread_home_bets,
          spreadAwayBets:  r.spread_away_bets,
          spreadHomeMoney: r.spread_home_money,
          spreadAwayMoney: r.spread_away_money,
          mlHomeBets:      r.ml_home_bets,
          mlAwayBets:      r.ml_away_bets,
          mlHomeMoney:     r.ml_home_money,
          mlAwayMoney:     r.ml_away_money,
          overBets:        r.over_bets,
          underBets:       r.under_bets,
          openingSpread:   r.opening_spread,
          currentSpread:   r.current_spread,
          openingTotal:    r.opening_total,
          currentTotal:    r.current_total,
        }
        const analysis = analyzeBettingSplit(split)
        splitsMap.set(r.game_id, {
          ...analysis,
          spreadHomeBeats:  split.spreadHomeBeats,
          spreadAwayBets:   split.spreadAwayBets,
          spreadHomeMoney:  split.spreadHomeMoney,
          spreadAwayMoney:  split.spreadAwayMoney,
          openingSpread:    split.openingSpread,
          currentSpread:    split.currentSpread,
          openingTotal:     split.openingTotal,
          currentTotal:     split.currentTotal,
        })
      }
    }
  }

  // ─── Load injuries from cached_injuries table ────────────────────────────────
  let injuryMap = new Map<string, { playerName: string; status: string; impactScore: number }[]>()

  const { data: injuryRows } = await supabaseAdmin
    .from('cached_injuries')
    .select('player_name, team_name, team, status, impact_score, last_updated')
    .order('impact_score', { ascending: false })

  if (injuryRows && injuryRows.length > 0) {
    const mostRecent = injuryRows[0].last_updated as string | null
    const ageMs = mostRecent ? Date.now() - new Date(mostRecent).getTime() : Infinity
    const isStale = ageMs > INJURIES_STALE_MINUTES * 60 * 1000

    if (!isStale) {
      for (const inj of injuryRows) {
        const impactScore = Number(inj.impact_score ?? 0)
        if (impactScore < 6) continue
        const status = inj.status as string
        if (status !== 'Out' && status !== 'IR' && status !== 'Day-To-Day') continue
        const key = ((inj.team_name ?? inj.team) as string).toLowerCase()
        if (!injuryMap.has(key)) injuryMap.set(key, [])
        injuryMap.get(key)!.push({
          playerName:  inj.player_name as string,
          status,
          impactScore,
        })
      }
    }
  }

  // ─── Build enriched heatmap rows ─────────────────────────────────────────────
  const heatmap = qualified.map((row) => {
    const splits = splitsMap.get(row.game_id) ?? null

    const homeKey = (row.home_team ?? '').toLowerCase()
    const awayKey = (row.away_team ?? '').toLowerCase()
    const homeInjuries = injuryMap.get(homeKey) ?? []
    const awayInjuries = injuryMap.get(awayKey) ?? []
    const hasInjuryImpact = homeInjuries.length > 0 || awayInjuries.length > 0

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
      // Betting splits
      publicBetsHome:       splits?.spreadHomeBeats ?? null,
      publicBetsAway:       splits?.spreadAwayBets ?? null,
      publicMoneyHome:      splits?.spreadHomeMoney ?? null,
      publicMoneyAway:      splits?.spreadAwayMoney ?? null,
      // Sharp money
      sharpMoneyAlert:      splits?.sharpMoneyAlert ?? false,
      sharpMoneySide:       splits?.sharpMoneySide ?? null,
      sharpMoneyDesc:       splits?.sharpMoneyDesc ?? null,
      // Line movement
      openingSpread:        splits?.openingSpread ?? null,
      lineMovementAlert:    splits?.lineMovementAlert ?? false,
      lineMovementDesc:     splits?.lineMovementDesc ?? null,
      totalMovementAlert:   splits?.totalMovementAlert ?? false,
      totalMovementDesc:    splits?.totalMovementDesc ?? null,
      // Injury impact
      hasInjuryImpact,
      homeInjuries,
      awayInjuries,
    }
  })

  return NextResponse.json({ heatmap, isPremium, modelUpdatedAt })
}
