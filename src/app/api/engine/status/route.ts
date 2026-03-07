import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { ENGINE_VERSION } from '@/lib/prediction-engine'

/**
 * GET /api/engine/status
 * Public endpoint — returns engine health, last run time, prediction counts.
 * Used by admin dashboard and for monitoring.
 */
export async function GET() {
  const [lastRunResult, predCountResult, gamesResult] = await Promise.all([
    supabaseAdmin
      .from('engine_runs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(1)
      .single(),

    supabaseAdmin
      .from('predictions')
      .select('id', { count: 'exact', head: true }),

    supabaseAdmin
      .from('games')
      .select('id, status, engine_run_at, league')
      .eq('status', 'scheduled'),
  ])

  const lastRun = lastRunResult.data
  const totalPredictions = predCountResult.count ?? 0
  const scheduledGames = gamesResult.data || []

  const pendingGames = scheduledGames.filter((g) => {
    if (!g.engine_run_at) return true
    const hoursSince = (Date.now() - new Date(g.engine_run_at).getTime()) / 3600000
    return hoursSince > 1
  })

  // League breakdown
  const leagueCounts: Record<string, number> = {}
  for (const g of scheduledGames) {
    const l = g.league || 'Unknown'
    leagueCounts[l] = (leagueCounts[l] || 0) + 1
  }

  // Data source connection status
  const dataSources = {
    oddsApi: { name: 'The Odds API', connected: !!(process.env.ODDS_API_KEY), envVar: 'ODDS_API_KEY' },
    sportradar: { name: 'Sportradar', connected: !!(process.env.SPORTRADAR_API_KEY), envVar: 'SPORTRADAR_API_KEY' },
    sportsDataIo: { name: 'SportsDataIO', connected: !!(process.env.SPORTSDATA_API_KEY), envVar: 'SPORTSDATA_API_KEY' },
  }

  const anyRealDataConnected = Object.values(dataSources).some((d) => d.connected)

  return NextResponse.json({
    engineVersion: ENGINE_VERSION,
    status: 'operational',
    usingMockData: !anyRealDataConnected,
    lastRun: lastRun ? {
      runAt: lastRun.run_at,
      gamesProcessed: lastRun.games_processed,
      predictionsGenerated: lastRun.predictions_generated,
      predictionsUpdated: lastRun.predictions_updated,
      runStatus: lastRun.status,
      durationEstimateMs: null,
    } : null,
    totalPredictions,
    scheduledGames: scheduledGames.length,
    pendingGames: pendingGames.length,
    leagueCounts,
    dataSources,
    supportedLeagues: ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'EPL', 'UCL'],
    supportedSports: ['Basketball', 'American Football', 'Baseball', 'Hockey', 'Soccer'],
  })
}
