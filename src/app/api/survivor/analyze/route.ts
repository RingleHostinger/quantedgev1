/**
 * POST /api/survivor/analyze
 *
 * AI Strategy Coach — reviews the user's current survivor pool picks and
 * returns structured coaching advice using GPT-4o-mini.
 *
 * The AI is given real structured data (picks, win probabilities, EV scores,
 * public pick %, future value, pool rules, simulation results) and asked to
 * produce a structured review — NOT generic freeform text.
 *
 * Body:
 * {
 *   picks:       Array of saved picks with metadata
 *   pool:        Pool config (strike_rule, pool_size, pick_format, …)
 *   edgeData:    EdgeRow data for each picked team (from MOCK_EDGE_TABLE)
 *   simResult?:  Latest Monte Carlo simulation result (optional)
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSession } from '@/lib/auth'

// ── Types mirrored from the frontend ────────────────────────────────────────
interface AnalyzePick {
  round: number
  roundLabel: string
  teamName: string
  teamSeed: number | null
  opponentName: string | null
  winProbability: number | null
  survivorEV: number | null
  publicPickPct: number | null
  futureValue: number | null
  riskScore: number | null
  aiScore: number | null
  result: string
}

interface PoolInfo {
  pool_name: string
  pool_size: string
  pick_format: string
  strike_rule: string
  team_reuse: boolean
}

interface SimSummary {
  survivalProbability: number
  mostCommonElimRound: number | null
  evVsPool: number
  bestPath: string[]
}

interface AnalyzeRequest {
  picks: AnalyzePick[]
  pool: PoolInfo
  simResult?: SimSummary
}

// ── Build a tightly-structured system prompt ────────────────────────────────
function buildSystemPrompt(): string {
  return `You are an expert NCAA March Madness survivor pool strategist.
You will receive structured JSON data about a user's current survivor picks, pool rules, and simulation results.
Your job is to produce a concise, actionable strategy review.

RULES:
- Use ONLY the data provided. Do not invent statistics.
- Be specific: name actual teams, actual numbers, actual rounds.
- Keep each section short — 1–3 sentences max.
- Tone: confident, analytical, friendly coach.
- Return ONLY the JSON object below — no markdown, no extra text.

OUTPUT FORMAT (strict JSON):
{
  "currentSurvivalProbability": <number 0-100 or null if unknown>,
  "overallAssessment": "<1-2 sentence summary of the strategy>",
  "weakPoints": [
    { "team": "<team name>", "round": <number>, "issue": "<brief reason>" }
  ],
  "saveForLater": [
    { "team": "<team name>", "reason": "<why save for later>", "betterRound": "<round label>" }
  ],
  "suggestedReplacements": [
    {
      "replace": "<current team>",
      "replaceRound": <number>,
      "with": "<suggested alternative team>",
      "reason": "<brief reasoning>",
      "projectedImpact": "<e.g. +2.1% survival probability>"
    }
  ],
  "updatedSurvivalEstimate": <number 0-100 or null>,
  "coachNote": "<1 sentence motivational closing note>"
}`
}

function buildUserMessage(body: AnalyzeRequest): string {
  const { picks, pool, simResult } = body

  const poolDesc = [
    `Pool: "${pool.pool_name}"`,
    `Size: ${pool.pool_size}`,
    `Pick format: ${pool.pick_format}`,
    `Strike rule: ${pool.strike_rule === 'one_strike' ? 'One loss eliminates entry' : 'One strike allowed'}`,
    `Team reuse: ${pool.team_reuse ? 'allowed' : 'not allowed'}`,
  ].join(' | ')

  const picksDesc = picks.map((p) =>
    `  Round ${p.round} (${p.roundLabel}): ${p.teamName}` +
    (p.teamSeed != null ? ` [#${p.teamSeed}]` : '') +
    (p.opponentName ? ` vs ${p.opponentName}` : '') +
    ` | Win%: ${p.winProbability ?? 'N/A'}%` +
    ` | SurvivorEV: ${p.survivorEV != null ? `+${p.survivorEV}%` : 'N/A'}` +
    ` | Public%: ${p.publicPickPct ?? 'N/A'}%` +
    ` | FutureValue: ${p.futureValue ?? 'N/A'}/100` +
    ` | Risk: ${p.riskScore ?? 'N/A'}` +
    ` | AIScore: ${p.aiScore ?? 'N/A'}` +
    ` | Result: ${p.result}`
  ).join('\n')

  const simDesc = simResult
    ? [
        `Simulation (10,000 runs):`,
        `  Overall survival probability: ${simResult.survivalProbability}%`,
        `  Most common elimination round: ${simResult.mostCommonElimRound != null ? `Round ${simResult.mostCommonElimRound}` : 'None (survived)'}`,
        `  EV vs avg pool entry: ${simResult.evVsPool >= 0 ? '+' : ''}${simResult.evVsPool}%`,
        `  Optimal path: ${simResult.bestPath.join(' → ')}`,
      ].join('\n')
    : 'Simulation: not yet run'

  return `POOL RULES\n${poolDesc}\n\nSAVED PICKS\n${picksDesc}\n\n${simDesc}\n\nPlease review this survivor strategy and return your analysis as JSON.`
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'AI Strategy Coach is not configured. Please contact support.' },
      { status: 503 }
    )
  }

  let body: AnalyzeRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.picks || body.picks.length === 0) {
    return NextResponse.json(
      { error: 'No picks to analyze. Save at least one pick first.' },
      { status: 400 }
    )
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 900,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserMessage(body) },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? ''

    // Parse the JSON — handle any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    let review: unknown
    try {
      review = JSON.parse(cleaned)
    } catch {
      // If parsing fails, return raw text so the frontend can still display it
      return NextResponse.json({ raw })
    }

    return NextResponse.json({ review })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `AI analysis failed: ${message}` },
      { status: 500 }
    )
  }
}
