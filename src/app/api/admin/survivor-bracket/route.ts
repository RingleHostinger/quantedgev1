import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

// GET - Get bracket data and confirmation status
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()

  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Get official pool
  const { data: pool } = await supabaseAdmin
    .from('survivor_pools')
    .select('id, pool_name, bracket_data, bracket_confirmed, confirmed_at, is_official')
    .eq('is_official', true)
    .single()

  if (!pool) {
    return NextResponse.json({
      bracketData: null,
      isConfirmed: false,
      confirmedAt: null,
      poolExists: false
    })
  }

  // Get test mode and live mode settings
  const { data: testModeSetting } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', 'survivor_test_mode')
    .single()

  const { data: liveModeSetting } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', 'survivor_live_mode')
    .single()

  return NextResponse.json({
    poolExists: true,
    poolId: pool.id,
    bracketData: pool.bracket_data,
    isConfirmed: pool.bracket_confirmed,
    confirmedAt: pool.confirmed_at,
    testMode: testModeSetting?.value === 'true',
    liveMode: liveModeSetting?.value === 'true',
  })
}

// POST - Insert or update bracket data (admin only)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()

  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const { bracketData, action } = body

  // Get or create official pool
  let { data: pool } = await supabaseAdmin
    .from('survivor_pools')
    .select('id')
    .eq('is_official', true)
    .single()

  let poolId: string

  if (!pool) {
    // Create official pool
    const { data: newPool, error: createError } = await supabaseAdmin
      .from('survivor_pools')
      .insert({
        user_id: session.userId,
        pool_name: 'Official Survivor Contest',
        pool_size: 'large',
        pick_format: 'one_per_round',
        team_reuse: false,
        late_round_rule: 'none',
        strike_rule: 'one_strike',
        is_active: true,
        is_official: true,
        bracket_data: bracketData || {},
        bracket_confirmed: false,
      })
      .select('id')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
    poolId = newPool.id
  } else {
    poolId = pool.id
  }

  if (action === 'confirm') {
    // Confirm the bracket - make it live
    const { error: updateError } = await supabaseAdmin
      .from('survivor_pools')
      .update({
        bracket_confirmed: true,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', poolId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Update admin settings
    await supabaseAdmin
      .from('admin_settings')
      .upsert({ key: 'survivor_bracket_confirmed', value: 'true', updated_at: new Date().toISOString() })

    return NextResponse.json({
      success: true,
      message: 'Bracket confirmed and made live',
      poolId
    })
  }

  // Just save/update bracket data
  const { error: updateError } = await supabaseAdmin
    .from('survivor_pools')
    .update({
      bracket_data: bracketData || {},
      bracket_confirmed: false,
    })
    .eq('id', poolId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: 'Bracket data saved',
    poolId
  })
}
