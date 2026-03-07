import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('bracket_teams')
      .select('*')
      .eq('season', 2025)
      .order('region')
      .order('seed')

    if (error) throw error

    return NextResponse.json({ teams: data ?? [] })
  } catch (err) {
    console.error('bracket-teams error:', err)
    return NextResponse.json({ teams: [] })
  }
}
