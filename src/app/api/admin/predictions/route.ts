import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const {
    game_id, predicted_home_score, predicted_away_score,
    confidence, home_win_probability, away_win_probability, draw_probability,
    ai_reasoning, is_trending, is_upset_pick, is_premium,
    ai_spread, ai_total,
  } = body

  const { data: prediction, error } = await supabaseAdmin
    .from('predictions')
    .insert({
      game_id,
      predicted_home_score,
      predicted_away_score,
      confidence,
      home_win_probability,
      away_win_probability,
      draw_probability,
      ai_reasoning,
      is_trending: is_trending || false,
      is_upset_pick: is_upset_pick || false,
      is_premium: is_premium || false,
      ai_spread: ai_spread ?? null,
      ai_total: ai_total ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prediction })
}
