/**
 * slateUtils
 *
 * Utilities for determining the current EST "sports day" slate window.
 *
 * The sports day boundary is 2:00 AM Eastern Time (ET):
 *   - EST (UTC-5) → 07:00 UTC  (Nov–Mar)
 *   - EDT (UTC-4) → 06:00 UTC  (Mar–Nov)
 *
 * IMPORTANT — nubase query bug:
 *   Combining .gte() + .lt() on the same timestamp column silently drops the .lt()
 *   upper bound, returning all rows from the start date onward (including future games).
 *   Workaround: query using .lt(end) only, then JS-filter rows >= start client-side.
 *   The helper filterToWindow() encapsulates this pattern.
 */

import { supabaseAdmin } from '@/integrations/supabase/server'

/** Returns the 2 AM ET offset in hours behind UTC for a given date. */
function getETOffsetHours(date: Date): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
    const parts = formatter.formatToParts(date)
    const tzPart = parts.find((p) => p.type === 'timeZoneName')
    return tzPart?.value === 'EDT' ? 4 : 5
  } catch {
    const month = date.getUTCMonth() + 1
    return month >= 3 && month <= 11 ? 4 : 5
  }
}

/**
 * Returns the UTC ISO timestamps bounding the current EST sports day.
 *
 * Sports day = 2:00 AM ET → 2:00 AM ET next day.
 * If it's currently before 2 AM ET, the active window is the *previous* day's slate.
 */
export function getTodaySlateRange(): { start: string; end: string } {
  const now = new Date()
  const offsetHours = getETOffsetHours(now)

  const todayCutoffUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    2 + offsetHours,
    0, 0, 0,
  ))

  const windowStart = now < todayCutoffUTC
    ? new Date(todayCutoffUTC.getTime() - 24 * 60 * 60 * 1000)
    : todayCutoffUTC

  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000)

  return {
    start: windowStart.toISOString(),
    end: windowEnd.toISOString(),
  }
}

/**
 * Returns the UTC ISO timestamps for the PREVIOUS EST sports day.
 * Used during the daily rollover to grade picks from yesterday.
 */
export function getYesterdaySlateRange(): { start: string; end: string } {
  const now = new Date()
  const offsetHours = getETOffsetHours(now)

  const todayCutoffUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    2 + offsetHours,
    0, 0, 0,
  ))

  const windowStart = now < todayCutoffUTC
    ? new Date(todayCutoffUTC.getTime() - 48 * 60 * 60 * 1000)
    : new Date(todayCutoffUTC.getTime() - 24 * 60 * 60 * 1000)

  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000)

  return {
    start: windowStart.toISOString(),
    end: windowEnd.toISOString(),
  }
}

/**
 * Client-side window filter — use this after fetching with .lt(end) only.
 *
 * Because nubase drops the upper bound when .gte + .lt are combined, the
 * safe pattern is:
 *   1. Query DB with .lt(end) — this correctly excludes rows >= end
 *   2. JS-filter the result set for rows >= start
 *
 * @param rows  Array of objects with a timestamp field
 * @param field Name of the timestamp field on each row
 * @param start ISO string lower bound (inclusive)
 * @param end   ISO string upper bound (exclusive) — already applied in DB query
 */
export function filterToWindow<T extends Record<string, unknown>>(
  rows: T[],
  field: string,
  start: string,
): T[] {
  const startMs = new Date(start).getTime()
  return rows.filter((r) => {
    const val = r[field]
    if (val == null) return false
    return new Date(val as string).getTime() >= startMs
  })
}

/**
 * Fetch the game_ids from prediction_cache that fall within today's EST slate.
 *
 * Uses the lt-only + JS-filter workaround for nubase.
 * Returns { gameIds, slateStart, slateEnd, count } for debug output.
 */
export async function getTodaySlateGameIds(): Promise<{
  gameIds: string[]
  slateStart: string
  slateEnd: string
  count: number
}> {
  const { start, end } = getTodaySlateRange()

  // Fetch with .lt(end) only — upper bound enforced here reliably
  const { data: rows } = await supabaseAdmin
    .from('prediction_cache')
    .select('game_id, commence_time')
    .lt('commence_time', end)
    .order('commence_time', { ascending: true })

  // JS-filter for lower bound >= start
  const inWindow = filterToWindow(rows ?? [], 'commence_time', start)
  const gameIds = inWindow.map((r) => r.game_id as string)

  return { gameIds, slateStart: start, slateEnd: end, count: gameIds.length }
}
