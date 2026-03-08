/**
 * oddsCacheService
 *
 * Fetches odds from The Odds API and stores them in the cached_odds table.
 * Cache TTL: 60 minutes. On every read the staleness is checked; if stale,
 * a fresh fetch is triggered automatically before returning data.
 *
 * Frontend should NEVER call The Odds API directly — only use /api/odds.
 */

import { supabaseAdmin } from '@/integrations/supabase/server'

// ─── Runtime env fallback ─────────────────────────────────────────────────────
// In production (next start), server-only env vars like ODDS_API_KEY may not
// be in process.env if the server started without inheriting the shell env.
// Read .env / .env.local directly at module load time as a reliable fallback.
;(function loadOddsEnv() {
  if (process.env.ODDS_API_KEY) return // already set — nothing to do
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path')
    const roots = [process.cwd(), path.resolve(__dirname, '../../../..')]
    const files = ['.env', '.env.local']
    for (const root of roots) {
      for (const file of files) {
        const p = path.join(root, file)
        if (!fs.existsSync(p)) continue
        const lines = fs.readFileSync(p, 'utf-8').split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const eq = trimmed.indexOf('=')
          if (eq < 0) continue
          const k = trimmed.slice(0, eq).trim()
          const v = trimmed.slice(eq + 1).trim()
          if (!process.env[k]) process.env[k] = v
        }
      }
      if (process.env.ODDS_API_KEY) break
    }
  } catch { /* ignore — best effort only */ }
})()

// ─── Configuration ────────────────────────────────────────────────────────────

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
const CACHE_TTL_MS = 60 * 60 * 1000 // 60 minutes

/**
 * The Odds API sport keys mapped to our internal league labels.
 * https://the-odds-api.com/sports-odds-data/sports-apis.html
 *
 * Explicit array — never derived — so it is always predictable at runtime.
 */
const SPORT_KEYS: string[] = [
  'basketball_nba',
  'basketball_ncaab',
  'americanfootball_nfl',
  'baseball_mlb',
  'icehockey_nhl',
  'soccer_epl',
  'soccer_uefa_champs_league',
]

const SPORT_MAP: Record<string, { sport: string; league: string }> = {
  basketball_nba:            { sport: 'Basketball',        league: 'NBA'   },
  basketball_ncaab:          { sport: 'Basketball',        league: 'NCAAB' },
  americanfootball_nfl:      { sport: 'American Football', league: 'NFL'   },
  baseball_mlb:              { sport: 'Baseball',          league: 'MLB'   },
  icehockey_nhl:             { sport: 'Hockey',            league: 'NHL'   },
  soccer_epl:                { sport: 'Soccer',            league: 'EPL'   },
  soccer_uefa_champs_league: { sport: 'Soccer',            league: 'UCL'   },
}

// Preferred bookmakers in priority order (used when multiple are returned)
const PREFERRED_BOOKMAKERS = [
  'draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbetus', 'betrivers', 'williamhill_us',
]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CachedOddsRow {
  id: string
  sport: string
  league: string
  game_id: string
  home_team: string
  away_team: string
  commence_time: string
  bookmaker: string
  spread: number | null
  spread_outcome_home: string | null
  spread_outcome_away: string | null
  total: number | null
  moneyline_home: number | null
  moneyline_away: number | null
  last_updated: string
  created_at: string
}

interface OddsApiOutcome {
  name: string
  price: number
  point?: number
}

interface OddsApiMarket {
  key: string
  outcomes: OddsApiOutcome[]
}

interface OddsApiBookmaker {
  key: string
  title: string
  markets: OddsApiMarket[]
}

interface OddsApiGame {
  id: string
  sport_key: string
  home_team: string
  away_team: string
  commence_time: string
  bookmakers: OddsApiBookmaker[]
}

// ─── Cache staleness check ─────────────────────────────────────────────────────

/**
 * Returns true if the cache is empty or the most recent record is older than TTL.
 */
export async function isCacheStale(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('cached_odds')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return true // empty cache

    const ageMs = Date.now() - new Date(data.last_updated).getTime()
    return ageMs > CACHE_TTL_MS
  } catch {
    return true
  }
}

/**
 * Returns the age of the cache in minutes, or null if cache is empty.
 */
export async function getCacheAgeMinutes(): Promise<number | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('cached_odds')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null
    return Math.floor((Date.now() - new Date(data.last_updated).getTime()) / 60000)
  } catch {
    return null
  }
}

// ─── Fetch from The Odds API ───────────────────────────────────────────────────

async function fetchOddsForSport(sportKey: string): Promise<OddsApiGame[]> {
  // Read at call-time so the env is always current (survives hot-reload / cold starts)
  const apiKey = process.env.ODDS_API_KEY || ''
  if (!apiKey) {
    throw new Error('ODDS_API_KEY environment variable is not set')
  }

  // Soccer leagues have broader bookmaker coverage with eu/uk regions included
  const isSoccer = sportKey.startsWith('soccer_')
  const regions = isSoccer ? 'us,uk,eu' : 'us'

  const url =
    `${ODDS_API_BASE}/sports/${sportKey}/odds` +
    `?apiKey=${apiKey}` +
    `&regions=${regions}` +
    `&markets=spreads,totals,h2h` +
    `&oddsFormat=american` +
    `&dateFormat=iso`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000) // 15 s timeout

  let res: Response
  try {
    res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timeout)
  }

  // Log quota on every request
  const remaining = res.headers.get('x-requests-remaining')
  const used = res.headers.get('x-requests-used')
  if (remaining !== null) {
    console.info(`[oddsCacheService] ${sportKey} — API quota used: ${used}, remaining: ${remaining}`)
  }

  if (res.status === 422) {
    // Sport is off-season or has no upcoming events — not an error
    console.info(`[oddsCacheService] ${sportKey}: off-season or no events (422)`)
    return []
  }

  if (res.status === 401) {
    throw new Error(`ODDS_API_KEY is invalid or expired (401)`)
  }

  if (res.status === 429) {
    throw new Error(`Odds API rate limit hit (429) — quota exhausted`)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Odds API HTTP ${res.status} for ${sportKey}: ${text.slice(0, 200)}`)
  }

  const json = await res.json()
  const games = Array.isArray(json) ? json : []
  console.info(`[oddsCacheService] ${sportKey}: received ${games.length} game(s)`)
  return games
}

// ─── Parse & upsert ───────────────────────────────────────────────────────────

function pickBookmaker(bookmakers: OddsApiBookmaker[]): OddsApiBookmaker | null {
  if (!bookmakers?.length) return null
  for (const key of PREFERRED_BOOKMAKERS) {
    const bm = bookmakers.find(b => b.key === key)
    if (bm) return bm
  }
  return bookmakers[0]
}

function extractMarket(
  markets: OddsApiMarket[],
  key: string,
  homeTeam: string,
  awayTeam: string
): { spread: number | null; spreadOutcomeHome: string | null; spreadOutcomeAway: string | null; total: number | null; mlHome: number | null; mlAway: number | null } {
  let spread: number | null = null
  let spreadOutcomeHome: string | null = null
  let spreadOutcomeAway: string | null = null
  let total: number | null = null
  let mlHome: number | null = null
  let mlAway: number | null = null

  const spreadsMarket = markets.find(m => m.key === 'spreads')
  if (spreadsMarket) {
    const homeOutcome = spreadsMarket.outcomes.find(o => o.name === homeTeam)
    const awayOutcome = spreadsMarket.outcomes.find(o => o.name === awayTeam)
    if (homeOutcome?.point !== undefined) {
      spread = homeOutcome.point
      spreadOutcomeHome = homeOutcome.price?.toString() ?? null
      spreadOutcomeAway = awayOutcome?.price?.toString() ?? null
    }
  }

  const totalsMarket = markets.find(m => m.key === 'totals')
  if (totalsMarket) {
    const overOutcome = totalsMarket.outcomes.find(o => o.name === 'Over')
    if (overOutcome?.point !== undefined) total = overOutcome.point
  }

  const h2hMarket = markets.find(m => m.key === 'h2h')
  if (h2hMarket) {
    const homeH2h = h2hMarket.outcomes.find(o => o.name === homeTeam)
    const awayH2h = h2hMarket.outcomes.find(o => o.name === awayTeam)
    if (homeH2h) mlHome = homeH2h.price
    if (awayH2h) mlAway = awayH2h.price
  }

  void key // suppress unused warning
  return { spread, spreadOutcomeHome, spreadOutcomeAway, total, mlHome, mlAway }
}

async function upsertOdds(games: OddsApiGame[], sportKey: string): Promise<number> {
  if (!games.length) return 0

  const meta = SPORT_MAP[sportKey]
  const now = new Date().toISOString()
  let upserted = 0

  const rows = games.flatMap(game => {
    const bm = pickBookmaker(game.bookmakers)
    if (!bm) return []

    const { spread, spreadOutcomeHome, spreadOutcomeAway, total, mlHome, mlAway } =
      extractMarket(bm.markets, bm.key, game.home_team, game.away_team)

    return [{
      game_id:            game.id,
      sport:              meta.sport,
      league:             meta.league,
      home_team:          game.home_team,
      away_team:          game.away_team,
      commence_time:      game.commence_time,
      bookmaker:          bm.key,
      spread:             spread,
      spread_outcome_home: spreadOutcomeHome,
      spread_outcome_away: spreadOutcomeAway,
      total:              total,
      moneyline_home:     mlHome,
      moneyline_away:     mlAway,
      last_updated:       now,
    }]
  })

  if (!rows.length) return 0

  const { error } = await supabaseAdmin
    .from('cached_odds')
    .upsert(rows, { onConflict: 'game_id,bookmaker' })

  if (error) {
    console.error('[oddsCacheService] upsert error:', error.message)
    return 0
  }

  upserted = rows.length
  return upserted
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RefreshResult {
  success: boolean
  totalFetched: number
  totalUpserted: number
  sportsRefreshed: string[]
  errors: string[]
  refreshedAt: string
}

/**
 * Fetch fresh odds from The Odds API for all configured sports and
 * store them in the cached_odds table.
 *
 * This is the core refresh function — called by:
 *  1. /api/odds  (when cache is stale, auto-refresh before returning data)
 *  2. /api/odds/refresh  (standalone endpoint for external cron)
 */
export async function refreshOddsCache(): Promise<RefreshResult> {
  const errors: string[] = []
  const sportsRefreshed: string[] = []
  const sportsSkipped: string[] = []   // off-season / 0 games
  let totalFetched = 0
  let totalUpserted = 0

  // Fail fast if the API key is missing — no point hitting all 7 endpoints
  const apiKey = process.env.ODDS_API_KEY || ''
  if (!apiKey) {
    const msg = 'ODDS_API_KEY environment variable is not set — cannot refresh odds cache'
    console.error('[oddsCacheService]', msg)
    return {
      success: false,
      totalFetched: 0,
      totalUpserted: 0,
      sportsRefreshed: [],
      errors: [msg],
      refreshedAt: new Date().toISOString(),
    }
  }

  console.info(`[oddsCacheService] Starting refresh for ${SPORT_KEYS.length} sports:`, SPORT_KEYS.join(', '))

  const results = await Promise.allSettled(
    SPORT_KEYS.map(async (sportKey) => {
      try {
        const games = await fetchOddsForSport(sportKey)
        totalFetched += games.length

        if (games.length > 0) {
          const upserted = await upsertOdds(games, sportKey)
          totalUpserted += upserted
          sportsRefreshed.push(sportKey)
          console.info(`[oddsCacheService] ${sportKey}: fetched=${games.length} upserted=${upserted}`)
        } else {
          sportsSkipped.push(sportKey)
          console.info(`[oddsCacheService] ${sportKey}: 0 games (off-season / no events)`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${sportKey}: ${msg}`)
        console.error(`[oddsCacheService] ${sportKey} FAILED:`, msg)
      }
    })
  )

  // Surface any unexpected Promise rejections that slipped past the inner try/catch
  for (const r of results) {
    if (r.status === 'rejected') {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
      if (!errors.some(e => e.includes(msg))) errors.push(msg)
    }
  }

  const result: RefreshResult = {
    success: sportsRefreshed.length > 0 || sportsSkipped.length > 0,
    totalFetched,
    totalUpserted,
    sportsRefreshed,
    errors,
    refreshedAt: new Date().toISOString(),
  }

  console.info(
    `[oddsCacheService] Refresh complete — fetched=${totalFetched} upserted=${totalUpserted}` +
    ` active=[${sportsRefreshed.join(',')}]` +
    ` skipped=[${sportsSkipped.join(',')}]` +
    (errors.length ? ` errors=[${errors.join(' | ')}]` : '')
  )
  return result
}

// ─── Score fetching ────────────────────────────────────────────────────────────

interface OddsApiScoreTeam {
  name: string
  score: string | null
}

interface OddsApiScoreGame {
  id: string
  sport_key: string
  home_team: string
  away_team: string
  commence_time: string
  completed: boolean
  scores: OddsApiScoreTeam[] | null
  last_update: string | null
}

/**
 * Fetch scores for recently completed games from The Odds API and update the
 * games table with final scores + status = 'final'.
 *
 * The Odds API /scores endpoint returns games completed within the last
 * `daysFrom` days (default 1, max 3 on free tier). We request 2 days to
 * catch any games from the previous slate that finished late.
 *
 * Only games already in the games table (matched by odds_game_id) are updated.
 */
export async function fetchAndUpdateGameScores(): Promise<{
  updated: number
  errors: string[]
}> {
  const errors: string[] = []
  let updated = 0

  const apiKey = process.env.ODDS_API_KEY || ''
  if (!apiKey) {
    return { updated: 0, errors: ['ODDS_API_KEY not set — cannot fetch scores'] }
  }

  // Fetch scores for each configured sport in parallel
  const allScores: OddsApiScoreGame[] = []

  await Promise.allSettled(
    SPORT_KEYS.map(async (sportKey) => {
      try {
        const url =
          `${ODDS_API_BASE}/sports/${sportKey}/scores` +
          `?apiKey=${apiKey}` +
          `&daysFrom=2` +
          `&dateFormat=iso`

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15_000)
        let res: Response
        try {
          res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
        } finally {
          clearTimeout(timeout)
        }

        if (res.status === 422) return // off-season
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          errors.push(`scores ${sportKey}: HTTP ${res.status} — ${text.slice(0, 100)}`)
          return
        }

        const json = await res.json()
        const games: OddsApiScoreGame[] = Array.isArray(json) ? json : []
        const completed = games.filter((g) => g.completed && g.scores)
        console.info(`[oddsCacheService] scores ${sportKey}: ${completed.length} completed games`)
        allScores.push(...completed)
      } catch (err) {
        errors.push(`scores ${sportKey}: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  )

  if (allScores.length === 0) {
    return { updated: 0, errors }
  }

  // Map odds_game_id → scores
  const scoresByGameId = new Map<string, { home: number; away: number; homeTeam: string; awayTeam: string }>()
  for (const game of allScores) {
    if (!game.scores) continue
    const homeEntry = game.scores.find((s) => s.name === game.home_team)
    const awayEntry = game.scores.find((s) => s.name === game.away_team)
    const homeScore = homeEntry?.score != null ? parseInt(homeEntry.score, 10) : null
    const awayScore = awayEntry?.score != null ? parseInt(awayEntry.score, 10) : null
    if (homeScore == null || awayScore == null) continue
    scoresByGameId.set(game.id, {
      home: homeScore,
      away: awayScore,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
    })
  }

  if (scoresByGameId.size === 0) {
    return { updated: 0, errors }
  }

  // Fetch games from DB that match these odds_game_ids
  const { data: dbGames, error: fetchErr } = await supabaseAdmin
    .from('games')
    .select('id, odds_game_id, status')
    .in('odds_game_id', Array.from(scoresByGameId.keys()))

  if (fetchErr || !dbGames) {
    errors.push(`Failed to fetch games for score update: ${fetchErr?.message}`)
    return { updated, errors }
  }

  // Update each game that has a final score and is not already marked final
  for (const game of dbGames) {
    if (game.status === 'final') continue // already settled
    const scores = scoresByGameId.get(game.odds_game_id)
    if (!scores) continue

    const { error: updateErr } = await supabaseAdmin
      .from('games')
      .update({
        actual_home_score: scores.home,
        actual_away_score: scores.away,
        status: 'final',
      })
      .eq('id', game.id)

    if (updateErr) {
      errors.push(`game ${game.id}: ${updateErr.message}`)
    } else {
      updated++
    }
  }

  console.info(`[oddsCacheService] Score update complete — ${updated} games marked final`)
  return { updated, errors }
}

/**
 * Read cached odds from the database.
 * Optionally filter by sport, league, or a specific game_id.
 */
export async function getCachedOdds(options?: {
  sport?: string
  league?: string
  game_id?: string
  limit?: number
}): Promise<CachedOddsRow[]> {
  let query = supabaseAdmin
    .from('cached_odds')
    .select('*')
    .order('commence_time', { ascending: true })

  if (options?.sport)   query = query.eq('sport', options.sport)
  if (options?.league)  query = query.eq('league', options.league)
  if (options?.game_id) query = query.eq('game_id', options.game_id)
  if (options?.limit)   query = query.limit(options.limit)

  const { data, error } = await query

  if (error) {
    console.error('[oddsCacheService] read error:', error.message)
    return []
  }

  return (data ?? []) as CachedOddsRow[]
}

/**
 * Check cache freshness, auto-refresh if stale, then return data.
 * This is the primary function called by /api/odds.
 *
 * Returns:
 *  - rows: the cached odds (from DB, always)
 *  - refreshed: true if a fresh fetch was triggered
 *  - cacheAgeMinutes: age of the cache in minutes (null = was empty)
 */
export async function getOddsWithAutoRefresh(options?: {
  sport?: string
  league?: string
  game_id?: string
  limit?: number
}): Promise<{
  rows: CachedOddsRow[]
  refreshed: boolean
  cacheAgeMinutes: number | null
  refreshResult?: RefreshResult
}> {
  const stale = await isCacheStale()
  let refreshed = false
  let refreshResult: RefreshResult | undefined

  if (stale) {
    console.info('[oddsCacheService] Cache is stale — triggering auto-refresh')
    try {
      refreshResult = await refreshOddsCache()
      refreshed = true
    } catch (err) {
      // Refresh failed — fall through and return whatever is in the cache
      console.error('[oddsCacheService] Auto-refresh failed, returning stale cache:', err)
    }
  }

  const rows = await getCachedOdds(options)
  const cacheAgeMinutes = await getCacheAgeMinutes()

  return { rows, refreshed, cacheAgeMinutes, refreshResult }
}
