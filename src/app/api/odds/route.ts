/**
 * GET /api/odds
 *
 * Returns cached odds. Auto-refreshes the cache if it is older than 60 minutes.
 * When a refresh happens, also syncs games table + runs the prediction engine.
 * Frontend should always hit this endpoint — never The Odds API directly.
 *
 * Query params (all optional):
 *   ?sport=Basketball
 *   ?league=NBA
 *   ?game_id=<odds-api-game-id>
 *   ?limit=50
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOddsWithAutoRefresh } from '@/lib/oddsCacheService'
import { syncOddsToGamesAndPredictions } from '@/lib/oddsSyncService'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const sport   = searchParams.get('sport')   ?? undefined
  const league  = searchParams.get('league')  ?? undefined
  const game_id = searchParams.get('game_id') ?? undefined
  const limitParam = searchParams.get('limit')
  const limit   = limitParam ? Math.min(parseInt(limitParam, 10), 500) : undefined

  try {
    const { rows, refreshed, cacheAgeMinutes, refreshResult } =
      await getOddsWithAutoRefresh({ sport, league, game_id, limit })

    // When odds are freshly fetched, sync to games + run prediction engine
    // Run in background (don't await) so the odds response is fast
    if (refreshed && refreshResult?.success) {
      syncOddsToGamesAndPredictions().catch((err) => {
        console.error('[GET /api/odds] Background sync error:', err)
      })
    }

    return NextResponse.json({
      odds: rows,
      meta: {
        count: rows.length,
        cacheAgeMinutes,
        refreshed,
        ...(refreshed && refreshResult
          ? {
              refreshSummary: {
                totalFetched:    refreshResult.totalFetched,
                totalUpserted:   refreshResult.totalUpserted,
                sportsRefreshed: refreshResult.sportsRefreshed,
                errors:          refreshResult.errors,
                refreshedAt:     refreshResult.refreshedAt,
              },
            }
          : {}),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[GET /api/odds] Unhandled error:', msg)

    // Last-resort: try to return whatever is in the cache even if refresh errored
    try {
      const { getCachedOdds, getCacheAgeMinutes } = await import('@/lib/oddsCacheService')
      const [rows, cacheAgeMinutes] = await Promise.all([
        getCachedOdds({ sport, league, game_id, limit }),
        getCacheAgeMinutes(),
      ])

      return NextResponse.json(
        {
          odds: rows,
          meta: { count: rows.length, cacheAgeMinutes, refreshed: false, staleReturnedDueToError: true },
          warning: 'Live odds fetch failed — returning most recent cached data.',
        },
        { status: 200 } // Return 200 so the UI still works
      )
    } catch {
      return NextResponse.json(
        { odds: [], meta: { count: 0 }, error: 'Odds service temporarily unavailable.' },
        { status: 503 }
      )
    }
  }
}
