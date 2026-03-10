import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getTodaySlateRange, filterToWindow } from '@/lib/slateUtils'

export async function GET() {
  const { start, end } = getTodaySlateRange()

  // Run DB queries in parallel
  const [oddsResult, engineResult, gradeResult, slateRows, officialPicksResult] = await Promise.all([
    supabaseAdmin
      .from('cached_odds')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single(),
    supabaseAdmin
      .from('engine_runs')
      .select('run_at, notes')
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
    // Slate games: use lt-only + JS-filter workaround for nubase .gte+.lt bug
    supabaseAdmin
      .from('prediction_cache')
      .select('game_id, league, commence_time')
      .lt('commence_time', end)
      .order('commence_time', { ascending: true }),
    // Today's official picks
    supabaseAdmin
      .from('official_picks')
      .select('id, result, league, commence_time')
      .lt('commence_time', end),
  ])

  // JS-filter for lower bound
  const slateGames = filterToWindow(slateRows.data ?? [], 'commence_time', start)
  const todayPicks = filterToWindow(officialPicksResult.data ?? [], 'commence_time', start)

  // Per-league slate counts
  const slateByLeague: Record<string, number> = {}
  for (const g of slateGames) {
    const league = (g as Record<string, unknown>).league as string
    slateByLeague[league] = (slateByLeague[league] ?? 0) + 1
  }

  // Official picks summary
  const picksTotal = todayPicks.length
  const picksPending = todayPicks.filter((p) => (p as Record<string, unknown>).result === 'pending').length

  const oddsUpdatedAt: string | null = oddsResult.data?.last_updated ?? null
  const predictionsGeneratedAt: string | null = engineResult.data?.run_at ?? null
  const lastPickGradeAt: string | null = gradeResult.data?.result_recorded_at ?? null
  const gamesInSlate: number = slateGames.length
  const lastRunNotes = engineResult.data?.notes ?? null

  return NextResponse.json({
    oddsUpdatedAt,
    predictionsGeneratedAt,
    lastPickGradeAt,
    gamesInSlate,
    slateByLeague,
    slateStart: start,
    slateEnd: end,
    officialPicksToday: picksTotal,
    officialPicksPending: picksPending,
    lastRunNotes,
  })
}
