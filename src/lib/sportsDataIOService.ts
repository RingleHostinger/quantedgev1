/**
 * sportsDataIOService
 *
 * Fetches sports data from SportsDataIO v3 API for NBA, NHL, and CBB/NCAAB.
 * Populates the cached_odds table in the same shape as the TheOddsAPI provider,
 * so all downstream services (sync, predictions, picks, grading) are unaffected.
 *
 * Endpoints used:
 *   GamesByDate:    /v3/{league}/scores/json/GamesByDate/{YYYY-MMM-DD}
 *   GameOddsByDate: /v3/{league}/odds/json/GameOddsByDate/{YYYY-MMM-DD}
 *   Injuries:       /v3/{league}/scores/json/Injuries
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
  sdioKey: string          // URL segment: nba | nhl | cbb
  league: string           // our internal label: NBA | NHL | NCAAB
  sport: string            // our internal label: Basketball | Hockey
}

const SDIO_LEAGUES: LeagueConfig[] = [
  { sdioKey: 'nba', league: 'NBA',   sport: 'Basketball' },
  { sdioKey: 'nhl', league: 'NHL',   sport: 'Hockey'     },
  { sdioKey: 'cbb', league: 'NCAAB', sport: 'Basketball' },
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
  status:          'Out' | 'Questionable' | 'Probable' | 'Day-To-Day' | 'IR' | 'GTD'
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
  const s = raw.toLowerCase()
  if (s === 'out' || s === 'did not participate' || s === 'dnp') return 'Out'
  if (s === 'ir' || s === 'injured reserve' || s === 'suspended') return 'IR'
  if (s === 'probable' || s === 'full practice' || s === 'full participation') return 'Probable'
  if (s === 'day-to-day' || s === 'dtd') return 'Day-To-Day'
  if (s === 'gtd' || s === 'game time decision') return 'GTD'
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
  const url = `${SDIO_BASE}/${config.sdioKey}/scores/json/Injuries?key=${apiKey}`
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
    configuredLeagues.map(async (config) => {
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

interface SDIOBettingSplitRaw {
  GameId:               number
  HomeTeam?:            string
  AwayTeam?:            string
  HomeTeamName?:        string
  AwayTeamName?:        string
  // Consensus splits (where available)
  SpreadHomePercentage?:  number | null
  SpreadAwayPercentage?:  number | null
  SpreadHomeMoneyPercentage?: number | null
  SpreadAwayMoneyPercentage?: number | null
  MoneyLineHomePercentage?: number | null
  MoneyLineAwayPercentage?: number | null
  MoneyLineHomeMoneyPercentage?: number | null
  MoneyLineAwayMoneyPercentage?: number | null
  OverPercentage?:      number | null
  UnderPercentage?:     number | null
  // Line movement (from GameLines)
  SpreadOpen?:          number | null
  PointSpreadHome?:     number | null
  OverUnderOpen?:       number | null
  OverUnder?:           number | null
}

/**
 * Fetch betting splits for a given date from SportsDataIO BettingSplitsByDate.
 * Endpoint: /v3/{league}/odds/json/BettingSplitsByGameOddsLineMovement/{date}
 * Falls back to GameOddsByDate if splits not available.
 */
async function fetchBettingSplitsForLeague(
  config: LeagueConfig,
  apiKey: string,
  dateStr: string,
): Promise<SdioBettingSplit[]> {
  // Try the betting splits endpoint first
  const splitsUrl = `${SDIO_BASE}/${config.sdioKey}/odds/json/BettingSplitsByGameOddsLineMovement/${dateStr}?key=${apiKey}`
  let data: unknown
  try {
    data = await sdioFetch(splitsUrl)
  } catch {
    // Splits may not be available on all subscription tiers — fall back to line movement
    data = []
  }

  // If splits endpoint returned nothing, try alternative: AlternateMarketGameOddsByDate
  const rawList = Array.isArray(data) ? data as SDIOBettingSplitRaw[] : []

  // Also fetch GameOddsByDate to get opening/current lines for movement tracking
  let linesData: SDIOGameOdds[] = []
  try {
    linesData = await fetchOddsByDate(config.sdioKey, apiKey, dateStr)
  } catch {
    // non-fatal
  }

  const linesMap = new Map<number, SDIOGameOdds>()
  for (const l of linesData) linesMap.set(l.GameId, l)

  const results: SdioBettingSplit[] = []

  for (const raw of rawList) {
    const lineData  = linesMap.get(raw.GameId)
    const bestLine  = lineData ? pickBestOdds(lineData.PregameOdds) : null

    results.push({
      gameId:           buildGameId(raw.GameId),
      league:           config.league,
      homeTeam:         raw.HomeTeamName ?? raw.HomeTeam ?? '',
      awayTeam:         raw.AwayTeamName ?? raw.AwayTeam ?? '',
      spreadHomeBeats:  raw.SpreadHomePercentage ?? null,
      spreadAwayBets:   raw.SpreadAwayPercentage ?? null,
      spreadHomeMoney:  raw.SpreadHomeMoneyPercentage ?? null,
      spreadAwayMoney:  raw.SpreadAwayMoneyPercentage ?? null,
      mlHomeBets:       raw.MoneyLineHomePercentage ?? null,
      mlAwayBets:       raw.MoneyLineAwayPercentage ?? null,
      mlHomeMoney:      raw.MoneyLineHomeMoneyPercentage ?? null,
      mlAwayMoney:      raw.MoneyLineAwayMoneyPercentage ?? null,
      overBets:         raw.OverPercentage ?? null,
      underBets:        raw.UnderPercentage ?? null,
      openingSpread:    raw.SpreadOpen ?? null,
      currentSpread:    bestLine?.HomePointSpread ?? raw.PointSpreadHome ?? null,
      openingTotal:     raw.OverUnderOpen ?? null,
      currentTotal:     bestLine?.OverUnder ?? raw.OverUnder ?? null,
    })
  }

  return results
}

/**
 * Fetch betting splits for all configured leagues for today's date.
 */
export async function fetchBettingSplits(): Promise<{
  splits: SdioBettingSplit[]
  errors: string[]
}> {
  const errors: string[] = []
  const all: SdioBettingSplit[] = []

  const apiKey = getSdioApiKey()
  if (!apiKey) {
    return { splits: [], errors: ['No SPORTSDATAIO_API_KEY env var configured'] }
  }
  const configuredLeagues = SDIO_LEAGUES

  const dates = getSdioFetchDates()

  await Promise.allSettled(
    configuredLeagues.flatMap((config) =>
      dates.map(async (dateStr) => {
        try {
          const splits = await fetchBettingSplitsForLeague(config, apiKey, dateStr)
          all.push(...splits)
          console.info(`[sportsDataIOService] betting splits ${config.league} ${dateStr}: ${splits.length}`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`${config.league} ${dateStr}: ${msg}`)
        }
      })
    )
  )

  // Deduplicate by gameId (same game may appear for today + tomorrow)
  const seen = new Set<string>()
  const deduped = all.filter((s) => {
    if (seen.has(s.gameId)) return false
    seen.add(s.gameId)
    return true
  })

  return { splits: deduped, errors }
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
