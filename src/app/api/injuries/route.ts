import { NextRequest, NextResponse } from 'next/server'
import { fetchAllInjuries, isSdioConfigured } from '@/lib/sportsDataIOService'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const league = searchParams.get('league')   // optional: NBA | NHL | NCAAB
  const team   = searchParams.get('team')     // optional: partial team name filter

  // If SportsDataIO is configured, use the live feed
  if (isSdioConfigured()) {
    const { injuries, errors } = await fetchAllInjuries()

    // Apply optional filters
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

  // Fallback: read from injuries table in DB
  let query = supabaseAdmin
    .from('injuries')
    .select('*')
    .order('created_at', { ascending: false })

  const game_id = searchParams.get('game_id')
  if (game_id) query = query.eq('game_id', game_id)

  const { data: injuries, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ injuries: injuries || [], source: 'database' })
}
