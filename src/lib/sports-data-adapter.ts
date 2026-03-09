/**
 * QuantEdge Sports Data Adapter
 *
 * Abstraction layer between external sports data APIs and the prediction engine.
 * Each data source is a separate provider that can be swapped independently.
 *
 * Supported sports: NBA, NFL, MLB, NHL, NCAAB, EPL, UCL
 *
 * Architecture:
 *   External API  →  Provider (adapter)  →  Normalized types  →  Prediction Engine
 *
 * To connect a real API:
 *   1. Set the relevant env vars (see .env.local examples below)
 *   2. Implement the provider's fetch functions
 *   3. The engine will use real data automatically
 *
 * Required env vars when APIs are connected:
 *   ODDS_API_KEY          — The Odds API (sportsbook lines)
 *   SPORTRADAR_API_KEY    — Sportradar (stats, schedules, injuries)
 *   SPORTSDATA_API_KEY    — SportsDataIO (alternative stats source)
 */

// ─── Normalized data types ────────────────────────────────────────────────

export interface TeamStats {
  teamName: string
  league: string
  offensiveEfficiency: number   // points per 100 possessions (or goals per game for soccer)
  defensiveEfficiency: number   // points allowed per 100 possessions
  pace: number                  // possessions per 48 min (or avg possession % for soccer)
  last5Wins: number
  last5Losses: number
  homeWins: number
  homeLosses: number
  awayWins: number
  awayLosses: number
  pointsPerGame: number
  pointsAllowedPerGame: number
  strengthOfSchedule: number    // 0–1 scale, higher = tougher
  restDays: number
}

export interface SportsBookLine {
  gameId: string
  homeTeam: string
  awayTeam: string
  spread: number | null         // positive = home dog, negative = home favorite
  total: number | null
  moneylineHome: number | null  // American odds
  moneylineAway: number | null
  source: string                // e.g. "DraftKings", "FanDuel", "consensus"
}

export interface InjuryReport {
  playerName: string
  teamName: string
  injuryType: string
  status: 'Out' | 'Questionable' | 'Probable'
  impactScore: number           // 0–10 scale (10 = star player, 0 = bench player)
  notes: string
}

export interface HeadToHeadRecord {
  teamA: string
  teamB: string
  teamAWins: number
  teamBWins: number
  draws: number
  avgTotalScore: number
  lastMeetingWinner: string
}

export interface NormalizedGameData {
  gameId: string
  homeTeam: string
  awayTeam: string
  league: string
  sport: string
  scheduledAt: Date
  homeStats: TeamStats
  awayStats: TeamStats
  sbLine: SportsBookLine | null
  injuries: InjuryReport[]
  h2h: HeadToHeadRecord | null
  venue: string
}

// ─── Sport metadata ───────────────────────────────────────────────────────

export const SPORT_DEFAULTS: Record<string, {
  avgTotal: number
  spreadVariance: number
  paceMultiplier: number
}> = {
  NBA:    { avgTotal: 225, spreadVariance: 6.5,  paceMultiplier: 1.0 },
  NFL:    { avgTotal: 47,  spreadVariance: 5.0,  paceMultiplier: 0.8 },
  MLB:    { avgTotal: 8.5, spreadVariance: 1.5,  paceMultiplier: 0.5 },
  NHL:    { avgTotal: 6.0, spreadVariance: 1.2,  paceMultiplier: 0.6 },
  NCAAB:  { avgTotal: 145, spreadVariance: 8.0,  paceMultiplier: 1.1 },
  EPL:    { avgTotal: 2.6, spreadVariance: 1.0,  paceMultiplier: 0.4 },
  UCL:    { avgTotal: 2.5, spreadVariance: 0.9,  paceMultiplier: 0.4 },
}

// ─── Mock data generators (used when APIs are not connected) ──────────────

/**
 * Generates deterministic but realistic team stats from a team name + league.
 * Seed ensures the same team always gets the same stats within a session.
 */
function seedRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  return () => {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5
    return (h >>> 0) / 0xFFFFFFFF
  }
}

export function getMockTeamStats(teamName: string, league: string, isHome: boolean): TeamStats {
  const rng = seedRandom(teamName + league)
  const defaults = SPORT_DEFAULTS[league] || SPORT_DEFAULTS.NBA
  const baseOff = defaults.avgTotal * 0.52
  const baseDef = defaults.avgTotal * 0.48

  return {
    teamName,
    league,
    offensiveEfficiency: parseFloat((baseOff + (rng() - 0.5) * 15).toFixed(2)),
    defensiveEfficiency: parseFloat((baseDef + (rng() - 0.5) * 12).toFixed(2)),
    pace: parseFloat((95 + rng() * 15).toFixed(2)),
    last5Wins: Math.floor(rng() * 5) + 1,
    last5Losses: Math.floor(rng() * 4),
    homeWins: isHome ? Math.floor(rng() * 20) + 10 : Math.floor(rng() * 12),
    homeLosses: isHome ? Math.floor(rng() * 10) : Math.floor(rng() * 18),
    awayWins: isHome ? Math.floor(rng() * 12) : Math.floor(rng() * 20) + 8,
    awayLosses: isHome ? Math.floor(rng() * 18) : Math.floor(rng() * 12),
    pointsPerGame: parseFloat((baseOff + (rng() - 0.5) * 10).toFixed(1)),
    pointsAllowedPerGame: parseFloat((baseDef + (rng() - 0.5) * 8).toFixed(1)),
    strengthOfSchedule: parseFloat((0.35 + rng() * 0.45).toFixed(3)),
    restDays: Math.floor(rng() * 4) + 1,
  }
}

export function getMockInjuries(teamName: string): InjuryReport[] {
  const rng = seedRandom(teamName + 'injuries')
  const count = Math.floor(rng() * 3) // 0-2 injuries
  if (count === 0) return []

  const statuses: InjuryReport['status'][] = ['Out', 'Questionable', 'Probable']
  const types = ['Knee', 'Ankle', 'Back', 'Hamstring', 'Shoulder', 'Concussion']

  return Array.from({ length: count }, (_, i) => ({
    playerName: `Player ${i + 1}`,
    teamName,
    injuryType: types[Math.floor(rng() * types.length)],
    status: statuses[Math.floor(rng() * statuses.length)],
    impactScore: parseFloat((rng() * 8).toFixed(1)),
    notes: 'Day-to-day',
  }))
}

export function getMockH2H(homeTeam: string, awayTeam: string): HeadToHeadRecord {
  const rng = seedRandom(homeTeam + awayTeam)
  const total = Math.floor(rng() * 8) + 4
  const homeWins = Math.floor(rng() * total)
  const awayWins = total - homeWins
  return {
    teamA: homeTeam,
    teamB: awayTeam,
    teamAWins: homeWins,
    teamBWins: awayWins,
    draws: 0,
    avgTotalScore: 0,
    lastMeetingWinner: rng() > 0.5 ? homeTeam : awayTeam,
  }
}

// ─── Data provider interface ──────────────────────────────────────────────

export interface DataProvider {
  name: string
  isConnected: boolean
  fetchTeamStats(teamName: string, league: string, isHome: boolean): Promise<TeamStats>
  fetchSportsbookLines(gameId: string, homeTeam: string, awayTeam: string): Promise<SportsBookLine | null>
  fetchInjuries(teamName: string): Promise<InjuryReport[]>
  fetchH2H(homeTeam: string, awayTeam: string): Promise<HeadToHeadRecord>
}

// ─── Mock provider (default when APIs not connected) ──────────────────────

export const MockDataProvider: DataProvider = {
  name: 'MockProvider',
  isConnected: false,

  async fetchTeamStats(teamName, league, isHome) {
    return getMockTeamStats(teamName, league, isHome)
  },

  async fetchSportsbookLines(_gameId, homeTeam, awayTeam) {
    // Return null to signal that sportsbook lines should come from the DB
    // (already stored via admin panel)
    return null
  },

  async fetchInjuries(teamName) {
    return getMockInjuries(teamName)
  },

  async fetchH2H(homeTeam, awayTeam) {
    return getMockH2H(homeTeam, awayTeam)
  },
}

// ─── The Odds API provider (connect when API key is available) ─────────────

export const OddsApiProvider: Partial<DataProvider> = {
  name: 'TheOddsAPI',
  isConnected: !!(process.env.ODDS_API_KEY),

  async fetchSportsbookLines(gameId, homeTeam, awayTeam): Promise<SportsBookLine | null> {
    if (!process.env.ODDS_API_KEY) return null

    // Sport key mapping for The Odds API
    // https://the-odds-api.com/sports-odds-data/sports-apis.html
    // const sportKeys: Record<string, string> = {
    //   NBA: 'basketball_nba',
    //   NFL: 'americanfootball_nfl',
    //   MLB: 'baseball_mlb',
    //   NHL: 'icehockey_nhl',
    //   NCAAB: 'basketball_ncaab',
    //   EPL: 'soccer_epl',
    //   UCL: 'soccer_uefa_champs_league',
    // }
    // TODO: Implement real fetch when API key is provided
    return null
  },
}

// ─── Sportradar provider (connect when API key is available) ───────────────

export const SportradarProvider: Partial<DataProvider> = {
  name: 'Sportradar',
  isConnected: !!(process.env.SPORTRADAR_API_KEY),

  async fetchTeamStats(teamName, league, isHome): Promise<TeamStats> {
    if (!process.env.SPORTRADAR_API_KEY) {
      return getMockTeamStats(teamName, league, isHome)
    }
    // TODO: Implement real Sportradar fetch
    return getMockTeamStats(teamName, league, isHome)
  },

  async fetchInjuries(teamName): Promise<InjuryReport[]> {
    if (!process.env.SPORTRADAR_API_KEY) return getMockInjuries(teamName)
    // TODO: Implement real Sportradar injury fetch
    return getMockInjuries(teamName)
  },
}

// ─── SportsDataIO provider ────────────────────────────────────────────────

/**
 * SportsDataIO provider for team stats and injuries.
 * Injuries endpoint: /v3/{league}/scores/json/Injuries
 * Team stats are not available as a direct endpoint — we derive them from
 * season standings/stats when the key is set, falling back to mock data.
 */
export const SportsDataIOProvider: DataProvider = {
  name: 'SportsDataIO',
  isConnected: !!(
    process.env.SPORTSDATAIO_NBA_KEY ||
    process.env.SPORTSDATAIO_NHL_KEY ||
    process.env.SPORTSDATAIO_CBB_KEY
  ),

  async fetchTeamStats(teamName: string, league: string, isHome: boolean): Promise<TeamStats> {
    // SportsDataIO does not expose a direct per-team efficiency endpoint in v3 basic tier.
    // Use mock stats (seeded from team name) as a placeholder until a stats feed is wired.
    return getMockTeamStats(teamName, league, isHome)
  },

  async fetchSportsbookLines(_gameId: string, _homeTeam: string, _awayTeam: string): Promise<SportsBookLine | null> {
    // Lines come from the cached_odds table (populated by sportsDataIOService).
    // Return null here so the caller uses the stored DB line instead.
    return null
  },

  async fetchInjuries(teamName: string): Promise<InjuryReport[]> {
    const leagueForTeam = _guessLeagueFromContext()
    const apiKey = leagueForTeam === 'NHL'
      ? process.env.SPORTSDATAIO_NHL_KEY
      : leagueForTeam === 'NCAAB'
        ? process.env.SPORTSDATAIO_CBB_KEY
        : process.env.SPORTSDATAIO_NBA_KEY

    if (!apiKey) return getMockInjuries(teamName)

    const sdioLeague = leagueForTeam === 'NHL' ? 'nhl'
      : leagueForTeam === 'NCAAB' ? 'cbb'
      : 'nba'

    try {
      // Confirmed endpoints:
      //   NBA/NHL: /v3/{league}/projections/json/InjuredPlayers
      //   CBB:     /v3/cbb/scores/json/InjuredPlayers
      const injuryPath = sdioLeague === 'cbb' ? 'scores' : 'projections'
      const url = `https://api.sportsdata.io/v3/${sdioLeague}/${injuryPath}/json/InjuredPlayers?key=${apiKey}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      let res: Response
      try {
        res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
      } finally {
        clearTimeout(timeout)
      }

      if (!res.ok) return getMockInjuries(teamName)

      const data = await res.json()
      const injuries: InjuryReport[] = []

      if (Array.isArray(data)) {
        for (const item of data) {
          // Filter to the requested team (full name or abbreviation match)
          const itemTeam: string = item.TeamName ?? item.Team ?? ''
          if (!itemTeam.toLowerCase().includes(teamName.toLowerCase().split(' ').pop() ?? teamName)) {
            continue
          }
          injuries.push({
            playerName: `${item.FirstName ?? ''} ${item.LastName ?? ''}`.trim() || 'Unknown',
            teamName:   itemTeam,
            injuryType: item.InjuryBodyPart ?? item.Injury ?? 'Unknown',
            status:     _mapSdioStatus(item.Status),
            impactScore: typeof item.FantasyPoints === 'number'
              ? Math.min(10, item.FantasyPoints / 5)
              : 5,
            notes: item.InjuryNotes ?? item.Practice ?? 'Day-to-day',
          })
        }
      }

      return injuries.length > 0 ? injuries : getMockInjuries(teamName)
    } catch {
      return getMockInjuries(teamName)
    }
  },

  async fetchH2H(homeTeam: string, awayTeam: string): Promise<HeadToHeadRecord> {
    return getMockH2H(homeTeam, awayTeam)
  },
}

/** Map SportsDataIO injury status strings to our InjuryReport status enum. */
function _mapSdioStatus(status: string | undefined): InjuryReport['status'] {
  if (!status) return 'Questionable'
  const s = status.toLowerCase()
  if (s === 'out' || s === 'dnp' || s === 'did not participate') return 'Out'
  if (s === 'probable' || s === 'full practice') return 'Probable'
  return 'Questionable'
}

/**
 * Lightweight helper: returns a league hint based on which SDIO key is
 * exclusively set. Used when we only have the team name and need to pick
 * the right endpoint for the injuries fetch.
 * If multiple keys are set we default to NBA.
 */
function _guessLeagueFromContext(): string {
  const hasNba   = !!process.env.SPORTSDATAIO_NBA_KEY
  const hasNhl   = !!process.env.SPORTSDATAIO_NHL_KEY
  const hasCbb   = !!process.env.SPORTSDATAIO_CBB_KEY
  if (hasNhl && !hasNba && !hasCbb) return 'NHL'
  if (hasCbb && !hasNba && !hasNhl) return 'NCAAB'
  return 'NBA'
}

// ─── Active provider resolver ─────────────────────────────────────────────

export function getActiveProvider(): DataProvider {
  // Use SportsDataIO when at least one key is configured
  if (SportsDataIOProvider.isConnected) return SportsDataIOProvider
  // Fall back to mock data provider
  return MockDataProvider
}

// ─── Composite data fetcher ───────────────────────────────────────────────

export async function fetchGameData(
  gameId: string,
  homeTeam: string,
  awayTeam: string,
  league: string,
  sport: string,
  scheduledAt: Date,
  storedSbLine?: {
    spread: number | null
    total: number | null
    moneylineHome: number | null
    moneylineAway: number | null
  } | null,
): Promise<NormalizedGameData> {
  const provider = getActiveProvider()

  const [homeStats, awayStats, injuries, h2h, apiLine] = await Promise.all([
    provider.fetchTeamStats(homeTeam, league, true),
    provider.fetchTeamStats(awayTeam, league, false),
    Promise.all([
      provider.fetchInjuries(homeTeam),
      provider.fetchInjuries(awayTeam),
    ]).then(([a, b]) => [...a, ...b]),
    provider.fetchH2H(homeTeam, awayTeam),
    provider.fetchSportsbookLines(gameId, homeTeam, awayTeam),
  ])

  // Prefer stored DB line over API line (admin-entered lines take priority)
  const sbLine: SportsBookLine | null = (storedSbLine?.spread != null || storedSbLine?.total != null)
    ? {
        gameId,
        homeTeam,
        awayTeam,
        spread: storedSbLine?.spread ?? null,
        total: storedSbLine?.total ?? null,
        moneylineHome: storedSbLine?.moneylineHome ?? null,
        moneylineAway: storedSbLine?.moneylineAway ?? null,
        source: 'admin',
      }
    : apiLine

  return {
    gameId,
    homeTeam,
    awayTeam,
    league,
    sport,
    scheduledAt,
    homeStats,
    awayStats,
    sbLine,
    injuries,
    h2h,
    venue: 'Home venue',
  }
}
