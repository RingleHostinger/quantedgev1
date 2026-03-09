import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'
import { getTodaySlateGameIds, filterToWindow } from '@/lib/slateUtils'
import { fetchBettingSplits, analyzeBettingSplit, fetchAllInjuries, isSdioConfigured } from '@/lib/sportsDataIOService'

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

  // ─── Enrich with betting splits + injuries (SDIO) ─────────────────────────────
  // Fetch in parallel, gracefully degrade if not available
  let splitsMap = new Map<string, ReturnType<typeof analyzeBettingSplit> & {
    spreadHomeBeats: number | null
    spreadAwayBets: number | null
    spreadHomeMoney: number | null
    spreadAwayMoney: number | null
    openingSpread: number | null
    currentSpread: number | null
    openingTotal: number | null
    currentTotal: number | null
  }>()

  // Build a map of team name → high-impact injuries (Out/IR, impactScore >= 6)
  let injuryMap = new Map<string, { playerName: string; status: string; impactScore: number }[]>()

  if (isSdioConfigured()) {
    const [splitsResult, injuriesResult] = await Promise.allSettled([
      fetchBettingSplits(),
      fetchAllInjuries(),
    ])

    if (splitsResult.status === 'fulfilled') {
      const { splits } = splitsResult.value
      for (const split of splits) {
        const analysis = analyzeBettingSplit(split)
        splitsMap.set(split.gameId, {
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

    if (injuriesResult.status === 'fulfilled') {
      const { injuries } = injuriesResult.value
      // Build team → high-impact injured players map
      for (const inj of injuries) {
        if (inj.impactScore < 6) continue
        if (inj.status !== 'Out' && inj.status !== 'IR' && inj.status !== 'Day-To-Day') continue
        const key = inj.teamName.toLowerCase()
        if (!injuryMap.has(key)) injuryMap.set(key, [])
        injuryMap.get(key)!.push({
          playerName: inj.playerName,
          status: inj.status,
          impactScore: inj.impactScore,
        })
      }
    }
  }

  // ─── Build enriched heatmap rows ─────────────────────────────────────────────
  const heatmap = qualified.map((row) => {
    const splits = splitsMap.get(row.game_id) ?? null

    // Look up injuries for home/away teams
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
