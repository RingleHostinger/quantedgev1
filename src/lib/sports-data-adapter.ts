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

// ─── Active provider resolver ─────────────────────────────────────────────

export function getActiveProvider(): DataProvider {
  // When real API keys are set, use the real providers
  // For now, always returns MockProvider — just swap this logic when connecting APIs
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
