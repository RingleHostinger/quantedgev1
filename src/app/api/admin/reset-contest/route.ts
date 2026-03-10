/**
 * POST /api/admin/reset-contest
 *
 * Admin-only actions to reset the official picks and/or model stats.
 *
 * Body: { action: 'clear_picks' | 'reset_stats' }
 *
 * clear_picks:
 *   Deletes ALL rows from official_picks (pending + settled).
 *
 * reset_stats:
 *   Deletes ALL settled official picks (win/loss/push) so the record
 *   starts from zero. Pending picks are also cleared so the slate is
 *   fully clean and stats + history stay consistent.
 *   Equivalent to a full wipe of official_picks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

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

  const body = await req.json()
  const { action } = body

  if (action === 'clear_picks') {
    // Delete ALL official picks (pending + settled)
    const { error, count } = await supabaseAdmin
      .from('official_picks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // match-all pattern
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'clear_picks',
      message: 'All official picks (pending + settled) have been cleared.',
      deleted: count ?? 'unknown',
    })
  }

  if (action === 'reset_stats') {
    // Full wipe — clears pending + settled so stats start from 0-0-0
    const { error, count } = await supabaseAdmin
      .from('official_picks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'reset_stats',
      message: 'Model stats reset to 0-0-0. All official picks (pending + settled) cleared.',
      deleted: count ?? 'unknown',
    })
  }

  return NextResponse.json({ error: 'Invalid action. Use clear_picks or reset_stats.' }, { status: 400 })
}
