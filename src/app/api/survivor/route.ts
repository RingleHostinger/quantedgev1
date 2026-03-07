import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

// GET: fetch user's survivor pool and picks
export async function GET() {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fresh plan_type check
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('plan_type')
    .eq('id', session.userId)
    .single()
  const isPremium = userRow?.plan_type === 'premium'

  // Fetch active pool
  const { data: pool } = await supabaseAdmin
    .from('survivor_pools')
    .select('*')
    .eq('user_id', session.userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Fetch picks for this pool if it exists
  let picks: Record<string, unknown>[] = []
  if (pool) {
    const { data } = await supabaseAdmin
      .from('survivor_picks')
      .select('*')
      .eq('pool_id', pool.id)
      .order('round_number', { ascending: true })
    picks = data || []
  }

  return NextResponse.json({ pool: pool || null, picks, isPremium })
}

// POST: create or update a survivor pool config
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { pool_name, pool_size, pick_format, team_reuse, late_round_rule, strike_rule } = body

  // Deactivate existing pools first
  await supabaseAdmin
    .from('survivor_pools')
    .update({ is_active: false })
    .eq('user_id', session.userId)

  const { data: pool, error } = await supabaseAdmin
    .from('survivor_pools')
    .insert({
      user_id: session.userId,
      pool_name: pool_name || 'My Survivor Pool',
      pool_size: pool_size || 'small',
      pick_format: pick_format || 'one_per_round',
      team_reuse: team_reuse ?? false,
      late_round_rule: late_round_rule || 'none',
      strike_rule: strike_rule || 'one_strike',
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create pool' }, { status: 500 })
  }

  return NextResponse.json({ pool })
}

// PATCH: record a pick made by the user
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { pool_id, round_number, team_name, team_seed, opponent_name, opponent_seed, win_probability, survivor_value_score, ai_confidence } = body

  if (!pool_id || !round_number || !team_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Upsert: replace any existing pick for this round
  await supabaseAdmin
    .from('survivor_picks')
    .delete()
    .eq('pool_id', pool_id)
    .eq('round_number', round_number)

  const { data: pick, error } = await supabaseAdmin
    .from('survivor_picks')
    .insert({
      pool_id,
      user_id: session.userId,
      round_number,
      team_name,
      team_seed,
      opponent_name,
      opponent_seed,
      win_probability,
      survivor_value_score,
      ai_confidence,
      result: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save pick' }, { status: 500 })
  }

  return NextResponse.json({ pick })
}
