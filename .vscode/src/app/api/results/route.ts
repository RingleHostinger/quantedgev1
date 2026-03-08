import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function GET() {
  const { data: results, error } = await supabaseAdmin
    .from('prediction_results')
    .select(`
      *,
      predictions (
        id,
        predicted_home_score,
        predicted_away_score,
        confidence,
        ai_spread,
        ai_total,
        games (
          home_team_name,
          away_team_name,
          sport,
          league,
          actual_home_score,
          actual_away_score,
          sportsbook_spread,
          sportsbook_total,
          scheduled_at
        )
      )
    `)
    .order('evaluated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 })
  }

  const total = results?.length || 0
  const correct = results?.filter((r) => r.is_correct).length || 0
  const spreadCorrect = results?.filter((r) => r.spread_correct).length || 0
  const totalCorrect = results?.filter((r) => r.total_correct).length || 0
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
  const spreadAccuracy = total > 0 ? Math.round((spreadCorrect / total) * 100) : 0
  const totalAccuracy = total > 0 ? Math.round((totalCorrect / total) * 100) : 0

  return NextResponse.json({ results, accuracy, spreadAccuracy, totalAccuracy, total, correct })
}
