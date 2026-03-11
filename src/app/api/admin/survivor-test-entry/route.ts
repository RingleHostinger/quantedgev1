import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

// POST - Create admin test entry (free, doesn't count toward stats)
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
  const { userId, entryNumber } = body

  if (!userId || !entryNumber) {
    return NextResponse.json({ error: 'userId and entryNumber are required' }, { status: 400 })
  }

  // Get official pool
  const { data: pool } = await supabaseAdmin
    .from('survivor_pools')
    .select('id')
    .eq('is_official', true)
    .single()

  if (!pool) {
    return NextResponse.json({ error: 'Official pool not found. Create bracket first.' }, { status: 404 })
  }

  // Check if user already has this entry number
  const { data: existing } = await supabaseAdmin
    .from('official_survivor_entries')
    .select('id')
    .eq('pool_id', pool.id)
    .eq('user_id', userId)
    .eq('entry_number', entryNumber)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Entry already exists for this user' }, { status: 400 })
  }

  // Create test entry (free, doesn't count)
  const { data: entry, error } = await supabaseAdmin
    .from('official_survivor_entries')
    .insert({
      pool_id: pool.id,
      user_id: userId,
      entry_number: entryNumber,
      status: 'active',
      is_test_entry: true, // Mark as test entry
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    entry,
    message: 'Test entry created (free, excluded from stats)',
  })
}

// GET - Get all entries including test entries (admin view)
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
    .select('id')
    .eq('is_official', true)
    .single()

  if (!pool) {
    return NextResponse.json({ entries: [] })
  }

  // Get all entries
  const { data: entries } = await supabaseAdmin
    .from('official_survivor_entries')
    .select(`
      id,
      user_id,
      entry_number,
      status,
      is_test_entry,
      created_at,
      users!inner(name, email)
    `)
    .eq('pool_id', pool.id)
    .order('created_at', { ascending: true })

  // Transform data
  const transformedEntries = (entries ?? []).map((e: Record<string, unknown>) => ({
    id: e.id,
    userId: e.user_id,
    entryNumber: e.entry_number,
    status: e.status,
    isTestEntry: e.is_test_entry,
    createdAt: e.created_at,
    userName: (e.users as Record<string, unknown>)?.name ?? 'Unknown',
    userEmail: (e.users as Record<string, unknown>)?.email ?? '',
  }))

  return NextResponse.json({ entries: transformedEntries })
}
