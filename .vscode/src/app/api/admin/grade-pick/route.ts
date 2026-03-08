/**
 * POST /api/admin/grade-pick
 *
 * Manually grade a single official pick as win, loss, or push.
 * Admin only. Updates result, settled_at, updated_at.
 *
 * Body: { id: string; result: 'win' | 'loss' | 'push' }
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

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  let body: { id?: string; result?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, result } = body

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing pick id' }, { status: 400 })
  }

  if (!['win', 'loss', 'push'].includes(result ?? '')) {
    return NextResponse.json({ error: 'result must be win, loss, or push' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('official_picks')
    .update({
      result,
      result_recorded_at: now,
    })
    .eq('id', id)
    .select('id, result, pick_team, league, bet_type, home_team, away_team')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, pick: data })
}
