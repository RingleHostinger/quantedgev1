import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 })
    }

    // Get contest data
    const { data: contest, error: contestError } = await supabaseAdmin
      .from('survivor_contest')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (contestError || !contest) {
      return NextResponse.json({ error: 'No contest found' }, { status: 404 })
    }

    // Get contest days
    const { data: contestDays, error: daysError } = await supabaseAdmin
      .from('survivor_contest_days')
      .select('*')
      .eq('contest_id', contest.id)
      .order('day_number', { ascending: true })

    // Get all entries
    const { data: allEntries, error: entriesError } = await supabaseAdmin
      .from('survivor_entries')
      .select('*')
      .order('created_at', { ascending: true })

    // Get all picks
    const entryIds = allEntries?.map(e => e.id) || []
    let allPicks: unknown[] = []

    if (entryIds.length > 0) {
      const { data: picks, error: picksError } = await supabaseAdmin
        .from('survivor_entry_picks')
        .select('*')
        .in('entry_id', entryIds)
        .order('submitted_at', { ascending: true })

      if (!picksError && picks) {
        allPicks = picks
      }
    }

    // Calculate stats
    const stats = {
      totalEntries: allEntries?.length || 0,
      activeEntries: allEntries?.filter(e => e.status === 'active').length || 0,
      eliminatedEntries: allEntries?.filter(e => e.status === 'eliminated').length || 0,
      winnerEntries: allEntries?.filter(e => e.status === 'winner').length || 0
    }

    return NextResponse.json({
      contest,
      days: contestDays || [],
      entries: allEntries || [],
      picks: allPicks,
      stats
    })
  } catch (error) {
    console.error('Error fetching admin contest data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'save_bracket': {
        const { bracket_data } = body
        if (!bracket_data) {
          return NextResponse.json({ error: 'Missing bracket_data' }, { status: 400 })
        }

        // Get current contest
        const { data: contest, error: contestError } = await supabaseAdmin
          .from('survivor_contest')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (contestError || !contest) {
          return NextResponse.json({ error: 'No contest found' }, { status: 404 })
        }

        const { error: updateError } = await supabaseAdmin
          .from('survivor_contest')
          .update({ bracket_data })
          .eq('id', contest.id)

        if (updateError) {
          console.error('Error saving bracket:', updateError)
          return NextResponse.json({ error: 'Failed to save bracket' }, { status: 500 })
        }

        return NextResponse.json({ message: 'Bracket saved successfully' })
      }

      case 'confirm_bracket': {
        const { data: contest, error: contestError } = await supabaseAdmin
          .from('survivor_contest')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (contestError || !contest) {
          return NextResponse.json({ error: 'No contest found' }, { status: 404 })
        }

        const { error: updateError } = await supabaseAdmin
          .from('survivor_contest')
          .update({ bracket_confirmed: true })
          .eq('id', contest.id)

        if (updateError) {
          console.error('Error confirming bracket:', updateError)
          return NextResponse.json({ error: 'Failed to confirm bracket' }, { status: 500 })
        }

        return NextResponse.json({ message: 'Bracket confirmed successfully' })
      }

      case 'load_teams': {
        const season = body.season || new Date().getFullYear()

        // Get teams from bracket_teams table
        const { data: teams, error: teamsError } = await supabaseAdmin
          .from('bracket_teams')
          .select('*')
          .eq('season', season)
          .order('region', { ascending: true })
          .order('seed', { ascending: true })

        if (teamsError || !teams) {
          return NextResponse.json({ error: 'Failed to load teams from bracket_teams' }, { status: 500 })
        }

        // Build bracket_data structure
        const regions = ['east', 'west', 'south', 'midwest']
        const bracket_data: Record<string, { seed: number; name: string }[]> = {}

        for (const region of regions) {
          bracket_data[region] = teams
            .filter(t => t.region === region)
            .map(t => ({ seed: t.seed, name: t.team_name }))
        }

        // Get current contest
        const { data: contest, error: contestError } = await supabaseAdmin
          .from('survivor_contest')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (contestError || !contest) {
          return NextResponse.json({ error: 'No contest found' }, { status: 404 })
        }

        // Save bracket_data
        const { error: updateError } = await supabaseAdmin
          .from('survivor_contest')
          .update({ bracket_data })
          .eq('id', contest.id)

        if (updateError) {
          console.error('Error saving bracket data:', updateError)
          return NextResponse.json({ error: 'Failed to save bracket data' }, { status: 500 })
        }

        return NextResponse.json({
          message: 'Teams loaded successfully',
          bracket_data
        })
      }

      case 'create_day': {
        const { day_number, round_label, picks_required, lock_time } = body

        if (day_number === undefined || !round_label || !picks_required) {
          return NextResponse.json({
            error: 'Missing required fields: day_number, round_label, picks_required'
          }, { status: 400 })
        }

        // Get current contest
        const { data: contest, error: contestError } = await supabaseAdmin
          .from('survivor_contest')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (contestError || !contest) {
          return NextResponse.json({ error: 'No contest found' }, { status: 404 })
        }

        const { data: newDay, error: createError } = await supabaseAdmin
          .from('survivor_contest_days')
          .insert({
            contest_id: contest.id,
            day_number,
            round_label,
            picks_required,
            status: 'pending',
            lock_time: lock_time || null
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating day:', createError)
          return NextResponse.json({ error: 'Failed to create contest day' }, { status: 500 })
        }

        return NextResponse.json({
          message: 'Contest day created successfully',
          day: newDay
        })
      }

      case 'update_day': {
        const { day_id, status, lock_time, picks_required } = body

        if (!day_id) {
          return NextResponse.json({ error: 'Missing day_id' }, { status: 400 })
        }

        const updateData: Record<string, unknown> = {}
        if (status) updateData.status = status
        if (lock_time !== undefined) updateData.lock_time = lock_time
        if (picks_required) updateData.picks_required = picks_required

        const { error: updateError } = await supabaseAdmin
          .from('survivor_contest_days')
          .update(updateData)
          .eq('id', day_id)

        if (updateError) {
          console.error('Error updating day:', updateError)
          return NextResponse.json({ error: 'Failed to update contest day' }, { status: 500 })
        }

        return NextResponse.json({ message: 'Contest day updated successfully' })
      }

      case 'post_games': {
        const { contest_day_id, games } = body

        if (!contest_day_id || !games || !Array.isArray(games)) {
          return NextResponse.json({
            error: 'Missing required fields: contest_day_id, games array'
          }, { status: 400 })
        }

        // Insert games
        const gamesToInsert = games.map(game => ({
          contest_day_id,
          matchup_key: game.matchup_key,
          team1_name: game.team1_name,
          team1_seed: game.team1_seed,
          team2_name: game.team2_name,
          team2_seed: game.team2_seed,
          region: game.region,
          round_key: game.round_key,
          winner: null,
          is_locked: false,
          status: 'posted'
        }))

        const { error: insertError } = await supabaseAdmin
          .from('survivor_contest_games')
          .insert(gamesToInsert)

        if (insertError) {
          console.error('Error posting games:', insertError)
          return NextResponse.json({ error: 'Failed to post games' }, { status: 500 })
        }

        return NextResponse.json({ message: 'Games posted successfully' })
      }

      case 'grade_game': {
        const { game_id, winner } = body

        if (!game_id || !winner) {
          return NextResponse.json({ error: 'Missing required fields: game_id, winner' }, { status: 400 })
        }

        // Update game with winner
        const { error: updateGameError } = await supabaseAdmin
          .from('survivor_contest_games')
          .update({ winner, status: 'graded' })
          .eq('id', game_id)

        if (updateGameError) {
          console.error('Error grading game:', updateGameError)
          return NextResponse.json({ error: 'Failed to grade game' }, { status: 500 })
        }

        // Get game details
        const { data: game, error: gameError } = await supabaseAdmin
          .from('survivor_contest_games')
          .select('*')
          .eq('id', game_id)
          .single()

        if (gameError || !game) {
          return NextResponse.json({ error: 'Game not found' }, { status: 404 })
        }

        // Get all picks for this game
        const { data: picks, error: picksError } = await supabaseAdmin
          .from('survivor_entry_picks')
          .select('*')
          .eq('game_id', game_id)

        if (picksError) {
          console.error('Error fetching picks:', picksError)
          return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 })
        }

        // Update each pick and check for eliminations
        const entriesToEliminate: string[] = []

        if (picks && picks.length > 0) {
          for (const pick of picks) {
            const pickResult = pick.team_name === winner ? 'won' : 'lost'

            await supabaseAdmin
              .from('survivor_entry_picks')
              .update({ result: pickResult, updated_at: new Date().toISOString() })
              .eq('id', pick.id)

            // Track entries to eliminate
            if (pickResult === 'lost') {
              entriesToEliminate.push(pick.entry_id)
            }
          }
        }

        // Mark eliminated entries
        if (entriesToEliminate.length > 0) {
          // Get the day number for elimination
          const { data: contestDay } = await supabaseAdmin
            .from('survivor_contest_days')
            .select('day_number')
            .eq('id', game.contest_day_id)
            .single()

          const dayNumber = contestDay?.day_number || 0

          for (const entryId of [...new Set(entriesToEliminate)]) {
            await supabaseAdmin
              .from('survivor_entries')
              .update({
                status: 'eliminated',
                eliminated_at_day: dayNumber
              })
              .eq('id', entryId)
              .eq('status', 'active')
          }
        }

        return NextResponse.json({
          message: 'Game graded successfully',
          eliminatedEntries: entriesToEliminate.length
        })
      }

      case 'lock_game': {
        const { game_id, locked } = body

        if (!game_id || locked === undefined) {
          return NextResponse.json({ error: 'Missing required fields: game_id, locked' }, { status: 400 })
        }

        const { error: updateError } = await supabaseAdmin
          .from('survivor_contest_games')
          .update({ is_locked: locked })
          .eq('id', game_id)

        if (updateError) {
          console.error('Error locking game:', updateError)
          return NextResponse.json({ error: 'Failed to lock/unlock game' }, { status: 500 })
        }

        return NextResponse.json({
          message: `Game ${locked ? 'locked' : 'unlocked'} successfully`
        })
      }

      case 'complete_day': {
        const { day_id } = body

        if (!day_id) {
          return NextResponse.json({ error: 'Missing day_id' }, { status: 400 })
        }

        // Get day with its games
        const { data: contestDay, error: dayError } = await supabaseAdmin
          .from('survivor_contest_days')
          .select('*, survivor_contest_games(*)')
          .eq('id', day_id)
          .single()

        if (dayError || !contestDay) {
          return NextResponse.json({ error: 'Contest day not found' }, { status: 404 })
        }

        const games = (contestDay as unknown as { survivor_contest_games: unknown[] }).survivor_contest_games || []
        const allGraded = games.every(g => (g as { status: string }).status === 'graded')

        if (!allGraded) {
          return NextResponse.json({
            error: 'Cannot complete day - not all games are graded'
          }, { status: 400 })
        }

        // Update day status
        const { error: updateDayError } = await supabaseAdmin
          .from('survivor_contest_days')
          .update({ status: 'completed' })
          .eq('id', day_id)

        if (updateDayError) {
          console.error('Error completing day:', updateDayError)
          return NextResponse.json({ error: 'Failed to complete day' }, { status: 500 })
        }

        // Update last_advanced_day for surviving entries
        const { data: survivingEntries, error: entriesError } = await supabaseAdmin
          .from('survivor_entries')
          .select('id')
          .eq('status', 'active')

        if (!entriesError && survivingEntries) {
          for (const entry of survivingEntries) {
            await supabaseAdmin
              .from('survivor_entries')
              .update({ last_advanced_day: contestDay.day_number })
              .eq('id', entry.id)
          }
        }

        return NextResponse.json({
          message: 'Day completed successfully',
          survivingEntries: survivingEntries?.length || 0
        })
      }

      case 'activate_contest': {
        const { data: contest, error: contestError } = await supabaseAdmin
          .from('survivor_contest')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (contestError || !contest) {
          return NextResponse.json({ error: 'No contest found' }, { status: 404 })
        }

        const { error: updateError } = await supabaseAdmin
          .from('survivor_contest')
          .update({ status: 'active' })
          .eq('id', contest.id)

        if (updateError) {
          console.error('Error activating contest:', updateError)
          return NextResponse.json({ error: 'Failed to activate contest' }, { status: 500 })
        }

        return NextResponse.json({ message: 'Contest activated successfully' })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in admin survivor contest:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
