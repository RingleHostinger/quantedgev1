import { NextRequest, NextResponse } from 'next/server'
import { fetchAllInjuries, isSdioConfigured } from '@/lib/sportsDataIOService'
import { supabaseAdmin } from '@/integrations/supabase/server'

const CACHE_STALE_MINUTES = 90  // treat cache as stale after 90 min

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const league = searchParams.get('league')   // optional: NBA | NHL | NCAAB
  const team   = searchParams.get('team')     // optional: partial team name filter

  // ── 1: Try cached_injuries table first ──────────────────────────────────────
  const { data: cachedRows, error: cacheErr } = await supabaseAdmin
    .from('cached_injuries')
    .select('*')
    .order('impact_score', { ascending: false })

  const hasCache = !cacheErr && cachedRows && cachedRows.length > 0

  if (hasCache) {
    // Check freshness — use the most recent last_updated
    const mostRecent = cachedRows[0].last_updated as string | null
    const ageMs = mostRecent ? Date.now() - new Date(mostRecent).getTime() : Infinity
    const isStale = ageMs > CACHE_STALE_MINUTES * 60 * 1000

    if (!isStale) {
      // Map DB rows → SdioInjury-compatible shape for the UI
      let injuries = cachedRows.map((r) => ({
        playerId:       r.player_id,
        playerName:     r.player_name,
        team:           r.team,
        teamName:       r.team_name ?? r.team,
        league:         r.league,
        position:       r.position,
        injuryType:     r.injury_type,
        injuryDesc:     r.injury_desc,
        status:         r.status,
        expectedReturn: r.expected_return,
        impactScore:    r.impact_score,
        updatedAt:      r.last_updated,
      }))

      // Apply optional filters
      if (league) {
        injuries = injuries.filter((i) => i.league.toLowerCase() === league.toLowerCase())
      }
      if (team) {
        const q = team.toLowerCase()
        injuries = injuries.filter(
          (i) => i.teamName.toLowerCase().includes(q) || i.team.toLowerCase().includes(q)
        )
      }

      return NextResponse.json({
        injuries,
        source: 'cache',
        lastCachedAt: mostRecent,
      })
    }
  }

  // ── 2: Cache miss/stale — try live SportsDataIO ──────────────────────────────
  if (isSdioConfigured()) {
    const { injuries, errors } = await fetchAllInjuries()

    let filtered = injuries
    if (league) {
      filtered = filtered.filter((i) => i.league.toLowerCase() === league.toLowerCase())
    }
    if (team) {
      const q = team.toLowerCase()
      filtered = filtered.filter(
        (i) => i.teamName.toLowerCase().includes(q) || i.team.toLowerCase().includes(q)
      )
    }

    return NextResponse.json({
      injuries: filtered,
      source: 'sportsdata.io',
      fetchErrors: errors.length > 0 ? errors : undefined,
    })
  }

  // ── 3: Fallback: legacy injuries table ──────────────────────────────────────
  let query = supabaseAdmin
    .from('injuries')
    .select('*')
    .order('created_at', { ascending: false })

  const game_id = searchParams.get('game_id')
  if (game_id) query = query.eq('game_id', game_id)

  const { data: injuries, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ injuries: injuries ?? [], source: 'database' })
}
