import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

async function checkAdmin() {
  const session = await getSession()
  if (!session?.userId) return false
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()
  return userRow?.role === 'admin'
}

// GET: list all predictions with their premium/free status
export async function GET() {
  const isAdmin = await checkAdmin()
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: predictions, error } = await supabaseAdmin
    .from('predictions')
    .select(`
      id, confidence, is_premium, is_trending, is_upset_pick,
      games (
        id, home_team_name, away_team_name, league, scheduled_at, is_free_pick
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  return NextResponse.json({ predictions: predictions || [] })
}

// PATCH: toggle is_premium on a prediction
export async function PATCH(req: NextRequest) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { prediction_id, is_premium } = await req.json()

  if (!prediction_id) return NextResponse.json({ error: 'prediction_id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('predictions')
    .update({ is_premium })
    .eq('id', prediction_id)

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  return NextResponse.json({ success: true })
}
