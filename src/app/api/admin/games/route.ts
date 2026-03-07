import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: games } = await supabaseAdmin
    .from('games')
    .select('*')
    .order('scheduled_at', { ascending: false })

  return NextResponse.json({ games })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const {
    home_team_name, away_team_name, sport, league, scheduled_at,
    sportsbook_spread, sportsbook_total, sportsbook_moneyline_home, sportsbook_moneyline_away,
  } = body

  if (!home_team_name || !away_team_name || !sport || !league || !scheduled_at) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  const { data: game, error } = await supabaseAdmin
    .from('games')
    .insert({
      home_team_name, away_team_name, sport, league, scheduled_at,
      status: 'scheduled',
      sportsbook_spread: sportsbook_spread ?? null,
      sportsbook_total: sportsbook_total ?? null,
      sportsbook_moneyline_home: sportsbook_moneyline_home ?? null,
      sportsbook_moneyline_away: sportsbook_moneyline_away ?? null,
      is_free_pick: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ game })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'Game ID required' }, { status: 400 })

  const { data: game, error } = await supabaseAdmin
    .from('games')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ game })
}
