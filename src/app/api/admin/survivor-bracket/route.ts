import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'

// GET - Get bracket data and confirmation status
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()

  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Get official pool
  const { data: pool } = await supabaseAdmin
    .from('survivor_pools')
    .select('id, pool_name, bracket_data, bracket_confirmed, confirmed_at, is_official')
    .eq('is_official', true)
    .single()

  if (!pool) {
    return NextResponse.json({
      bracketData: null,
      isConfirmed: false,
      confirmedAt: null,
      poolExists: false
    })
  }

  // Get test mode and live mode settings
  const { data: testModeSetting } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', 'survivor_test_mode')
    .single()

  const { data: liveModeSetting } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', 'survivor_live_mode')
    .single()

  return NextResponse.json({
    poolExists: true,
    poolId: pool.id,
    bracketData: pool.bracket_data,
    isConfirmed: pool.bracket_confirmed,
    confirmedAt: pool.confirmed_at,
    testMode: testModeSetting?.value === 'true',
    liveMode: liveModeSetting?.value === 'true',
  })
}

// POST - Insert or update bracket data (admin only)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()

  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const { bracketData, action } = body

  // Get or create official pool
  let { data: pool } = await supabaseAdmin
    .from('survivor_pools')
    .select('id')
    .eq('is_official', true)
    .single()

  let poolId: string

  if (!pool) {
    // Create official pool
    const { data: newPool, error: createError } = await supabaseAdmin
      .from('survivor_pools')
      .insert({
        user_id: session.userId,
        pool_name: 'Official Survivor Contest',
        pool_size: 'large',
        pick_format: 'one_per_round',
        team_reuse: false,
        late_round_rule: 'none',
        strike_rule: 'one_strike',
        is_active: true,
        is_official: true,
        bracket_data: bracketData || {},
        bracket_confirmed: false,
      })
      .select('id')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
    poolId = newPool.id
  } else {
    poolId = pool.id
  }

  // Action: load_teams - Fetch teams from bracket_teams table, grouped by region
  if (action === 'load_teams') {
    const { data: teams, error: teamsErr } = await supabaseAdmin
      .from('bracket_teams')
      .select('team_name, seed, region')
      .order('seed', { ascending: true })

    if (teamsErr) {
      return NextResponse.json({ error: teamsErr.message }, { status: 500 })
    }

    const regions: Record<string, Array<{ seed: number; name: string }>> = {}
    for (const t of teams ?? []) {
      const region = t.region ?? 'Unknown'
      if (!regions[region]) regions[region] = []
      regions[region].push({ seed: t.seed, name: t.team_name })
    }

    return NextResponse.json({ success: true, regions })
  }

  // Action: grade_game - Grade a game and advance winner to next round
  if (action === 'grade_game') {
    const { roundKey, matchupKey, winner } = body

    if (!roundKey || !matchupKey || !winner) {
      return NextResponse.json({ error: 'roundKey, matchupKey, and winner are required' }, { status: 400 })
    }

    // Get current bracket data
    const { data: currentPool } = await supabaseAdmin
      .from('survivor_pools')
      .select('id, bracket_data')
      .eq('is_official', true)
      .single()

    if (!currentPool) {
      return NextResponse.json({ error: 'Official pool not found' }, { status: 404 })
    }

    const bd = (currentPool.bracket_data ?? {}) as Record<string, unknown>
    const results = (bd.results ?? {}) as Record<string, Record<string, Record<string, unknown>>>

    if (!results[roundKey]?.[matchupKey]) {
      return NextResponse.json({ error: 'Matchup not found' }, { status: 404 })
    }

    const matchup = results[roundKey][matchupKey]
    matchup.winner = winner

    // Determine loser
    const loser = matchup.team1 === winner ? matchup.team2 : matchup.team1

    // Advance winner to next round
    const nextRoundMap: Record<string, string> = {
      round64: 'round32', round32: 'sweet16', sweet16: 'elite8',
      elite8: 'finalFour', finalFour: 'championship',
    }
    const roundNumberMap: Record<string, number> = {
      round64: 1, round32: 2, sweet16: 3, elite8: 4, finalFour: 5, championship: 6,
    }

    const nextRound = nextRoundMap[roundKey]
    if (nextRound) {
      // Parse matchup index from matchupKey (e.g., "m0" -> 0)
      const matchupIndex = parseInt(matchupKey.replace('m', ''), 10)
      const nextMatchIndex = Math.floor(matchupIndex / 2)
      const nextMatchKey = `m${nextMatchIndex}`

      if (!results[nextRound]) results[nextRound] = {}
      if (!results[nextRound][nextMatchKey]) {
        results[nextRound][nextMatchKey] = {
          team1: '', team1Seed: 0, team2: '', team2Seed: 0, winner: null,
        }
      }

      const nextMatchup = results[nextRound][nextMatchKey]
      const winnerSeed = matchup.team1 === winner ? matchup.team1Seed : matchup.team2Seed

      if (matchupIndex % 2 === 0) {
        nextMatchup.team1 = winner
        nextMatchup.team1Seed = winnerSeed
      } else {
        nextMatchup.team2 = winner
        nextMatchup.team2Seed = winnerSeed
      }
    }

    // Save updated bracket data
    const updatedBd = { ...bd, results }
    const { error: saveErr } = await supabaseAdmin
      .from('survivor_pools')
      .update({ bracket_data: updatedBd })
      .eq('id', currentPool.id)

    if (saveErr) {
      return NextResponse.json({ error: saveErr.message }, { status: 500 })
    }

    // Grade survivor picks
    const roundNum = roundNumberMap[roundKey] ?? 0
    let gradedPicks = 0

    if (roundNum > 0) {
      // Losing team picks → eliminated
      const { data: loserPicks } = await supabaseAdmin
        .from('survivor_picks')
        .update({ result: 'eliminated', updated_at: new Date().toISOString() })
        .ilike('team_name', loser as string)
        .eq('round_number', roundNum)
        .eq('result', 'pending')
        .select('id')

      // Winning team picks → won
      const { data: winnerPicks } = await supabaseAdmin
        .from('survivor_picks')
        .update({ result: 'won', updated_at: new Date().toISOString() })
        .ilike('team_name', winner)
        .eq('round_number', roundNum)
        .eq('result', 'pending')
        .select('id')

      gradedPicks = (loserPicks?.length ?? 0) + (winnerPicks?.length ?? 0)
    }

    return NextResponse.json({
      success: true,
      bracketData: updatedBd,
      gradedPicks,
      message: `${winner} wins! ${loser} eliminated. ${gradedPicks} pick(s) graded.`,
    })
  }

  if (action === 'confirm') {
    // Auto-generate Round of 64 matchups from regions data if available
    let finalBracketData = bracketData || {}
    if (bracketData?.regions) {
      const seedPairings: [number, number][] = [
        [1, 16], [8, 9], [5, 12], [4, 13],
        [6, 11], [3, 14], [7, 10], [2, 15],
      ]
      const regions = ['East', 'West', 'South', 'Midwest']
      const round64: Record<string, Record<string, unknown>> = {}
      let matchIdx = 0

      for (const region of regions) {
        const teams = bracketData.regions[region] ?? []
        const teamMap: Record<number, string> = {}
        for (const t of teams) {
          teamMap[t.seed] = t.name
        }
        for (const [seedA, seedB] of seedPairings) {
          round64[`m${matchIdx}`] = {
            team1: teamMap[seedA] ?? `${region} #${seedA}`,
            team1Seed: seedA,
            team2: teamMap[seedB] ?? `${region} #${seedB}`,
            team2Seed: seedB,
            winner: null,
          }
          matchIdx++
        }
      }

      // Initialize empty rounds
      const emptyRounds: Record<string, Record<string, unknown>> = {}
      const roundSizes: Record<string, number> = { round32: 16, sweet16: 8, elite8: 4, finalFour: 2, championship: 1 }
      for (const [rk, count] of Object.entries(roundSizes)) {
        emptyRounds[rk] = {}
        for (let i = 0; i < count; i++) {
          emptyRounds[rk][`m${i}`] = { team1: '', team1Seed: 0, team2: '', team2Seed: 0, winner: null }
        }
      }

      finalBracketData = {
        ...bracketData,
        results: { round64, ...emptyRounds },
      }
    }

    // Save bracket data + confirm
    const { error: updateError } = await supabaseAdmin
      .from('survivor_pools')
      .update({
        bracket_data: finalBracketData,
        bracket_confirmed: true,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', poolId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await supabaseAdmin
      .from('admin_settings')
      .upsert({ key: 'survivor_bracket_confirmed', value: 'true', updated_at: new Date().toISOString() })

    return NextResponse.json({
      success: true,
      message: 'Bracket confirmed and made live',
      poolId,
      bracketData: finalBracketData,
    })
  }

  // Action: save_test_preview - Save test bracket for admin preview without locking live bracket
  if (action === 'save_test_preview') {
    // Save test bracket data to admin_settings (separate from live bracket)
    const { error: testSaveErr } = await supabaseAdmin
      .from('admin_settings')
      .upsert({
        key: 'survivor_test_bracket_data',
        value: JSON.stringify(bracketData),
        updated_at: new Date().toISOString()
      })

    if (testSaveErr) {
      return NextResponse.json({ error: testSaveErr.message }, { status: 500 })
    }

    // Also enable test mode so admin can see the preview
    await supabaseAdmin
      .from('admin_settings')
      .upsert({ key: 'survivor_test_mode', value: 'true', updated_at: new Date().toISOString() })

    return NextResponse.json({
      success: true,
      message: 'Test bracket saved. Admin can now preview the full bracket experience in test mode.',
      isTestMode: true,
      bracketData,
    })
  }

  // Just save/update bracket data
  const { error: updateError } = await supabaseAdmin
    .from('survivor_pools')
    .update({
      bracket_data: bracketData || {},
      bracket_confirmed: false,
    })
    .eq('id', poolId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: 'Bracket data saved',
    poolId
  })
}
