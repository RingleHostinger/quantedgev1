import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

interface Record {
  wins: number
  losses: number
  pushes: number
  total: number
}

function buildRecord(picks: { result: string }[]): Record {
  const settled = picks.filter((p) => p.result !== 'pending')
  return {
    wins: settled.filter((p) => p.result === 'win').length,
    losses: settled.filter((p) => p.result === 'loss').length,
    pushes: settled.filter((p) => p.result === 'push').length,
    total: settled.length,
  }
}

function winPct(record: Record): number | null {
  const denom = record.wins + record.losses  // pushes excluded from win%
  if (denom === 0) return null
  return Math.round((record.wins / denom) * 1000) / 10
}

/**
 * ROI assumes flat $110 to win $100 (standard -110 spread/total bets).
 * Win: +$100, Loss: -$110, Push: $0
 * ROI = (net profit / total wagered) × 100
 */
function calcRoi(record: Record): number | null {
  const settled = record.wins + record.losses + record.pushes
  if (settled === 0) return null
  const totalWagered = (record.wins + record.losses) * 110
  if (totalWagered === 0) return null
  const netProfit = record.wins * 100 - record.losses * 110
  return Math.round((netProfit / totalWagered) * 1000) / 10
}

function formatRecord(record: Record): string {
  return `${record.wins}-${record.losses}${record.pushes > 0 ? `-${record.pushes}` : ''}`
}

/**
 * CLV = line_at_pick - closing_line (both from the picked-team perspective).
 * Positive = model beat the closing market (got a better number early).
 * Only computable when both fields are present.
 */
function calcClv(lineAtPick: number | null, closingLine: number | null): number | null {
  if (lineAtPick == null || closingLine == null) return null
  return Math.round((lineAtPick - closingLine) * 10) / 10
}

/**
 * Average CLV across picks that have both line_at_pick and closing_line.
 * Returns null if no CLV-eligible picks exist.
 */
function avgClv(picks: { line_at_pick: number | null; closing_line: number | null }[]): number | null {
  const clvValues = picks
    .map((p) => calcClv(p.line_at_pick, p.closing_line))
    .filter((v): v is number => v !== null)
  if (clvValues.length === 0) return null
  const sum = clvValues.reduce((a, b) => a + b, 0)
  return Math.round((sum / clvValues.length) * 10) / 10
}

export async function GET() {
  const session = await getSession()
  let isPremium = false
  if (session?.userId) {
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('plan_type')
      .eq('id', session.userId)
      .single()
    isPremium = userRow?.plan_type === 'premium'
  }

  const now = new Date()
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  // Season start: August 1 of the current or previous year
  const seasonYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  const seasonStart = new Date(`${seasonYear}-08-01T00:00:00Z`).toISOString()

  // Fetch all official picks — include CLV fields
  const { data: allPicks, error } = await supabaseAdmin
    .from('official_picks')
    .select('id, result, created_at, league, bet_type, confidence_score, edge_score, commence_time, pick_team, home_team, away_team, sportsbook_line, model_line, spread_edge, line_at_pick, closing_line')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 })
  }

  const picks = allPicks || []

  // Time-windowed subsets
  const last7 = picks.filter((p) => p.created_at >= day7)
  const last30 = picks.filter((p) => p.created_at >= day30)
  const season = picks.filter((p) => p.created_at >= seasonStart)

  const last7Record = buildRecord(last7)
  const last30Record = buildRecord(last30)
  const seasonRecord = buildRecord(season)
  const allTimeRecord = buildRecord(picks)

  // Average CLV — calculated across all picks that have closing line data
  const allTimeAvgClv = avgClv(picks)
  const seasonAvgClv = avgClv(season)

  // Recent picks for display (last 20, including pending)
  const recentPicks = picks.slice(0, 20).map((p) => ({
    id: p.id,
    league: p.league,
    home_team: p.home_team,
    away_team: p.away_team,
    pick_team: p.pick_team,
    bet_type: p.bet_type,
    sportsbook_line: p.sportsbook_line,
    model_line: p.model_line,
    spread_edge: p.spread_edge,
    confidence_score: p.confidence_score,
    edge_score: p.edge_score,
    result: p.result,
    commence_time: p.commence_time,
    created_at: p.created_at,
    line_at_pick: p.line_at_pick ?? null,
    closing_line: p.closing_line ?? null,
    clv: calcClv(p.line_at_pick ?? null, p.closing_line ?? null),
  }))

  // Breakdown by league (season)
  const byLeague: Record<string, { record: ReturnType<typeof buildRecord>; win_pct: number | null }> = {}
  for (const pick of season) {
    if (!byLeague[pick.league]) byLeague[pick.league] = { record: { wins: 0, losses: 0, pushes: 0, total: 0 }, win_pct: null }
    const r = byLeague[pick.league].record
    if (pick.result === 'win') r.wins++
    else if (pick.result === 'loss') r.losses++
    else if (pick.result === 'push') r.pushes++
    if (pick.result !== 'pending') r.total++
  }
  for (const league of Object.keys(byLeague)) {
    byLeague[league].win_pct = winPct(byLeague[league].record)
  }

  // Streak calculation (most recent settled picks)
  const settled = picks.filter((p) => p.result !== 'pending')
  let streak = 0
  let streakType: 'W' | 'L' | null = null
  for (const p of settled) {
    if (streakType === null) {
      streakType = p.result === 'win' ? 'W' : 'L'
      streak = 1
    } else if ((p.result === 'win') === (streakType === 'W')) {
      streak++
    } else {
      break
    }
  }

  // Last engine run timestamp — used by the dashboard "Last Updated" label
  const { data: lastRun } = await supabaseAdmin
    .from('engine_runs')
    .select('run_at')
    .order('run_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    isPremium,
    lastUpdated: lastRun?.run_at ?? null,
    last_7_days: {
      record: formatRecord(last7Record),
      wins: last7Record.wins,
      losses: last7Record.losses,
      pushes: last7Record.pushes,
      total_picks: last7Record.total,
      win_percentage: winPct(last7Record),
      roi: calcRoi(last7Record),
    },
    last_30_days: {
      record: formatRecord(last30Record),
      wins: last30Record.wins,
      losses: last30Record.losses,
      pushes: last30Record.pushes,
      total_picks: last30Record.total,
      win_percentage: winPct(last30Record),
      roi: calcRoi(last30Record),
    },
    season: {
      record: formatRecord(seasonRecord),
      wins: seasonRecord.wins,
      losses: seasonRecord.losses,
      pushes: seasonRecord.pushes,
      total_picks: seasonRecord.total,
      win_percentage: winPct(seasonRecord),
      roi: calcRoi(seasonRecord),
    },
    all_time: {
      record: formatRecord(allTimeRecord),
      wins: allTimeRecord.wins,
      losses: allTimeRecord.losses,
      pushes: allTimeRecord.pushes,
      total_picks: allTimeRecord.total,
      win_percentage: winPct(allTimeRecord),
      roi: calcRoi(allTimeRecord),
    },
    current_streak: streakType ? `${streak}${streakType}` : null,
    total_official_picks: picks.length,
    pending_picks: picks.filter((p) => p.result === 'pending').length,
    avg_clv: allTimeAvgClv,
    season_avg_clv: seasonAvgClv,
    by_league: byLeague,
    // Pick log is premium-only — omit details for free users
    recent_picks: isPremium ? recentPicks : [],
  })
}
