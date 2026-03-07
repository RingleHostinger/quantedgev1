import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { analyzeBracket, BracketTeam, BracketPicks } from '@/lib/bracket-analysis'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('brackets')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.userId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ bracket: data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('plan_type')
    .eq('id', session.userId)
    .single()
  if (userRow?.plan_type !== 'premium') {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const body = await req.json()
  const { name, pool_size, picks } = body

  // Re-run analysis if picks or pool_size changed
  let analysis = undefined
  if (picks || pool_size) {
    const { data: existing } = await supabaseAdmin
      .from('brackets')
      .select('picks, pool_size')
      .eq('id', id)
      .eq('user_id', session.userId)
      .single()

    const finalPicks = picks ?? existing?.picks
    const finalPoolSize = pool_size ?? existing?.pool_size ?? 25

    const { data: teamsData } = await supabaseAdmin
      .from('bracket_teams')
      .select('*')
      .eq('season', 2025)

    analysis = analyzeBracket(finalPicks as BracketPicks, finalPoolSize, (teamsData ?? []) as BracketTeam[])
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name) updatePayload.name = name
  if (pool_size) updatePayload.pool_size = pool_size
  if (picks) updatePayload.picks = picks
  if (analysis) {
    updatePayload.analysis = analysis
    updatePayload.bracket_score = analysis.scoreGrade
    updatePayload.win_probability = analysis.winProbs[pool_size ?? 25]
    updatePayload.risk_level = analysis.riskLevel
    updatePayload.uniqueness_score = analysis.uniquenessScore
  }

  const { data, error } = await supabaseAdmin
    .from('brackets')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', session.userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bracket: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { error } = await supabaseAdmin
    .from('brackets')
    .delete()
    .eq('id', id)
    .eq('user_id', session.userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
