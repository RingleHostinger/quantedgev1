// ─── Shared Bracket Types & Constants ────────────────────────────────────────
// Used by both admin bracket editor and user-facing survivor views.

export interface BracketTeam {
  seed: number
  name: string
}

export interface BracketMatchup {
  team1: string
  team1Seed: number
  team2: string
  team2Seed: number
  winner: string | null
  locked?: boolean  // Individual game lock for manual locking
}

export interface OfficialBracketData {
  regions?: Record<string, BracketTeam[]>
  results?: Record<string, Record<string, BracketMatchup>>
  posted_games?: Record<number, string[]>  // contest_day -> array of matchup keys
}

export interface RoundCompletionStatus {
  total: number
  completed: number
  allDone: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const REGIONS = ['East', 'West', 'South', 'Midwest'] as const

export const SEED_PAIRINGS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13],
  [6, 11], [3, 14], [7, 10], [2, 15],
]

export const ROUND_KEYS = [
  'round64', 'round32', 'sweet16', 'elite8', 'finalFour', 'championship',
] as const

export const ROUND_LABELS: Record<string, string> = {
  round64: 'Round of 64',
  round32: 'Round of 32',
  sweet16: 'Sweet 16',
  elite8: 'Elite Eight',
  finalFour: 'Final Four',
  championship: 'Championship',
}

export const ROUND_MATCHUP_COUNTS: Record<string, number> = {
  round64: 32,
  round32: 16,
  sweet16: 8,
  elite8: 4,
  finalFour: 2,
  championship: 1,
}

// Round number (1-6) to round key
export function roundNumberToKey(roundNumber: number): string {
  return ROUND_KEYS[roundNumber - 1] ?? 'round64'
}

// Round key to round number (1-6)
export function roundKeyToNumber(roundKey: string): number {
  const idx = ROUND_KEYS.indexOf(roundKey as typeof ROUND_KEYS[number])
  return idx >= 0 ? idx + 1 : 1
}

// Parse matchup index from key - handles both "m0" and "east_0" formats
export function parseMatchupIndex(key: string): number {
  if (key.startsWith('m')) {
    return parseInt(key.slice(1), 10)
  }
  const parts = key.split('_')
  if (parts.length === 2) {
    return parseInt(parts[1], 10)
  }
  return 0
}

// Sort matchup entries by index
export function sortMatchupEntries(
  entries: [string, BracketMatchup][]
): [string, BracketMatchup][] {
  return entries.sort((a, b) => parseMatchupIndex(a[0]) - parseMatchupIndex(b[0]))
}

// Get region name for a round64 matchup index (0-31)
// 0-7 = East, 8-15 = West, 16-23 = South, 24-31 = Midwest
export function getRegionForMatchup(matchupIndex: number): string {
  if (matchupIndex < 8) return 'East'
  if (matchupIndex < 16) return 'West'
  if (matchupIndex < 24) return 'South'
  return 'Midwest'
}

// Compute round completion from bracket results
export function computeRoundCompletion(
  results: Record<string, Record<string, BracketMatchup>> | undefined
): Record<string, RoundCompletionStatus> {
  const status: Record<string, RoundCompletionStatus> = {}
  for (const roundKey of ROUND_KEYS) {
    const matchups = results?.[roundKey] ?? {}
    const entries = Object.values(matchups)
    const total = ROUND_MATCHUP_COUNTS[roundKey] ?? 0
    const completed = entries.filter((m) => m.winner != null && m.winner !== '').length
    status[roundKey] = { total, completed, allDone: completed >= total && total > 0 }
  }
  return status
}

// Compute active round number (1-6) from bracket results
// Returns first round where not all matchups have winners. 7 = tournament complete.
export function computeActiveRound(
  results: Record<string, Record<string, BracketMatchup>> | undefined
): number {
  if (!results) return 1
  for (let i = 0; i < ROUND_KEYS.length; i++) {
    const roundKey = ROUND_KEYS[i]
    const matchups = results[roundKey] ?? {}
    const entries = Object.values(matchups)
    const total = ROUND_MATCHUP_COUNTS[roundKey] ?? 0
    const completed = entries.filter((m) => m.winner != null && m.winner !== '').length
    if (completed < total) return i + 1
  }
  return 7 // Tournament complete
}
