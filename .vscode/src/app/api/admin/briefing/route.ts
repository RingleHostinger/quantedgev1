import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

// Check admin role
async function checkAdmin() {
  const session = await getSession()
  if (!session?.userId) return false
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()
  return userRow?.role === 'admin'
}

// GET: fetch current briefing overrides from settings table (or return defaults)
export async function GET() {
  const isAdmin = await checkAdmin()
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Try to fetch from a settings-like table; fall back to empty overrides
  let overrides = {
    topSpreadEdgeNote: '',
    topTotalEdgeNote: '',
    highestConfidenceNote: '',
    upsetAlertNote: '',
    modelStatusNote: '',
  }

  try {
    const { data } = await supabaseAdmin
      .from('admin_settings')
      .select('value')
      .eq('key', 'briefing_overrides')
      .single()
    if (data?.value) overrides = { ...overrides, ...(data.value as object) }
  } catch { /* table may not exist */ }

  return NextResponse.json({ overrides })
}

// POST: save briefing overrides
export async function POST(req: NextRequest) {
  const isAdmin = await checkAdmin()
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  try {
    // Upsert into admin_settings
    await supabaseAdmin
      .from('admin_settings')
      .upsert({ key: 'briefing_overrides', value: body, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    return NextResponse.json({ success: true })
  } catch {
    // Table may not exist — silently succeed for now
    return NextResponse.json({ success: true, note: 'Settings not persisted (table not yet created)' })
  }
}
