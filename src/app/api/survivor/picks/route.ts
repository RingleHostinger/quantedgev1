import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { entry_id, contest_day_id, picks } = body

    // Validate required fields
    if (!entry_id || !contest_day_id || !picks || !Array.isArray(picks)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify entry belongs to user
    const { data: entry, error: entryError } = await supabaseAdmin
      .from('survivor_entries')
      .select('*')
      .eq('id', entry_id)
      .eq('user_id', session.userId)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ error: 'Entry not found or unauthorized' }, { status: 404 })
    }

    // Check entry is still active
    if (entry.status !== 'active') {
      return NextResponse.json({ error: 'Entry is eliminated' }, { status: 400 })
    }

    // Get contest day
    const { data: contestDay, error: dayError } = await supabaseAdmin
      .from('survivor_contest_days')
      .select('*')
      .eq('id', contest_day_id)
      .single()

    if (dayError || !contestDay) {
      return NextResponse.json({ error: 'Contest day not found' }, { status: 404 })
    }

    // Check contest day is open
    if (contestDay.status !== 'open') {
      return NextResponse.json({ error: 'Contest day is not open for picks' }, { status: 400 })
    }

    // Check lock time hasn't passed
    if (contestDay.lock_time && new Date(contestDay.lock_time) <= new Date()) {
      return NextResponse.json({ error: 'Pick lock time has passed' }, { status: 400 })
    }

    // Validate picks count
    if (picks.length !== contestDay.picks_required) {
      return NextResponse.json({
        error: `Expected ${contestDay.picks_required} picks, got ${picks.length}`
      }, { status: 400 })
    }

    // Get all games for this contest day
    const { data: games, error: gamesError } = await supabaseAdmin
      .from('survivor_contest_games')
      .select('*')
      .eq('contest_day_id', contest_day_id)

    if (gamesError || !games) {
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 })
    }

    // Validate each pick
    for (const pick of picks) {
      const game = games.find(g => g.id === pick.game_id)
      if (!game) {
        return NextResponse.json({ error: `Game not found: ${pick.game_id}` }, { status: 400 })
      }

      // Check game is not locked or graded
      if (game.is_locked || game.status === 'graded') {
        return NextResponse.json({ error: `Game is locked or graded: ${game.matchup_key}` }, { status: 400 })
      }

      // Validate team is in the game
      if (game.team1_name !== pick.team_name && game.team2_name !== pick.team_name) {
        return NextResponse.json({
          error: `Team ${pick.team_name} not in game ${game.matchup_key}`
        }, { status: 400 })
      }
    }

    // Get all previous picks for this entry to check team reuse
    const { data: previousPicks, error: previousPicksError } = await supabaseAdmin
      .from('survivor_entry_picks')
      .select('*')
      .eq('entry_id', entry_id)

    if (previousPicksError) {
      return NextResponse.json({ error: 'Failed to fetch previous picks' }, { status: 500 })
    }

    // Check team reuse - only check against won picks from previous days
    const usedTeams = new Set(
      previousPicks
        ?.filter(p => p.result === 'won')
        .map(p => p.team_name) || []
    )

    for (const pick of picks) {
      if (usedTeams.has(pick.team_name)) {
        return NextResponse.json({
          error: `Team ${pick.team_name} has already been used in a previous winning pick`
        }, { status: 400 })
      }
    }

    // Get day number for this contest day
    const dayNumber = contestDay.day_number

    // Delete existing picks for this entry and day (if any)
    await supabaseAdmin
      .from('survivor_entry_picks')
      .delete()
      .eq('entry_id', entry_id)
      .eq('contest_day_id', contest_day_id)

    // Insert new picks
    const now = new Date().toISOString()
    const picksToInsert = picks.map(pick => ({
      entry_id,
      contest_day_id,
      game_id: pick.game_id,
      team_name: pick.team_name,
      team_seed: pick.team_seed,
      result: 'pending',
      submitted_at: now,
      updated_at: now
    }))

    const { error: insertError } = await supabaseAdmin
      .from('survivor_entry_picks')
      .insert(picksToInsert)

    if (insertError) {
      console.error('Error inserting picks:', insertError)
      return NextResponse.json({ error: 'Failed to save picks' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Picks saved successfully',
      picks: picksToInsert
    })
  } catch (error) {
    console.error('Error saving picks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
