import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function GET() {
  const { data: teams, error } = await supabaseAdmin
    .from('teams')
    .select('*')
    .order('season_wins', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 })
  }

  return NextResponse.json({ teams })
}
