'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Trophy, Clock, Star, CheckCircle, ChevronRight, Zap, RotateCcw, Shield,
  ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, BookmarkCheck, Info, FlaskConical,
  Plus, Trash2, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// ─── Selection Sunday: March 16, 2026 at 6:00 PM EST ──────────────────────
const BRACKET_RELEASE = new Date('2026-03-16T23:00:00Z')

// ─── Mock data — populates once bracket is released ───────────────────────

interface EdgeRow {
  team: string
  seed: number
  opponent: string
  opponentSeed: number
  region: string
  winPct: number
  publicPickPct: number
  survivorEV: number
  futureValue: number
  riskScore: number
  aiScore: number
  aiRank: number
  publicRank: number
}

const MOCK_EDGE_TABLE: EdgeRow[] = [
  { team: 'Duke', seed: 1, opponent: "Mt. St. Mary's", opponentSeed: 16, region: 'East', winPct: 98, publicPickPct: 31, survivorEV: 7.4, futureValue: 88, riskScore: 4, aiScore: 94, aiRank: 1, publicRank: 2 },
  { team: 'Houston', seed: 1, opponent: 'SIUE', opponentSeed: 16, region: 'Midwest', winPct: 97, publicPickPct: 38, survivorEV: 4.1, futureValue: 82, riskScore: 5, aiScore: 89, aiRank: 2, publicRank: 1 },
  { team: 'Auburn', seed: 1, opponent: 'Alabama St.', opponentSeed: 16, region: 'West', winPct: 96, publicPickPct: 22, survivorEV: 6.8, futureValue: 76, riskScore: 6, aiScore: 87, aiRank: 3, publicRank: 3 },
  { team: 'Kansas', seed: 1, opponent: 'Longwood', opponentSeed: 16, region: 'South', winPct: 97, publicPickPct: 19, survivorEV: 5.9, futureValue: 71, riskScore: 5, aiScore: 84, aiRank: 4, publicRank: 4 },
  { team: 'Tennessee', seed: 2, opponent: 'McNeese', opponentSeed: 15, region: 'East', winPct: 92, publicPickPct: 8, survivorEV: 9.2, futureValue: 65, riskScore: 12, aiScore: 81, aiRank: 5, publicRank: 7 },
  { team: 'Iowa St.', seed: 2, opponent: 'Lipscomb', opponentSeed: 15, region: 'Midwest', winPct: 91, publicPickPct: 6, survivorEV: 10.1, futureValue: 60, riskScore: 14, aiScore: 79, aiRank: 6, publicRank: 9 },
  { team: "St. John's", seed: 2, opponent: 'N. Iowa', opponentSeed: 15, region: 'West', winPct: 89, publicPickPct: 5, survivorEV: 11.3, futureValue: 55, riskScore: 18, aiScore: 76, aiRank: 7, publicRank: 10 },
  { team: 'Michigan St.', seed: 2, opponent: 'Yale', opponentSeed: 15, region: 'South', winPct: 88, publicPickPct: 7, survivorEV: 8.7, futureValue: 52, riskScore: 20, aiScore: 74, aiRank: 8, publicRank: 8 },
  { team: 'Wisconsin', seed: 3, opponent: 'Montana', opponentSeed: 14, region: 'East', winPct: 86, publicPickPct: 4, survivorEV: 8.1, futureValue: 47, riskScore: 22, aiScore: 71, aiRank: 9, publicRank: 11 },
  { team: 'Purdue', seed: 3, opponent: 'High Point', opponentSeed: 14, region: 'Midwest', winPct: 85, publicPickPct: 9, survivorEV: 5.4, futureValue: 72, riskScore: 19, aiScore: 70, aiRank: 10, publicRank: 6 },
]

interface ReservationRow {
  team: string
  seed: number
  bestRound: string
  currentRoundValue: string
  futureRoundValue: string
  saveRec: 'Use Now' | 'Neutral' | 'Save for Later'
}

const MOCK_RESERVATION_TABLE: ReservationRow[] = [
  { team: 'Duke', seed: 1, bestRound: 'Round of 64', currentRoundValue: 'High', futureRoundValue: 'Very High', saveRec: 'Save for Later' },
  { team: 'Houston', seed: 1, bestRound: 'Round of 64', currentRoundValue: 'High', futureRoundValue: 'High', saveRec: 'Neutral' },
  { team: 'Auburn', seed: 1, bestRound: 'Round of 64', currentRoundValue: 'High', futureRoundValue: 'Medium', saveRec: 'Use Now' },
  { team: 'Kansas', seed: 1, bestRound: 'Sweet 16', currentRoundValue: 'Medium', futureRoundValue: 'Very High', saveRec: 'Save for Later' },
  { team: 'Tennessee', seed: 2, bestRound: 'Round of 64', currentRoundValue: 'High', futureRoundValue: 'Low', saveRec: 'Use Now' },
  { team: 'Iowa St.', seed: 2, bestRound: 'Round of 64', currentRoundValue: 'High', futureRoundValue: 'Low', saveRec: 'Use Now' },
  { team: 'Purdue', seed: 3, bestRound: 'Sweet 16', currentRoundValue: 'Medium', futureRoundValue: 'Very High', saveRec: 'Save for Later' },
  { team: 'Wisconsin', seed: 3, bestRound: 'Round of 32', currentRoundValue: 'Medium', futureRoundValue: 'Medium', saveRec: 'Neutral' },
]

const MOCK_AI_PICKS = [
  {
    round: 1,
    roundLabel: 'Round of 64',
    team: 'Duke',
    seed: 1,
    opponent: "Mt. St. Mary's",
    opponentSeed: 16,
    region: 'East',
    winProbability: 98,
    survivorValueScore: 94,
    aiConfidence: 87,
    survivorEdgeGain: 7.4,
    reasoning:
      'Duke is heavily favored against a 16-seed while being significantly under-selected (31%) compared to Houston (38%). This creates meaningful ownership leverage. Duke also retains elite future-round value — their projected path avoids other 1-seeds until the Elite 8.',
    alternatives: [
      { team: 'Auburn', seed: 1, opponent: 'Alabama St.', winProb: 96, valueScore: 87, edgeGain: 6.8 },
      { team: 'Kansas', seed: 1, opponent: 'Longwood', winProb: 97, valueScore: 84, edgeGain: 5.9 },
      { team: 'Tennessee', seed: 2, opponent: 'McNeese', winProb: 92, valueScore: 81, edgeGain: 9.2 },
    ],
  },
]

// ─── Bracket mock data ──────────────────────────────────────────────────────
interface BracketSlot { seed: number; team: string }
interface BracketGame { id: string; top: BracketSlot; bottom: BracketSlot; winner?: string }
interface BracketRegion { name: string; rounds: BracketGame[][] }

const MOCK_BRACKET: BracketRegion[] = [
  {
    name: 'East', rounds: [[
      { id: 'e1', top: { seed: 1, team: 'Duke' }, bottom: { seed: 16, team: "Mt. St. Mary's" } },
      { id: 'e2', top: { seed: 8, team: 'Marquette' }, bottom: { seed: 9, team: 'Boise St.' } },
      { id: 'e3', top: { seed: 5, team: 'Gonzaga' }, bottom: { seed: 12, team: 'Liberty' } },
      { id: 'e4', top: { seed: 4, team: 'Maryland' }, bottom: { seed: 13, team: 'UC Irvine' } },
      { id: 'e5', top: { seed: 6, team: 'Illinois' }, bottom: { seed: 11, team: 'Drake' } },
      { id: 'e6', top: { seed: 3, team: 'Wisconsin' }, bottom: { seed: 14, team: 'Montana' } },
      { id: 'e7', top: { seed: 7, team: 'Creighton' }, bottom: { seed: 10, team: 'New Mexico' } },
      { id: 'e8', top: { seed: 2, team: 'Tennessee' }, bottom: { seed: 15, team: 'McNeese' } },
    ]]
  },
  {
    name: 'West', rounds: [[
      { id: 'w1', top: { seed: 1, team: 'Auburn' }, bottom: { seed: 16, team: 'Alabama St.' } },
      { id: 'w2', top: { seed: 8, team: 'Mississippi St.' }, bottom: { seed: 9, team: 'Dayton' } },
      { id: 'w3', top: { seed: 5, team: 'Oregon' }, bottom: { seed: 12, team: 'Vermont' } },
      { id: 'w4', top: { seed: 4, team: 'Louisville' }, bottom: { seed: 13, team: 'Colgate' } },
      { id: 'w5', top: { seed: 6, team: 'BYU' }, bottom: { seed: 11, team: 'San Diego St.' } },
      { id: 'w6', top: { seed: 3, team: "St. John's" }, bottom: { seed: 14, team: 'N. Iowa' } },
      { id: 'w7', top: { seed: 7, team: 'Texas A&M' }, bottom: { seed: 10, team: 'Virginia' } },
      { id: 'w8', top: { seed: 2, team: 'Iowa St.' }, bottom: { seed: 15, team: 'Lipscomb' } },
    ]]
  },
  {
    name: 'South', rounds: [[
      { id: 's1', top: { seed: 1, team: 'Kansas' }, bottom: { seed: 16, team: 'Longwood' } },
      { id: 's2', top: { seed: 8, team: 'Florida' }, bottom: { seed: 9, team: 'Utah St.' } },
      { id: 's3', top: { seed: 5, team: 'Clemson' }, bottom: { seed: 12, team: 'McNeese St.' } },
      { id: 's4', top: { seed: 4, team: 'Texas Tech' }, bottom: { seed: 13, team: 'High Point' } },
      { id: 's5', top: { seed: 6, team: 'Missouri' }, bottom: { seed: 11, team: "Saint Mary's" } },
      { id: 's6', top: { seed: 3, team: 'Michigan St.' }, bottom: { seed: 14, team: 'Yale' } },
      { id: 's7', top: { seed: 7, team: 'Vanderbilt' }, bottom: { seed: 10, team: 'Utah' } },
      { id: 's8', top: { seed: 2, team: 'Baylor' }, bottom: { seed: 15, team: "St. Peter's" } },
    ]]
  },
  {
    name: 'Midwest', rounds: [[
      { id: 'm1', top: { seed: 1, team: 'Houston' }, bottom: { seed: 16, team: 'SIUE' } },
      { id: 'm2', top: { seed: 8, team: 'Cincinnati' }, bottom: { seed: 9, team: 'Colorado St.' } },
      { id: 'm3', top: { seed: 5, team: 'Indiana' }, bottom: { seed: 12, team: 'Grand Canyon' } },
      { id: 'm4', top: { seed: 4, team: 'Ohio St.' }, bottom: { seed: 13, team: 'Furman' } },
      { id: 'm5', top: { seed: 6, team: 'West Virginia' }, bottom: { seed: 11, team: 'Drake' } },
      { id: 'm6', top: { seed: 3, team: 'Purdue' }, bottom: { seed: 14, team: 'High Point' } },
      { id: 'm7', top: { seed: 7, team: 'Georgia' }, bottom: { seed: 10, team: 'Akron' } },
      { id: 'm8', top: { seed: 2, team: 'Michigan St.' }, bottom: { seed: 15, team: 'Wofford' } },
    ]]
  },
]

// ─── Types ─────────────────────────────────────────────────────────────────
const NCAA_ROUNDS = [
  { key: 'round_of_64', label: 'Round of 64', number: 1 },
  { key: 'round_of_32', label: 'Round of 32', number: 2 },
  { key: 'sweet_16',    label: 'Sweet 16',    number: 3 },
  { key: 'elite_8',     label: 'Elite 8',     number: 4 },
  { key: 'final_four',  label: 'Final Four',  number: 5 },
  { key: 'championship', label: 'Championship', number: 6 },
] as const

type RoundKey = typeof NCAA_ROUNDS[number]['key']
type PicksPerRound = Record<RoundKey, number>

const DEFAULT_PICKS_PER_ROUND: PicksPerRound = {
  round_of_64:  2,
  round_of_32:  1,
  sweet_16:     1,
  elite_8:      1,
  final_four:   1,
  championship: 1,
}

interface PoolConfig {
  pool_name: string
  pool_size: string
  pick_format: string
  team_reuse: boolean
  late_round_rule: string
  strike_rule: string
  picks_per_round: PicksPerRound
}

interface Pool {
  id: string
  pool_name: string
  pool_size: string
  pick_format: string
  team_reuse: boolean
  late_round_rule: string
  strike_rule: string
  picks_per_round: PicksPerRound | null
  is_active: boolean
  created_at: string
  updated_at?: string
}

interface SurvivorPick {
  id: string
  round_number: number
  team_name: string
  team_seed: number | null
  opponent_name: string | null
  win_probability: number | null
  survivor_value_score: number | null
  ai_confidence: number | null
  result: string
}

type SortDir = 'asc' | 'desc'
type EdgeSortKey = keyof EdgeRow

type ToastState = { msg: string; type: 'success' | 'error' } | null

// ─── Countdown hook ────────────────────────────────────────────────────────
function useCountdown(target: Date) {
  const calc = () => {
    const diff = target.getTime() - Date.now()
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true }
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      done: false,
    }
  }
  const [time, setTime] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(id)
  })
  return time
}

// ─── Round number ↔ key helpers ────────────────────────────────────────────
const ROUND_NUM_TO_KEY: Record<number, RoundKey> = {
  1: 'round_of_64', 2: 'round_of_32', 3: 'sweet_16',
  4: 'elite_8', 5: 'final_four', 6: 'championship',
}
const ROUND_LABEL: Record<number, string> = {
  1: 'Round of 64', 2: 'Round of 32', 3: 'Sweet 16',
  4: 'Elite 8', 5: 'Final Four', 6: 'Championship',
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-black"
        style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.25)', color: '#00FFA3', boxShadow: '0 0 20px rgba(0,255,163,0.12)' }}
      >
        {String(value).padStart(2, '0')}
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider mt-2" style={{ color: '#6B6B80' }}>{label}</span>
    </div>
  )
}

function BracketPlaceholder() {
  const regions = ['East', 'West', 'South', 'Midwest']
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' }} className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {regions.map((region) => (
            <div key={region}>
              <div className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: '#A0A0B0' }}>{region}</div>
              {[1, 8, 5, 4, 6, 3, 7, 2].map((seed) => (
                <div key={seed} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs w-4 text-right font-bold" style={{ color: '#6B6B80' }}>{seed}</span>
                  <div className="flex-1 h-6 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6" style={{ background: 'rgba(15,15,26,0.7)' }}>
        <Trophy className="w-8 h-8 mb-3" style={{ color: '#00FFA3' }} />
        <p className="font-bold text-sm" style={{ color: '#E6E6FA' }}>Bracket coming soon</p>
        <p className="text-xs mt-1 max-w-xs" style={{ color: '#A0A0B0' }}>Survivor AI will activate once the NCAA tournament bracket is released on Selection Sunday.</p>
      </div>
    </div>
  )
}

// ─── InlineToast ───────────────────────────────────────────────────────────
function InlineToast({ toast }: { toast: ToastState }) {
  if (!toast) return null
  const isSuccess = toast.type === 'success'
  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-none"
      style={{
        transform: 'translateX(-50%)',
        background: isSuccess ? 'rgba(0,255,163,0.15)' : 'rgba(255,107,107,0.15)',
        border: `1px solid ${isSuccess ? 'rgba(0,255,163,0.4)' : 'rgba(255,107,107,0.4)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        minWidth: 240,
      }}
    >
      {isSuccess
        ? <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#00FFA3' }} />
        : <Info className="w-4 h-4 flex-shrink-0" style={{ color: '#FF6B6B' }} />}
      <span className="text-sm font-semibold" style={{ color: isSuccess ? '#00FFA3' : '#FF6B6B' }}>{toast.msg}</span>
    </div>
  )
}

// ─── PoolSelectorBar ───────────────────────────────────────────────────────
function PoolSelectorBar({
  pools, activePoolId, onSelect, onCreateNew,
}: {
  pools: Pool[]; activePoolId: string | null; onSelect: (id: string) => void; onCreateNew: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = pools.find((p) => p.id === activePoolId)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const ruleBadges = (pool: Pool) => {
    const parts: string[] = [
      pool.pool_size === 'small' ? 'Small Pool' : pool.pool_size === 'medium' ? 'Medium Pool' : 'Large Pool',
    ]
    if (pool.pick_format === 'multiple_per_round' && pool.picks_per_round) {
      const ppr = pool.picks_per_round
      const summary = NCAA_ROUNDS.slice(0, 2)
        .map(({ key, label }) => `${label.replace('Round of ', 'R')} ×${ppr[key] ?? 1}`)
        .join(' | ')
      parts.push(`Multi-pick: ${summary}`)
    } else {
      parts.push(pool.pick_format === 'one_per_round' ? '1 pick/round' : '1 pick/day')
    }
    if (!pool.team_reuse) parts.push('No reuse')
    if (pool.strike_rule === 'one_loss') parts.push('1 strike')
    return parts.join(' · ')
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-3">
        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6B6B80' }}>Active Pool</div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1 sm:flex-none sm:min-w-64 transition-all hover:border-white/20"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E6E6FA' }}
        >
          <span className="text-sm font-bold truncate flex-1 text-left">
            {active?.pool_name ?? (pools.length === 0 ? 'No pools yet' : 'Select pool')}
          </span>
          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#6B6B80' }} />
        </button>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
          style={{ background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.25)', color: '#00FFA3' }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Pool</span>
        </button>
      </div>

      {/* Rule badges for active pool */}
      {active && (
        <div className="mt-2 text-xs" style={{ color: '#6B6B80' }}>{ruleBadges(active)}</div>
      )}

      {/* Dropdown */}
      {open && pools.length > 0 && (
        <div
          className="absolute left-0 top-full mt-2 w-80 rounded-2xl z-50 overflow-hidden shadow-2xl"
          style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
        >
          {pools.map((pool) => (
            <button
              key={pool.id}
              onClick={() => { onSelect(pool.id); setOpen(false) }}
              className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold" style={{ color: pool.id === activePoolId ? '#00FFA3' : '#E6E6FA' }}>
                  {pool.pool_name}
                </span>
                {pool.id === activePoolId && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,163,0.12)', color: '#00FFA3' }}>Active</span>
                )}
              </div>
              <div className="text-[11px] mt-0.5 truncate" style={{ color: '#6B6B80' }}>{ruleBadges(pool)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── RoundSelector ─────────────────────────────────────────────────────────
function RoundSelector({
  selectedRound, onSelect, picks,
}: {
  selectedRound: number; onSelect: (n: number) => void; picks: SurvivorPick[]
}) {
  const pickedRounds = new Set(picks.map((p) => p.round_number))
  return (
    <div
      className="sticky top-0 z-20 -mx-6 px-6 py-3 flex items-center gap-2 overflow-x-auto"
      style={{ background: 'rgba(10,10,20,0.95)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}
    >
      <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0" style={{ color: '#6B6B80' }}>Round:</span>
      {NCAA_ROUNDS.map(({ key, label, number }) => {
        const isActive = selectedRound === number
        const hasPick = pickedRounds.has(number)
        return (
          <button
            key={key}
            onClick={() => onSelect(number)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
            style={{
              background: isActive ? 'rgba(0,255,163,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isActive ? 'rgba(0,255,163,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: isActive ? '#00FFA3' : '#A0A0B0',
            }}
          >
            <span>{label}</span>
            {hasPick && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: isActive ? '#00FFA3' : '#6B6B80' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── BracketTree ───────────────────────────────────────────────────────────
function BracketTree({ picks, selectedRound }: { picks: SurvivorPick[]; selectedRound: number }) {
  const pickedTeams = new Set(picks.map((p) => p.team_name))
  const pickedByRound = new Map<string, { result: string; round: number }>()
  for (const p of picks) {
    pickedByRound.set(p.team_name, { result: p.result, round: p.round_number })
  }

  const slotStyle = (team: string) => {
    const pickInfo = pickedByRound.get(team)
    if (!pickInfo) return { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)', color: '#A0A0B0', dot: null }
    if (pickInfo.result === 'won' || pickInfo.result === 'win') return { bg: 'rgba(0,255,163,0.1)', border: 'rgba(0,255,163,0.3)', color: '#00FFA3', dot: '#00FFA3' }
    if (pickInfo.result === 'eliminated' || pickInfo.result === 'loss') return { bg: 'rgba(255,107,107,0.1)', border: 'rgba(255,107,107,0.3)', color: '#FF6B6B', dot: '#FF6B6B' }
    return { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', color: '#F59E0B', dot: '#F59E0B' }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: '#F59E0B' }} />
          <span className="text-sm font-black" style={{ color: '#E6E6FA' }}>2026 NCAA Tournament Bracket</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          {[
            { dot: '#F59E0B', label: 'Pending pick' },
            { dot: '#00FFA3', label: 'Won' },
            { dot: '#FF6B6B', label: 'Eliminated' },
          ].map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
              <span style={{ color: '#6B6B80' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 min-w-[640px]">
          {MOCK_BRACKET.map((region) => (
            <div key={region.name}>
              <div className="text-xs font-black uppercase tracking-wider mb-3 text-center" style={{ color: '#6B6B80' }}>
                {region.name}
              </div>
              {region.rounds[0].map((game) => {
                const topStyle = slotStyle(game.top.team)
                const botStyle = slotStyle(game.bottom.team)
                const topPicked = pickedTeams.has(game.top.team)
                const botPicked = pickedTeams.has(game.bottom.team)
                return (
                  <div key={game.id} className="mb-2.5 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                    {/* Top team */}
                    <div className="flex items-center gap-2 px-3 py-2"
                      style={{ background: topStyle.bg, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-[10px] font-black w-4 text-right flex-shrink-0" style={{ color: '#6B6B80' }}>{game.top.seed}</span>
                      <span className="text-xs font-semibold flex-1 truncate" style={{ color: topStyle.color }}>{game.top.team}</span>
                      {topPicked && topStyle.dot && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: topStyle.dot }} />
                      )}
                    </div>
                    {/* Bottom team */}
                    <div className="flex items-center gap-2 px-3 py-2" style={{ background: botStyle.bg }}>
                      <span className="text-[10px] font-black w-4 text-right flex-shrink-0" style={{ color: '#6B6B80' }}>{game.bottom.seed}</span>
                      <span className="text-xs font-semibold flex-1 truncate" style={{ color: botStyle.color }}>{game.bottom.team}</span>
                      {botPicked && botStyle.dot && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: botStyle.dot }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] mt-3" style={{ color: '#4A4A60' }}>
          Showing Round of 64 matchups · Bracket updates round by round as the tournament progresses
        </p>
      </div>
    </div>
  )
}

// ─── StrategyPlanner ───────────────────────────────────────────────────────
function StrategyPlanner({
  picks, onDelete, syncing, onSync,
}: {
  picks: SurvivorPick[]; onDelete: (id: string) => void; syncing: boolean; onSync: () => void
}) {
  const grouped = NCAA_ROUNDS.map(({ number, label }) => ({
    round: number,
    label,
    picks: picks.filter((p) => p.round_number === number),
  })).filter((g) => g.picks.length > 0 || picks.length === 0)

  const resultStyle = (result: string) => {
    if (result === 'won' || result === 'win') return { bg: 'rgba(0,255,163,0.12)', color: '#00FFA3', label: 'Won' }
    if (result === 'eliminated' || result === 'loss') return { bg: 'rgba(255,107,107,0.12)', color: '#FF6B6B', label: 'Eliminated' }
    return { bg: 'rgba(255,255,255,0.08)', color: '#A0A0B0', label: 'Pending' }
  }

  if (picks.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-4 h-4" style={{ color: '#A78BFA' }} />
            <h3 className="font-black text-base" style={{ color: '#E6E6FA' }}>Strategy Planner</h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>
            {picks.length} pick{picks.length !== 1 ? 's' : ''} saved across {grouped.filter((g) => g.picks.length > 0).length} round{grouped.filter((g) => g.picks.length > 0).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-80"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#A0A0B0' }}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Results'}
        </button>
      </div>

      <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {grouped.filter((g) => g.picks.length > 0).map(({ round, label, picks: roundPicks }) => (
          <div key={round} className="px-5 py-4">
            <div className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#6B6B80' }}>
              <span className="w-5 h-5 rounded-full text-center text-[10px] font-black flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#A0A0B0' }}>
                {round}
              </span>
              {label}
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#6B6B80' }}>
                {roundPicks.length} pick{roundPicks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {roundPicks.map((p) => {
                const rs = resultStyle(p.result)
                return (
                  <div key={p.id}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: '#E6E6FA' }}>{p.team_name}</div>
                      <div className="text-xs truncate" style={{ color: '#6B6B80' }}>
                        {p.team_seed != null && `#${p.team_seed} seed`}
                        {p.opponent_name && ` · vs. ${p.opponent_name}`}
                        {p.win_probability != null && ` · ${p.win_probability}% win prob`}
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: rs.bg, color: rs.color }}>
                      {rs.label}
                    </span>
                    {p.survivor_value_score != null && (
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: '#00FFA3' }}>
                        {p.survivor_value_score}
                      </span>
                    )}
                    <button
                      onClick={() => onDelete(p.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all hover:bg-red-500/15"
                      style={{ color: '#4A4A60', border: '1px solid rgba(255,255,255,0.07)' }}
                      title="Remove pick"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Pool setup form ───────────────────────────────────────────────────────
function PoolSetupForm({
  onSave, initialConfig, poolId,
}: {
  onSave: (config: PoolConfig, savedPool?: Pool) => void
  initialConfig?: PoolConfig
  poolId?: string
}) {
  const [config, setConfig] = useState<PoolConfig>(initialConfig ?? {
    pool_name: 'My Survivor Pool',
    pool_size: 'small',
    pick_format: 'one_per_round',
    team_reuse: false,
    late_round_rule: 'none',
    strike_rule: 'one_strike',
    picks_per_round: { ...DEFAULT_PICKS_PER_ROUND },
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof PoolConfig, v: string | boolean) => setConfig((p) => ({ ...p, [k]: v }))
  const setPicksForRound = (round: RoundKey, count: number) =>
    setConfig((p) => ({ ...p, picks_per_round: { ...p.picks_per_round, [round]: Math.max(1, Math.min(8, count)) } }))

  const isEdit = !!poolId

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isEdit) {
        const res = await fetch('/api/survivor', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_pool', pool_id: poolId, ...config }),
        })
        const data = res.ok ? await res.json() : null
        onSave(config, data?.pool ?? undefined)
      } else {
        const res = await fetch('/api/survivor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        })
        const data = res.ok ? await res.json() : null
        onSave(config, data?.pool ?? undefined)
      }
    } finally { setSaving(false) }
  }

  const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6"><div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6B6B80' }}>{title}</div>{children}</div>
  )
  const Opt = ({ label, desc, selected, onClick }: { label: string; desc: string; selected: boolean; onClick: () => void }) => (
    <button onClick={onClick} className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all mb-2"
      style={{ background: selected ? 'rgba(0,255,163,0.08)' : 'rgba(255,255,255,0.03)', border: selected ? '1px solid rgba(0,255,163,0.3)' : '1px solid rgba(255,255,255,0.07)' }}>
      <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0 flex items-center justify-center"
        style={{ border: selected ? '2px solid #00FFA3' : '2px solid rgba(255,255,255,0.2)', background: selected ? '#00FFA3' : 'transparent' }}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>{desc}</div>
      </div>
    </button>
  )

  return (
    <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-5 h-5" style={{ color: '#00FFA3' }} />
        <h3 className="font-black text-lg" style={{ color: '#E6E6FA' }}>
          {isEdit ? 'Edit Pool Settings' : 'Create My Survivor Pool'}
        </h3>
      </div>
      <div className="mb-6">
        <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: '#6B6B80' }}>Pool Name</label>
        <input type="text" value={config.pool_name} onChange={(e) => set('pool_name', e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E6E6FA' }} />
      </div>
      <Sec title="Pool Size">
        <Opt label="Small Pool" desc="Under 50 players — prioritize winning probability" selected={config.pool_size === 'small'} onClick={() => set('pool_size', 'small')} />
        <Opt label="Medium Pool" desc="50–200 players — balance upsets and favorites" selected={config.pool_size === 'medium'} onClick={() => set('pool_size', 'medium')} />
        <Opt label="Large Pool" desc="200+ players — differentiation strategy needed" selected={config.pool_size === 'large'} onClick={() => set('pool_size', 'large')} />
      </Sec>
      <Sec title="Pick Format">
        <Opt label="One pick per round" desc="Standard format — one team per tournament round" selected={config.pick_format === 'one_per_round'} onClick={() => set('pick_format', 'one_per_round')} />
        <Opt label="One pick per day" desc="Daily selections during tournament play" selected={config.pick_format === 'one_per_day'} onClick={() => set('pick_format', 'one_per_day')} />
        <Opt label="Multiple picks per round" desc="Select more than one team per round — configure exact counts per round below" selected={config.pick_format === 'multiple_per_round'} onClick={() => set('pick_format', 'multiple_per_round')} />
      </Sec>

      {config.pick_format === 'multiple_per_round' && (
        <div className="mb-6 rounded-2xl p-5"
          style={{ background: 'rgba(0,255,163,0.04)', border: '1px solid rgba(0,255,163,0.2)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#00FFA3' }}>
            Picks Per Round Configuration
          </div>
          <p className="text-xs mb-4" style={{ color: '#6B6B80' }}>
            Set the number of picks required for each NCAA tournament round.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {NCAA_ROUNDS.map(({ key, label }) => (
              <div key={key} className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: '#A0A0B0' }}>{label}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPicksForRound(key, config.picks_per_round[key] - 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-base transition-colors hover:bg-white/10"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#A0A0B0' }}
                    disabled={config.picks_per_round[key] <= 1}
                  >
                    −
                  </button>
                  <span className="flex-1 text-center text-lg font-black" style={{ color: '#E6E6FA' }}>
                    {config.picks_per_round[key]}
                  </span>
                  <button
                    onClick={() => setPicksForRound(key, config.picks_per_round[key] + 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-base transition-colors hover:bg-white/10"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#A0A0B0' }}
                    disabled={config.picks_per_round[key] >= 8}
                  >
                    +
                  </button>
                </div>
                <div className="text-center mt-1 text-[10px]" style={{ color: '#4A4A60' }}>
                  {config.picks_per_round[key] === 1 ? '1 pick' : `${config.picks_per_round[key]} picks`}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {NCAA_ROUNDS.map(({ key, label }) => (
              <span key={key} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
                {label.replace('Round of ', 'R')} × {config.picks_per_round[key]}
              </span>
            ))}
          </div>
        </div>
      )}
      <Sec title="Team Usage Rule">
        <Opt label="Team can only be used once" desc="Classic survivor — once used, a team is gone" selected={!config.team_reuse} onClick={() => set('team_reuse', false)} />
        <Opt label="Teams can be reused" desc="Same team can be picked in multiple rounds" selected={config.team_reuse} onClick={() => set('team_reuse', true)} />
      </Sec>
      <Sec title="Late Round Rules">
        <Opt label="No special rules" desc="Same format throughout the entire tournament" selected={config.late_round_rule === 'none'} onClick={() => set('late_round_rule', 'none')} />
        <Opt label="Double picks required in later rounds" desc="Elite 8 and beyond require two picks per round" selected={config.late_round_rule === 'double_picks'} onClick={() => set('late_round_rule', 'double_picks')} />
      </Sec>
      <Sec title="Strike Rules">
        <Opt label="One loss eliminates you" desc="Classic survivor — no second chances" selected={config.strike_rule === 'one_strike'} onClick={() => set('strike_rule', 'one_strike')} />
        <Opt label="Pool allows one strike" desc="One loss allowed before elimination" selected={config.strike_rule === 'one_loss'} onClick={() => set('strike_rule', 'one_loss')} />
      </Sec>
      <Button onClick={handleSave} disabled={saving} className="w-full gradient-green text-black font-black py-5 rounded-xl border-0 hover:opacity-90 neon-glow">
        {saving ? 'Saving...' : isEdit ? 'Save Pool Strategy' : 'Save Pool Settings & Generate AI Picks'}
      </Button>
    </div>
  )
}

// ─── AI Best Pick card ──────────────────────────────────────────────────────
function AIPickCard({ pick, isPremium, usedTeams, onPickTeam, picksNeeded, picksMade }: {
  pick: typeof MOCK_AI_PICKS[0]; isPremium: boolean; usedTeams: string[]; onPickTeam: (t: string, round: number) => void
  picksNeeded?: number; picksMade?: number
}) {
  const [confirming, setConfirming] = useState(false)
  const alreadyPicked = usedTeams.includes(pick.team)
  const isMultiPick = picksNeeded !== undefined && picksNeeded > 1
  const madeCount = picksMade ?? 0
  const stillNeeded = isMultiPick ? Math.max(0, picksNeeded! - madeCount) : null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,255,163,0.18)', boxShadow: '0 0 24px rgba(0,255,163,0.06)' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(0,255,163,0.06)', borderBottom: '1px solid rgba(0,255,163,0.12)' }}>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: '#00FFA3' }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#00FFA3' }}>
            {pick.roundLabel} · AI Best Survivor Pick
          </span>
          {isMultiPick && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: stillNeeded === 0 ? 'rgba(0,255,163,0.2)' : 'rgba(245,158,11,0.2)', color: stillNeeded === 0 ? '#00FFA3' : '#F59E0B' }}>
              {madeCount}/{picksNeeded} picks
            </span>
          )}
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(0,255,163,0.12)', color: '#00FFA3' }}>{pick.region}</span>
      </div>
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-black" style={{ color: '#E6E6FA' }}>{pick.team}</span>
              <span className="text-sm font-bold" style={{ color: '#6B6B80' }}>#{pick.seed} seed</span>
            </div>
            <div className="text-sm mt-0.5" style={{ color: '#A0A0B0' }}>vs. #{pick.opponentSeed} {pick.opponent}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-black" style={{ color: '#00FFA3' }}>{pick.winProbability}%</div>
            <div className="text-xs" style={{ color: '#6B6B80' }}>Win Probability</div>
          </div>
        </div>

        {isMultiPick && stillNeeded !== null && stillNeeded > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3"
            style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <Info className="w-4 h-4 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <p className="text-xs" style={{ color: '#A0A0B0' }}>
              Your pool requires <span className="font-bold" style={{ color: '#F59E0B' }}>{picksNeeded} picks</span> this round.
              You still need <span className="font-bold" style={{ color: '#F59E0B' }}>{stillNeeded} more</span>. See the edge table below.
            </p>
          </div>
        )}
        {isMultiPick && stillNeeded === 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3"
            style={{ background: 'rgba(0,255,163,0.07)', border: '1px solid rgba(0,255,163,0.18)' }}>
            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#00FFA3' }} />
            <p className="text-xs font-semibold" style={{ color: '#00FFA3' }}>
              All {picksNeeded} picks for this round are saved.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
          style={{ background: 'rgba(0,255,163,0.07)', border: '1px solid rgba(0,255,163,0.18)' }}>
          <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: '#00FFA3' }} />
          <div>
            <span className="text-sm font-black" style={{ color: '#00FFA3' }}>Survivor Edge Gain: +{pick.survivorEdgeGain}%</span>
            <p className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>
              High win probability while under-selected vs. public — contrarian value.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'AI Score', value: pick.survivorValueScore, color: '#00FFA3', suffix: '' },
            { label: 'AI Confidence', value: pick.aiConfidence, color: '#06B6D4', suffix: '%' },
            { label: 'Win Prob', value: pick.winProbability, color: '#00FFA3', suffix: '%' },
          ].map(({ label, value, color, suffix }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-xl font-black" style={{ color }}>{value}{suffix}</div>
              <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>{label}</div>
            </div>
          ))}
        </div>

        {isPremium ? (
          <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(0,255,163,0.04)', border: '1px solid rgba(0,255,163,0.12)' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#00FFA3' }}>AI Strategy Analysis</div>
            <p className="text-xs leading-relaxed" style={{ color: '#C0C0D0' }}>{pick.reasoning}</p>
          </div>
        ) : (
          <div className="rounded-xl p-4 mb-4 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', minHeight: 72 }}>
            <p className="text-xs leading-relaxed" style={{ color: '#C0C0D0', filter: 'blur(3px)', userSelect: 'none' }}>{pick.reasoning}</p>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <Star className="w-4 h-4" style={{ color: '#00FFA3' }} />
              <span className="text-xs font-bold" style={{ color: '#E6E6FA' }}>Premium — Full AI Reasoning</span>
              <Link href="/dashboard/pricing"><span className="text-xs underline" style={{ color: '#00FFA3' }}>Upgrade</span></Link>
            </div>
          </div>
        )}

        {isPremium && (
          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6B6B80' }}>Alternative Picks</div>
            <div className="space-y-2">
              {pick.alternatives.map((alt) => (
                <div key={alt.team} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#6B6B80' }} />
                  <span className="text-sm font-bold flex-1" style={{ color: '#E6E6FA' }}>
                    {alt.team} <span className="font-normal text-xs" style={{ color: '#6B6B80' }}>#{alt.seed}</span>
                  </span>
                  <span className="text-xs font-bold" style={{ color: '#00FFA3' }}>{alt.winProb}% win</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,163,0.08)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.2)' }}>
                    +{alt.edgeGain}% EV
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {alreadyPicked ? (
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl"
            style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)' }}>
            <CheckCircle className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>Pick Saved</span>
          </div>
        ) : (
          <Button onClick={() => { setConfirming(true); onPickTeam(pick.team, pick.round); setTimeout(() => setConfirming(false), 1500) }}
            disabled={confirming} className="w-full gradient-green text-black font-black py-4 rounded-xl border-0 hover:opacity-90 neon-glow">
            {confirming ? <><CheckCircle className="w-4 h-4 mr-2" />Pick Saved!</> : 'I Picked This Team'}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Survivor Edge Table ──────────────────────────────────────────────────
function SurvivorEdgeTable({ usedTeams, onPickTeam, selectedRound }: {
  usedTeams: string[]; onPickTeam: (t: string, round: number) => void; selectedRound: number
}) {
  const [sortKey, setSortKey] = useState<EdgeSortKey>('aiScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [tooltip, setTooltip] = useState<string | null>(null)

  const handleSort = (key: EdgeSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...MOCK_EDGE_TABLE]
    .filter((r) => !usedTeams.includes(r.team))
    .sort((a, b) => {
      const aVal = a[sortKey]; const bVal = b[sortKey]
      const mul = sortDir === 'asc' ? 1 : -1
      return typeof aVal === 'number' && typeof bVal === 'number' ? (aVal - bVal) * mul : 0
    })

  const colDefs: { key: EdgeSortKey; label: string; tip: string }[] = [
    { key: 'team', label: 'Team', tip: 'Team name and seed' },
    { key: 'winPct', label: 'Win %', tip: 'Probability this team wins the current game.' },
    { key: 'publicPickPct', label: 'Public %', tip: 'Estimated % of survivor entries picking this team.' },
    { key: 'survivorEV', label: 'Survivor EV %', tip: 'How much selecting this team increases your probability of winning the pool vs. the average pick.' },
    { key: 'futureValue', label: 'Future Value', tip: 'Rating showing how valuable this team is to save for later rounds (0–100).' },
    { key: 'riskScore', label: 'Risk', tip: 'Upset risk score — lower is safer.' },
    { key: 'aiScore', label: 'AI Score', tip: 'Overall AI ranking balancing win probability, ownership leverage, and future round value.' },
  ]

  const SortIcon = ({ k }: { k: EdgeSortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" style={{ color: '#00FFA3' }} /> : <ArrowDown className="w-3 h-3" style={{ color: '#00FFA3' }} />
  }

  const evColor = (ev: number) => ev >= 8 ? '#00FFA3' : ev >= 5 ? '#F59E0B' : '#A0A0B0'
  const riskColor = (r: number) => r <= 8 ? '#00FFA3' : r <= 15 ? '#F59E0B' : '#FF6B6B'
  const aiColor = (s: number) => s >= 88 ? '#00FFA3' : s >= 75 ? '#F59E0B' : '#A0A0B0'

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <h3 className="font-black text-base" style={{ color: '#E6E6FA' }}>AI Survivor Edge Table</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
              {ROUND_LABEL[selectedRound]}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Click any column header to sort. Green = best value picks.</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B6B80' }}>
          <Info className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Hover column headers for metric definitions</span>
        </div>
      </div>

      {tooltip && (
        <div className="px-5 py-2.5" style={{ background: 'rgba(0,255,163,0.06)', borderBottom: '1px solid rgba(0,255,163,0.12)' }}>
          <p className="text-xs" style={{ color: '#A0A0B0' }}><span style={{ color: '#00FFA3' }}>Info:</span> {tooltip}</p>
        </div>
      )}

      <div className="px-5 py-3 flex items-center gap-4 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>AI Rank vs Public Rank:</span>
        {MOCK_EDGE_TABLE.slice(0, 3).map((r) => (
          <div key={r.team} className="flex items-center gap-2 text-xs">
            <span className="font-bold" style={{ color: '#E6E6FA' }}>{r.team}</span>
            <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>AI #{r.aiRank}</span>
            <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0' }}>Public #{r.publicRank}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {colDefs.map(({ key, label, tip }) => (
                <th key={key}
                  className="text-left px-4 py-3 font-bold cursor-pointer select-none hover:bg-white/5 transition-colors"
                  style={{ color: sortKey === key ? '#00FFA3' : '#6B6B80', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort(key)}
                  onMouseEnter={() => setTooltip(tip)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <div className="flex items-center gap-1.5">
                    {label} <SortIcon k={key} />
                  </div>
                </th>
              ))}
              <th className="text-left px-4 py-3 font-bold" style={{ color: '#6B6B80' }}>Pick</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const isTopEV = row.survivorEV >= 7
              const isUsed = usedTeams.includes(row.team)
              return (
                <tr key={row.team}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: isTopEV ? 'rgba(0,255,163,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isTopEV && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00FFA3', boxShadow: '0 0 5px #00FFA3' }} />}
                      <div>
                        <div className="font-bold" style={{ color: '#E6E6FA' }}>{row.team}</div>
                        <div style={{ color: '#6B6B80' }}>#{row.seed} vs #{row.opponentSeed} {row.opponent}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-black" style={{ color: row.winPct >= 90 ? '#00FFA3' : '#E6E6FA' }}>{row.winPct}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-bold" style={{ color: row.publicPickPct >= 30 ? '#FF6B6B' : row.publicPickPct >= 15 ? '#F59E0B' : '#A0A0B0' }}>
                        {row.publicPickPct}%
                      </span>
                      <span className="ml-1.5 text-xs" style={{ color: '#4A4A60' }}>#{row.publicRank}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-black text-sm" style={{ color: evColor(row.survivorEV) }}>+{row.survivorEV}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${row.futureValue}%`, background: row.futureValue >= 80 ? '#00FFA3' : row.futureValue >= 60 ? '#F59E0B' : '#A0A0B0' }} />
                      </div>
                      <span className="font-bold" style={{ color: '#A0A0B0' }}>{row.futureValue}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold" style={{ color: riskColor(row.riskScore) }}>{row.riskScore}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-sm" style={{ color: aiColor(row.aiScore) }}>{row.aiScore}</span>
                      <span className="text-xs" style={{ color: '#4A4A60' }}>#{row.aiRank}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isUsed ? (
                      <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(255,107,107,0.12)', color: '#FF6B6B' }}>Used</span>
                    ) : (
                      <button onClick={() => onPickTeam(row.team, selectedRound)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-90 whitespace-nowrap"
                        style={{ background: 'rgba(0,255,163,0.12)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.25)' }}>
                        Pick This
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 flex flex-wrap gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Edge Strength:</span>
        {[{ color: '#00FFA3', label: 'EV ≥8% — Strong' }, { color: '#F59E0B', label: 'EV 5–7% — Medium' }, { color: '#A0A0B0', label: 'EV <5% — Small' }].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs" style={{ color }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Future Round Reservation Tool ─────────────────────────────────────────
function ReservationTool({ usedTeams }: { usedTeams: string[] }) {
  const available = MOCK_RESERVATION_TABLE.filter((r) => !usedTeams.includes(r.team))

  const recStyle = (rec: ReservationRow['saveRec']) => {
    if (rec === 'Use Now') return { color: '#00FFA3', bg: 'rgba(0,255,163,0.10)', border: 'rgba(0,255,163,0.25)' }
    if (rec === 'Save for Later') return { color: '#FF6B6B', bg: 'rgba(255,107,107,0.10)', border: 'rgba(255,107,107,0.25)' }
    return { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' }
  }
  const valColor = (v: string) => v === 'Very High' ? '#00FFA3' : v === 'High' ? '#60A5FA' : v === 'Medium' ? '#F59E0B' : '#A0A0B0'

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-1">
          <BookmarkCheck className="w-4 h-4" style={{ color: '#A78BFA' }} />
          <h3 className="font-black text-base" style={{ color: '#E6E6FA' }}>Future Round Reservation Tool</h3>
        </div>
        <p className="text-xs" style={{ color: '#6B6B80' }}>Avoid burning elite teams too early. Plan which rounds to use each team for maximum survival odds.</p>
      </div>

      <div className="px-5 py-3 flex flex-wrap gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Save Recommendation:</span>
        {[
          { color: '#00FFA3', label: 'Use Now' },
          { color: '#F59E0B', label: 'Neutral' },
          { color: '#FF6B6B', label: 'Save for Later' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs" style={{ color }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Team', 'Best Round To Use', 'Current Round Value', 'Future Round Value', 'Save Recommendation'].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-bold" style={{ color: '#6B6B80', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {available.map((row, i) => {
              const rs = recStyle(row.saveRec)
              return (
                <tr key={row.team} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td className="px-4 py-3">
                    <div className="font-bold" style={{ color: '#E6E6FA' }}>{row.team}</div>
                    <div style={{ color: '#6B6B80' }}>#{row.seed} seed</div>
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#A0A0B0' }}>{row.bestRound}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold" style={{ color: valColor(row.currentRoundValue) }}>{row.currentRoundValue}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold" style={{ color: valColor(row.futureRoundValue) }}>{row.futureRoundValue}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-black px-2.5 py-1 rounded-full"
                      style={{ background: rs.bg, color: rs.color, border: `1px solid ${rs.border}` }}>
                      {row.saveRec}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Used teams badge ──────────────────────────────────────────────────────
function UsedTeamsBadge({ teams }: { teams: string[] }) {
  if (teams.length === 0) return null
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6B6B80' }}>Teams Used — Removed from Recommendations</div>
      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <span key={t} className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: 'rgba(255,107,107,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.2)' }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Pre-bracket overlay ───────────────────────────────────────────────────
function PreBracketOverlay({ countdown, pools, activePoolId, showSetup, setShowSetup, onSave }: {
  countdown: { days: number; hours: number; minutes: number; seconds: number }
  pools: Pool[]
  activePoolId: string | null
  showSetup: boolean
  setShowSetup: (v: boolean) => void
  onSave: (c: PoolConfig, savedPool?: Pool) => void
}) {
  const activePool = pools.find((p) => p.id === activePoolId) ?? null
  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-center"
        style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(251,191,36,0.06))', border: '1px solid rgba(245,158,11,0.2)' }}>
        <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: '#F59E0B' }} />
        <h2 className="text-lg font-black mb-1" style={{ color: '#E6E6FA' }}>Bracket Release Countdown</h2>
        <p className="text-sm mb-6" style={{ color: '#A0A0B0' }}>
          The official NCAA tournament bracket will be released on Selection Sunday, March 16 at 6:00 PM EST.
        </p>
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-2">
          <CountdownUnit value={countdown.days} label="Days" />
          <span className="text-2xl font-black mb-4" style={{ color: '#F59E0B' }}>:</span>
          <CountdownUnit value={countdown.hours} label="Hours" />
          <span className="text-2xl font-black mb-4" style={{ color: '#F59E0B' }}>:</span>
          <CountdownUnit value={countdown.minutes} label="Mins" />
          <span className="text-2xl font-black mb-4" style={{ color: '#F59E0B' }}>:</span>
          <CountdownUnit value={countdown.seconds} label="Secs" />
        </div>
        <p className="text-xs mt-3" style={{ color: '#6B6B80' }}>Survivor AI, Edge Table and Reservation Tool activate automatically once the bracket is released.</p>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6B6B80' }}>2026 NCAA Tournament Bracket</div>
        <BracketPlaceholder />
      </div>

      <div className="relative rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <Zap className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <span className="font-black text-sm" style={{ color: '#E6E6FA' }}>AI Survivor Edge Table</span>
          </div>
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="w-24 h-4 rounded" style={{ background: 'rgba(255,255,255,0.12)' }} />
                <div className="w-12 h-4 rounded" style={{ background: 'rgba(0,255,163,0.2)' }} />
                <div className="w-12 h-4 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="w-16 h-4 rounded" style={{ background: 'rgba(0,255,163,0.15)' }} />
                <div className="w-20 h-4 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6"
          style={{ background: 'rgba(15,15,26,0.65)' }}>
          <Zap className="w-7 h-7 mb-2" style={{ color: '#00FFA3' }} />
          <p className="font-bold text-sm" style={{ color: '#E6E6FA' }}>NCAA Bracket Releases March 16 at 6PM EST</p>
          <p className="text-xs mt-1 max-w-xs" style={{ color: '#A0A0B0' }}>Edge Table and AI recommendations will populate automatically once bracket data is available.</p>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'rgba(0,255,163,0.04)', border: '1px solid rgba(0,255,163,0.15)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4" style={{ color: '#00FFA3' }} />
          <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>Get Ready Early</span>
        </div>
        <p className="text-xs mb-4" style={{ color: '#A0A0B0' }}>
          Set up your survivor pool rules now so the AI can generate your personalized strategy the moment the bracket drops.
        </p>
        {activePool ? (
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#00FFA3' }} />
            <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
              Pool configured: <span style={{ color: '#00FFA3' }}>{activePool.pool_name}</span>
            </span>
            <button onClick={() => setShowSetup(true)} className="ml-auto text-xs flex items-center gap-1 hover:opacity-80" style={{ color: '#A0A0B0' }}>
              <RotateCcw className="w-3 h-3" /> Edit
            </button>
          </div>
        ) : (
          <Button onClick={() => setShowSetup(true)} className="gradient-green text-black font-bold text-sm px-6 py-4 rounded-xl border-0 hover:opacity-90 neon-glow">
            Configure My Pool Rules
          </Button>
        )}
      </div>

      {showSetup && <PoolSetupForm onSave={onSave} />}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function SurvivorPage() {
  const countdown = useCountdown(BRACKET_RELEASE)
  const bracketReleased = countdown.done

  const [isPremium, setIsPremium] = useState(false)
  const [testModeActive, setTestModeActive] = useState(false)
  const [pools, setPools] = useState<Pool[]>([])
  const [activePoolId, setActivePoolId] = useState<string | null>(null)
  const [picks, setPicks] = useState<SurvivorPick[]>([])
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [selectedRound, setSelectedRound] = useState(1)
  const [toast, setToast] = useState<ToastState>(null)
  const [syncing, setSyncing] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const effectiveBracketReleased = bracketReleased || testModeActive

  const activePool = pools.find((p) => p.id === activePoolId) ?? null
  const usedTeams = picks.map((p) => p.team_name)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async (poolId?: string) => {
    const url = poolId ? `/api/survivor?pool_id=${poolId}` : '/api/survivor'
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setIsPremium(data.isPremium || false)
      setTestModeActive(data.testModeActive || false)
      const allPools: Pool[] = data.pools || []
      setPools(allPools)
      if (!poolId && allPools.length > 0 && !activePoolId) {
        setActivePoolId(allPools[0].id)
      }
      setPicks(data.picks || [])
    }
    setLoading(false)
  }, [activePoolId])

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectPool = async (id: string) => {
    setActivePoolId(id)
    const res = await fetch(`/api/survivor?pool_id=${id}`)
    if (res.ok) {
      const data = await res.json()
      setPicks(data.picks || [])
    }
  }

  const handlePickTeam = async (teamName: string, roundNumber: number) => {
    if (!activePool) return
    const row = MOCK_EDGE_TABLE.find((r) => r.team === teamName)
    const aiPick = MOCK_AI_PICKS.find((p) => p.round === roundNumber) ?? MOCK_AI_PICKS[0]
    await fetch('/api/survivor', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pool_id: activePool.id,
        round_number: roundNumber,
        team_name: teamName,
        team_seed: row?.seed ?? aiPick.seed,
        opponent_name: row?.opponent ?? aiPick.opponent,
        opponent_seed: row?.opponentSeed ?? aiPick.opponentSeed,
        win_probability: row?.winPct ?? aiPick.winProbability,
        survivor_value_score: row?.aiScore ?? aiPick.survivorValueScore,
        ai_confidence: aiPick.aiConfidence,
      }),
    })
    // Refresh picks from server (so we get the real id)
    const res = await fetch(`/api/survivor?pool_id=${activePool.id}`)
    if (res.ok) {
      const data = await res.json()
      setPicks(data.picks || [])
    }
    showToast(`Pick Saved — ${teamName} added to ${ROUND_LABEL[roundNumber]}`)
  }

  const handleDeletePick = async (pickId: string) => {
    await fetch('/api/survivor', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_pick', pick_id: pickId }),
    })
    setPicks((prev) => prev.filter((p) => p.id !== pickId))
    showToast('Pick removed')
  }

  const handleSyncResults = async () => {
    if (!activePool) return
    setSyncing(true)
    const res = await fetch('/api/survivor', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_results', pool_id: activePool.id }),
    })
    if (res.ok) {
      const data = await res.json()
      // Reload picks with updated results
      const picksRes = await fetch(`/api/survivor?pool_id=${activePool.id}`)
      if (picksRes.ok) {
        const picksData = await picksRes.json()
        setPicks(picksData.picks || [])
      }
      showToast(`Results synced — ${data.synced} pick${data.synced !== 1 ? 's' : ''} updated`)
    }
    setSyncing(false)
  }

  const handlePoolSave = (config: PoolConfig, savedPool?: Pool) => {
    if (savedPool) {
      setPools((prev) => {
        const exists = prev.find((p) => p.id === savedPool.id)
        if (exists) return prev.map((p) => p.id === savedPool.id ? savedPool : p)
        return [savedPool, ...prev]
      })
      setActivePoolId(savedPool.id)
      setPicks([])
    } else {
      setPools((prev) => prev.map((p) => p.id === activePoolId ? { ...p, ...config } : p))
    }
    setShowSetup(false)
    showToast(activePoolId && savedPool?.id === activePoolId ? 'Pool settings saved' : 'New pool created')
  }

  const handleCreateNew = () => {
    setShowSetup(true)
    setActivePoolId(null)
    setPicks([])
  }

  if (loading) return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Trophy className="w-5 h-5" style={{ color: '#F59E0B' }} />
        <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>QuantEdge Survivor Pool Assistant</h1>
      </div>
      <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="rounded-2xl h-40 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}</div>
    </div>
  )

  if (!isPremium) return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Trophy className="w-5 h-5" style={{ color: '#F59E0B' }} />
        <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>QuantEdge Survivor Pool Assistant</h1>
      </div>
      <div className="rounded-2xl p-10 text-center"
        style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(251,191,36,0.04))', border: '1px solid rgba(245,158,11,0.25)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <Trophy className="w-8 h-8" style={{ color: '#F59E0B' }} />
        </div>
        <h2 className="text-xl font-black mb-2" style={{ color: '#E6E6FA' }}>Survivor Pool AI</h2>
        <p className="text-sm mb-1 font-semibold" style={{ color: '#F59E0B' }}>Madness Special or Premium Plan Required</p>
        <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#A0A0B0' }}>
          The Survivor Pool AI — including the Edge Table, AI pick recommendations, and Future Round Reservation Tool — is available on the Madness Special plan ($19.99/mo) or Premium plan ($39.99/mo).
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard/pricing">
            <button className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
              View Plans
            </button>
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>QuantEdge Survivor Pool Assistant</h1>
        </div>
        <p className="text-sm" style={{ color: '#A0A0B0' }}>AI-powered survivor pool strategy for March Madness.</p>
      </div>

      {/* Test mode banner */}
      {testModeActive && (
        <div className="mb-6 flex items-start gap-3 px-5 py-4 rounded-2xl"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)' }}>
          <FlaskConical className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
          <div>
            <div className="text-sm font-black" style={{ color: '#F59E0B' }}>Test Bracket Mode Active</div>
            <p className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>
              The Survivor AI is running on a simulated 2026 projected bracket. All pick generation, round strategy,
              pool size logic, and multi-pick handling can be tested and validated.
              This mode will be overridden automatically once the official NCAA bracket releases on March 16.
            </p>
          </div>
        </div>
      )}

      {/* Pre-bracket */}
      {!effectiveBracketReleased && (
        <PreBracketOverlay
          countdown={countdown}
          pools={pools}
          activePoolId={activePoolId}
          showSetup={showSetup}
          setShowSetup={setShowSetup}
          onSave={handlePoolSave}
        />
      )}

      {/* Post-bracket */}
      {effectiveBracketReleased && (
        <div className="space-y-8">
          {/* Pool setup or create prompt */}
          {!activePool && !showSetup && (
            <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(0,255,163,0.06)', border: '1px solid rgba(0,255,163,0.2)' }}>
              <Shield className="w-8 h-8 mx-auto mb-3" style={{ color: '#00FFA3' }} />
              <h2 className="text-lg font-black mb-2" style={{ color: '#E6E6FA' }}>Set Up Your Survivor Pool</h2>
              <p className="text-sm mb-4" style={{ color: '#A0A0B0' }}>Configure your pool rules so the AI can build a personalized survival strategy.</p>
              <Button onClick={() => setShowSetup(true)} className="gradient-green text-black font-bold px-8 py-4 rounded-xl border-0 hover:opacity-90 neon-glow">
                Create My Survivor Pool
              </Button>
            </div>
          )}

          {showSetup && (
            <div className="space-y-4">
              <button
                onClick={() => { setShowSetup(false); if (!activePoolId && pools.length > 0) setActivePoolId(pools[0].id) }}
                className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-80"
                style={{ color: '#6B6B80' }}
              >
                ← Back to pool
              </button>
              <PoolSetupForm
                onSave={handlePoolSave}
                initialConfig={activePool ? {
                  pool_name: activePool.pool_name,
                  pool_size: activePool.pool_size,
                  pick_format: activePool.pick_format,
                  team_reuse: activePool.team_reuse,
                  late_round_rule: activePool.late_round_rule,
                  strike_rule: activePool.strike_rule,
                  picks_per_round: activePool.picks_per_round ?? { ...DEFAULT_PICKS_PER_ROUND },
                } : undefined}
                poolId={activePool?.id}
              />
            </div>
          )}

          {activePool && !showSetup && (
            <>
              {/* 1. Pool Selector Bar */}
              <PoolSelectorBar
                pools={pools}
                activePoolId={activePoolId}
                onSelect={handleSelectPool}
                onCreateNew={handleCreateNew}
              />

              {/* 2. Bracket Tree */}
              <BracketTree picks={picks} selectedRound={selectedRound} />

              {/* 3. Used Teams Badge */}
              {usedTeams.length > 0 && <UsedTeamsBadge teams={usedTeams} />}

              {/* 4. Round Selector (sticky) */}
              <RoundSelector selectedRound={selectedRound} onSelect={setSelectedRound} picks={picks} />

              {/* 5. AI Pick Card */}
              {MOCK_AI_PICKS.filter((p) => p.round === selectedRound).map((pick) => {
                const roundKey = ROUND_NUM_TO_KEY[pick.round]
                const poolPicksPerRound = activePool.pick_format === 'multiple_per_round'
                  ? (activePool.picks_per_round ?? null)
                  : null
                const picksNeeded = poolPicksPerRound && roundKey ? poolPicksPerRound[roundKey] : undefined
                const picksMade = picks.filter((p) => p.round_number === pick.round).length
                return (
                  <AIPickCard
                    key={pick.round}
                    pick={pick}
                    isPremium={isPremium}
                    usedTeams={usedTeams}
                    onPickTeam={handlePickTeam}
                    picksNeeded={picksNeeded}
                    picksMade={picksMade}
                  />
                )
              })}

              {/* Show a message for rounds beyond round 1 where no AI pick exists yet */}
              {selectedRound > 1 && MOCK_AI_PICKS.filter((p) => p.round === selectedRound).length === 0 && (
                <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Trophy className="w-6 h-6 mx-auto mb-2" style={{ color: '#6B6B80' }} />
                  <p className="text-sm font-semibold mb-1" style={{ color: '#A0A0B0' }}>AI picks for {ROUND_LABEL[selectedRound]} coming soon</p>
                  <p className="text-xs" style={{ color: '#6B6B80' }}>AI recommendations generate as the bracket progresses. You can still manually select a pick from the edge table below.</p>
                </div>
              )}

              {/* 6. Edge Table */}
              <SurvivorEdgeTable usedTeams={usedTeams} onPickTeam={handlePickTeam} selectedRound={selectedRound} />

              {/* 7. Reservation Tool */}
              <ReservationTool usedTeams={usedTeams} />

              {/* 8. Strategy Planner */}
              <StrategyPlanner picks={picks} onDelete={handleDeletePick} syncing={syncing} onSync={handleSyncResults} />

              {/* Edit pool button */}
              <div className="flex justify-center">
                <button
                  onClick={() => setShowSetup(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:bg-white/5"
                  style={{ color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.09)' }}
                >
                  <RotateCcw className="w-3 h-3" /> Edit Pool Rules
                </button>
              </div>

              {/* 9. Premium upsell */}
              {!isPremium && (
                <div className="rounded-2xl p-6 text-center"
                  style={{ background: 'linear-gradient(135deg, rgba(0,255,163,0.06), rgba(59,130,246,0.06))', border: '1px solid rgba(0,255,163,0.18)' }}>
                  <Star className="w-7 h-7 mx-auto mb-3" style={{ color: '#00FFA3' }} />
                  <h3 className="font-black text-base mb-1" style={{ color: '#E6E6FA' }}>Unlock Full Survivor Strategy</h3>
                  <p className="text-xs mb-4 max-w-xs mx-auto" style={{ color: '#A0A0B0' }}>
                    Premium includes full AI reasoning, alternative picks, Survivor EV analysis, future round planning, and upset recalculations.
                  </p>
                  <Link href="/dashboard/pricing">
                    <Button className="gradient-green text-black font-bold px-6 py-4 rounded-xl border-0 hover:opacity-90 neon-glow text-sm">
                      Upgrade to Premium
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 10. Inline Toast (fixed overlay) */}
      <InlineToast toast={toast} />
    </div>
  )
}
