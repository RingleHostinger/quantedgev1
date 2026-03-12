import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function GET() {
  try {
    // Get contest data (most recent one)
    const { data: contest, error: contestError } = await supabaseAdmin
      .from('survivor_contest')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (contestError || !contest) {
      return NextResponse.json({ error: 'No contest found' }, { status: 404 })
    }

    // Get contest days ordered by day_number
    const { data: contestDays, error: daysError } = await supabaseAdmin
      .from('survivor_contest_days')
      .select('*')
      .eq('contest_id', contest.id)
      .order('day_number', { ascending: true })

    if (daysError) {
      return NextResponse.json({ error: 'Failed to fetch contest days' }, { status: 500 })
    }

    // Get games for all days
    const dayIds = contestDays.map(d => d.id)
    let games: Record<string, unknown[]> = {}

    if (dayIds.length > 0) {
      const { data: allGames, error: gamesError } = await supabaseAdmin
        .from('survivor_contest_games')
        .select('*')
        .in('contest_day_id', dayIds)
        .order('matchup_key', { ascending: true })

      if (!gamesError && allGames) {
        // Group games by contest_day_id
        for (const day of contestDays) {
          games[day.id] = allGames.filter(g => g.contest_day_id === day.id)
        }
      }
    }

    // Build response matching what the page expects:
    // { contest, days, entries, picks }
    const response: Record<string, unknown> = {
      contest: {
        id: contest.id,
        bracket_data: contest.bracket_data,
        bracket_confirmed: contest.bracket_confirmed,
        status: contest.status,
        created_at: contest.created_at
      },
      days: contestDays.map(day => ({
        ...day,
        games: games[day.id] || []
      })),
      entries: [],
      picks: []
    }

    // Get authenticated user data if available
    const session = await getSession()
    if (session) {
      // Get user's entries for this contest
      const { data: entries, error: entriesError } = await supabaseAdmin
        .from('survivor_entries')
        .select('*')
        .eq('user_id', session.userId)
        .order('entry_number', { ascending: true })

      if (!entriesError && entries && entries.length > 0) {
        const entryIds = entries.map(e => e.id)

        // Get picks for all entries
        const { data: picks, error: picksError } = await supabaseAdmin
          .from('survivor_entry_picks')
          .select('*')
          .in('entry_id', entryIds)
          .order('submitted_at', { ascending: true })

        response.entries = entries
        response.picks = (!picksError && picks) ? picks : []
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching contest data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
