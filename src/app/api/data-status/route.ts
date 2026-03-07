import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getTodaySlateGameIds } from '@/lib/slateUtils'

const ODDS_TTL_MINUTES = 60

export async function GET() {
  // Run DB queries and slate lookup in parallel.
  // getTodaySlateGameIds() uses lt-only + JS-filter workaround for nubase .gte+.lt bug.
  const [oddsResult, engineResult, gradeResult, slateInfo] = await Promise.all([
    supabaseAdmin
      .from('cached_odds')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single(),
    supabaseAdmin
      .from('engine_runs')
      .select('run_at')
      .order('run_at', { ascending: false })
      .limit(1)
      .single(),
    // Last time a pick was graded (result_recorded_at)
    supabaseAdmin
      .from('official_picks')
      .select('result_recorded_at')
      .not('result_recorded_at', 'is', null)
      .order('result_recorded_at', { ascending: false })
      .limit(1)
      .single(),
    // Current slate game count (uses lt-only + JS-filter pattern)
    getTodaySlateGameIds(),
  ])

  const oddsUpdatedAt: string | null = oddsResult.data?.last_updated ?? null
  const predictionsGeneratedAt: string | null = engineResult.data?.run_at ?? null
  const lastPickGradeAt: string | null = gradeResult.data?.result_recorded_at ?? null
  const gamesInSlate: number = slateInfo.count
  const slateStart = slateInfo.slateStart
  const slateEnd = slateInfo.slateEnd

  let nextRefreshInMinutes: number | null = null
  if (oddsUpdatedAt) {
    const ageMinutes = (Date.now() - new Date(oddsUpdatedAt).getTime()) / 60000
    nextRefreshInMinutes = Math.max(0, Math.round(ODDS_TTL_MINUTES - ageMinutes))
  }

  return NextResponse.json({
    oddsUpdatedAt,
    predictionsGeneratedAt,
    lastPickGradeAt,
    gamesInSlate,
    slateStart,
    slateEnd,
    nextRefreshInMinutes,
  })
}
