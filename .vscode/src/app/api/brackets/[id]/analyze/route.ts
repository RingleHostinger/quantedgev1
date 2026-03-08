import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { analyzeBracket, generateOptimizedBrackets, BracketTeam, BracketPicks } from '@/lib/bracket-analysis'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: bracket } = await supabaseAdmin
    .from('brackets')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.userId)
    .single()

  if (!bracket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: teamsData } = await supabaseAdmin
    .from('bracket_teams')
    .select('*')
    .eq('season', 2025)

  const teams = (teamsData ?? []) as BracketTeam[]
  const analysis = analyzeBracket(bracket.picks as BracketPicks, bracket.pool_size, teams)
  const optimized = generateOptimizedBrackets(bracket.picks as BracketPicks, teams, bracket.pool_size)

  // Analyze each optimized version
  const safeAnalysis = analyzeBracket(optimized.safe, bracket.pool_size, teams)
  const balancedAnalysis = analyzeBracket(optimized.balanced, bracket.pool_size, teams)
  const aggressiveAnalysis = analyzeBracket(optimized.aggressive, bracket.pool_size, teams)

  // Save updated analysis to DB
  await supabaseAdmin
    .from('brackets')
    .update({
      analysis,
      bracket_score: analysis.scoreGrade,
      win_probability: analysis.winProbs[bracket.pool_size],
      risk_level: analysis.riskLevel,
      uniqueness_score: analysis.uniquenessScore,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return NextResponse.json({
    analysis,
    optimized: {
      safe: { picks: optimized.safe, analysis: safeAnalysis },
      balanced: { picks: optimized.balanced, analysis: balancedAnalysis },
      aggressive: { picks: optimized.aggressive, analysis: aggressiveAnalysis },
    },
  })
}
