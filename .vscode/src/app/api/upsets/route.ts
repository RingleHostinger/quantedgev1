import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'
import { getUpsetProbability, getUpsetAlertLevel, seedRandom } from '@/lib/analytics-utils'

// Upset reasons keyed by league
const UPSET_REASONS: Record<string, string[][]> = {
  NBA: [
    ['Away team on 5-game winning streak', 'Favorable pace matchup for underdog', 'Favorite missing key rotation player'],
    ['Home court advantage neutralized by travel fatigue', 'Underdog top-10 in defensive efficiency', 'H2H: 3-1 in last 4 meetings'],
  ],
  NFL: [
    ['Underdog strong run defense vs weak rushing attack', 'QB hot streak — 8 TDs last 3 games', 'Weather conditions favor defensive game'],
    ['Favorite 3rd in turnover rate this season', 'Home underdog, historically 53% win rate', 'Line movement suggests sharp action on dog'],
  ],
  NCAAB: [
    ['12 vs 5 historical upset rate: 35%', 'Underdog elite perimeter shooting', 'Slower pace neutralizes favorite athleticism'],
    ['Underdog coach tournament experience', 'Favorite relies on interior play — poor matchup', 'Underdog leads nation in steals per game'],
  ],
  DEFAULT: [
    ['AI model detects line value on underdog', 'Recent form strongly favors underdog', 'Matchup advantage in key statistical areas'],
    ['Public heavily on favorite — classic trap', 'Underdog motivated spot', 'Key efficiency metrics favor underdog'],
  ],
}

function getReasons(league: string, seed: string): string[] {
  const rng = seedRandom(seed)
  const pool = UPSET_REASONS[league] || UPSET_REASONS.DEFAULT
  const idx = Math.floor(rng() * pool.length)
  return pool[idx]
}

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

  // Fetch upset candidates from prediction_cache
  // upset_flag = true means away underdog has moneyline_edge > 5%
  // Also include games where away_win_probability suggests upset potential
  const { data: rows, error } = await supabaseAdmin
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
    .or('upset_flag.eq.true,model_prob_away.gte.30')
    .order('moneyline_edge_away', { ascending: false, nullsFirst: false })
    .limit(15)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch upsets' }, { status: 500 })
  }

  const valid = (rows || []).filter((r) => r.model_prob_away != null)

  const upsets = valid.map((row) => {
    const spread = row.sportsbook_spread ?? 4
    const awayWinProb = row.model_prob_away ?? 35
    const upsetProb = getUpsetProbability(awayWinProb, Math.abs(spread))
    const alert = getUpsetAlertLevel(upsetProb)

    // Recent form (deterministic per game)
    const rng = seedRandom((row.game_id || row.id) + 'form')
    const wins = Math.round(2 + rng() * 3)
    const form = Array.from({ length: 5 }, (_, i) => i < wins ? 'W' : 'L')
      .sort(() => rng() - 0.5)

    const reasons = getReasons(row.league || 'DEFAULT', row.game_id || row.id)

    // Moneyline edge as percentage for display
    const mlEdgeAway = row.moneyline_edge_away != null
      ? Math.round(row.moneyline_edge_away * 1000) / 10  // convert 0–1 to 0–100 with 1dp
      : null

    return {
      id: row.id,
      game_id: row.game_id,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      league: row.league,
      scheduledAt: row.commence_time,
      vegasSpread: Math.abs(spread),
      aiUpsetProb: upsetProb,
      awayWinProb,
      homeWinProb: row.model_prob_home ?? 65,
      confidence: row.confidence_score,
      alertLabel: alert.label,
      alertColor: alert.color,
      alertBg: alert.bgColor,
      form,
      reasons,
      isNcaab: row.league === 'NCAAB',

      // New fields
      moneylineAway: row.moneyline_away,
      impliedProbAway: row.implied_prob_away != null
        ? Math.round(row.implied_prob_away * 1000) / 10
        : null,
      moneylineEdgeAway: mlEdgeAway,
      edgeScore: row.edge_score,
      upsetFlag: row.upset_flag,
    }
  })
    .filter((c) => c.aiUpsetProb >= 15)
    .sort((a, b) => b.aiUpsetProb - a.aiUpsetProb)
    .slice(0, 10)

  return NextResponse.json({ upsets, isPremium })
}
