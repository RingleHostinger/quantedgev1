'use client'

import { useEffect, useState, useMemo } from 'react'
import { BarChart2, Lock, Star, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { GameSearchBar, GameSearchItem } from '@/components/GameSearchBar'

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316', NFL: '#3B82F6', MLB: '#EF4444',
  NHL: '#A78BFA', NCAAB: '#F59E0B', EPL: '#00FFA3', UCL: '#06B6D4',
}

interface InjuryInfo {
  playerName: string
  status: string
  impactScore: number
}

interface HeatmapRow {
  id: string
  game_id: string
  league: string
  home_team: string
  away_team: string
  commence_time: string
  sportsbook_spread: number | null
  model_spread: number | null
  spread_edge: number | null
  model_prob_home: number | null
  model_prob_away: number | null
  confidence: number | null
  // Betting splits
  publicBetsHome: number | null
  publicBetsAway: number | null
  publicMoneyHome: number | null
  publicMoneyAway: number | null
  // Sharp money
  sharpMoneyAlert: boolean
  sharpMoneySide: 'home' | 'away' | null
  sharpMoneyDesc: string | null
  // Line movement
  openingSpread: number | null
  lineMovementAlert: boolean
  lineMovementDesc: string | null
  totalMovementAlert: boolean
  totalMovementDesc: string | null
  // Injuries
  hasInjuryImpact: boolean
  homeInjuries: InjuryInfo[]
  awayInjuries: InjuryInfo[]
}

/** Edge magnitude → heat color config */
function edgeHeat(edge: number | null): { color: string; bg: string; border: string; label: string; intensity: 1 | 2 | 3 } {
  const abs = Math.abs(edge ?? 0)
  if (abs >= 4) return { color: '#00C97A', bg: 'rgba(0,201,122,0.13)', border: 'rgba(0,201,122,0.35)', label: 'Strong', intensity: 3 }
  if (abs >= 2) return { color: '#34D399', bg: 'rgba(52,211,153,0.09)', border: 'rgba(52,211,153,0.25)', label: 'Medium', intensity: 2 }
  return { color: '#6EE7B7', bg: 'rgba(110,231,183,0.06)', border: 'rgba(110,231,183,0.18)', label: 'Light', intensity: 1 }
}

function formatSpread(spread: number | null, team: string): string {
  if (spread == null) return 'N/A'
  const sign = spread > 0 ? '+' : ''
  return `${team} ${sign}${spread}`
}

function formatTs(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function PublicBetsBar({ homePct, awayPct, homeTeam, awayTeam, label }: {
  homePct: number | null; awayPct: number | null
  homeTeam: string; awayTeam: string; label: string
}) {
  if (homePct == null && awayPct == null) return null
  const h = homePct ?? (100 - (awayPct ?? 50))
  const a = awayPct ?? (100 - h)

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>{label}</span>
        <span className="text-xs" style={{ color: '#4A4A60' }}>{homeTeam} vs {awayTeam}</span>
      </div>
      <div className="flex rounded-full overflow-hidden h-4 text-xs font-bold">
        <div
          className="flex items-center justify-center transition-all"
          style={{ width: `${h}%`, background: 'rgba(0,255,163,0.25)', color: '#00FFA3', minWidth: h > 10 ? '2rem' : 0 }}
        >
          {h > 10 ? `${Math.round(h)}%` : ''}
        </div>
        <div
          className="flex items-center justify-center transition-all"
          style={{ width: `${a}%`, background: 'rgba(255,107,107,0.2)', color: '#FF6B6B', minWidth: a > 10 ? '2rem' : 0 }}
        >
          {a > 10 ? `${Math.round(a)}%` : ''}
        </div>
      </div>
      <div className="flex justify-between text-xs mt-0.5" style={{ color: '#6B6B80' }}>
        <span>{homeTeam}</span><span>{awayTeam}</span>
      </div>
    </div>
  )
}

function HeatCard({ row, rank }: { row: HeatmapRow; rank: number }) {
  const edgeAbs = Math.abs(row.spread_edge ?? 0)
  const heat = edgeHeat(row.spread_edge)
  const lc = LEAGUE_COLORS[row.league] || '#A0A0B0'
  const gameTime = new Date(row.commence_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const homeProb = row.model_prob_home ?? 50
  const awayProb = row.model_prob_away ?? 50
  const modelPrefersHome = homeProb >= awayProb

  const hasSplits = row.publicBetsHome != null || row.publicMoneyHome != null
  const hasAlerts = row.sharpMoneyAlert || row.lineMovementAlert || row.totalMovementAlert

  return (
    <div
      id={`game-card-${row.id}`}
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${heat.border}`,
        boxShadow: heat.intensity === 3 ? `0 0 18px ${heat.color}18` : undefined,
      }}
    >
      {/* Top stripe */}
      <div style={{ height: 3, background: heat.color, opacity: heat.intensity === 3 ? 1 : heat.intensity === 2 ? 0.65 : 0.4 }} />

      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black mt-0.5"
          style={{ background: heat.bg, color: heat.color, border: `1px solid ${heat.border}` }}
        >
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${lc}18`, color: lc, border: `1px solid ${lc}30` }}>
              {row.league}
            </span>
            <span className="text-xs" style={{ color: '#6B6B80' }}>{gameTime}</span>
            {/* Alert indicators */}
            {row.sharpMoneyAlert && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                Sharp
              </span>
            )}
            {row.lineMovementAlert && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
                Line Move
              </span>
            )}
            {row.hasInjuryImpact && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)' }}>
                Injury
              </span>
            )}
          </div>
          <div className="text-sm font-black" style={{ color: '#E6E6FA' }}>
            {row.away_team} @ {row.home_team}
          </div>
        </div>

        {/* Edge badge */}
        <div className="flex flex-col items-end flex-shrink-0">
          <div className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Edge</div>
          <div className="text-lg font-black" style={{ color: heat.color }}>
            {edgeAbs > 0 ? '+' : ''}{edgeAbs.toFixed(1)}
          </div>
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: heat.color }}>{heat.label}</div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-3">

        {/* Market vs Model spread */}
        <div className="rounded-xl px-3 py-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Market Spread</span>
            <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>
              {formatSpread(row.sportsbook_spread, row.home_team)}
            </span>
          </div>
          <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Model Spread</span>
            <span className="text-sm font-bold" style={{ color: heat.color }}>
              {formatSpread(row.model_spread, row.home_team)}
            </span>
          </div>
          {row.openingSpread != null && row.sportsbook_spread != null && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Opening</span>
              <span className="text-xs" style={{ color: '#4A4A60' }}>
                {row.openingSpread > 0 ? '+' : ''}{row.openingSpread}
              </span>
            </div>
          )}
        </div>

        {/* AI Win Probability */}
        <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: '#6B6B80' }}>AI Win Probability</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg px-2 py-2 text-center" style={{ background: modelPrefersHome ? heat.bg : 'rgba(255,255,255,0.03)', border: `1px solid ${modelPrefersHome ? heat.border : 'rgba(255,255,255,0.06)'}` }}>
              <div className="text-xs mb-0.5 truncate" style={{ color: '#A0A0B0' }}>{row.home_team}</div>
              <div className="text-base font-black" style={{ color: modelPrefersHome ? heat.color : '#E6E6FA' }}>
                {Math.round(homeProb)}%
              </div>
            </div>
            <div className="rounded-lg px-2 py-2 text-center" style={{ background: !modelPrefersHome ? heat.bg : 'rgba(255,255,255,0.03)', border: `1px solid ${!modelPrefersHome ? heat.border : 'rgba(255,255,255,0.06)'}` }}>
              <div className="text-xs mb-0.5 truncate" style={{ color: '#A0A0B0' }}>{row.away_team}</div>
              <div className="text-base font-black" style={{ color: !modelPrefersHome ? heat.color : '#E6E6FA' }}>
                {Math.round(awayProb)}%
              </div>
            </div>
          </div>
        </div>

        {/* Confidence */}
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Model Confidence</span>
          <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>
            {row.confidence != null ? `${row.confidence}%` : '—'}
          </span>
        </div>

        {/* Public betting splits */}
        {hasSplits ? (
          <div className="rounded-xl px-3 py-3 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B6B80' }}>Public Betting</div>
            <PublicBetsBar
              homePct={row.publicBetsHome}
              awayPct={row.publicBetsAway}
              homeTeam={row.home_team}
              awayTeam={row.away_team}
              label="Bets %"
            />
            <PublicBetsBar
              homePct={row.publicMoneyHome}
              awayPct={row.publicMoneyAway}
              homeTeam={row.home_team}
              awayTeam={row.away_team}
              label="Money %"
            />
          </div>
        ) : (
          <div
            className="rounded-xl px-3 py-2.5 flex justify-between items-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
          >
            <span className="text-xs font-semibold" style={{ color: '#4A4A60' }}>Public Bets & Money %</span>
            <span className="text-xs" style={{ color: '#4A4A60' }}>Awaiting data</span>
          </div>
        )}

        {/* Alerts section */}
        {hasAlerts && (
          <div className="space-y-2">
            {/* Sharp money alert */}
            {row.sharpMoneyAlert && row.sharpMoneyDesc && (
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-black" style={{ color: '#EF4444' }}>Sharp Money Alert</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#A0A0B0' }}>{row.sharpMoneyDesc}</p>
                {row.sharpMoneySide && (
                  <p className="text-xs mt-1 font-semibold" style={{ color: '#EF4444' }}>
                    Smart money appears to be on {row.sharpMoneySide === 'home' ? row.home_team : row.away_team}
                  </p>
                )}
              </div>
            )}

            {/* Line movement alert */}
            {row.lineMovementAlert && row.lineMovementDesc && (
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3 h-3 flex-shrink-0" style={{ color: '#F59E0B' }} />
                  <span className="text-xs font-black" style={{ color: '#F59E0B' }}>Market Movement</span>
                </div>
                <p className="text-xs" style={{ color: '#A0A0B0' }}>{row.lineMovementDesc}</p>
              </div>
            )}

            {/* Total movement alert */}
            {row.totalMovementAlert && row.totalMovementDesc && (
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3 h-3 flex-shrink-0" style={{ color: '#818CF8' }} />
                  <span className="text-xs font-black" style={{ color: '#818CF8' }}>Total Movement</span>
                </div>
                <p className="text-xs" style={{ color: '#A0A0B0' }}>{row.totalMovementDesc}</p>
              </div>
            )}
          </div>
        )}

        {/* Injury impact */}
        {row.hasInjuryImpact && (
          <div
            className="rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)' }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: '#F97316' }} />
              <span className="text-xs font-black" style={{ color: '#F97316' }}>Injury Impact</span>
            </div>
            <div className="space-y-0.5">
              {[...row.homeInjuries, ...row.awayInjuries].slice(0, 3).map((inj, i) => (
                <p key={i} className="text-xs" style={{ color: '#A0A0B0' }}>
                  <span style={{ color: inj.status === 'Out' || inj.status === 'IR' ? '#FF6B6B' : '#F59E0B' }}>
                    {inj.status}:
                  </span>{' '}
                  {inj.playerName}
                </p>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: '#6B6B80' }}>Model adjusted due to key injury.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function LockedCard({ rank }: { rank: number }) {
  return (
    <div className="rounded-2xl overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}>
        <div style={{ height: 3, background: '#00FFA3', opacity: 0.5 }} />
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-sm font-black" style={{ color: '#E6E6FA' }}>Team A @ Team B</div>
          <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>NBA · 8:00 PM</div>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div className="text-xl font-black" style={{ color: '#00FFA3' }}>+{(rank * 1.2 + 1.5).toFixed(1)}</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg px-2 py-2 text-center" style={{ background: 'rgba(0,255,163,0.08)' }}>
              <div className="text-xs" style={{ color: '#A0A0B0' }}>Home</div>
              <div className="text-base font-black" style={{ color: '#00FFA3' }}>62%</div>
            </div>
            <div className="rounded-lg px-2 py-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-xs" style={{ color: '#A0A0B0' }}>Away</div>
              <div className="text-base font-black" style={{ color: '#E6E6FA' }}>38%</div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(15,15,26,0.55)' }}>
        <Lock className="w-5 h-5" style={{ color: '#A0A0B0' }} />
      </div>
    </div>
  )
}

export default function HeatmapPage() {
  const [rows, setRows] = useState<HeatmapRow[]>([])
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modelUpdatedAt, setModelUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/heatmap')
      .then((r) => r.json())
      .then((data) => {
        setRows(data.heatmap || [])
        setIsPremium(data.isPremium || false)
        setModelUpdatedAt(data.modelUpdatedAt || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const visibleRows = isPremium ? rows : []
  const lockedCount = isPremium ? 0 : rows.length

  const searchItems = useMemo<GameSearchItem[]>(() =>
    rows.map((r) => ({ id: r.id, homeTeam: r.home_team, awayTeam: r.away_team, league: r.league })),
  [rows])

  const strongCount  = rows.filter((r) => Math.abs(r.spread_edge ?? 0) >= 4).length
  const mediumCount  = rows.filter((r) => { const a = Math.abs(r.spread_edge ?? 0); return a >= 2 && a < 4 }).length
  const lightCount   = rows.filter((r) => { const a = Math.abs(r.spread_edge ?? 0); return a >= 1 && a < 2 }).length
  const sharpCount   = rows.filter((r) => r.sharpMoneyAlert).length
  const movingCount  = rows.filter((r) => r.lineMovementAlert || r.totalMovementAlert).length
  const injuredCount = rows.filter((r) => r.hasInjuryImpact).length

  return (
    <div className="p-6 space-y-6" style={{ background: '#0F0F1A', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-5 h-5" style={{ color: '#00FFA3' }} />
            <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Model vs Market Heat Map</h1>
          </div>
          <p className="text-sm mb-2" style={{ color: '#A0A0B0' }}>
            Live view of where the AI model disagrees with sportsbook lines. Includes public betting data, sharp money detection, and injury alerts.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" style={{ color: '#4A4A60' }} />
              <span className="text-xs" style={{ color: '#4A4A60' }}>Odds Updated: Hourly</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" style={{ color: '#4A4A60' }} />
              <span className="text-xs" style={{ color: '#4A4A60' }}>Model Updated: {formatTs(modelUpdatedAt)}</span>
            </div>
          </div>
        </div>
        {!isPremium && (
          <Link href="/dashboard/pricing">
            <Button size="sm" className="gradient-green text-black font-bold border-0 neon-glow">
              <Star className="w-3.5 h-3.5 mr-1.5" />
              Unlock All Data
            </Button>
          </Link>
        )}
      </div>

      {/* Jump to game */}
      <GameSearchBar games={searchItems} />

      {/* Summary stats */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B6B80' }}>Edge:</span>
        {[
          { label: `Light (+1–2)`, color: '#6EE7B7', count: lightCount },
          { label: `Medium (+2–4)`, color: '#34D399', count: mediumCount },
          { label: `Strong (+4+)`,  color: '#00C97A', count: strongCount },
        ].map(({ label, color, count }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-xs font-medium" style={{ color }}>
              {label}{count > 0 && <span className="ml-1 opacity-60">({count})</span>}
            </span>
          </div>
        ))}
        {/* Alert stats */}
        {sharpCount > 0 && (
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }} />
            <span className="text-xs font-medium" style={{ color: '#EF4444' }}>Sharp: {sharpCount}</span>
          </div>
        )}
        {movingCount > 0 && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" style={{ color: '#F59E0B' }} />
            <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>Moving: {movingCount}</span>
          </div>
        )}
        {injuredCount > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" style={{ color: '#F97316' }} />
            <span className="text-xs font-medium" style={{ color: '#F97316' }}>Injuries: {injuredCount}</span>
          </div>
        )}
        <div className="ml-auto text-xs" style={{ color: '#6B6B80' }}>
          Only games with |edge| ≥ 1 shown
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl h-96 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <BarChart2 className="w-10 h-10 mx-auto mb-4" style={{ color: '#4A4A60' }} />
          <p className="text-lg font-bold mb-2" style={{ color: '#E6E6FA' }}>No qualifying games right now</p>
          <p className="text-sm" style={{ color: '#A0A0B0' }}>
            Games appear here when the model detects a spread disagreement of at least 1 point vs the sportsbook.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleRows.map((row, i) => (
              <HeatCard key={row.id} row={row} rank={i + 1} />
            ))}
            {!isPremium && lockedCount > 0 && Array.from({ length: Math.min(lockedCount, 3) }).map((_, i) => (
              <LockedCard key={`locked-${i}`} rank={visibleRows.length + i + 1} />
            ))}
          </div>

          {!isPremium && lockedCount > 0 && (
            <div className="rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 flex-shrink-0" style={{ color: '#A0A0B0' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
                    Premium feature — {lockedCount} game{lockedCount !== 1 ? 's' : ''} available
                  </p>
                  <p className="text-xs" style={{ color: '#A0A0B0' }}>
                    Upgrade to see the full heat map with betting splits, sharp money alerts, and line movement
                  </p>
                </div>
              </div>
              <Link href="/dashboard/pricing">
                <Button size="sm" className="gradient-green text-black font-bold border-0 neon-glow flex-shrink-0">
                  <Star className="w-3.5 h-3.5 mr-1.5" />
                  Unlock Full Heat Map
                </Button>
              </Link>
            </div>
          )}

          {isPremium && (
            <p className="text-xs text-center" style={{ color: '#4A4A60' }}>
              Showing {visibleRows.length} game{visibleRows.length !== 1 ? 's' : ''} with |edge| ≥ 1
              {sharpCount > 0 ? ` · ${sharpCount} sharp money alert${sharpCount !== 1 ? 's' : ''}` : ''}
              {movingCount > 0 ? ` · ${movingCount} line movement${movingCount !== 1 ? 's' : ''}` : ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}
