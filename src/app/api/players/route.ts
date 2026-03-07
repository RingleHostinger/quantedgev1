import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function GET() {
  const { data: players, error } = await supabaseAdmin
    .from('players')
    .select(`
      *,
      teams (
        id,
        name,
        sport
      )
    `)
    .order('goals', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
  }

  return NextResponse.json({ players })
}
