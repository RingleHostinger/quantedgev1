/**
 * GET  /api/admin/survivor-grade
 *
 * Fetch all survivor picks across all users (for admin review).
 * Query params: ?result=pending|won|eliminated|all  (default: all)
 *               &pool_id=<uuid>                      (optional filter)
 *               &user_id=<uuid>                      (optional filter)
 *
 * POST /api/admin/survivor-grade
 *
 * Manually grade one or more survivor picks. Admin only.
 * Modes:
 *   - Single pick:  { pick_id: string; result: 'won' | 'eliminated' | 'pending' }
 *   - By team/pool: { pool_id: string; team_name: string; result: 'won' | 'eliminated' }
 *                   Grades ALL picks for that team across ALL pools (or scoped to pool_id)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'

async function verifyAdmin(): Promise<boolean> {
  const session = await getSession()
  if (!session?.userId) return false
  const { data } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()
  return data?.role === 'admin'
}

// ── GET: list survivor picks ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const resultFilter = searchParams.get('result') ?? 'all'
  const poolIdFilter = searchParams.get('pool_id')
  const userIdFilter = searchParams.get('user_id')

  let query = supabaseAdmin
    .from('survivor_picks')
    .select(`
      id,
      pool_id,
      user_id,
      round_number,
      team_name,
      team_seed,
      opponent_name,
      win_probability,
      result,
      updated_at,
      survivor_pools ( pool_name, pool_size, strike_rule, pick_format ),
      users ( email, name )
    `)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (resultFilter !== 'all') {
    query = query.eq('result', resultFilter)
  }
  if (poolIdFilter) {
    query = query.eq('pool_id', poolIdFilter)
  }
  if (userIdFilter) {
    query = query.eq('user_id', userIdFilter)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ picks: data ?? [], total: (data ?? []).length })
}

// ── POST: grade picks ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  let body: {
    pick_id?: string
    pool_id?: string
    team_name?: string
    result?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { pick_id, pool_id, team_name, result } = body

  const VALID_RESULTS = ['won', 'eliminated', 'pending']
  if (!result || !VALID_RESULTS.includes(result)) {
    return NextResponse.json(
      { error: `result must be one of: ${VALID_RESULTS.join(', ')}` },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  // ── Mode 1: grade a single pick by pick_id ────────────────────────────────
  if (pick_id) {
    const { data, error } = await supabaseAdmin
      .from('survivor_picks')
      .update({ result, updated_at: now })
      .eq('id', pick_id)
      .select('id, team_name, round_number, result, pool_id, user_id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: 1, picks: [data] })
  }

  // ── Mode 2: bulk-grade by team name (within optional pool scope) ──────────
  if (team_name) {
    let query = supabaseAdmin
      .from('survivor_picks')
      .update({ result, updated_at: now })
      .ilike('team_name', `%${team_name}%`)

    if (pool_id) {
      query = query.eq('pool_id', pool_id)
    }

    const { data, error } = await query.select('id, team_name, round_number, result, pool_id, user_id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      updated: (data ?? []).length,
      picks: data ?? [],
    })
  }

  return NextResponse.json(
    { error: 'Provide either pick_id or team_name' },
    { status: 400 }
  )
}
