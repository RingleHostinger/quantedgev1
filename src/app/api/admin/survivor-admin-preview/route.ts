import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()

  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { data } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', 'survivor_admin_preview')
    .single()

  return NextResponse.json({ enabled: data?.value === 'true' })
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()

  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const enabled = Boolean(body.enabled)

  // Upsert the setting
  const { error } = await supabaseAdmin
    .from('admin_settings')
    .upsert({
      key: 'survivor_admin_preview',
      value: enabled ? 'true' : 'false',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  if (error) {
    console.error('Failed to update admin preview setting:', error)
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }

  return NextResponse.json({ enabled })
}
