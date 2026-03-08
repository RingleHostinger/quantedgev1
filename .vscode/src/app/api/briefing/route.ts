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

  // ── Fetch prediction_cache for today's slate only ───────────────────────
  // Workaround: nubase drops .lt() when combined with .gte() on same column.
  // Use .lt(end) in DB query, then JS-filter for >= start.
  const { slateStart, slateEnd } = await getTodaySlateGameIds().then(
    ({ slateStart, slateEnd }) => ({ slateStart, slateEnd })
  )

  const { data: rawCache } = await supabaseAdmin
    .from('prediction_cache')
    .select(`
      game_id, league, home_team, away_team, commence_time,
      sportsbook_spread, model_spread, spread_edge,
      sportsbook_total, model_total, total_edge,
      moneyline_home, moneyline_away,
      model_prob_home, model_prob_away,
      implied_prob_home, implied_prob_away,
      moneyline_edge_home, moneyline_edge_away,
      confidence_score, edge_score, upset_flag
    `)
    .lt('commence_time', slateEnd)
    .order('edge_score', { ascending: false })

  // JS-filter for lower bound (nubase .gte+.lt bug workaround)
  const cache = filterToWindow(rawCache ?? [], 'commence_time', slateStart)

  // ── Key Insights ────────────────────────────────────────────────────────

  // 1. Largest spread edge (abs(spread_edge) max)
  const bySpreadEdge = [...cache]
    .filter(r => r.spread_edge != null)
    .sort((a, b) => Math.abs(b.spread_edge) - Math.abs(a.spread_edge))
  const topSpread = bySpreadEdge[0] ?? null

  // 2. Biggest underdog opportunity (highest moneyline_edge_away > 0)
  const byUnderdogEdge = [...cache]
    .filter(r => r.moneyline_edge_away != null && r.moneyline_edge_away > 0)
    .sort((a, b) => b.moneyline_edge_away - a.moneyline_edge_away)
  const topUnderdog = byUnderdogEdge[0] ?? null

  // 3. Most confident prediction
  const byConfidence = [...cache].sort((a, b) => b.confidence_score - a.confidence_score)
  const topConfident = byConfidence[0] ?? null

  // 4. Largest model disagreement (same as spread edge, but framed differently)
  const topDisagreement = bySpreadEdge[0] ?? null

  // ── Market Disagreement Games (top 3 by abs spread_edge) ────────────────
  const marketDisagreement = bySpreadEdge.slice(0, 3).map(r => ({
    home_team: r.home_team,
    away_team: r.away_team,
    league: r.league,
    commence_time: r.commence_time,
    sportsbook_spread: r.sportsbook_spread,
    model_spread: r.model_spread,
    spread_edge: r.spread_edge,
  }))

  // ── Underdog Radar (top 3 positive moneyline_edge_away) ─────────────────
  const underdogRadar = byUnderdogEdge.slice(0, 3).map(r => {
    // Convert moneyline to American odds display string
    const ml = r.moneyline_away
    const mlStr = ml == null ? null : ml >= 0 ? `+${ml}` : `${ml}`

    const impliedPct = r.implied_prob_away != null
      ? parseFloat((r.implied_prob_away * 100).toFixed(1))
      : null
    const modelPct = r.model_prob_away != null
      ? parseFloat(r.model_prob_away.toFixed(1))
      : null
    const edgePct = r.moneyline_edge_away != null
      ? parseFloat((r.moneyline_edge_away * 100).toFixed(1))
      : null

    return {
      team: r.away_team,
      opponent: r.home_team,
      league: r.league,
      commence_time: r.commence_time,
      moneyline: mlStr,
      implied_prob_pct: impliedPct,
      model_prob_pct: modelPct,
      edge_pct: edgePct,
    }
  })

  // ── Top Storylines Summary ───────────────────────────────────────────────
  const qualifiedEdges = cache.filter(r => Math.abs(r.spread_edge ?? 0) >= 1.5)
  const edgeCount = qualifiedEdges.length
  const avgEdgeSize = edgeCount > 0
    ? parseFloat((qualifiedEdges.reduce((s, r) => s + Math.abs(r.spread_edge ?? 0), 0) / edgeCount).toFixed(1))
    : 0

  const topMatchup = topSpread
    ? `${topSpread.away_team} vs ${topSpread.home_team}`
    : null

  // ── Engine status ────────────────────────────────────────────────────────
  let lastRun: string | null = null
  let totalPredictions = cache.length
  try {
    const { data: runRow } = await supabaseAdmin
      .from('engine_runs')
      .select('run_at, status')
      .eq('status', 'success')
      .order('run_at', { ascending: false })
      .limit(1)
      .single()
    if (runRow) lastRun = runRow.run_at
  } catch { /* engine_runs may not exist */ }

  // Fallback: also count from predictions table if cache is empty
  // Note: nubase count:exact always returns null — use data.length instead
  if (totalPredictions === 0) {
    const { data: predRows } = await supabaseAdmin
      .from('predictions')
      .select('id')
    totalPredictions = (predRows ?? []).length
  }

  // ── Key Insights (4 derived cards) ──────────────────────────────────────
  function formatSpread(v: number | null) {
    if (v == null) return 'N/A'
    return v > 0 ? `+${v}` : `${v}`
  }

  function pickSide(modelSpread: number | null, sbSpread: number | null, homeTeam: string, awayTeam: string) {
    if (modelSpread == null || sbSpread == null) return { team: homeTeam, line: formatSpread(sbSpread) }
    if (modelSpread > sbSpread) return { team: awayTeam, line: `+${Math.abs(sbSpread)}` }
    return { team: homeTeam, line: formatSpread(sbSpread) }
  }

  const insights = []

  if (topSpread) {
    const { team, line } = pickSide(topSpread.model_spread, topSpread.sportsbook_spread, topSpread.home_team, topSpread.away_team)
    insights.push({
      type: 'spread_edge',
      label: 'Largest Spread Edge',
      headline: `${team} ${line}`,
      sub: `Edge +${Math.abs(topSpread.spread_edge ?? 0).toFixed(1)}`,
      league: topSpread.league,
      game: `${topSpread.away_team} vs ${topSpread.home_team}`,
    })
  }

  if (topUnderdog) {
    const mlStr = topUnderdog.moneyline_away != null
      ? (topUnderdog.moneyline_away >= 0 ? `+${topUnderdog.moneyline_away}` : `${topUnderdog.moneyline_away}`)
      : ''
    insights.push({
      type: 'underdog',
      label: 'Biggest Underdog Value',
      headline: `${topUnderdog.away_team} ${mlStr}`,
      sub: `Model Edge +${((topUnderdog.moneyline_edge_away ?? 0) * 100).toFixed(1)}%`,
      league: topUnderdog.league,
      game: `${topUnderdog.away_team} vs ${topUnderdog.home_team}`,
    })
  }

  if (topConfident) {
    const { team, line } = pickSide(topConfident.model_spread, topConfident.sportsbook_spread, topConfident.home_team, topConfident.away_team)
    insights.push({
      type: 'confidence',
      label: 'Most Confident Prediction',
      headline: `${team} ${line}`,
      sub: `Confidence ${topConfident.confidence_score}%`,
      league: topConfident.league,
      game: `${topConfident.away_team} vs ${topConfident.home_team}`,
    })
  }

  if (topDisagreement && (!topSpread || topDisagreement.game_id !== topSpread.game_id)) {
    const { team, line } = pickSide(topDisagreement.model_spread, topDisagreement.sportsbook_spread, topDisagreement.home_team, topDisagreement.away_team)
    insights.push({
      type: 'disagreement',
      label: 'Largest Model Disagreement',
      headline: `${team} ${line}`,
      sub: `Model ${formatSpread(topDisagreement.model_spread)} vs Book ${formatSpread(topDisagreement.sportsbook_spread)}`,
      league: topDisagreement.league,
      game: `${topDisagreement.away_team} vs ${topDisagreement.home_team}`,
    })
  }

  return NextResponse.json({
    isPremium,
    generatedAt: lastRun ?? new Date().toISOString(),
    insights: insights.slice(0, 4),
    marketDisagreement,
    underdogRadar,
    storyline: {
      edgeCount,
      avgEdgeSize,
      topMatchup,
      totalPredictions,
      lastRun,
    },
  })
}
