/**
 * spreadPickUtils
 *
 * Centralized spread pick direction logic used across:
 * - officialPicksService (storing picks)
 * - Model Performance page (displaying picks)
 * - Home dashboard / edges page (showing recommended bet)
 * - Briefing API (insights)
 *
 * The sportsbook_spread is always expressed from the HOME team's perspective:
 *   negative = home team is favored  (e.g. -7.5 means home gives 7.5 points)
 *   positive = home team is underdog (e.g. +3.5 means home gets 3.5 points)
 *
 * Value side rule:
 *   model_spread > sportsbook_spread  →  model is softer on the home favorite
 *                                        (e.g. model -1.5 vs book -7.5)
 *                                        → UNDERDOG has value → pick AWAY team
 *                                        → away line = -sportsbook_spread (e.g. +7.5)
 *
 *   model_spread < sportsbook_spread  →  model is more bullish on the home team
 *                                        (e.g. model -10.5 vs book -6.5)
 *                                        → FAVORITE has value → pick HOME team
 *                                        → home line = sportsbook_spread (e.g. -6.5)
 */

export interface SpreadPick {
  /** Team name that is the value side */
  team: string
  /** The sportsbook line from THAT TEAM's perspective (e.g. "+7.5" or "-6.5") */
  line: number
  /** Formatted line string (e.g. "+7.5" or "-6.5") */
  lineStr: string
  /** Whether the pick is on the away team (underdog) */
  isAway: boolean
}

/**
 * Determine the value side for a spread bet and return the correct
 * team + line from that team's perspective.
 *
 * @param modelSpread  Model's spread from home team perspective (e.g. -1.5)
 * @param sbSpread     Sportsbook spread from home team perspective (e.g. -7.5)
 * @param homeTeam     Home team name
 * @param awayTeam     Away team name
 * @returns SpreadPick with team name and correctly-oriented line, or null if data missing
 */
export function spreadPickSide(
  modelSpread: number | null,
  sbSpread: number | null,
  homeTeam: string,
  awayTeam: string,
): SpreadPick | null {
  if (modelSpread == null || sbSpread == null) return null

  if (modelSpread > sbSpread) {
    // Model is softer on the home team → underdog (away) has value
    // Away team's line is the negation of the home spread
    const awayLine = -sbSpread
    return {
      team: awayTeam,
      line: awayLine,
      lineStr: awayLine >= 0 ? `+${awayLine}` : `${awayLine}`,
      isAway: true,
    }
  }

  // Model is more bullish on home team → favorite (home) has value
  return {
    team: homeTeam,
    line: sbSpread,
    lineStr: sbSpread >= 0 ? `+${sbSpread}` : `${sbSpread}`,
    isAway: false,
  }
}

/** Format a numeric line as a string with sign (e.g. -7.5 → "-7.5", 3.5 → "+3.5") */
export function formatLine(line: number | null): string {
  if (line == null) return 'N/A'
  return line >= 0 ? `+${line}` : `${line}`
}
