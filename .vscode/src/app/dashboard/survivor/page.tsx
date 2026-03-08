'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Trophy, Clock, Star, CheckCircle, ChevronRight, Zap, RotateCcw, Shield,
  ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, BookmarkCheck, Info,
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
  { team: 'St. John\'s', seed: 2, opponent: 'N. Iowa', opponentSeed: 15, region: 'West', winPct: 89, publicPickPct: 5, survivorEV: 11.3, futureValue: 55, riskScore: 18, aiScore: 76, aiRank: 7, publicRank: 10 },
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

// ─── Types ─────────────────────────────────────────────────────────────────
interface PoolConfig {
  pool_name: string
  pool_size: string
  pick_format: string
  team_reuse: boolean
  late_round_rule: string
  strike_rule: string
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

// ─── Pool setup form ───────────────────────────────────────────────────────
function PoolSetupForm({ onSave }: { onSave: (config: PoolConfig) => void }) {
  const [config, setConfig] = useState<PoolConfig>({ pool_name: 'My Survivor Pool', pool_size: 'small', pick_format: 'one_per_round', team_reuse: false, late_round_rule: 'none', strike_rule: 'one_strike' })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof PoolConfig, v: string | boolean) => setConfig((p) => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/survivor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      onSave(config)
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
        <h3 className="font-black text-lg" style={{ color: '#E6E6FA' }}>Create My Survivor Pool</h3>
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
        <Opt label="Multiple picks per round" desc="Select more than one team per round" selected={config.pick_format === 'multiple_per_round'} onClick={() => set('pick_format', 'multiple_per_round')} />
      </Sec>
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
        {saving ? 'Saving...' : 'Save Pool Settings & Generate AI Picks'}
      </Button>
    </div>
  )
}

// ─── AI Best Pick card ──────────────────────────────────────────────────────
function AIPickCard({ pick, isPremium, usedTeams, onPickTeam }: {
  pick: typeof MOCK_AI_PICKS[0]; isPremium: boolean; usedTeams: string[]; onPickTeam: (t: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const alreadyPicked = usedTeams.includes(pick.team)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,255,163,0.18)', boxShadow: '0 0 24px rgba(0,255,163,0.06)' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(0,255,163,0.06)', borderBottom: '1px solid rgba(0,255,163,0.12)' }}>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: '#00FFA3' }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#00FFA3' }}>
            {pick.roundLabel} · AI Best Survivor Pick
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(0,255,163,0.12)', color: '#00FFA3' }}>{pick.region}</span>
      </div>
      <div className="px-5 py-5">
        {/* Header */}
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

        {/* Edge gain highlight */}
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

        {/* Stats */}
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

        {/* Reasoning */}
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

        {/* Alternatives — premium */}
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

        {/* Pick button */}
        {alreadyPicked ? (
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl"
            style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)' }}>
            <CheckCircle className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>Pick Saved</span>
          </div>
        ) : (
          <Button onClick={() => { setConfirming(true); onPickTeam(pick.team); setTimeout(() => setConfirming(false), 1500) }}
            disabled={confirming} className="w-full gradient-green text-black font-black py-4 rounded-xl border-0 hover:opacity-90 neon-glow">
            {confirming ? <><CheckCircle className="w-4 h-4 mr-2" />Pick Saved!</> : 'I Picked This Team'}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Survivor Edge Table ──────────────────────────────────────────────────
function SurvivorEdgeTable({ usedTeams, onPickTeam }: { usedTeams: string[]; onPickTeam: (t: string) => void }) {
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
      {/* Section header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <h3 className="font-black text-base" style={{ color: '#E6E6FA' }}>AI Survivor Edge Table</h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Click any column header to sort. Green = best value picks.</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B6B80' }}>
          <Info className="w-3.5 h-3.5" />
          <span>Hover column headers for metric definitions</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="px-5 py-2.5" style={{ background: 'rgba(0,255,163,0.06)', borderBottom: '1px solid rgba(0,255,163,0.12)' }}>
          <p className="text-xs" style={{ color: '#A0A0B0' }}><span style={{ color: '#00FFA3' }}>Info:</span> {tooltip}</p>
        </div>
      )}

      {/* AI vs Public comparison legend */}
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

      {/* Table */}
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
                  {/* Team */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isTopEV && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00FFA3', boxShadow: '0 0 5px #00FFA3' }} />}
                      <div>
                        <div className="font-bold" style={{ color: '#E6E6FA' }}>{row.team}</div>
                        <div style={{ color: '#6B6B80' }}>#{row.seed} vs #{row.opponentSeed} {row.opponent}</div>
                      </div>
                    </div>
                  </td>
                  {/* Win % */}
                  <td className="px-4 py-3">
                    <span className="font-black" style={{ color: row.winPct >= 90 ? '#00FFA3' : '#E6E6FA' }}>{row.winPct}%</span>
                  </td>
                  {/* Public % */}
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-bold" style={{ color: row.publicPickPct >= 30 ? '#FF6B6B' : row.publicPickPct >= 15 ? '#F59E0B' : '#A0A0B0' }}>
                        {row.publicPickPct}%
                      </span>
                      <span className="ml-1.5 text-xs" style={{ color: '#4A4A60' }}>#{row.publicRank}</span>
                    </div>
                  </td>
                  {/* Survivor EV */}
                  <td className="px-4 py-3">
                    <span className="font-black text-sm" style={{ color: evColor(row.survivorEV) }}>+{row.survivorEV}%</span>
                  </td>
                  {/* Future Value */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${row.futureValue}%`, background: row.futureValue >= 80 ? '#00FFA3' : row.futureValue >= 60 ? '#F59E0B' : '#A0A0B0' }} />
                      </div>
                      <span className="font-bold" style={{ color: '#A0A0B0' }}>{row.futureValue}</span>
                    </div>
                  </td>
                  {/* Risk */}
                  <td className="px-4 py-3">
                    <span className="font-bold" style={{ color: riskColor(row.riskScore) }}>{row.riskScore}</span>
                  </td>
                  {/* AI Score */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-sm" style={{ color: aiColor(row.aiScore) }}>{row.aiScore}</span>
                      <span className="text-xs" style={{ color: '#4A4A60' }}>#{row.aiRank}</span>
                    </div>
                  </td>
                  {/* Pick button */}
                  <td className="px-4 py-3">
                    {isUsed ? (
                      <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(255,107,107,0.12)', color: '#FF6B6B' }}>Used</span>
                    ) : (
                      <button onClick={() => onPickTeam(row.team)}
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

      {/* Legend */}
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

      {/* Color key */}
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

      {/* Table */}
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
function PreBracketOverlay({ countdown, pool, showSetup, setShowSetup, onSave }: {
  countdown: { days: number; hours: number; minutes: number; seconds: number }
  pool: Record<string, unknown> | null
  showSetup: boolean
  setShowSetup: (v: boolean) => void
  onSave: (c: PoolConfig) => void
}) {
  return (
    <div className="space-y-6">
      {/* Countdown card */}
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

      {/* Blurred bracket placeholder */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6B6B80' }}>2026 NCAA Tournament Bracket</div>
        <BracketPlaceholder />
      </div>

      {/* Blurred Edge Table preview */}
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

      {/* Early setup */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(0,255,163,0.04)', border: '1px solid rgba(0,255,163,0.15)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4" style={{ color: '#00FFA3' }} />
          <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>Get Ready Early</span>
        </div>
        <p className="text-xs mb-4" style={{ color: '#A0A0B0' }}>
          Set up your survivor pool rules now so the AI can generate your personalized strategy the moment the bracket drops.
        </p>
        {pool ? (
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#00FFA3' }} />
            <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
              Pool configured: <span style={{ color: '#00FFA3' }}>{pool.pool_name as string}</span>
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
  const [pool, setPool] = useState<Record<string, unknown> | null>(null)
  const [picks, setPicks] = useState<SurvivorPick[]>([])
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [usedTeams, setUsedTeams] = useState<string[]>([])

  const loadData = useCallback(async () => {
    const res = await fetch('/api/survivor')
    if (res.ok) {
      const data = await res.json()
      setIsPremium(data.isPremium || false)
      setPool(data.pool || null)
      setPicks(data.picks || [])
      setUsedTeams((data.picks || []).map((p: SurvivorPick) => p.team_name))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handlePickTeam = async (teamName: string) => {
    if (!pool) return
    const aiPick = MOCK_AI_PICKS[0]
    const row = MOCK_EDGE_TABLE.find((r) => r.team === teamName)
    await fetch('/api/survivor', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pool_id: pool.id,
        round_number: aiPick.round,
        team_name: teamName,
        team_seed: row?.seed ?? aiPick.seed,
        opponent_name: row?.opponent ?? aiPick.opponent,
        opponent_seed: row?.opponentSeed ?? aiPick.opponentSeed,
        win_probability: row?.winPct ?? aiPick.winProbability,
        survivor_value_score: row?.aiScore ?? aiPick.survivorValueScore,
        ai_confidence: aiPick.aiConfidence,
      }),
    })
    setUsedTeams((prev) => [...prev.filter((t) => t !== teamName), teamName])
  }

  const handlePoolSave = (config: PoolConfig) => {
    setPool({ ...(pool || {}), ...config })
    setShowSetup(false)
    loadData()
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

      {/* ── PRE-BRACKET ── */}
      {!bracketReleased && (
        <PreBracketOverlay
          countdown={countdown}
          pool={pool}
          showSetup={showSetup}
          setShowSetup={setShowSetup}
          onSave={handlePoolSave}
        />
      )}

      {/* ── POST-BRACKET ── */}
      {bracketReleased && (
        <div className="space-y-8">
          {/* Pool setup */}
          {!pool && !showSetup && (
            <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(0,255,163,0.06)', border: '1px solid rgba(0,255,163,0.2)' }}>
              <Shield className="w-8 h-8 mx-auto mb-3" style={{ color: '#00FFA3' }} />
              <h2 className="text-lg font-black mb-2" style={{ color: '#E6E6FA' }}>Set Up Your Survivor Pool</h2>
              <p className="text-sm mb-4" style={{ color: '#A0A0B0' }}>Configure your pool rules so the AI can build a personalized survival strategy.</p>
              <Button onClick={() => setShowSetup(true)} className="gradient-green text-black font-bold px-8 py-4 rounded-xl border-0 hover:opacity-90 neon-glow">
                Create My Survivor Pool
              </Button>
            </div>
          )}

          {showSetup && <PoolSetupForm onSave={handlePoolSave} />}

          {pool && !showSetup && (
            <>
              {/* Pool bar */}
              <div className="flex items-center justify-between px-5 py-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{pool.pool_name as string}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>
                    {pool.pool_size as string} pool · {(pool.pick_format as string).replace(/_/g, ' ')}
                    {pool.team_reuse ? ' · Teams reusable' : ''}
                    {(pool.strike_rule as string) === 'one_loss' ? ' · 1 strike allowed' : ''}
                  </div>
                </div>
                <button onClick={() => setShowSetup(true)} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/5"
                  style={{ color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <RotateCcw className="w-3 h-3" /> Edit Pool
                </button>
              </div>

              {/* Used teams */}
              {usedTeams.length > 0 && <UsedTeamsBadge teams={usedTeams} />}

              {/* AI Best Pick */}
              {MOCK_AI_PICKS.map((pick) => (
                <AIPickCard key={pick.round} pick={pick} isPremium={isPremium} usedTeams={usedTeams} onPickTeam={handlePickTeam} />
              ))}

              {/* Edge Table */}
              <SurvivorEdgeTable usedTeams={usedTeams} onPickTeam={handlePickTeam} />

              {/* Reservation Tool */}
              <ReservationTool usedTeams={usedTeams} />

              {/* Pick history */}
              {picks.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6B6B80' }}>My Pool History</div>
                  <div className="space-y-2">
                    {picks.map((p) => (
                      <div key={p.id} className="flex items-center gap-4 px-5 py-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{ background: 'rgba(255,255,255,0.08)', color: '#A0A0B0' }}>R{p.round_number}</div>
                        <div className="flex-1">
                          <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{p.team_name}</div>
                          {p.opponent_name && <div className="text-xs" style={{ color: '#6B6B80' }}>vs. {p.opponent_name}</div>}
                        </div>
                        <div className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{
                            background: p.result === 'win' ? 'rgba(0,255,163,0.12)' : p.result === 'loss' ? 'rgba(255,107,107,0.12)' : 'rgba(255,255,255,0.08)',
                            color: p.result === 'win' ? '#00FFA3' : p.result === 'loss' ? '#FF6B6B' : '#A0A0B0',
                          }}>
                          {p.result === 'pending' ? 'Saved' : p.result.charAt(0).toUpperCase() + p.result.slice(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Premium upsell */}
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
    </div>
  )
}
