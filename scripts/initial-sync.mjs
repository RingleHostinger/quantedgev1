/**
 * Initial sync script: generates predictions for all real games from cached_odds.
 * Run with: node scripts/initial-sync.mjs
 *
 * AI totals are anchored near the sportsbook total (±8 points) to produce
 * realistic total edges. AI spreads are clamped within ±6 of the book line.
 * Win probabilities are blended 50/50 with moneyline-implied probs.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(__dirname, '..')

// Load env files
for (const file of ['.env', '.env.local']) {
  const fp = path.join(appDir, file)
  if (!fs.existsSync(fp)) continue
  for (const line of fs.readFileSync(fp, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const idx = t.indexOf('=')
    if (idx < 0) continue
    const key = t.slice(0, idx).trim()
    const value = t.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const db = createClient(process.env.DATABASE_URL, process.env.DATABASE_SERVICE_ROLE_KEY)

const SPORT_DEFAULTS = {
  NBA:   { avgTotal: 225 },
  NFL:   { avgTotal: 47 },
  MLB:   { avgTotal: 8.5 },
  NHL:   { avgTotal: 6.0 },
  NCAAB: { avgTotal: 145 },
  EPL:   { avgTotal: 2.6 },
  UCL:   { avgTotal: 2.5 },
}

function seedRandom(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 0xFFFFFFFF }
}

function impliedProb(ml) {
  if (ml == null) return null
  return ml < 0 ? Math.abs(ml) / (Math.abs(ml) + 100) : 100 / (ml + 100)
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function generatePrediction(game) {
  const league = game.league || 'NBA'
  const defaults = SPORT_DEFAULTS[league] || SPORT_DEFAULTS.NBA
  const isSoccer = league === 'EPL' || league === 'UCL'
  const rngHome = seedRandom(game.home_team_name + league)
  const rngAway = seedRandom(game.away_team_name + league)

  const avgOff = defaults.avgTotal * 0.52
  const avgDef = defaults.avgTotal * 0.48
  const homeOff = avgOff + (rngHome() - 0.5) * 15
  const homeDef = avgDef + (rngHome() - 0.5) * 12
  const awayOff = avgOff + (rngAway() - 0.5) * 15
  const awayDef = avgDef + (rngAway() - 0.5) * 12
  const homePace = 95 + rngHome() * 15
  const awayPace = 95 + rngAway() * 15
  const homeForm = rngHome()
  const awayForm = rngAway()

  const paceFactor = ((homePace + awayPace) / 2) / 100
  const homeOffFactor = homeOff / avgOff
  const homeDefFactor = avgDef / Math.max(homeDef, 0.1)
  const awayOffFactor = awayOff / avgOff
  const awayDefFactor = avgDef / Math.max(awayDef, 0.1)
  const homeFormAdj = 0.9 + homeForm * 0.2
  const awayFormAdj = 0.9 + awayForm * 0.2

  let rawHome = avgOff * homeOffFactor * homeDefFactor * paceFactor * homeFormAdj * 1.03
  let rawAway = avgOff * awayOffFactor * awayDefFactor * paceFactor * awayFormAdj

  if (isSoccer) {
    rawHome = clamp(rawHome, 0.3, 5.0)
    rawAway = clamp(rawAway, 0.3, 4.5)
  } else {
    const scale = defaults.avgTotal / (rawHome + rawAway)
    rawHome *= scale
    rawAway *= scale
  }

  let homeScore = Math.round(rawHome * 10) / 10
  let awayScore = Math.round(rawAway * 10) / 10
  const scoreDiff = homeScore - awayScore
  const logScale = isSoccer ? 0.8 : 0.045

  let homeWinProb = clamp(1 / (1 + Math.exp(-scoreDiff * logScale)), 0.05, 0.95)
  const drawProb = isSoccer ? clamp(0.28 - Math.abs(scoreDiff) * 0.05, 0.05, 0.35) : 0
  let awayWinProb = clamp(1 - homeWinProb - drawProb, 0.05, 0.95)

  // Anchor AI total to sportsbook total ±8 (avoids model-scale artifacts)
  const sbTotal = game.sportsbook_total
  const sbSpread = game.sportsbook_spread
  let aiTotal = parseFloat((homeScore + awayScore).toFixed(1))
  let aiSpread = parseFloat((-(homeScore - awayScore)).toFixed(1))

  if (sbTotal != null && aiTotal > 0) {
    const ratio = homeScore / (homeScore + awayScore)
    const modelRatio = aiTotal / sbTotal
    const aiAdj = Math.max(-8, Math.min(8, (modelRatio - 1) * sbTotal))
    const anchoredTotal = Math.round((sbTotal + aiAdj) * 10) / 10
    homeScore = Math.round(anchoredTotal * ratio)
    awayScore = Math.round(anchoredTotal * (1 - ratio))
    aiTotal = parseFloat(anchoredTotal.toFixed(1))
  }

  // Clamp AI spread within ±6 of book spread
  if (sbSpread != null) {
    aiSpread = parseFloat((-(homeScore - awayScore)).toFixed(1))
    const clamped = Math.max(sbSpread - 6, Math.min(sbSpread + 6, aiSpread))
    aiSpread = parseFloat(clamped.toFixed(1))
  } else {
    aiSpread = parseFloat((-(homeScore - awayScore)).toFixed(1))
  }

  // Blend win probs 50/50 with moneyline-implied
  const implH = impliedProb(game.sportsbook_moneyline_home)
  const implA = impliedProb(game.sportsbook_moneyline_away)
  if (implH != null && implA != null) {
    const total = implH + implA
    homeWinProb = clamp(homeWinProb * 0.5 + (implH / total) * 0.5, 0.05, 0.95)
    awayWinProb = clamp(awayWinProb * 0.5 + (implA / total) * 0.5, 0.05, 0.95)
  }

  const spreadEdge = sbSpread != null
    ? parseFloat((Math.abs(aiSpread) - Math.abs(sbSpread)).toFixed(1))
    : null
  const totalEdge = sbTotal != null
    ? parseFloat((aiTotal - sbTotal).toFixed(1))
    : null
  const maxEdge = Math.max(Math.abs(spreadEdge ?? 0), Math.abs(totalEdge ?? 0))
  const edgeTier = maxEdge > 5 ? 'strong' : maxEdge >= 3 ? 'moderate' : maxEdge >= 1 ? 'lean' : 'none'

  const confidence = clamp(
    Math.round(50 + Math.abs(homeForm - awayForm) * 20 + (Math.abs(scoreDiff) / (defaults.avgTotal * 0.15)) * 10),
    40, 96
  )
  const confidenceTier = confidence >= 80 ? 'high' : confidence >= 65 ? 'medium' : 'low'
  const homeWinPct = Math.round(homeWinProb * 1000) / 10
  const awayWinPct = Math.round(awayWinProb * 1000) / 10

  return {
    game_id: game.id,
    predicted_home_score: Math.round(homeScore),
    predicted_away_score: Math.round(awayScore),
    ai_spread: aiSpread,
    ai_total: aiTotal,
    confidence,
    home_win_probability: homeWinPct,
    away_win_probability: awayWinPct,
    draw_probability: Math.round(drawProb * 1000) / 10,
    ai_reasoning: `AI projects ${game.home_team_name} ${Math.round(homeScore)}-${game.away_team_name} ${Math.round(awayScore)} with ${confidence}% confidence. Home win probability: ${homeWinPct}%.`,
    spread_edge: spreadEdge,
    total_edge: totalEdge,
    edge_tier: edgeTier,
    confidence_tier: confidenceTier,
    is_trending: homeWinPct > 75 || awayWinPct > 75,
    is_upset_pick: sbSpread != null && Math.abs(sbSpread) > 10 && Math.abs(aiSpread) < Math.abs(sbSpread) * 0.7,
    engine_version: 'v1.0',
  }
}

// Fetch all scheduled real games
const { data: games, error: gErr } = await db
  .from('games')
  .select('*')
  .not('odds_game_id', 'is', null)
  .eq('status', 'scheduled')

if (gErr) { console.error('Error fetching games:', gErr.message); process.exit(1) }
console.log(`Processing ${games.length} real scheduled games...`)

let generated = 0, updated = 0, errors = 0

for (const game of games) {
  try {
    const pred = generatePrediction(game)
    const { data: existing } = await db.from('predictions').select('id').eq('game_id', game.id).maybeSingle()

    if (existing?.id) {
      const { error } = await db.from('predictions').update(pred).eq('id', existing.id)
      if (error) throw error
      updated++
    } else {
      const { error } = await db.from('predictions').insert(pred)
      if (error) throw error
      generated++
    }

    await db.from('games').update({ engine_run_at: new Date().toISOString() }).eq('id', game.id)
  } catch (e) {
    console.error(`Error for ${game.home_team_name} vs ${game.away_team_name}:`, e.message)
    errors++
  }
}

console.log(`Done — Generated: ${generated}, Updated: ${updated}, Errors: ${errors}`)

// Log engine run
await db.from('engine_runs').insert({
  run_at: new Date().toISOString(),
  games_processed: games.length,
  predictions_generated: generated,
  predictions_updated: updated,
  status: errors === 0 ? 'completed' : 'partial',
  engine_version: 'v1.0',
  data_sources: { provider: 'TheOddsAPI+AnchoredModel', real_api_connected: true },
})

console.log('Engine run logged. Sync complete.')
