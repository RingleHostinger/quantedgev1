import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'
import { computePrizePool } from '@/lib/officialContestUtils'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Official pool
  const { data: pool } = await supabaseAdmin
    .from('survivor_pools')
    .select('id, pool_name, is_active, round_states')
    .eq('is_official', true)
    .single()

  if (!pool) {
    return NextResponse.json({ error: 'Official pool not found' }, { status: 404 })
  }

  // All entries
  const { data: entries } = await supabaseAdmin
    .from('official_survivor_entries')
    .select('id, user_id, entry_number, ls_order_id, ls_order_ref, amount_paid, status, created_at')
    .eq('pool_id', pool.id)
    .order('created_at', { ascending: true })

  const allEntries = entries ?? []

  // User info for all entrants
  const userIds = [...new Set(allEntries.map((e) => e.user_id))]
  const userMap: Record<string, { name: string; email: string }> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .in('id', userIds)
    for (const u of users ?? []) {
      userMap[u.id] = { name: u.name ?? u.email, email: u.email }
    }
  }

  // Picks for all entries
  const entryIds = allEntries.map((e) => e.id)
  let pickCounts: Record<string, { won: number; eliminated: boolean }> = {}
  if (entryIds.length > 0) {
    const { data: picks } = await supabaseAdmin
      .from('survivor_picks')
      .select('official_entry_id, result')
      .in('official_entry_id', entryIds)
    for (const p of picks ?? []) {
      if (!p.official_entry_id) continue
      if (!pickCounts[p.official_entry_id]) {
        pickCounts[p.official_entry_id] = { won: 0, eliminated: false }
      }
      if (p.result === 'won') pickCounts[p.official_entry_id].won++
      if (p.result === 'eliminated') pickCounts[p.official_entry_id].eliminated = true
    }
  }

  const activeEntries = allEntries.filter((e) => e.status === 'active')
  const prizePool = computePrizePool(activeEntries.length)

  const aliveCount = activeEntries.filter((e) => !pickCounts[e.id]?.eliminated).length
  const eliminatedCount = activeEntries.filter((e) => pickCounts[e.id]?.eliminated).length

  const entryList = allEntries.map((e) => ({
    id: e.id,
    userId: e.user_id,
    displayName: userMap[e.user_id]?.name ?? 'Unknown',
    email: userMap[e.user_id]?.email ?? '',
    entryNumber: e.entry_number,
    lsOrderId: e.ls_order_id,
    lsOrderRef: e.ls_order_ref,
    amountPaidCents: e.amount_paid,
    status: e.status,
    entryStatus: pickCounts[e.id]?.eliminated ? 'eliminated' : 'alive',
    picksCorrect: pickCounts[e.id]?.won ?? 0,
    createdAt: e.created_at,
  }))

  return NextResponse.json({
    pool,
    prizePool,
    aliveCount,
    eliminatedCount,
    totalEntries: allEntries.length,
    activeEntries: activeEntries.length,
    entryList,
    roundStates: pool.round_states || { round64: 'open', round32: 'open', sweet16: 'open', elite8: 'open', finalFour: 'open', championship: 'open' },
  })
}

// POST: Update round states (open/close/grade)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { round_key, state } = body

  if (!round_key || !state) {
    return NextResponse.json({ error: 'round_key and state are required' }, { status: 400 })
  }

  const validStates = ['open', 'closed', 'graded']
  if (!validStates.includes(state)) {
    return NextResponse.json({ error: 'state must be open, closed, or graded' }, { status: 400 })
  }

  const validRoundKeys = ['round64', 'round32', 'sweet16', 'elite8', 'finalFour', 'championship']
  if (!validRoundKeys.includes(round_key)) {
    return NextResponse.json({ error: 'Invalid round_key' }, { status: 400 })
  }

  // Get official pool
  const { data: pool } = await supabaseAdmin
    .from('survivor_pools')
    .select('round_states')
    .eq('is_official', true)
    .single()

  if (!pool) {
    return NextResponse.json({ error: 'Official pool not found' }, { status: 404 })
  }

  const currentStates = (pool.round_states as Record<string, string>) || {
    round64: 'open',
    round32: 'open',
    sweet16: 'open',
    elite8: 'open',
    finalFour: 'open',
    championship: 'open',
  }

  // Update the specific round
  currentStates[round_key] = state

  const { error } = await supabaseAdmin
    .from('survivor_pools')
    .update({ round_states: currentStates })
    .eq('is_official', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, round_states: currentStates })
}
