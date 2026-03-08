import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role, plan_type, daily_free_picks_used, picks_reset_at, stripe_customer_id, stripe_subscription_id, created_at')
    .eq('id', session.userId)
    .single()

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Reset daily picks if needed
  const resetAt = new Date(user.picks_reset_at)
  const now = new Date()
  if (now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000) {
    await supabaseAdmin
      .from('users')
      .update({ daily_free_picks_used: 0, picks_reset_at: now.toISOString() })
      .eq('id', user.id)
    user.daily_free_picks_used = 0
  }

  return NextResponse.json({ user })
}
