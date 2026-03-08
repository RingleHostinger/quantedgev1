import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

// GET: return current test mode state
export async function GET() {
  const session = await getSession()
  if (!session?.userId || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', 'survivor_test_mode')
    .single()

  return NextResponse.json({ enabled: data?.value === 'true' })
}

// POST: toggle test mode
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const enabled = Boolean(body.enabled)

  const { error } = await supabaseAdmin
    .from('admin_settings')
    .update({ value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() })
    .eq('key', 'survivor_test_mode')

  if (error) {
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }

  return NextResponse.json({ enabled })
}
