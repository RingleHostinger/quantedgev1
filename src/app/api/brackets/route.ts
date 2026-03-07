import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { analyzeBracket, BracketTeam, BracketPicks } from '@/lib/bracket-analysis'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('plan_type')
    .eq('id', session.userId)
    .single()
  if (userRow?.plan_type !== 'premium') {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('brackets')
    .select('id, name, pool_size, source, bracket_score, win_probability, risk_level, uniqueness_score, created_at, updated_at')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ brackets: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('plan_type')
    .eq('id', session.userId)
    .single()
  if (userRow?.plan_type !== 'premium') {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const body = await req.json()
  const { name, pool_size, source, picks } = body

  if (!picks) return NextResponse.json({ error: 'picks required' }, { status: 400 })

  // Run analysis
  const { data: teamsData } = await supabaseAdmin
    .from('bracket_teams')
    .select('*')
    .eq('season', 2025)

  const analysis = analyzeBracket(picks as BracketPicks, pool_size ?? 25, (teamsData ?? []) as BracketTeam[])

  const { data, error } = await supabaseAdmin
    .from('brackets')
    .insert({
      user_id: session.userId,
      name: name || 'My Bracket',
      pool_size: pool_size ?? 25,
      source: source ?? 'builder',
      picks,
      analysis,
      bracket_score: analysis.scoreGrade,
      win_probability: analysis.winProbs[pool_size ?? 25],
      risk_level: analysis.riskLevel,
      uniqueness_score: analysis.uniquenessScore,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bracket: data })
}
