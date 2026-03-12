import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's entries
    const { data: entries, error } = await supabaseAdmin
      .from('survivor_entries')
      .select('*')
      .eq('user_id', session.userId)
      .order('entry_number', { ascending: true })

    if (error) {
      console.error('Error fetching entries:', error)
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 })
    }

    return NextResponse.json({ entries: entries || [] })
  } catch (error) {
    console.error('Error fetching entries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the current contest
    const { data: contest, error: contestError } = await supabaseAdmin
      .from('survivor_contest')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (contestError || !contest) {
      return NextResponse.json({ error: 'No active contest found' }, { status: 404 })
    }

    // Get user's current entries to determine next entry number
    const { data: existingEntries, error: entriesError } = await supabaseAdmin
      .from('survivor_entries')
      .select('entry_number')
      .eq('user_id', session.userId)
      .order('entry_number', { ascending: false })
      .limit(1)

    const nextEntryNumber = existingEntries && existingEntries.length > 0
      ? (existingEntries[0].entry_number || 0) + 1
      : 1

    // Create new entry
    const { data: newEntry, error: createError } = await supabaseAdmin
      .from('survivor_entries')
      .insert({
        user_id: session.userId,
        entry_number: nextEntryNumber,
        status: 'active',
        eliminated_at_day: null,
        last_advanced_day: null
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating entry:', createError)
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Entry created successfully',
      entry: newEntry
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating entry:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
