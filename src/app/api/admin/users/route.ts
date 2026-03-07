import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, name, email, plan_type, role, daily_free_picks_used, created_at')
    .order('created_at', { ascending: false })

  return NextResponse.json({ users })
}
