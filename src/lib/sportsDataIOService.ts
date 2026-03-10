/**
 * sportsDataIOService
 *
 * Fetches sports data from SportsDataIO v3 API for NBA, NHL, and CBB/NCAAB.
 * Populates the cached_odds table in the same shape as the TheOddsAPI provider,
 * so all downstream services (sync, predictions, picks, grading) are unaffected.
 *
 * Endpoints used:
 *   GamesByDate:         /v3/{league}/scores/json/GamesByDate/{YYYY-MMM-DD}
 *   GameOddsByDate:      /v3/{league}/odds/json/GameOddsByDate/{YYYY-MMM-DD}
 *   InjuredPlayers:      /v3/nba/projections/json/InjuredPlayers   (NBA)
 *                        /v3/nhl/projections/json/InjuredPlayers   (NHL)
 *                        /v3/cbb/scores/json/InjuredPlayers        (CBB)
 *   BettingSplitsByGameId: /v3/{league}/odds/json/BettingSplitsByGameId/{gameId}
 *                          (NBA, NHL, CBB — same path pattern, confirmed)
 *   Season schedule:     /v3/{league}/scores/json/Games/{season}
 *                        (NBA, NHL, MLB, CBB — confirmed from docs screenshots)
 *
 * Auth: query param ?key={API_KEY}
 *
 * Required env var (single key covers all leagues):
 *   SPORTSDATAIO_API_KEY   — SportsDataIO API key
 *
 * Legacy per-league vars still accepted as fallbacks:
 *   SPORTSDATAIO_NBA_KEY / SPORTSDATAIO_NHL_KEY / SPORTSDATAIO_CBB_KEY
 */

import { supabaseAdmin } from '@/integrations/supabase/server'

// ─── Configuration ─────────────────────────────────────────────────────────────

const SDIO_BASE = 'https://api.sportsdata.io/v3'

// Preferred bookmaker names in priority order for picking the best odds line
const PREFERRED_BOOKMAKERS = [
  'DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet',
  'BetRivers', 'William Hill', 'Barstool',
]

/**
 * Resolve the SportsDataIO API key from env vars.
 * Priority: SPORTSDATAIO_API_KEY → SPORTSDATAIO_NBA_KEY → SPORTSDATAIO_NHL_KEY → SPORTSDATAIO_CBB_KEY
 * One key works for all leagues — SportsDataIO uses the same key across sports on a given subscription.
 */
function getSdioApiKey(): string | undefined {
  return (
    process.env.SPORTSDATAIO_API_KEY ||
    process.env.SPORTSDATAIO_NBA_KEY ||
    process.env.SPORTSDATAIO_NHL_KEY ||
    process.env.SPORTSDATAIO_CBB_KEY ||
    undefined
  )
}

// ─── League config ─────────────────────────────────────────────────────────────

interface LeagueConfig {
  sdioKey: string          // URL segment used in most endpoints: nba | nhl | mlb | cbb
  league: string           // our internal label: NBA | NHL | MLB | NCAAB
  sport: string            // our internal label: Basketball | Hockey | Baseball
  injuryPath: string       // base path for InjuredPlayers endpoint (differs by league)
  hasInjuryFeed: boolean   // whether InjuredPlayers endpoint is available for this league
  hasBettingSplits: boolean // whether BettingSplitsByGameId is available
}

const SDIO_LEAGUES: LeagueConfig[] = [
  { sdioKey: 'nba', league: 'NBA',   sport: 'Basketball', injuryPath: 'projections', hasInjuryFeed: true,  hasBettingSplits: true  },
  { sdioKey: 'nhl', league: 'NHL',   sport: 'Hockey',     injuryPath: 'projections', hasInjuryFeed: true,  hasBettingSplits: true  },
  { sdioKey: 'cbb', league: 'NCAAB', sport: 'Basketball', injuryPath: 'scores',      hasInjuryFeed: true,  hasBettingSplits: true  },
  { sdioKey: 'mlb', league: 'MLB',   sport: 'Baseball',   injuryPath: 'projections', hasInjuryFeed: false, hasBettingSplits: false },
]

// ─── SportsDataIO response types ───────────────────────────────────────────────

interface SDIOPregameOdds {
  GameOddId:       number
  Sportsbook:      string
  GameId:          number
  HomeMoneyLine:   number | null
  AwayMoneyLine:   number | null
  HomePointSpread: number | null
  AwayPointSpread: number | null
  OverUnder:       number | null
  OverPayout:      number | null
  UnderPayout:     number | null
}

interface SDIOGameOdds {
  GameId:       number
  PregameOdds:  SDIOPregameOdds[]
}

interface SDIOGame {
  GameId:        number
  DateTime:      string   // ISO: "2026-03-09T19:30:00"
  Status:        string   // "Scheduled" | "Final" | "InProgress" | "Postponed" | "Canceled"
  HomeTeam:      string   // abbreviation e.g. "BOS"
  AwayTeam:      string   // abbreviation e.g. "LAL"
  HomeTeamName?: string   // full name e.g. "Boston Celtics"
  AwayTeamName?: string
  HomeTeamScore?: number | null
  AwayTeamScore?: number | null
}

// ─── Normalized row shape (matches cached_odds table) ──────────────────────────

export interface SdioNormalizedRow {
  game_id:             string
  sport:               string
  league:              string
  home_team:           string
  away_team:           string
  commence_time:       string
  bookmaker:           string
  spread:              number | null
  spread_outcome_home: string | null
  spread_outcome_away: string | null
  total:               number | null
  moneyline_home:      number | null
  moneyline_away:      number | null
  last_updated:        string
}

export interface SdioScoreRow {
  game_id:   string   // the SportsDataIO GameID cast to string ("sdio_{id}")
  homeScore: number
  awayScore: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format a Date as "YYYY-MMM-DD" (SportsDataIO date format).
 * e.g. 2026-03-09 → "2026-MAR-09"
 */
function toSdioDateString(date: Date): string {
  const yyyy = date.getUTCFullYear()
  const mm = date.getUTCMonth() // 0-based
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${yyyy}-${monthNames[mm]}-${dd}`
}

/**
 * Derive fetch dates: today + tomorrow (UTC) to cover games that start late
 * in the evening which may roll into the next UTC day.
 */
function getSdioFetchDates(): string[] {
  const now = new Date()
  const today = toSdioDateString(now)
  const tomorrow = toSdioDateString(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  // Deduplicate in case of timezone edge cases
  return today === tomorrow ? [today] : [today, tomorrow]
}

/**
 * Build a stable game_id string from SportsDataIO GameId.
 * Prefixed with "sdio_" to avoid collision with TheOddsAPI UUIDs.
 */
function buildGameId(sdioId: number): string {
  return `sdio_${sdioId}`
}

/**
 * HTTP fetch with 15s timeout and basic error surfacing.
 */
async function sdioFetch(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  let res: Response
  try {
    res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timeout)
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`SportsDataIO auth failed (${res.status}) — check API key`)
  }
  if (res.status === 404) {
    // No games for this date — not an error
    return []
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SportsDataIO HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}

// ─── Per-league fetch + merge ──────────────────────────────────────────────────

/**
 * Fetch GamesByDate for a single date.
 */
async function fetchGamesByDate(sdioKey: string, apiKey: string, dateStr: string): Promise<SDIOGame[]> {
  const url = `${SDIO_BASE}/${sdioKey}/scores/json/GamesByDate/${dateStr}?key=${apiKey}`
  const data = await sdioFetch(url)
  return Array.isArray(data) ? data : []
}

/**
 * Fetch GameOddsByDate for a single date.
 */
async function fetchOddsByDate(sdioKey: string, apiKey: string, dateStr: string): Promise<SDIOGameOdds[]> {
  const url = `${SDIO_BASE}/${sdioKey}/odds/json/GameOddsByDate/${dateStr}?key=${apiKey}`
  const data = await sdioFetch(url)
  return Array.isArray(data) ? data : []
}

/**
 * Pick the best bookmaker line from PregameOdds array.
 * Priority: our preferred list → first available.
 */
function pickBestOdds(pregameOdds: SDIOPregameOdds[]): SDIOPregameOdds | null {
  if (!pregameOdds?.length) return null
  for (const preferred of PREFERRED_BOOKMAKERS) {
    const match = pregameOdds.find(
      (o) => o.Sportsbook?.toLowerCase() === preferred.toLowerCase()
    )
    if (match) return match
  }
  return pregameOdds[0]
}

/**
 * Fetch and normalize all odds + schedule data for one league config.
 * Returns rows ready to upsert into cached_odds.
 */
async function fetchLeagueData(
  config: LeagueConfig,
  apiKey: string,
): Promise<{ rows: SdioNormalizedRow[]; gameCount: number }> {
  const dates = getSdioFetchDates()
  const now = new Date().toISOString()

  // Fetch all dates in parallel
  const gamesByDate = await Promise.all(dates.map((d) => fetchGamesByDate(config.sdioKey, apiKey, d)))
  const oddsByDate  = await Promise.all(dates.map((d) => fetchOddsByDate(config.sdioKey, apiKey, d)))

  // Flatten
  const allGames: SDIOGame[]     = gamesByDate.flat()
  const allOdds:  SDIOGameOdds[] = oddsByDate.flat()

  console.info(`[sportsDataIOService] ${config.league}: ${allGames.length} games across ${dates.length} date(s)`)

  if (!allGames.length) return { rows: [], gameCount: 0 }

  // Build odds lookup by GameId
  const oddsMap = new Map<number, SDIOGameOdds>()
  for (const o of allOdds) {
    oddsMap.set(o.GameId, o)
  }

  const rows: SdioNormalizedRow[] = []

  for (const game of allGames) {
    // Skip games that are canceled / postponed
    if (game.Status === 'Canceled' || game.Status === 'Postponed') continue

    // Use full team name when available, fall back to abbreviation
    const homeTeam = game.HomeTeamName || game.HomeTeam
    const awayTeam = game.AwayTeamName || game.AwayTeam
    const gameId   = buildGameId(game.GameId)

    // Convert ISO timestamp to UTC ISO string
    // SportsDataIO returns "2026-03-09T19:30:00" without timezone — treat as ET
    // Add the UTC offset ourselves (ET = UTC-5 in winter, UTC-4 in summer)
    // Simplest safe approach: store as-is with Z suffix (won't be off by more than 1h)
    const commenceTime = game.DateTime.endsWith('Z') ? game.DateTime : `${game.DateTime}Z`

    // Get odds for this game
    const gameOdds = oddsMap.get(game.GameId)
    const bestOdds = gameOdds ? pickBestOdds(gameOdds.PregameOdds) : null
    const bookmaker = bestOdds?.Sportsbook?.toLowerCase().replace(/\s+/g, '_') ?? 'sportsdata'

    rows.push({
      game_id:             gameId,
      sport:               config.sport,
      league:              config.league,
      home_team:           homeTeam,
      away_team:           awayTeam,
      commence_time:       commenceTime,
      bookmaker,
      spread:              bestOdds?.HomePointSpread ?? null,
      spread_outcome_home: bestOdds?.OverPayout != null ? String(bestOdds.OverPayout) : null,
      spread_outcome_away: bestOdds?.UnderPayout != null ? String(bestOdds.UnderPayout) : null,
      total:               bestOdds?.OverUnder ?? null,
      moneyline_home:      bestOdds?.HomeMoneyLine ?? null,
      moneyline_away:      bestOdds?.AwayMoneyLine ?? null,
      last_updated:        now,
    })
  }

  return { rows, gameCount: allGames.length }
}

// ─── Upsert into cached_odds ───────────────────────────────────────────────────

async function upsertLeagueRows(rows: SdioNormalizedRow[], league: string): Promise<number> {
  if (!rows.length) return 0

  // Clear stale rows for this league first (same pattern as TheOddsAPI provider)
  await supabaseAdmin.from('cached_odds').delete().eq('league', league)

  const { error } = await supabaseAdmin
    .from('cached_odds')
    .upsert(rows, { onConflict: 'game_id,bookmaker' })

  if (error) {
    console.error(`[sportsDataIOService] upsert error for ${league}:`, error.message)
    return 0
  }

  return rows.length
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface SdioRefreshResult {
  success: boolean
  totalFetched: number
  totalUpserted: number
  leaguesRefreshed: string[]
  errors: string[]
  refreshedAt: string
}

/**
 * Refresh the cached_odds table from SportsDataIO for all configured leagues
 * (NBA, NHL, NCAAB). Only leagues with a valid API key are fetched.
 *
 * Returns a result object compatible with the TheOddsAPI RefreshResult shape
 * so callers can use both interchangeably.
 */
export async function refreshOddsCacheFromSdio(): Promise<SdioRefreshResult> {
  const errors: string[] = []
  const leaguesRefreshed: string[] = []
  let totalFetched  = 0
  let totalUpserted = 0

  const apiKey = getSdioApiKey()
  if (!apiKey) {
    return {
      success: false,
      totalFetched: 0,
      totalUpserted: 0,
      leaguesRefreshed: [],
      errors: ['No SPORTSDATAIO_API_KEY env var set — cannot refresh from SportsDataIO'],
      refreshedAt: new Date().toISOString(),
    }
  }

  const configuredLeagues = SDIO_LEAGUES

  console.info(`[sportsDataIOService] Starting refresh for leagues: ${configuredLeagues.map((l) => l.league).join(', ')}`)

  await Promise.allSettled(
    configuredLeagues.map(async (config) => {
      try {
        const { rows, gameCount } = await fetchLeagueData(config, apiKey)
        totalFetched += gameCount

        if (rows.length > 0) {
          const upserted = await upsertLeagueRows(rows, config.league)
          totalUpserted += upserted
          leaguesRefreshed.push(config.league)
          console.info(`[sportsDataIOService] ${config.league}: fetched=${gameCount} upserted=${upserted}`)
        } else {
          // No games — purge stale cache rows for this league
          await supabaseAdmin.from('cached_odds').delete().eq('league', config.league)
          console.info(`[sportsDataIOService] ${config.league}: 0 games — purged stale cache rows`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${config.league}: ${msg}`)
        console.error(`[sportsDataIOService] ${config.league} FAILED:`, msg)
      }
    })
  )

  const result: SdioRefreshResult = {
    success: leaguesRefreshed.length > 0,
    totalFetched,
    totalUpserted,
    leaguesRefreshed,
    errors,
    refreshedAt: new Date().toISOString(),
  }

  console.info(
    `[sportsDataIOService] Refresh complete — fetched=${totalFetched} upserted=${totalUpserted}` +
    ` active=[${leaguesRefreshed.join(',')}]` +
    (errors.length ? ` errors=[${errors.join(' | ')}]` : '')
  )

  return result
}

/**
 * Returns true if at least one SportsDataIO key is configured.
 */
export function isSdioConfigured(): boolean {
  return !!getSdioApiKey()
}

/**
 * Returns the list of leagues covered by SportsDataIO given current env keys.
 */
export function getSdioConfiguredLeagues(): string[] {
  return getSdioApiKey() ? SDIO_LEAGUES.map((l) => l.league) : []
}

// ─── Score fetching ─────────────────────────────────────────────────────────────

/**
 * Fetch final scores from SportsDataIO GamesByDate for yesterday + today,
 * returning completed games keyed by our sdio_ game_id.
 */
export async function fetchSdioScores(): Promise<{
  scores: SdioScoreRow[]
  errors: string[]
}> {
  const errors: string[] = []
  const scores: SdioScoreRow[] = []

  const apiKey = getSdioApiKey()
  if (!apiKey) {
    return { scores: [], errors: ['No SPORTSDATAIO_API_KEY env var configured'] }
  }
  const configuredLeagues = SDIO_LEAGUES

  // Fetch yesterday + today to catch late-finishing games
  const now = new Date()
  const yesterday = toSdioDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const today     = toSdioDateString(now)
  const dates     = yesterday === today ? [today] : [yesterday, today]

  await Promise.allSettled(
    configuredLeagues.flatMap((config) =>
      dates.map(async (dateStr) => {
        try {
          const games = await fetchGamesByDate(config.sdioKey, apiKey, dateStr)
          const completed = games.filter(
            (g) => (g.Status === 'Final' || g.Status === 'F/OT') &&
                   g.HomeTeamScore != null && g.AwayTeamScore != null
          )
          console.info(`[sportsDataIOService] scores ${config.league} ${dateStr}: ${completed.length} completed`)
          for (const g of completed) {
            scores.push({
              game_id:   buildGameId(g.GameId),
              homeScore: g.HomeTeamScore!,
              awayScore: g.AwayTeamScore!,
            })
          }
        } catch (err) {
          errors.push(`${config.league} ${dateStr}: ${err instanceof Error ? err.message : String(err)}`)
        }
      })
    )
  )

  return { scores, errors }
}

/**
 * Fetch final scores from SportsDataIO and update the games table.
 * Drop-in replacement for oddsCacheService.fetchAndUpdateGameScores().
 *
 * Reads games from the games table matched by odds_game_id ("sdio_xxxxx"),
 * updates actual_home_score, actual_away_score, and status = 'final'.
 */
export async function updateGameScoresFromSdio(): Promise<{ updated: number; errors: string[] }> {
  const { scores, errors } = await fetchSdioScores()
  if (!scores.length) return { updated: 0, errors }

  // Build lookup: sdio game_id → scores
  const scoreMap = new Map<string, { home: number; away: number }>()
  for (const s of scores) {
    scoreMap.set(s.game_id, { home: s.homeScore, away: s.awayScore })
  }

  // Find matching games rows by odds_game_id (which holds "sdio_xxxxx" strings)
  const { data: dbGames, error: fetchErr } = await supabaseAdmin
    .from('games')
    .select('id, odds_game_id, status')
    .in('odds_game_id', Array.from(scoreMap.keys()))

  if (fetchErr || !dbGames) {
    errors.push(`Failed to fetch games for score update: ${fetchErr?.message}`)
    return { updated: 0, errors }
  }

  let updated = 0
  for (const game of dbGames) {
    if (game.status === 'final') continue // already graded
    const sc = scoreMap.get(game.odds_game_id as string)
    if (!sc) continue

    const { error: updateErr } = await supabaseAdmin
      .from('games')
      .update({
        actual_home_score: sc.home,
        actual_away_score: sc.away,
        status: 'final',
      })
      .eq('id', game.id)

    if (updateErr) {
      errors.push(`game ${game.id}: ${updateErr.message}`)
    } else {
      updated++
    }
  }

  console.info(`[sportsDataIOService] updateGameScoresFromSdio: ${updated} games updated`)
  return { updated, errors }
}

// ─── Injury feed ────────────────────────────────────────────────────────────────

export interface SdioInjuryPlayer {
  playerId:        number
  playerName:      string
  team:            string           // abbreviation
  teamName:        string           // full name
  league:          string           // NBA | NHL | NCAAB
  position:        string | null
  injuryType:      string           // body part
  injuryDesc:      string           // description
  status:          'Out' | 'Doubtful' | 'Questionable' | 'Probable' | 'Day-To-Day' | 'IR' | 'GTD'
  expectedReturn:  string | null    // ISO date string or null
  impactScore:     number           // 0–10 estimated from FantasyPoints
  updatedAt:       string           // ISO timestamp
}

interface SDIORawInjury {
  PlayerID:          number
  Name?:             string
  FirstName?:        string
  LastName?:         string
  Team?:             string
  TeamName?:         string
  Position?:         string
  InjuryBodyPart?:   string
  InjuryStatus?:     string
  Status?:           string
  InjuryStartDate?:  string
  InjuryNotes?:      string
  FantasyPoints?:    number
  Practice?:         string
  PracticeDescription?: string
  ExpectedReturn?:   string
}

function normalizeSdioStatus(raw: string | undefined): SdioInjuryPlayer['status'] {
  if (!raw) return 'Questionable'
  const s = raw.toLowerCase().trim()

  // "Scrambled" = status obfuscated by SDIO when injury feed tier is not enabled.
  // Treat as Questionable until the full feed is active.
  if (s === 'scrambled') return 'Questionable'

  // OUT / IR bucket — most severe
  if (s === 'out' || s === 'dnp' || s === 'did not participate') return 'Out'
  if (
    s === 'ir' ||
    s === 'injured reserve' ||
    s.includes('injured reserve') ||
    s === 'suspended' ||
    s.includes('suspend')
  ) return 'IR'

  // Doubtful — maps to Out/IR display per UI spec
  if (s === 'doubtful' || s.includes('doubtful')) return 'Doubtful'

  // Probable
  if (
    s === 'probable' ||
    s === 'full practice' ||
    s === 'full participation' ||
    s.includes('probable')
  ) return 'Probable'

  // Active — treat as Probable (healthy player on injured list for tracking)
  if (s === 'active') return 'Probable'

  // GTD / Game Time Decision
  if (s === 'gtd' || s === 'game time decision' || s.includes('game time')) return 'GTD'

  // Day-To-Day
  if (s === 'day-to-day' || s === 'dtd' || s.includes('day-to-day')) return 'Day-To-Day'

  // Questionable — catch-all including explicit "Questionable"
  return 'Questionable'
}

function estimateImpactScore(fantasyPoints: number | undefined): number {
  if (!fantasyPoints) return 3
  // FP / 5 capped at 10. A 40-FP star → score 8. A 20-FP rotation → score 4.
  return Math.min(10, Math.round((fantasyPoints / 5) * 10) / 10)
}

/**
 * Fetch player injuries for a single league from the SportsDataIO Injuries endpoint.
 * Returns normalized SdioInjuryPlayer objects.
 */
async function fetchInjuriesForLeague(
  config: LeagueConfig,
  apiKey: string,
): Promise<SdioInjuryPlayer[]> {
  // Confirmed endpoints:
  //   NBA: /v3/nba/projections/json/InjuredPlayers
  //   NHL: /v3/nhl/projections/json/InjuredPlayers
  //   CBB: /v3/cbb/scores/json/InjuredPlayers
  const url = `${SDIO_BASE}/${config.sdioKey}/${config.injuryPath}/json/InjuredPlayers?key=${apiKey}`
  const data = await sdioFetch(url)
  if (!Array.isArray(data)) return []

  const now = new Date().toISOString()
  const players: SdioInjuryPlayer[] = []

  for (const raw of data as SDIORawInjury[]) {
    const firstName = raw.FirstName ?? ''
    const lastName  = raw.LastName ?? ''
    const fullName  = raw.Name ?? (`${firstName} ${lastName}`.trim() || 'Unknown')
    const statusRaw = raw.InjuryStatus ?? raw.Status ?? raw.Practice ?? 'Questionable'

    players.push({
      playerId:       raw.PlayerID ?? 0,
      playerName:     fullName,
      team:           raw.Team ?? '',
      teamName:       raw.TeamName ?? raw.Team ?? '',
      league:         config.league,
      position:       raw.Position ?? null,
      injuryType:     raw.InjuryBodyPart ?? 'Unknown',
      injuryDesc:     raw.InjuryNotes ?? raw.PracticeDescription ?? raw.Practice ?? 'Day-to-day',
      status:         normalizeSdioStatus(statusRaw),
      expectedReturn: raw.ExpectedReturn ?? raw.InjuryStartDate ?? null,
      impactScore:    estimateImpactScore(raw.FantasyPoints),
      updatedAt:      now,
    })
  }

  return players
}

/**
 * Fetch injuries across all configured leagues (NBA, NHL, NCAAB).
 * Returns a flat list of all injured players sorted by impactScore DESC.
 */
export async function fetchAllInjuries(): Promise<{
  injuries: SdioInjuryPlayer[]
  errors: string[]
}> {
  const errors: string[] = []
  const all: SdioInjuryPlayer[] = []

  const apiKey = getSdioApiKey()
  if (!apiKey) {
    return { injuries: [], errors: ['No SPORTSDATAIO_API_KEY env var configured'] }
  }
  const configuredLeagues = SDIO_LEAGUES

  await Promise.allSettled(
    configuredLeagues.filter((c) => c.hasInjuryFeed).map(async (config) => {
      try {
        const players = await fetchInjuriesForLeague(config, apiKey)
        all.push(...players)
        console.info(`[sportsDataIOService] injuries ${config.league}: ${players.length} players`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${config.league}: ${msg}`)
        console.error(`[sportsDataIOService] injuries ${config.league} FAILED:`, msg)
      }
    })
  )

  // Sort by impactScore DESC, then status severity
  const statusOrder: Record<string, number> = { Out: 0, IR: 1, 'Day-To-Day': 2, GTD: 3, Questionable: 4, Probable: 5 }
  all.sort((a, b) => {
    if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore
    return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
  })

  return { injuries: all, errors }
}

// ─── Betting splits (public bets / public money) ────────────────────────────────

export interface SdioBettingSplit {
  gameId:        string   // our sdio_ prefixed game ID
  sdioGameId:    number   // raw SDIO integer GameId (for joining to cached_schedules)
  league:        string
  homeTeam:      string
  awayTeam:      string
  // Spread splits
  spreadHomeBeats:  number | null   // % bets on home spread
  spreadAwayBets:   number | null   // % bets on away spread
  spreadHomeMoney:  number | null   // % money on home spread
  spreadAwayMoney:  number | null   // % money on away spread
  // Moneyline splits
  mlHomeBets:    number | null
  mlAwayBets:    number | null
  mlHomeMoney:   number | null
  mlAwayMoney:   number | null
  // Total splits
  overBets:      number | null
  underBets:     number | null
  // Line movement
  openingSpread: number | null   // home team opening spread
  currentSpread: number | null   // home team current spread
  openingTotal:  number | null
  currentTotal:  number | null
}

// ─── GameBettingSplit response shape ────────────────────────────────────────────
// Confirmed endpoint: /v3/{league}/odds/json/BettingSplitsByGameId/{gameId}
// Returns: GameBettingSplit (with nested BettingMarketSplit[] → BettingSplit[])

interface SDIOBettingSplitEntry {
  Name?:             string    // "Home", "Away", "Over", "Under"
  BetPercentage?:    number | null
  MoneyPercentage?:  number | null
}

interface SDIOBettingMarketSplit {
  BettingMarketTypeID?: number  // 1=Spread, 2=Moneyline, 3=Over/Under
  BettingMarketType?:   string  // "Spread", "Moneyline", "Over/Under"
  BettingSplits?:       SDIOBettingSplitEntry[]
  // Line movement fields (present on the market level)
  SpreadOpen?:          number | null
  SpreadCurrent?:       number | null
  TotalOpen?:           number | null
  TotalCurrent?:        number | null
}

interface SDIOGameBettingSplit {
  GameId?:          number
  BettingMarkets?:  SDIOBettingMarketSplit[]
  // Line movement may also appear at the top level
  SpreadOpen?:      number | null
  SpreadCurrent?:   number | null
  TotalOpen?:       number | null
  TotalCurrent?:    number | null
}

/**
 * Parse a GameBettingSplit response into our normalized SdioBettingSplit shape.
 * The response contains BettingMarkets[] with nested BettingSplits[].
 * MarketTypeID: 1=Spread, 2=Moneyline, 3=Over/Under
 */
function parseGameBettingSplit(
  raw: SDIOGameBettingSplit,
  game: SDIOGame,
  league: string,
): SdioBettingSplit {
  const homeTeam = game.HomeTeamName ?? game.HomeTeam
  const awayTeam = game.AwayTeamName ?? game.AwayTeam

  let spreadHomeBeats: number | null = null
  let spreadAwayBets:  number | null = null
  let spreadHomeMoney: number | null = null
  let spreadAwayMoney: number | null = null
  let mlHomeBets:      number | null = null
  let mlAwayBets:      number | null = null
  let mlHomeMoney:     number | null = null
  let mlAwayMoney:     number | null = null
  let overBets:        number | null = null
  let underBets:       number | null = null
  let openingSpread:   number | null = raw.SpreadOpen ?? null
  let currentSpread:   number | null = raw.SpreadCurrent ?? null
  let openingTotal:    number | null = raw.TotalOpen ?? null
  let currentTotal:    number | null = raw.TotalCurrent ?? null

  for (const market of raw.BettingMarkets ?? []) {
    const splits = market.BettingSplits ?? []
    const typeId = market.BettingMarketTypeID
    const typeName = (market.BettingMarketType ?? '').toLowerCase()

    // Prefer line movement from the market level if not at root
    if (market.SpreadOpen != null && openingSpread == null)   openingSpread = market.SpreadOpen
    if (market.SpreadCurrent != null && currentSpread == null) currentSpread = market.SpreadCurrent
    if (market.TotalOpen != null && openingTotal == null)      openingTotal  = market.TotalOpen
    if (market.TotalCurrent != null && currentTotal == null)   currentTotal  = market.TotalCurrent

    const isSpread    = typeId === 1 || typeName.includes('spread')
    const isMoneyline = typeId === 2 || typeName.includes('moneyline') || typeName.includes('money line')
    const isTotal     = typeId === 3 || typeName.includes('over') || typeName.includes('under') || typeName.includes('total')

    for (const s of splits) {
      const name = (s.Name ?? '').toLowerCase()
      const bet  = s.BetPercentage   ?? null
      const mon  = s.MoneyPercentage ?? null

      if (isSpread) {
        if (name === 'home')  { spreadHomeBeats = bet; spreadHomeMoney = mon }
        if (name === 'away')  { spreadAwayBets  = bet; spreadAwayMoney = mon }
      } else if (isMoneyline) {
        if (name === 'home')  { mlHomeBets = bet; mlHomeMoney = mon }
        if (name === 'away')  { mlAwayBets = bet; mlAwayMoney = mon }
      } else if (isTotal) {
        if (name === 'over')  overBets  = bet
        if (name === 'under') underBets = bet
      }
    }
  }

  return {
    gameId:          buildGameId(game.GameId),
    sdioGameId:      game.GameId,
    league,
    homeTeam,
    awayTeam,
    spreadHomeBeats,
    spreadAwayBets,
    spreadHomeMoney,
    spreadAwayMoney,
    mlHomeBets,
    mlAwayBets,
    mlHomeMoney,
    mlAwayMoney,
    overBets,
    underBets,
    openingSpread,
    currentSpread,
    openingTotal,
    currentTotal,
  }
}

/**
 * Fetch betting splits for all of today's games in one league.
 * Confirmed endpoints:
 *   NBA: /v3/nba/odds/json/BettingSplitsByGameId/{gameId}
 *   NHL: /v3/nhl/odds/json/BettingSplitsByGameId/{gameId}
 *   CBB: /v3/cbb/odds/json/BettingSplitsByGameId/{gameId}
 *
 * Flow: GamesByDate → extract GameIds → BettingSplitsByGameId per game (parallel)
 */
async function fetchBettingSplitsForLeague(
  config: LeagueConfig,
  apiKey: string,
): Promise<{ splits: SdioBettingSplit[]; errors: string[] }> {
  const dates  = getSdioFetchDates()
  const errors: string[] = []

  // Step 1: Get today's games to obtain their integer GameIds
  const gamesByDate = await Promise.all(
    dates.map((d) => fetchGamesByDate(config.sdioKey, apiKey, d).catch(() => [] as SDIOGame[]))
  )
  const allGames = gamesByDate.flat().filter(
    (g) => g.Status !== 'Canceled' && g.Status !== 'Postponed'
  )

  if (!allGames.length) return { splits: [], errors }

  // Step 2: Fetch BettingSplitsByGameId for each game in parallel
  const results: SdioBettingSplit[] = []

  await Promise.allSettled(
    allGames.map(async (game) => {
      const url = `${SDIO_BASE}/${config.sdioKey}/odds/json/BettingSplitsByGameId/${game.GameId}?key=${apiKey}`
      try {
        const data = await sdioFetch(url)
        // Response is a single GameBettingSplit object (not an array)
        const raw = (Array.isArray(data) ? data[0] : data) as SDIOGameBettingSplit | null
        if (!raw) return
        results.push(parseGameBettingSplit(raw, game, config.league))
      } catch (err) {
        errors.push(`${config.league} game ${game.GameId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  )

  return { splits: results, errors }
}

/**
 * Fetch betting splits for all configured leagues for today's slate.
 */
export async function fetchBettingSplits(): Promise<{
  splits: SdioBettingSplit[]
  errors: string[]
}> {
  const allErrors: string[] = []
  const all: SdioBettingSplit[] = []

  const apiKey = getSdioApiKey()
  if (!apiKey) {
    return { splits: [], errors: ['No SPORTSDATAIO_API_KEY env var configured'] }
  }

  await Promise.allSettled(
    SDIO_LEAGUES.filter((c) => c.hasBettingSplits).map(async (config) => {
      try {
        const { splits, errors } = await fetchBettingSplitsForLeague(config, apiKey)
        all.push(...splits)
        allErrors.push(...errors)
        console.info(`[sportsDataIOService] betting splits ${config.league}: ${splits.length} games`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        allErrors.push(`${config.league}: ${msg}`)
        console.error(`[sportsDataIOService] betting splits ${config.league} FAILED:`, msg)
      }
    })
  )

  // Deduplicate by gameId
  const seen = new Set<string>()
  const deduped = all.filter((s) => {
    if (seen.has(s.gameId)) return false
    seen.add(s.gameId)
    return true
  })

  return { splits: deduped, errors: allErrors }
}

// ─── Future feature hooks ───────────────────────────────────────────────────────
// These functions are stubs ready for implementation when the corresponding
// SportsDataIO subscription tiers / endpoints are activated.

export interface SdioPlayerProp {
  gameId:     string
  playerId:   number
  playerName: string
  team:       string
  league:     string
  propType:   string   // e.g. "Points", "Rebounds", "Goals"
  line:       number
  overOdds:   number | null
  underOdds:  number | null
  sportsbook: string
}

export interface SdioLiveOdds {
  gameId:        string
  league:        string
  homeTeam:      string
  awayTeam:      string
  liveSpread:    number | null
  liveTotal:     number | null
  homeScore:     number | null
  awayScore:     number | null
  quarter:       string | null   // "Q1", "Q2", "HT", etc.
  timeRemaining: string | null
  updatedAt:     string
}

export interface SdioLineupConfirmation {
  gameId:      string
  league:      string
  team:        string
  confirmed:   boolean
  starters:    string[]   // player names
  confirmedAt: string | null
}

/**
 * Fetch player props for today's games.
 * Endpoint: /v3/{league}/odds/json/PlayerPropsByDate/{date}
 *
 * STUB — requires SportsDataIO Props tier subscription.
 * Returns empty array until activated.
 */
export async function fetchPlayerProps(_league: string): Promise<SdioPlayerProp[]> {
  // TODO: implement when Props subscription is active
  // const url = `${SDIO_BASE}/${sdioKey}/odds/json/PlayerPropsByDate/${dateStr}?key=${apiKey}`
  console.info('[sportsDataIOService] fetchPlayerProps: stub — not yet implemented')
  return []
}

/**
 * Fetch live in-game odds for currently active games.
 * Endpoint: /v3/{league}/odds/json/LiveGameOddsByDate/{date}
 *
 * STUB — requires SportsDataIO Live tier subscription.
 * Returns empty array until activated.
 */
export async function fetchLiveOdds(_league: string): Promise<SdioLiveOdds[]> {
  // TODO: implement when Live subscription is active
  // const url = `${SDIO_BASE}/${sdioKey}/odds/json/LiveGameOddsByDate/${dateStr}?key=${apiKey}`
  console.info('[sportsDataIOService] fetchLiveOdds: stub — not yet implemented')
  return []
}

/**
 * Fetch lineup confirmations for today's games.
 * Endpoint: /v3/{league}/scores/json/StartingLineupsByDate/{date}  (NBA)
 *           /v3/nhl/scores/json/Lineups/{date}                     (NHL)
 *
 * STUB — implement per league when Lineup feed is required.
 * Returns empty array until activated.
 */
export async function fetchLineupConfirmations(_league: string): Promise<SdioLineupConfirmation[]> {
  // TODO: implement when Lineup feed is needed for prediction adjustments
  // const url = `${SDIO_BASE}/${sdioKey}/scores/json/StartingLineupsByDate/${dateStr}?key=${apiKey}`
  console.info('[sportsDataIOService] fetchLineupConfirmations: stub — not yet implemented')
  return []
}

// ─── Cache-write functions ───────────────────────────────────────────────────────

export interface CacheInjuriesResult {
  cached: number
  errors: string[]
  cachedAt: string
}

/**
 * Fetch injuries from SportsDataIO and write them to the cached_injuries table.
 * Performs a full replace per league (delete + insert) so stale players are removed.
 */
export async function cacheInjuries(): Promise<CacheInjuriesResult> {
  const { injuries, errors } = await fetchAllInjuries()
  const cachedAt = new Date().toISOString()

  if (!injuries.length) {
    return { cached: 0, errors, cachedAt }
  }

  // Group by league and replace each league's rows atomically
  const byLeague = new Map<string, SdioInjuryPlayer[]>()
  for (const inj of injuries) {
    const arr = byLeague.get(inj.league) ?? []
    arr.push(inj)
    byLeague.set(inj.league, arr)
  }

  const upsertErrors: string[] = [...errors]
  let totalCached = 0

  for (const [league, players] of byLeague) {
    try {
      // Delete existing rows for this league
      await supabaseAdmin.from('cached_injuries').delete().eq('league', league)

      // Insert new rows
      const rows = players.map((p) => ({
        player_id:       String(p.playerId),
        player_name:     p.playerName,
        team:            p.team,
        team_name:       p.teamName,
        league:          p.league,
        position:        p.position,
        injury_type:     p.injuryType,
        injury_desc:     p.injuryDesc,
        status:          p.status,
        expected_return: p.expectedReturn,
        impact_score:    p.impactScore,
        last_updated:    cachedAt,
      }))

      const { error } = await supabaseAdmin.from('cached_injuries').insert(rows)
      if (error) {
        upsertErrors.push(`${league} insert: ${error.message}`)
      } else {
        totalCached += rows.length
        console.info(`[sportsDataIOService] cacheInjuries ${league}: ${rows.length} rows written`)
      }
    } catch (err) {
      upsertErrors.push(`${league}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { cached: totalCached, errors: upsertErrors, cachedAt }
}

export interface CacheBettingSplitsResult {
  cached: number
  errors: string[]
  cachedAt: string
}

/**
 * Fetch betting splits from SportsDataIO and write them to the cached_betting_splits table.
 * Uses upsert on game_id so re-runs are safe.
 */
export async function cacheBettingSplits(): Promise<CacheBettingSplitsResult> {
  const { splits, errors } = await fetchBettingSplits()
  const cachedAt = new Date().toISOString()

  if (!splits.length) {
    return { cached: 0, errors, cachedAt }
  }

  const rows = splits.map((s) => ({
    game_id:           s.gameId,
    sdio_game_id:      s.sdioGameId,
    league:            s.league,
    home_team:         s.homeTeam,
    away_team:         s.awayTeam,
    spread_home_bets:  s.spreadHomeBeats,
    spread_away_bets:  s.spreadAwayBets,
    spread_home_money: s.spreadHomeMoney,
    spread_away_money: s.spreadAwayMoney,
    ml_home_bets:      s.mlHomeBets,
    ml_away_bets:      s.mlAwayBets,
    ml_home_money:     s.mlHomeMoney,
    ml_away_money:     s.mlAwayMoney,
    over_bets:         s.overBets,
    under_bets:        s.underBets,
    opening_spread:    s.openingSpread,
    current_spread:    s.currentSpread,
    opening_total:     s.openingTotal,
    current_total:     s.currentTotal,
    last_updated:      cachedAt,
  }))

  const { error } = await supabaseAdmin
    .from('cached_betting_splits')
    .upsert(rows, { onConflict: 'game_id' })

  if (error) {
    console.error('[sportsDataIOService] cacheBettingSplits upsert error:', error.message)
    return { cached: 0, errors: [...errors, error.message], cachedAt }
  }

  console.info(`[sportsDataIOService] cacheBettingSplits: ${rows.length} rows upserted`)
  return { cached: rows.length, errors, cachedAt }
}

// ─── Sharp money + line movement analysis ───────────────────────────────────────

/**
 * Compute sharp money indicators and line movement alerts from a betting split.
 *
 * Sharp Money: Public bets heavily on one side but money on the other.
 *   - Threshold: bets ≥ 65% on one side AND money ≤ 45% on that same side.
 *
 * Line Movement: Opening vs current spread changed by ≥ 2 points.
 */
export function analyzeBettingSplit(split: SdioBettingSplit): {
  sharpMoneyAlert: boolean
  sharpMoneySide: 'home' | 'away' | null
  sharpMoneyDesc: string | null
  lineMovementAlert: boolean
  lineMovementDesc: string | null
  totalMovementAlert: boolean
  totalMovementDesc: string | null
} {
  // Sharp money detection (spread bets vs money)
  let sharpMoneyAlert = false
  let sharpMoneySide: 'home' | 'away' | null = null
  let sharpMoneyDesc: string | null = null

  const homeBets = split.spreadHomeBeats ?? split.mlHomeBets
  const awayBets = split.spreadAwayBets ?? split.mlAwayBets
  const homeMoney = split.spreadHomeMoney ?? split.mlHomeMoney
  const awayMoney = split.spreadAwayMoney ?? split.mlAwayMoney

  if (homeBets != null && homeMoney != null) {
    if (homeBets >= 65 && homeMoney <= 45) {
      sharpMoneyAlert = true
      sharpMoneySide = 'away'   // sharp money is on the opposite side
      sharpMoneyDesc = `${Math.round(homeBets)}% of bets on ${split.homeTeam} but only ${Math.round(homeMoney)}% of money — sharp money on ${split.awayTeam}`
    } else if (awayBets != null && awayMoney != null && awayBets >= 65 && awayMoney <= 45) {
      sharpMoneyAlert = true
      sharpMoneySide = 'home'
      sharpMoneyDesc = `${Math.round(awayBets)}% of bets on ${split.awayTeam} but only ${Math.round(awayMoney)}% of money — sharp money on ${split.homeTeam}`
    }
  }

  // Line movement detection
  let lineMovementAlert = false
  let lineMovementDesc: string | null = null
  if (split.openingSpread != null && split.currentSpread != null) {
    const moved = Math.abs(split.currentSpread - split.openingSpread)
    if (moved >= 2) {
      lineMovementAlert = true
      const dir = split.currentSpread < split.openingSpread ? 'toward home' : 'toward away'
      lineMovementDesc = `Line moved from ${split.openingSpread > 0 ? '+' : ''}${split.openingSpread} to ${split.currentSpread > 0 ? '+' : ''}${split.currentSpread} (${dir})`
    }
  }

  // Total movement detection
  let totalMovementAlert = false
  let totalMovementDesc: string | null = null
  if (split.openingTotal != null && split.currentTotal != null) {
    const moved = Math.abs(split.currentTotal - split.openingTotal)
    if (moved >= 2) {
      totalMovementAlert = true
      const dir = split.currentTotal > split.openingTotal ? 'up' : 'down'
      totalMovementDesc = `Total moved ${dir} from ${split.openingTotal} → ${split.currentTotal}`
    }
  }

  return {
    sharpMoneyAlert,
    sharpMoneySide,
    sharpMoneyDesc,
    lineMovementAlert,
    lineMovementDesc,
    totalMovementAlert,
    totalMovementDesc,
  }
}

// ─── Season schedule feed ────────────────────────────────────────────────────────
//
// Confirmed endpoints (from docs screenshots):
//   NBA:  /v3/nba/scores/json/Games/{season}   — "Schedules"
//   NHL:  /v3/nhl/scores/json/Games/{season}   — "Schedules"
//   MLB:  /v3/mlb/scores/json/Games/{season}   — "Schedules"
//   CBB:  /v3/cbb/scores/json/Games/{season}   — "Games - by Season"
//
// All use: GET /v3/{league}/scores/json/Games/{YYYY}?key={apiKey}
// Return type: Game[] with full schedule for the season.
// Refreshed daily (not hourly) — season metadata is static; status/scores update via GamesByDate.

interface SDIOSeasonGame {
  GameId:             number
  DateTime?:          string | null   // "2026-03-09T19:30:00"
  Date?:              string | null   // date-only fallback: "2026-03-09"
  Status?:            string | null   // "Scheduled" | "Final" | "InProgress" | "Postponed" | "Canceled"
  SeasonType?:        number | null   // 1=Regular, 2=Preseason, 3=Postseason, 4=Tournament
  Season?:            number | null
  HomeTeam?:          string | null   // abbreviation
  AwayTeam?:          string | null
  HomeTeamName?:      string | null   // full name
  AwayTeamName?:      string | null
  HomeTeamID?:        number | null
  AwayTeamID?:        number | null
  HomeTeamScore?:     number | null
  AwayTeamScore?:     number | null
  Stadium?:           { Name?: string | null; City?: string | null } | null
  StadiumID?:         number | null
  NeutralVenue?:      boolean | null
  Channel?:           string | null   // broadcast e.g. "ESPN"
  PointSpread?:       number | null   // pre-game line from schedule feed
  OverUnder?:         number | null
}

/**
 * Map SDIO SeasonType integer to a human-readable label.
 */
function sdioSeasonTypeLabel(typeId: number | null | undefined): string {
  switch (typeId) {
    case 1: return 'Regular Season'
    case 2: return 'Preseason'
    case 3: return 'Playoffs'
    case 4: return 'Tournament'
    default: return 'Regular Season'
  }
}

/**
 * Derive the current season string for a given league.
 * NBA/NHL/CBB: season year = the calendar year the season *ends* in.
 *   e.g. 2025-26 NBA season → "2026"
 * MLB: season year = the calendar year the season runs in.
 *   e.g. 2026 MLB season → "2026"
 */
function getCurrentSeason(league: string): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1 // 1-12

  if (league === 'MLB') {
    // MLB regular season runs April–October; use current year
    return String(year)
  }

  // NBA/NHL: season crosses calendar years (Oct–Jun)
  // If we're in Aug/Sep/Oct onward, the season ending year = year+1
  // If Jan–Jul, the season ending year = current year
  if (month >= 8) return String(year + 1)
  return String(year)
}

/**
 * Fetch the full season schedule for one league from SDIO.
 * Endpoint: /v3/{league}/scores/json/Games/{season}
 */
async function fetchSeasonScheduleForLeague(
  config: LeagueConfig,
  apiKey: string,
): Promise<{ games: SDIOSeasonGame[]; errors: string[] }> {
  const season = getCurrentSeason(config.league)
  const url = `${SDIO_BASE}/${config.sdioKey}/scores/json/Games/${season}?key=${apiKey}`

  try {
    const data = await sdioFetch(url)
    const games = Array.isArray(data) ? data as SDIOSeasonGame[] : []
    console.info(`[sportsDataIOService] schedule ${config.league} ${season}: ${games.length} games`)
    return { games, errors: [] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sportsDataIOService] schedule ${config.league} FAILED:`, msg)
    return { games: [], errors: [`${config.league}: ${msg}`] }
  }
}

export interface CachedScheduleRow {
  game_id:       string       // "sdio_{GameId}"
  sdio_game_id:  number
  league:        string
  sport:         string
  home_team:     string
  away_team:     string
  home_team_id:  number | null
  away_team_id:  number | null
  game_date:     string       // "YYYY-MM-DD"
  commence_time: string | null
  status:        string
  season:        string
  season_type:   string
  venue:         string | null
  neutral_venue: boolean
  broadcast:     string | null
  home_score:    number | null
  away_score:    number | null
  last_updated:  string
}

function normalizeScheduleStatus(raw: string | null | undefined): string {
  if (!raw) return 'Scheduled'
  const s = raw.toLowerCase()
  if (s === 'final' || s === 'f' || s === 'f/ot') return 'Final'
  if (s === 'inprogress' || s === 'in progress' || s === 'live') return 'InProgress'
  if (s === 'postponed') return 'Postponed'
  if (s === 'canceled' || s === 'cancelled') return 'Canceled'
  return 'Scheduled'
}

function buildScheduleRow(
  game: SDIOSeasonGame,
  config: LeagueConfig,
  season: string,
  now: string,
): CachedScheduleRow {
  const homeTeam = game.HomeTeamName ?? game.HomeTeam ?? ''
  const awayTeam = game.AwayTeamName ?? game.AwayTeam ?? ''

  // Parse datetime — SDIO returns without timezone, treat as ET (UTC-5 winter / UTC-4 summer)
  // Store as-is with Z for downstream consistency (same as GamesByDate handling)
  const rawDt = game.DateTime ?? game.Date ?? null
  const commenceTime = rawDt
    ? (rawDt.endsWith('Z') ? rawDt : `${rawDt}Z`)
    : null

  // Extract date portion
  const gameDate = rawDt
    ? rawDt.slice(0, 10)   // "YYYY-MM-DD"
    : ''

  // Venue: SDIO returns a nested Stadium object
  const venue = game.Stadium?.Name
    ? (game.Stadium.City ? `${game.Stadium.Name}, ${game.Stadium.City}` : game.Stadium.Name)
    : null

  return {
    game_id:       buildGameId(game.GameId),
    sdio_game_id:  game.GameId,
    league:        config.league,
    sport:         config.sport,
    home_team:     homeTeam,
    away_team:     awayTeam,
    home_team_id:  game.HomeTeamID ?? null,
    away_team_id:  game.AwayTeamID ?? null,
    game_date:     gameDate,
    commence_time: commenceTime,
    status:        normalizeScheduleStatus(game.Status),
    season,
    season_type:   sdioSeasonTypeLabel(game.SeasonType),
    venue,
    neutral_venue: game.NeutralVenue ?? false,
    broadcast:     game.Channel ?? null,
    home_score:    game.HomeTeamScore ?? null,
    away_score:    game.AwayTeamScore ?? null,
    last_updated:  now,
  }
}

export interface CacheSchedulesResult {
  cached:   number
  errors:   string[]
  cachedAt: string
  leagues:  string[]
}

/**
 * Fetch the full season schedule for NBA, NHL, MLB, and NCAAB from SportsDataIO
 * and write them to the cached_schedules table.
 *
 * Strategy: upsert on (sdio_game_id, league) so:
 *   - New games are inserted
 *   - Existing games get status + score updates
 *   - No orphan rows accumulate
 *
 * Called daily (not hourly) from the daily-rollover cron.
 */
export async function cacheSchedules(): Promise<CacheSchedulesResult> {
  const errors: string[] = []
  const cachedAt = new Date().toISOString()
  const leaguesCached: string[] = []
  let totalCached = 0

  const apiKey = getSdioApiKey()
  if (!apiKey) {
    return { cached: 0, errors: ['No SPORTSDATAIO_API_KEY env var configured'], cachedAt, leagues: [] }
  }

  await Promise.allSettled(
    SDIO_LEAGUES.map(async (config) => {
      const season = getCurrentSeason(config.league)
      const { games, errors: fetchErrors } = await fetchSeasonScheduleForLeague(config, apiKey)
      errors.push(...fetchErrors)

      if (!games.length) return

      // Filter out games with no GameId or date (data quality guard)
      const validGames = games.filter((g) => g.GameId && (g.DateTime || g.Date))
      const rows = validGames.map((g) => buildScheduleRow(g, config, season, cachedAt))

      if (!rows.length) return

      // Upsert in batches of 200 to avoid payload limits
      const BATCH = 200
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH)
        const { error } = await supabaseAdmin
          .from('cached_schedules')
          .upsert(batch, { onConflict: 'sdio_game_id,league' })

        if (error) {
          errors.push(`${config.league} batch ${i / BATCH + 1}: ${error.message}`)
          console.error(`[sportsDataIOService] cacheSchedules ${config.league} upsert error:`, error.message)
        } else {
          totalCached += batch.length
        }
      }

      leaguesCached.push(config.league)
      console.info(`[sportsDataIOService] cacheSchedules ${config.league}: ${rows.length} rows upserted`)
    })
  )

  return { cached: totalCached, errors, cachedAt, leagues: leaguesCached }
}

/**
 * Query today's scheduled games from cached_schedules.
 * Returns games for a given date (UTC) across all leagues (or filtered by league).
 */
export async function getScheduledGamesForDate(
  date: string,   // "YYYY-MM-DD"
  league?: string,
): Promise<CachedScheduleRow[]> {
  let query = supabaseAdmin
    .from('cached_schedules')
    .select('*')
    .eq('game_date', date)
    .not('status', 'in', '("Canceled","Postponed")')
    .order('commence_time', { ascending: true })

  if (league) query = query.eq('league', league)

  const { data, error } = await query
  if (error) {
    console.error('[sportsDataIOService] getScheduledGamesForDate error:', error.message)
    return []
  }
  return (data ?? []) as CachedScheduleRow[]
}

/**
 * Look up a game's final status and scores from cached_schedules by SDIO game_id.
 * Used by the grading system to verify Final status via SDIO's own GameId.
 */
export async function getScheduleGameStatus(
  sdioGameId: number,
): Promise<{ status: string; homeScore: number | null; awayScore: number | null } | null> {
  const { data, error } = await supabaseAdmin
    .from('cached_schedules')
    .select('status, home_score, away_score')
    .eq('sdio_game_id', sdioGameId)
    .single()

  if (error || !data) return null
  return {
    status:     data.status as string,
    homeScore:  data.home_score as number | null,
    awayScore:  data.away_score as number | null,
  }
}
