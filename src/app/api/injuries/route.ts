import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const game_id = searchParams.get('game_id')

  let query = supabaseAdmin
    .from('injuries')
    .select('*')
    .order('created_at', { ascending: false })

  if (game_id) query = query.eq('game_id', game_id)

  const { data: injuries, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ injuries: injuries || [] })
}
