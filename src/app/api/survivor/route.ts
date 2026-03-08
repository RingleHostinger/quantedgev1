import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

// ─── GET: fetch all pools for user + picks for selected/active pool ─────────
export async function GET(req: NextRequest) {
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
  const planType = userRow?.plan_type ?? 'free'
  const isPremium = planType === 'premium'
  const hasMadnessAccess = planType === 'premium' || planType === 'madness'

  // Fetch ALL pools for this user (not just active one)
  const { data: pools } = await supabaseAdmin
    .from('survivor_pools')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })

  const allPools = pools ?? []

  // Determine which pool's picks to return:
  // - If ?pool_id= query param is provided, use that pool
  // - Otherwise, use the first pool (most recently created)
  const poolIdParam = req.nextUrl.searchParams.get('pool_id')
  const targetPoolId = poolIdParam ?? allPools[0]?.id ?? null

  let picks: Record<string, unknown>[] = []
  if (targetPoolId) {
    const { data } = await supabaseAdmin
      .from('survivor_picks')
      .select('*')
      .eq('pool_id', targetPoolId)
      .order('round_number', { ascending: true })
    picks = data ?? []
  }

  // Check if admin has enabled Test Bracket Mode
  const { data: testModeSetting } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', 'survivor_test_mode')
    .single()
  const testModeActive = testModeSetting?.value === 'true'

  return NextResponse.json({
    pools: allPools,
    picks,
    isPremium: hasMadnessAccess,
    isTruePremium: isPremium,
    testModeActive,
  })
}

// ─── POST: create a new pool ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { pool_name, pool_size, pick_format, team_reuse, late_round_rule, strike_rule, picks_per_round } = body

  // Create new pool — do NOT deactivate existing pools (users can have multiple)
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
      picks_per_round: pick_format === 'multiple_per_round' ? (picks_per_round ?? null) : null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create pool' }, { status: 500 })
  }

  return NextResponse.json({ pool })
}

// ─── PATCH: multi-action handler ──────────────────────────────────────────────
//
// action: 'save_pick'    — save/replace a pick for a round (default)
// action: 'update_pool'  — update pool rules in place
// action: 'delete_pick'  — delete a single pick by pick_id
// action: 'sync_results' — auto-grade pending picks against game scores
//
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const action = body.action ?? 'save_pick'

  // ── update_pool ─────────────────────────────────────────────────────────
  if (action === 'update_pool') {
    const { pool_id, pool_name, pool_size, pick_format, team_reuse, late_round_rule, strike_rule, picks_per_round } = body
    if (!pool_id) return NextResponse.json({ error: 'Missing pool_id' }, { status: 400 })

    const { data: pool, error } = await supabaseAdmin
      .from('survivor_pools')
      .update({
        pool_name,
        pool_size,
        pick_format,
        team_reuse,
        late_round_rule,
        strike_rule,
        picks_per_round: pick_format === 'multiple_per_round' ? (picks_per_round ?? null) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pool_id)
      .eq('user_id', session.userId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to update pool' }, { status: 500 })
    return NextResponse.json({ pool })
  }

  // ── delete_pick ─────────────────────────────────────────────────────────
  if (action === 'delete_pick') {
    const { pick_id } = body
    if (!pick_id) return NextResponse.json({ error: 'Missing pick_id' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('survivor_picks')
      .delete()
      .eq('id', pick_id)
      .eq('user_id', session.userId)

    if (error) return NextResponse.json({ error: 'Failed to delete pick' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── sync_results ─────────────────────────────────────────────────────────
  if (action === 'sync_results') {
    const { pool_id } = body
    if (!pool_id) return NextResponse.json({ error: 'Missing pool_id' }, { status: 400 })

    const { data: pendingPicks } = await supabaseAdmin
      .from('survivor_picks')
      .select('id, team_name')
      .eq('pool_id', pool_id)
      .eq('user_id', session.userId)
      .eq('result', 'pending')

    let synced = 0
    for (const pick of pendingPicks ?? []) {
      // Find completed NCAAB games and match by team name
      const { data: games } = await supabaseAdmin
        .from('games')
        .select('home_team_name, away_team_name, actual_home_score, actual_away_score')
        .eq('league', 'NCAAB')
        .in('status', ['final', 'completed'])
        .limit(50)

      if (!games) continue

      const game = games.find(
        (g) =>
          g.home_team_name?.toLowerCase().includes(pick.team_name.toLowerCase()) ||
          g.away_team_name?.toLowerCase().includes(pick.team_name.toLowerCase())
      )

      if (!game || game.actual_home_score == null || game.actual_away_score == null) continue

      const teamIsHome = game.home_team_name?.toLowerCase().includes(pick.team_name.toLowerCase())
      const teamWon = teamIsHome
        ? game.actual_home_score > game.actual_away_score
        : game.actual_away_score > game.actual_home_score

      await supabaseAdmin
        .from('survivor_picks')
        .update({ result: teamWon ? 'won' : 'eliminated', updated_at: new Date().toISOString() })
        .eq('id', pick.id)

      synced++
    }

    return NextResponse.json({ success: true, synced })
  }

  // ── save_pick (default) ──────────────────────────────────────────────────
  const { pool_id, round_number, team_name, team_seed, opponent_name, opponent_seed, win_probability, survivor_value_score, ai_confidence } = body

  if (!pool_id || !round_number || !team_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify pool belongs to this user
  const { data: poolRow } = await supabaseAdmin
    .from('survivor_pools')
    .select('id')
    .eq('id', pool_id)
    .eq('user_id', session.userId)
    .single()

  if (!poolRow) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })

  // Replace any existing pick for this round in this pool
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
      team_seed: team_seed ?? null,
      opponent_name: opponent_name ?? null,
      opponent_seed: opponent_seed ?? null,
      win_probability: win_probability ?? null,
      survivor_value_score: survivor_value_score != null ? Math.round(survivor_value_score) : null,
      ai_confidence: ai_confidence != null ? Math.round(ai_confidence) : null,
      result: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save pick' }, { status: 500 })
  }

  return NextResponse.json({ pick })
}
