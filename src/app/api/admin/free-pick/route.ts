import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

// GET: return today's free pick
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: freePick } = await supabaseAdmin
    .from('games')
    .select('id, home_team_name, away_team_name, sport, league, scheduled_at')
    .eq('is_free_pick', true)
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ freePick: freePick || null })
}

// POST: set a game as today's free pick (clears all others first)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { game_id } = await req.json()
  if (!game_id) return NextResponse.json({ error: 'game_id required' }, { status: 400 })

  // Clear all existing free picks
  await supabaseAdmin
    .from('games')
    .update({ is_free_pick: false })
    .eq('is_free_pick', true)

  // Set the new free pick
  const { data: game, error } = await supabaseAdmin
    .from('games')
    .update({ is_free_pick: true })
    .eq('id', game_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ game })
}
