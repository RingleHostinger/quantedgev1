import { NextResponse } from 'next/server'
import { fetchBettingSplits, analyzeBettingSplit, isSdioConfigured, SdioBettingSplit } from '@/lib/sportsDataIOService'
import { supabaseAdmin } from '@/integrations/supabase/server'

const CACHE_STALE_MINUTES = 60  // treat splits cache as stale after 60 min

export async function GET() {
  // ── 1: Try cached_betting_splits table first ─────────────────────────────────
  const { data: cachedRows, error: cacheErr } = await supabaseAdmin
    .from('cached_betting_splits')
    .select('*')
    .order('last_updated', { ascending: false })

  const hasCache = !cacheErr && cachedRows && cachedRows.length > 0

  if (hasCache) {
    const mostRecent = cachedRows[0].last_updated as string | null
    const ageMs = mostRecent ? Date.now() - new Date(mostRecent).getTime() : Infinity
    const isStale = ageMs > CACHE_STALE_MINUTES * 60 * 1000

    if (!isStale) {
      const splits = cachedRows.map((r) => {
        const split: SdioBettingSplit = {
          gameId:         r.game_id,
          league:         r.league,
          homeTeam:       r.home_team,
          awayTeam:       r.away_team,
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
        return { ...split, ...analyzeBettingSplit(split) }
      })

      return NextResponse.json({
        splits,
        source: 'cache',
        lastCachedAt: mostRecent,
      })
    }
  }

  // ── 2: Cache miss/stale — try live SportsDataIO ──────────────────────────────
  if (!isSdioConfigured()) {
    return NextResponse.json({
      splits: [],
      source: 'none',
      message: 'SportsDataIO keys not configured — betting splits unavailable',
    })
  }

  const { splits, errors } = await fetchBettingSplits()

  const enriched = splits.map((split) => ({
    ...split,
    ...analyzeBettingSplit(split),
  }))

  return NextResponse.json({
    splits: enriched,
    source: 'sportsdata.io',
    fetchErrors: errors.length > 0 ? errors : undefined,
  })
}
