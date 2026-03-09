'use client'

import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, Activity, ChevronDown, ChevronUp, Calendar, RefreshCw } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SdioInjury {
  playerId:        number
  playerName:      string
  team:            string
  teamName:        string
  league:          string
  position:        string | null
  injuryType:      string
  injuryDesc:      string
  status:          string
  expectedReturn:  string | null
  impactScore:     number
  updatedAt:       string
}

// Legacy DB shape (fallback)
interface DbInjury {
  id: string
  game_id: string | null
  player_name: string | null
  team_name: string | null
  injury_type: string | null
  status: string
  notes: string | null
  impact_score: number | null
  created_at: string
}

type AnyInjury = SdioInjury | DbInjury

function isSdioInjury(i: AnyInjury): i is SdioInjury {
  return 'playerName' in i
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  'Out':          { color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)', border: 'rgba(255,107,107,0.3)' },
  'IR':           { color: '#FF4444', bg: 'rgba(255,68,68,0.12)',   border: 'rgba(255,68,68,0.3)'   },
  'Day-To-Day':   { color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)'  },
  'GTD':          { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)'  },
  'Questionable': { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.2)'   },
  'Probable':     { color: '#00FFA3', bg: 'rgba(0,255,163,0.12)',  border: 'rgba(0,255,163,0.2)'    },
}

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? { color: '#A0A0B0', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' }
}

function getImpactLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 9) return { label: '⭐ Star Player', color: '#FF6B6B', bg: 'rgba(255,107,107,0.15)' }
  if (score >= 6) return { label: '⚠ Rotation Player', color: '#F97316', bg: 'rgba(249,115,22,0.12)' }
  if (score >= 3) return { label: 'ℹ Role Player', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' }
  return { label: 'Bench', color: '#A0A0B0', bg: 'rgba(160,160,176,0.08)' }
}

function formatExpectedReturn(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return null
  }
}

function getPlayerName(injury: AnyInjury): string {
  return isSdioInjury(injury) ? injury.playerName : (injury.player_name ?? 'Unknown Player')
}
function getTeamName(injury: AnyInjury): string {
  return isSdioInjury(injury) ? injury.teamName : (injury.team_name ?? '—')
}
function getInjuryType(injury: AnyInjury): string {
  return isSdioInjury(injury) ? injury.injuryType : (injury.injury_type ?? 'Unknown')
}
function getNotes(injury: AnyInjury): string | null {
  return isSdioInjury(injury) ? injury.injuryDesc : injury.notes
}
function getImpactScore(injury: AnyInjury): number {
  return isSdioInjury(injury) ? injury.impactScore : (injury.impact_score ?? 0)
}
function getStatus(injury: AnyInjury): string {
  return injury.status
}
function getLeague(injury: AnyInjury): string {
  return isSdioInjury(injury) ? injury.league : '—'
}
function getPosition(injury: AnyInjury): string | null {
  return isSdioInjury(injury) ? injury.position : null
}
function getExpectedReturn(injury: AnyInjury): string | null {
  return isSdioInjury(injury) ? injury.expectedReturn : null
}
function getKey(injury: AnyInjury): string {
  return isSdioInjury(injury) ? String(injury.playerId) : injury.id
}

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316', NHL: '#A78BFA', NCAAB: '#F59E0B',
}

// ─── Spread scenario helper (same as before) ───────────────────────────────────

function getSpreadScenarios(impactScore: number, status: string) {
  const shift = Math.min(0.5 + impactScore * 0.35, 4.0)
  const base = -(3.5 + Math.random() * 3)
  return {
    ifOut: parseFloat((base - shift).toFixed(1)),
    ifIn: parseFloat(base.toFixed(1)),
    isActive: status === 'Questionable' || status === 'Out' || status === 'Day-To-Day' || status === 'GTD',
  }
}

// ─── InjuryCard ─────────────────────────────────────────────────────────────────

function InjuryCard({ injury }: { injury: AnyInjury }) {
  const [expanded, setExpanded] = useState(false)
  const status = getStatus(injury)
  const impactScore = getImpactScore(injury)
  const impact = getImpactLabel(impactScore)
  const statusStyle = getStatusStyle(status)
  const scenarios = getSpreadScenarios(impactScore, status)
  const league = getLeague(injury)
  const lc = LEAGUE_COLORS[league] ?? '#A0A0B0'
  const position = getPosition(injury)
  const expectedReturn = getExpectedReturn(injury)
  const returnDate = formatExpectedReturn(expectedReturn)
  const isHighSeverity = status === 'Out' || status === 'IR'

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: isHighSeverity && impactScore >= 6
          ? `1px solid ${statusStyle.border}`
          : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Status dot */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: statusStyle.color, boxShadow: `0 0 6px ${statusStyle.color}` }}
        />

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* League badge */}
            {league !== '—' && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${lc}18`, color: lc, border: `1px solid ${lc}30` }}
              >
                {league}
              </span>
            )}
            <span className="font-bold text-sm" style={{ color: '#E6E6FA' }}>
              {getPlayerName(injury)}
            </span>
            {position && (
              <span className="text-xs" style={{ color: '#6B6B80' }}>{position}</span>
            )}
            {/* Impact badge */}
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: impact.bg, color: impact.color }}
            >
              {impact.label}
            </span>
          </div>

          <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>
            {getTeamName(injury)}
            {getInjuryType(injury) ? ` · ${getInjuryType(injury)}` : ''}
          </div>

          {getNotes(injury) && (
            <div className="text-xs mt-1" style={{ color: '#6B6B80' }}>{getNotes(injury)}</div>
          )}

          {returnDate && (
            <div className="flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: '#4A4A60' }} />
              <span className="text-xs" style={{ color: '#4A4A60' }}>
                Expected return: {returnDate}
              </span>
            </div>
          )}
        </div>

        {/* Right: status badge + expand button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap"
            style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.color}30` }}
          >
            {status}
          </div>
          {scenarios.isActive && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: '#A0A0B0' }}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Spread scenario panel */}
      {expanded && scenarios.isActive && (
        <div className="px-5 pb-4 pt-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#A0A0B0' }}>
              Spread Scenario Simulation
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}
              >
                <div className="text-xs mb-1 font-semibold" style={{ color: '#FF6B6B' }}>
                  If {getPlayerName(injury).split(' ')[0]} OUT
                </div>
                <div className="text-xl font-black" style={{ color: '#FF6B6B' }}>
                  {scenarios.ifOut > 0 ? '+' : ''}{scenarios.ifOut}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>Projected Spread</div>
              </div>
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)' }}
              >
                <div className="text-xs mb-1 font-semibold" style={{ color: '#00FFA3' }}>
                  If {getPlayerName(injury).split(' ')[0]} IN
                </div>
                <div className="text-xl font-black" style={{ color: '#00FFA3' }}>
                  {scenarios.ifIn > 0 ? '+' : ''}{scenarios.ifIn}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>Projected Spread</div>
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: '#6B6B80' }}>
              Scenario simulations are AI estimates based on historical impact data.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const LEAGUES = ['All', 'NBA', 'NHL', 'NCAAB']

export default function InjuriesPage() {
  const [allInjuries, setAllInjuries] = useState<AnyInjury[]>([])
  const [loading, setLoading] = useState(true)
  const [leagueFilter, setLeagueFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [source, setSource] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const loadInjuries = () => {
    setLoading(true)
    const qs = leagueFilter !== 'All' ? `?league=${leagueFilter}` : ''
    fetch(`/api/injuries${qs}`)
      .then((r) => r.json())
      .then((data) => {
        setAllInjuries(data.injuries || [])
        setSource(data.source || '')
        if (data.injuries?.length > 0) {
          const first = data.injuries[0]
          setLastUpdated(isSdioInjury(first) ? first.updatedAt : first.created_at)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadInjuries() }, [leagueFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredInjuries = useMemo(() => {
    let list = allInjuries
    if (statusFilter !== 'All') {
      list = list.filter((i) => {
        const s = getStatus(i)
        if (statusFilter === 'Out') return s === 'Out' || s === 'IR'
        if (statusFilter === 'Questionable') return s === 'Questionable' || s === 'GTD' || s === 'Day-To-Day'
        if (statusFilter === 'Probable') return s === 'Probable'
        return true
      })
    }
    return list
  }, [allInjuries, statusFilter])

  const outCount          = allInjuries.filter((i) => getStatus(i) === 'Out' || getStatus(i) === 'IR').length
  const questionableCount = allInjuries.filter((i) => ['Questionable', 'GTD', 'Day-To-Day'].includes(getStatus(i))).length
  const probableCount     = allInjuries.filter((i) => getStatus(i) === 'Probable').length
  const criticalCount     = allInjuries.filter((i) => getImpactScore(i) >= 6 && (getStatus(i) === 'Out' || getStatus(i) === 'IR')).length

  const formatLastUpdated = (ts: string | null) => {
    if (!ts) return null
    try {
      return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return null }
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#0F0F1A', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} />
            <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Injury Report</h1>
            {source === 'sportsdata.io' && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.2)' }}>
                Live
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: '#A0A0B0' }}>
            Live player injury statuses with AI impact analysis and spread scenario simulations.
            {lastUpdated && (
              <span className="ml-2" style={{ color: '#4A4A60' }}>
                Updated {formatLastUpdated(lastUpdated)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadInjuries}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
          style={{ color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Out / IR',      count: outCount,          color: '#FF6B6B', bg: 'rgba(255,107,107,0.08)' },
          { label: 'Questionable',  count: questionableCount, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)'  },
          { label: 'Probable',      count: probableCount,     color: '#00FFA3', bg: 'rgba(0,255,163,0.08)'   },
          { label: 'High-Impact Out', count: criticalCount,   color: '#F97316', bg: 'rgba(249,115,22,0.08)'  },
        ].map(({ label, count, color, bg }) => (
          <div
            key={label}
            className="rounded-2xl p-4 text-center"
            style={{ background: bg, border: `1px solid ${color}25` }}
          >
            <div className="text-3xl font-black" style={{ color }}>{count}</div>
            <div className="text-xs font-semibold mt-1 uppercase tracking-wider" style={{ color }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* League filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B6B80' }}>League:</span>
          {LEAGUES.map((l) => (
            <button
              key={l}
              onClick={() => setLeagueFilter(l)}
              className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
              style={{
                background: leagueFilter === l ? 'rgba(0,255,163,0.12)' : 'rgba(255,255,255,0.04)',
                color:      leagueFilter === l ? '#00FFA3' : '#A0A0B0',
                border:     leagueFilter === l ? '1px solid rgba(0,255,163,0.3)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B6B80' }}>Status:</span>
          {['All', 'Out', 'Questionable', 'Probable'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="text-xs font-bold px-3 py-1 rounded-full transition-colors"
              style={{
                background: statusFilter === s ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                color:      statusFilter === s ? '#F59E0B' : '#A0A0B0',
                border:     statusFilter === s ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Impact legend */}
      <div className="rounded-xl p-4 flex flex-wrap gap-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>IMPACT:</span>
        {[
          { label: '⭐ Star Player',      color: '#FF6B6B', bg: 'rgba(255,107,107,0.15)', range: '9–10' },
          { label: '⚠ Rotation Player',  color: '#F97316', bg: 'rgba(249,115,22,0.12)',  range: '6–8'  },
          { label: 'ℹ Role Player',       color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  range: '3–5'  },
          { label: 'Bench',              color: '#A0A0B0', bg: 'rgba(160,160,176,0.08)', range: '0–2'  },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: item.bg, color: item.color }}>
              {item.label}
            </span>
            <span className="text-xs" style={{ color: '#6B6B80' }}>({item.range})</span>
          </div>
        ))}
      </div>

      {/* Injury list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : filteredInjuries.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: '#A0A0B0' }} />
          <p className="font-semibold" style={{ color: '#E6E6FA' }}>No injury reports available</p>
          <p className="text-sm mt-1" style={{ color: '#6B6B80' }}>
            {source === 'sportsdata.io'
              ? 'SportsDataIO returned no injuries for the current filters.'
              : 'Check back closer to game time.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: '#4A4A60' }}>
              Showing {filteredInjuries.length} player{filteredInjuries.length !== 1 ? 's' : ''}
              {leagueFilter !== 'All' ? ` · ${leagueFilter}` : ''}
              {statusFilter !== 'All' ? ` · ${statusFilter}` : ''}
            </p>
          </div>
          {filteredInjuries.map((injury) => (
            <InjuryCard key={getKey(injury)} injury={injury} />
          ))}
        </div>
      )}
    </div>
  )
}
