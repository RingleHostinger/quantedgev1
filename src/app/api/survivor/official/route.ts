import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { getSession } from '@/lib/auth'
import { computePrizePool } from '@/lib/officialContestUtils'
import {
  type BracketMatchup,
  type OfficialBracketData,
  computeRoundCompletion,
  computeActiveRound,
  ROUND_KEYS,
} from '@/lib/bracketTypes'

// ─── Types ────────────────────────────────────────────────────────────────

interface OfficialEntry {
  id: string
  user_id: string
  entry_number: number
  status: 'active' | 'refunded'
  created_at: string
}

interface SurvivorPick {
  id: string
  official_entry_id: string | null
  user_id: string
  round_number: number
  team_name: string
  team_seed: number | null
  opponent_name: string | null
  result: 'pending' | 'won' | 'eliminated'
  picked_at: string
  updated_at: string
}

// ─── GET /api/survivor/official ───────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Official pool
  const { data: pool, error: poolErr } = await supabaseAdmin
    .from('survivor_pools')
    .select('id, pool_name, pool_size, pick_format, team_reuse, strike_rule, is_active, created_at, bracket_data, bracket_confirmed')
    .eq('is_official', true)
    .single()

  if (poolErr || !pool) {
    return NextResponse.json({ error: 'Official pool not found' }, { status: 404 })
  }

  const officialPoolId = pool.id

  // All entries for this pool (exclude test entries from public stats)
  const { data: allEntries } = await supabaseAdmin
    .from('official_survivor_entries')
    .select('id, user_id, entry_number, status, created_at, is_test_entry')
    .eq('pool_id', officialPoolId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  // Separate real entries from test entries - test entries excluded from public stats
  const allEntriesList = (allEntries ?? []) as OfficialEntry[]
  const realEntries = allEntriesList.filter(e => !(e as Record<string, unknown>).is_test_entry)

  // Public stats only include real entries
  const entries: OfficialEntry[] = realEntries

  // All picks linked to this pool's entries (real entries)
  const entryIds = entries.map((e) => e.id)
  let picks: SurvivorPick[] = []
  if (entryIds.length > 0) {
    const { data: pickRows } = await supabaseAdmin
      .from('survivor_picks')
      .select('id, official_entry_id, user_id, round_number, team_name, team_seed, opponent_name, result, picked_at, updated_at')
      .in('official_entry_id', entryIds)
      .order('round_number', { ascending: true })
    picks = (pickRows ?? []) as SurvivorPick[]
  }

  // For test mode: also fetch picks for test entries
  let testPicks: SurvivorPick[] = []
  const testEntryIds = allEntriesList
    .filter((e) => (e as Record<string, unknown>).is_test_entry === true)
    .map((e) => e.id)
  if (testEntryIds.length > 0) {
    const { data: testPickRows } = await supabaseAdmin
      .from('survivor_picks')
      .select('id, official_entry_id, user_id, round_number, team_name, team_seed, opponent_name, result, picked_at, updated_at')
      .in('official_entry_id', testEntryIds)
      .order('round_number', { ascending: true })
    testPicks = (testPickRows ?? []) as SurvivorPick[]
  }

  // User display names for all entrants
  const entrantIds = [...new Set(entries.map((e) => e.user_id))]
  const userMap: Record<string, { name: string; email: string }> = {}
  if (entrantIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .in('id', entrantIds)
    for (const u of users ?? []) {
      userMap[u.id] = { name: u.name ?? u.email, email: u.email }
    }
  }

  // Current round = highest round across all picks (min 1)
  const currentRound = picks.length > 0
    ? Math.max(...picks.map((p) => p.round_number))
    : 1

  // Build leaderboard — one row per entry
  const picksByEntry: Record<string, SurvivorPick[]> = {}
  for (const p of picks) {
    if (!p.official_entry_id) continue
    if (!picksByEntry[p.official_entry_id]) picksByEntry[p.official_entry_id] = []
    picksByEntry[p.official_entry_id].push(p)
  }

  const leaderboard = entries.map((entry) => {
    const entryPicks = picksByEntry[entry.id] ?? []
    let entryStatus: 'alive' | 'eliminated' = 'alive'
    let roundsSurvived = 0
    let picksCorrect = 0

    for (const pick of entryPicks) {
      if (pick.result === 'won') {
        roundsSurvived = Math.max(roundsSurvived, pick.round_number)
        picksCorrect++
      } else if (pick.result === 'eliminated') {
        entryStatus = 'eliminated'
        roundsSurvived = pick.round_number - 1
      }
    }

    return {
      entryId: entry.id,
      userId: entry.user_id,
      entryNumber: entry.entry_number,
      displayName: userMap[entry.user_id]?.name ?? 'Unknown',
      status: entryStatus,
      roundsSurvived,
      picksCorrect,
      currentRound,
      picks: entryPicks,
      createdAt: entry.created_at,
    }
  }).sort((a, b) => {
    // Alive first
    if (a.status !== b.status) return a.status === 'alive' ? -1 : 1
    // Rounds survived desc
    if (b.roundsSurvived !== a.roundsSurvived) return b.roundsSurvived - a.roundsSurvived
    // Correct picks desc
    if (b.picksCorrect !== a.picksCorrect) return b.picksCorrect - a.picksCorrect
    // Earliest entry wins tiebreaker
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  }).map((row, idx) => ({ rank: idx + 1, ...row }))

  // Check if current user is admin with test mode or admin preview mode enabled → bracketLive bypass
  let bracketLive = false
  let isAdmin = false
  let isAdminPreview = false
  let testBracketData = null

  const { data: currentUser } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.userId)
    .single()

  if (currentUser?.role === 'admin') {
    isAdmin = true

    // Check admin preview mode (new: separate from test mode, bypasses countdown for previewing)
    const { data: adminPreviewSetting } = await supabaseAdmin
      .from('admin_settings')
      .select('value')
      .eq('key', 'survivor_admin_preview')
      .single()
    if (adminPreviewSetting?.value === 'true') {
      isAdminPreview = true
      bracketLive = true
    }

    // Check test mode (existing: for testing entries)
    const { data: testModeSetting } = await supabaseAdmin
      .from('admin_settings')
      .select('value')
      .eq('key', 'survivor_test_mode')
      .single()
    if (testModeSetting?.value === 'true') {
      bracketLive = true
    }

    // Load test bracket data for admin preview (when either test mode OR admin preview is enabled)
    if (bracketLive) {
      const { data: testBracketSetting } = await supabaseAdmin
        .from('admin_settings')
        .select('value')
        .eq('key', 'survivor_test_bracket_data')
        .single()
      if (testBracketSetting?.value) {
        try {
          testBracketData = JSON.parse(testBracketSetting.value)
        } catch { /* ignore parse errors */ }
      }
    }
  }

  // My entries
  // For test mode: also include test entries for admin preview
  let myEntries = entries.filter((e) => e.user_id === session.userId)
  let isTestMode = false

  // If admin with test mode enabled, also include test entries for preview
  // Note: testBracketData is optional - we can preview entries even without saved bracket data
  if (isAdmin && bracketLive) {
    // Check if admin has test entries
    const adminTestEntries = allEntriesList.filter(
      (e) => e.user_id === session.userId && (e as Record<string, unknown>).is_test_entry === true
    )
    if (adminTestEntries.length > 0) {
      isTestMode = true
      // Include test entries in myEntries for preview
      myEntries = [...myEntries, ...adminTestEntries]
    }
  }

  const myEntryCount = myEntries.length

  // Build leaderboard rows for test entries (for preview)
  let testLeaderboardRows: Array<{
    rank: number
    entryId: string
    userId: string
    entryNumber: number
    displayName: string
    status: 'alive' | 'eliminated'
    roundsSurvived: number
    picksCorrect: number
    currentRound: number
    picks: SurvivorPick[]
    createdAt: string
  }> = []

  if (isTestMode && testPicks.length > 0) {
    const testPicksByEntry: Record<string, SurvivorPick[]> = {}
    for (const p of testPicks) {
      if (!p.official_entry_id) continue
      if (!testPicksByEntry[p.official_entry_id]) testPicksByEntry[p.official_entry_id] = []
      testPicksByEntry[p.official_entry_id].push(p)
    }

    const testEntriesMap = new Map(
      allEntriesList
        .filter((e) => e.user_id === session.userId && (e as Record<string, unknown>).is_test_entry === true)
        .map((e) => [e.id, e])
    )

    testLeaderboardRows = myEntries
      .filter((e) => (e as Record<string, unknown>).is_test_entry === true)
      .map((entry) => {
        const entryPicks = testPicksByEntry[entry.id] ?? []
        let entryStatus: 'alive' | 'eliminated' = 'alive'
        let roundsSurvived = 0
        let picksCorrect = 0

        for (const pick of entryPicks) {
          if (pick.result === 'won') {
            roundsSurvived = Math.max(roundsSurvived, pick.round_number)
            picksCorrect++
          } else if (pick.result === 'eliminated') {
            entryStatus = 'eliminated'
            roundsSurvived = pick.round_number - 1
          }
        }

        return {
          entryId: entry.id,
          userId: entry.user_id,
          entryNumber: entry.entry_number,
          displayName: userMap[entry.user_id]?.name ?? 'Unknown',
          status: entryStatus,
          roundsSurvived,
          picksCorrect,
          currentRound,
          picks: entryPicks,
          createdAt: entry.created_at,
          isTestEntry: true,
        }
      })
  }

  // Combine real leaderboard rows with test leaderboard rows for preview
  const myLeaderboardRows = [
    ...leaderboard.filter((r) => r.userId === session.userId),
    ...testLeaderboardRows,
  ]

  // Prize pool
  const prizePool = computePrizePool(entries.length)

  // ─── Bracket Data & Round Status ──────────────────────────────────────────
  // Determine which bracket data to use: test mode uses saved test data, otherwise use pool's bracket
  let liveBracketData: OfficialBracketData | null = null
  if (isTestMode && testBracketData) {
    liveBracketData = testBracketData as OfficialBracketData
  } else if (isAdminPreview && testBracketData) {
    liveBracketData = testBracketData as OfficialBracketData
  } else if (pool.bracket_data) {
    liveBracketData = pool.bracket_data as OfficialBracketData
  }

  const bracketResults = liveBracketData?.results as Record<string, Record<string, BracketMatchup>> | undefined
  const roundCompletionStatus = computeRoundCompletion(bracketResults)
  const activeRound = computeActiveRound(bracketResults)

  // Compute used teams per entry (team names from won/pending picks - for team reuse prevention)
  const allMyPicks = [...picks, ...testPicks]
  const usedTeamsByEntry: Record<string, string[]> = {}
  for (const p of allMyPicks) {
    if (!p.official_entry_id) continue
    if (!usedTeamsByEntry[p.official_entry_id]) usedTeamsByEntry[p.official_entry_id] = []
    if (p.result !== 'eliminated') {
      usedTeamsByEntry[p.official_entry_id].push(p.team_name)
    }
  }

  return NextResponse.json({
    pool,
    myEntries: myLeaderboardRows,
    myEntryCount,
    canPurchaseMore: myEntryCount < 3,
    remainingSlots: Math.max(0, 3 - myEntryCount),
    leaderboard,
    currentRound,
    totalEntrants: entries.length,
    prizePool,
    bracketLive,
    isAdmin,
    isAdminPreview,
    isTestMode,
    testBracketData,
    bracketData: liveBracketData,
    roundCompletionStatus,
    activeRound,
    usedTeamsByEntry,
  })
}

// ─── POST /api/survivor/official ─────────────────────────────────────────
// Submit or update a pick for a specific entry.
// Body: { entry_id, round_number, team_name, team_seed?, opponent_name?, opponent_seed?, win_probability?, ai_confidence? }

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { entry_id, round_number, team_name, team_seed, opponent_name, opponent_seed, win_probability, ai_confidence } = body

  if (!entry_id || !round_number || !team_name) {
    return NextResponse.json({ error: 'entry_id, round_number, and team_name are required' }, { status: 400 })
  }

  // Verify entry belongs to this user and is in the official pool
  const { data: entry } = await supabaseAdmin
    .from('official_survivor_entries')
    .select('id, user_id, pool_id, entry_number, status')
    .eq('id', entry_id)
    .single()

  if (!entry || entry.user_id !== session.userId) {
    return NextResponse.json({ error: 'Entry not found or does not belong to you' }, { status: 403 })
  }
  if (entry.status !== 'active') {
    return NextResponse.json({ error: 'This entry is no longer active' }, { status: 400 })
  }

  // Fetch the official pool to check is_active
  const { data: pool } = await supabaseAdmin
    .from('survivor_pools')
    .select('id, is_active')
    .eq('id', entry.pool_id)
    .single()

  if (!pool?.is_active) {
    return NextResponse.json({ error: 'Official pool is closed' }, { status: 400 })
  }

  // Check if this entry has been eliminated
  const { data: existingPicks } = await supabaseAdmin
    .from('survivor_picks')
    .select('id, round_number, result, team_name')
    .eq('official_entry_id', entry_id)
    .order('round_number', { ascending: true })

  const isEliminated = (existingPicks ?? []).some((p) => p.result === 'eliminated')
  if (isEliminated) {
    return NextResponse.json({ error: 'This entry has been eliminated' }, { status: 400 })
  }

  const existingRoundPick = (existingPicks ?? []).find((p) => p.round_number === round_number)
  if (existingRoundPick && existingRoundPick.result !== 'pending') {
    return NextResponse.json({ error: 'This round has already been resolved' }, { status: 400 })
  }

  // Team reuse validation: check if this team was already picked in a previous round
  const previousTeams = (existingPicks ?? [])
    .filter((p) => p.round_number !== round_number)
    .map((p) => p.team_name as string)
    .filter(Boolean)
    .map((t) => t.toLowerCase())

  if (previousTeams.includes(team_name.toLowerCase())) {
    return NextResponse.json({ error: 'You already used this team in a previous round' }, { status: 400 })
  }

  const now = new Date().toISOString()

  let result
  if (existingRoundPick) {
    const { data, error } = await supabaseAdmin
      .from('survivor_picks')
      .update({
        team_name,
        team_seed: team_seed ?? null,
        opponent_name: opponent_name ?? null,
        opponent_seed: opponent_seed ?? null,
        win_probability: win_probability ?? null,
        ai_confidence: ai_confidence ?? null,
        updated_at: now,
      })
      .eq('id', existingRoundPick.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  } else {
    const { data, error } = await supabaseAdmin
      .from('survivor_picks')
      .insert({
        pool_id: entry.pool_id,
        user_id: session.userId,
        official_entry_id: entry_id,
        round_number,
        team_name,
        team_seed: team_seed ?? null,
        opponent_name: opponent_name ?? null,
        opponent_seed: opponent_seed ?? null,
        win_probability: win_probability ?? null,
        ai_confidence: ai_confidence ?? null,
        result: 'pending',
        picked_at: now,
        updated_at: now,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  }

  return NextResponse.json({ success: true, pick: result })
}
