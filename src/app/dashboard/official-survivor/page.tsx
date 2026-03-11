'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Trophy, Users, Shield, Crown, CheckCircle, XCircle, Clock,
  ChevronRight, Medal, Zap, Info, DollarSign, Ticket,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse'
import { ContestStatusHeader } from '@/components/ContestStatusHeader'
import { SurvivorBracketView } from '@/components/SurvivorBracketView'
import { RoundGameCards, type PickSelection } from '@/components/RoundGameCards'
import {
  type OfficialBracketData,
  type BracketMatchup,
  type RoundCompletionStatus,
  ROUND_LABELS,
  roundNumberToKey,
} from '@/lib/bracketTypes'

// ─── Constants ─────────────────────────────────────────────────────────────
const BRACKET_RELEASE = new Date('2026-03-16T23:00:00Z')
const ENTRY_PRICE = 50
const MAX_ENTRIES = 3

// ─── Types ─────────────────────────────────────────────────────────────────

interface SurvivorPickRow {
  id: string
  round_number: number
  team_name: string
  team_seed: number | null
  opponent_name: string | null
  result: 'pending' | 'won' | 'eliminated'
  picked_at: string
}

interface LeaderboardRow {
  rank: number
  entryId: string
  userId: string
  entryNumber: number
  displayName: string
  status: 'alive' | 'eliminated'
  roundsSurvived: number
  picksCorrect: number
  currentRound: number
  picks: SurvivorPickRow[]
  createdAt: string
}

interface PrizePool {
  totalEntries: number
  entryPriceCents: number
  totalPotCents: number
  firstPlaceCents: number
  secondPlaceCents: number
  retainedCents: number
  perfectSurvivorPotCents: number
}

interface Pool {
  id: string
  pool_name: string
  is_active: boolean
}

interface OfficialData {
  pool: Pool
  myEntries: LeaderboardRow[]
  myEntryCount: number
  canPurchaseMore: boolean
  remainingSlots: number
  leaderboard: LeaderboardRow[]
  currentRound: number
  totalEntrants: number
  prizePool: PrizePool
  bracketLive?: boolean
  isAdmin?: boolean
  isAdminPreview?: boolean
  isTestMode?: boolean
  testBracketData?: unknown
  bracketData?: OfficialBracketData
  roundCompletionStatus?: Record<string, RoundCompletionStatus>
  activeRound?: number
  usedTeamsByEntry?: Record<string, string[]>
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDollars(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

function RoundLabel(round: number): string {
  const key = roundNumberToKey(round)
  return ROUND_LABELS[key] ?? `Round ${round}`
}

function StatusBadge({ status }: { status: 'alive' | 'eliminated' }) {
  return status === 'alive' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ background: 'rgba(0,255,163,0.12)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.25)' }}>
      <CheckCircle className="w-2.5 h-2.5" /> Alive
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
      <XCircle className="w-2.5 h-2.5" /> Out
    </span>
  )
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-4 h-4" style={{ color: '#FFD700' }} />
  if (rank === 2) return <Medal className="w-4 h-4" style={{ color: '#C0C0C0' }} />
  if (rank === 3) return <Medal className="w-4 h-4" style={{ color: '#CD7F32' }} />
  return <span className="text-xs font-bold w-4 text-center tabular-nums" style={{ color: '#6B6B80' }}>{rank}</span>
}

// ─── Prize Pool Widget ──────────────────────────────────────────────────────

function PrizePoolWidget({ prizePool, totalEntrants }: { prizePool: PrizePool; totalEntrants: number }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4" style={{ color: '#F59E0B' }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F59E0B' }}>Live Prize Pool</span>
      </div>
      <div className="flex items-end gap-3 mb-4">
        <div>
          <div className="text-3xl font-black" style={{ color: '#E6E6FA' }}>
            {fmtDollars(prizePool.totalPotCents)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Total Prize Pool</div>
        </div>
        <div className="mb-1 flex gap-4 ml-4">
          <div>
            <div className="text-base font-bold" style={{ color: '#E6E6FA' }}>{totalEntrants}</div>
            <div className="text-[11px]" style={{ color: '#6B6B80' }}>Entries</div>
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: '#E6E6FA' }}>${ENTRY_PRICE}</div>
            <div className="text-[11px]" style={{ color: '#6B6B80' }}>Per Entry</div>
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: '#E6E6FA' }}>{MAX_ENTRIES}</div>
            <div className="text-[11px]" style={{ color: '#6B6B80' }}>Max/User</div>
          </div>
        </div>
      </div>
      <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-3.5 h-3.5" style={{ color: '#FFD700' }} />
            <span className="text-xs font-semibold" style={{ color: '#E6E6FA' }}>Perfect Survivor</span>
          </div>
          <span className="text-xs font-bold" style={{ color: '#FFD700' }}>Wins 100% &mdash; {fmtDollars(prizePool.perfectSurvivorPotCents)}</span>
        </div>
        <div className="border-t pt-2 space-y-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#4A4A60' }}>If no perfect survivor:</p>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#A0A0B0' }}>1st Place</span>
            <span className="text-xs font-bold" style={{ color: '#E6E6FA' }}>50% &mdash; {fmtDollars(prizePool.firstPlaceCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#A0A0B0' }}>2nd Place</span>
            <span className="text-xs font-bold" style={{ color: '#E6E6FA' }}>25% &mdash; {fmtDollars(prizePool.secondPlaceCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#4A4A60' }}>QuantEdge Retained</span>
            <span className="text-xs" style={{ color: '#4A4A60' }}>25% &mdash; {fmtDollars(prizePool.retainedCents)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Purchase Banner ────────────────────────────────────────────────────────

function PurchaseBanner({
  myEntryCount,
  remainingSlots,
  poolActive,
}: {
  myEntryCount: number
  remainingSlots: number
  poolActive: boolean
}) {
  const [quantity, setQuantity] = useState<1 | 2 | 3>(Math.min(remainingSlots, 1) as 1 | 2 | 3)

  if (!poolActive) {
    return (
      <div className="rounded-2xl p-5 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-sm font-medium" style={{ color: '#A0A0B0' }}>The official pool is currently closed.</p>
      </div>
    )
  }

  if (remainingSlots === 0) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.15)' }}>
        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#00FFA3' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#00FFA3' }}>You have {myEntryCount} of {MAX_ENTRIES} entries</p>
          <p className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Maximum entries reached. Good luck!</p>
        </div>
      </div>
    )
  }

  const options = Array.from({ length: remainingSlots }, (_, i) => i + 1) as (1 | 2 | 3)[]

  return (
    <div className="rounded-2xl p-5" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Ticket className="w-4 h-4" style={{ color: '#00FFA3' }} />
        <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>
          {myEntryCount === 0 ? 'Enter the Official Survivor Contest' : `Add More Entries (${remainingSlots} slot${remainingSlots > 1 ? 's' : ''} left)`}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs" style={{ color: '#A0A0B0' }}>Entries to purchase:</span>
        <div className="flex gap-2">
          {options.map((n) => (
            <button
              key={n}
              onClick={() => setQuantity(n)}
              className="w-9 h-9 rounded-xl text-sm font-bold transition-all"
              style={quantity === n
                ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.35)' }
                : { background: 'rgba(255,255,255,0.05)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-xs font-semibold" style={{ color: '#E6E6FA' }}>= ${quantity * ENTRY_PRICE}</span>
      </div>
      <div className="flex items-center gap-3">
        <Button
          disabled
          className="font-semibold text-sm border-0 cursor-not-allowed opacity-60"
          style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}
        >
          Purchase {quantity} {quantity === 1 ? 'Entry' : 'Entries'} &mdash; ${quantity * ENTRY_PRICE}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
          Payments coming soon
        </span>
      </div>
      <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: '#4A4A60' }}>
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        ${ENTRY_PRICE} per entry &middot; Max {MAX_ENTRIES} entries per user &middot; One-time purchase
      </p>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function OfficialSurvivorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Trophy className="w-10 h-10 animate-pulse" style={{ color: '#F59E0B' }} />
      </div>
    }>
      <OfficialSurvivorInner />
    </Suspense>
  )
}

function OfficialSurvivorInner() {
  const searchParams = useSearchParams()
  const entrySuccess = searchParams.get('entry') === 'success'
  const { setCollapsed } = useSidebarCollapse()

  const [data, setData] = useState<OfficialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState<'contest' | 'leaderboard' | 'rules'>('contest')
  const [activeEntryIndex, setActiveEntryIndex] = useState(0)
  const [pendingPicks, setPendingPicks] = useState<Record<string, PickSelection | null>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [adminPreviewLoading, setAdminPreviewLoading] = useState(false)

  const bracketLive = new Date() >= BRACKET_RELEASE || (data?.bracketLive === true)
  const isTestMode = data?.isTestMode === true
  const isAdmin = data?.isAdmin === true
  const isAdminPreview = data?.isAdminPreview === true
  const showEnteredExperience = bracketLive || isAdminPreview
  const hasEntries = (data?.myEntryCount ?? 0) > 0
  const canEnterPool = hasEntries || isTestMode || isAdminPreview

  // Collapse sidebar when on this page in live contest mode
  useEffect(() => {
    if (showEnteredExperience) {
      setCollapsed(true)
      return () => setCollapsed(false)
    }
  }, [showEnteredExperience, setCollapsed])

  const toggleAdminPreview = async (enable: boolean) => {
    setAdminPreviewLoading(true)
    try {
      const res = await fetch('/api/admin/survivor-admin-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enable }),
      })
      if (res.ok) {
        const dataRes = await fetch('/api/survivor/official')
        if (dataRes.ok) {
          setData(await dataRes.json())
        }
      }
    } catch (err) {
      console.error('Failed to toggle admin preview:', err)
    } finally {
      setAdminPreviewLoading(false)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/survivor/official')
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Failed to load')
        return
      }
      setData(await res.json())
    } catch {
      setError('Failed to load official survivor data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (entrySuccess) setMainTab('contest')
  }, [entrySuccess])

  // ─── Save pick handler ──────────────────────────────────────────────────
  const handleSavePick = async (entryId: string) => {
    const pick = pendingPicks[entryId]
    if (!pick || !data) return

    const activeRound = data.activeRound ?? 1

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(null)
    try {
      const res = await fetch('/api/survivor/official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entryId,
          round_number: activeRound,
          team_name: pick.teamName,
          team_seed: pick.teamSeed,
          opponent_name: pick.opponentName,
          opponent_seed: pick.opponentSeed,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setSaveError(body.error ?? 'Failed to save pick')
      } else {
        setSaveSuccess(`Locked in: ${pick.teamName}`)
        setPendingPicks((prev) => ({ ...prev, [entryId]: null }))
        fetchData()
      }
    } catch {
      setSaveError('Network error - please try again')
    } finally {
      setSaving(false)
    }
  }

  // ─── Loading / Error States ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Trophy className="w-10 h-10 mx-auto animate-pulse" style={{ color: '#F59E0B' }} />
          <p className="text-sm font-medium" style={{ color: '#A0A0B0' }}>Loading Official Survivor...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <XCircle className="w-10 h-10 mx-auto" style={{ color: '#F87171' }} />
          <p className="text-sm font-medium" style={{ color: '#F87171' }}>{error}</p>
          <Button size="sm" variant="outline" onClick={fetchData}>Retry</Button>
        </div>
      </div>
    )
  }

  // ─── Pre-bracket gate ──────────────────────────────────────────────────
  if (!bracketLive && !isAdminPreview) {
    return (
      <div className="px-4 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
        <PageHeader totalEntrants={data?.totalEntrants ?? 0} currentRound={1} />
        {data && <PrizePoolWidget prizePool={data.prizePool} totalEntrants={data.totalEntrants} />}

        {isAdmin && !isAdminPreview && (
          <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5" style={{ color: '#8B5CF6' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Admin Preview Mode</p>
                <p className="text-xs" style={{ color: '#A0A0B0' }}>Preview the live contest UI before launch</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => toggleAdminPreview(true)}
              disabled={adminPreviewLoading}
              style={{ background: '#8B5CF6', color: '#fff' }}
            >
              {adminPreviewLoading ? 'Loading...' : 'Preview Live Contest'}
            </Button>
          </div>
        )}

        {isTestMode && (
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <Shield className="w-4 h-4 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <p className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
              TEST MODE &mdash; You are previewing the contest as admin.
            </p>
          </div>
        )}

        {canEnterPool && (
          <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(0,255,163,0.06)', border: '1px solid rgba(0,255,163,0.2)' }}>
            <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: '#00FFA3' }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: '#E6E6FA' }}>
              {isTestMode || isAdminPreview ? 'Preview: Enter Pool' : 'Ready to Play'}
            </h2>
            <p className="text-sm max-w-md mx-auto mb-4" style={{ color: '#A0A0B0' }}>
              {isTestMode || isAdminPreview
                ? 'Preview the contest experience as an admin.'
                : 'Your entry is confirmed! Enter the pool to make your picks.'}
            </p>
            <Button
              onClick={() => toggleAdminPreview(true)}
              className="font-bold"
              style={{ background: '#00FFA3', color: '#000' }}
            >
              Enter Pool
            </Button>
          </div>
        )}

        {!canEnterPool && (
          <>
            <div className="rounded-2xl p-10 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Clock className="w-12 h-12 mx-auto mb-4" style={{ color: '#F59E0B' }} />
              <h2 className="text-xl font-bold mb-2" style={{ color: '#E6E6FA' }}>Bracket Releases March 16</h2>
              <p className="text-sm max-w-md mx-auto" style={{ color: '#A0A0B0' }}>
                The contest opens on Selection Sunday, March 16, 2026.
              </p>
            </div>
            <div className="rounded-2xl p-6" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
              <RulesSection />
            </div>
          </>
        )}
      </div>
    )
  }

  if (!data) return null

  // ─── Live Contest Experience ──────────────────────────────────────────
  const {
    pool, myEntries, myEntryCount, leaderboard, currentRound,
    totalEntrants, prizePool, bracketData, roundCompletionStatus,
    activeRound: apiActiveRound, usedTeamsByEntry,
    remainingSlots,
  } = data

  const activeRound = apiActiveRound ?? currentRound
  const activeRoundKey = roundNumberToKey(activeRound)
  const activeRoundMatchups = (bracketData?.results?.[activeRoundKey] ?? {}) as Record<string, BracketMatchup>

  // Current entry
  const currentEntry = myEntries[activeEntryIndex] ?? myEntries[0]
  const currentEntryId = currentEntry?.entryId
  const currentPick = currentEntryId ? pendingPicks[currentEntryId] ?? null : null
  const currentUsedTeams = currentEntryId ? (usedTeamsByEntry?.[currentEntryId] ?? []) : []

  // Determine if current entry already has a pick for the active round
  const existingPick = currentEntry?.picks.find((p) => p.round_number === activeRound)
  const hasSubmittedPick = existingPick != null
  const hasPendingPick = currentPick != null

  // Count alive entries
  const aliveEntrants = leaderboard.filter((r) => r.status === 'alive').length
  const myAliveEntries = myEntries.filter((e) => e.status === 'alive').length

  // Round locking: can only pick in the active round
  const isCurrentRoundLocked = false // Active round is always open
  const isEntryEliminated = currentEntry?.status === 'eliminated'

  return (
    <div className="px-4 lg:px-6 py-6 max-w-7xl mx-auto space-y-4">

      {/* Admin banners */}
      {isAdminPreview && (
        <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 flex-shrink-0" style={{ color: '#F87171' }} />
            <p className="text-sm font-semibold" style={{ color: '#F87171' }}>
              ADMIN PREVIEW MODE &mdash; Viewing the live contest UI.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleAdminPreview(false)}
            disabled={adminPreviewLoading}
          >
            Exit Preview
          </Button>
        </div>
      )}
      {isTestMode && (
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Shield className="w-4 h-4 flex-shrink-0" style={{ color: '#F59E0B' }} />
          <p className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
            TEST MODE &mdash; Previewing as admin. Regular users see the countdown.
          </p>
        </div>
      )}

      {entrySuccess && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)' }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#00FFA3' }} />
          <p className="text-sm font-semibold" style={{ color: '#00FFA3' }}>
            Entry confirmed! Make your picks below.
          </p>
        </div>
      )}

      {/* Header */}
      <PageHeader totalEntrants={totalEntrants} currentRound={activeRound} />

      {/* Contest Status Bar */}
      <ContestStatusHeader
        currentRound={currentRound}
        activeRound={activeRound}
        totalEntrants={totalEntrants}
        aliveEntrants={aliveEntrants}
        myAliveEntries={myAliveEntries}
        myTotalEntries={myEntries.length}
        roundCompletionStatus={roundCompletionStatus}
        hasPendingPick={hasPendingPick}
        hasSubmittedPick={hasSubmittedPick}
      />

      {/* Entry Selector Dropdown - shown when user has entries */}
      {myEntries.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Viewing Entry:</span>
          <select
            value={activeEntryIndex}
            onChange={(e) => {
              setActiveEntryIndex(Number(e.target.value))
              setSaveError(null)
              setSaveSuccess(null)
            }}
            className="px-3 py-2 rounded-lg text-xs font-semibold border-0 focus:ring-2"
            style={{
              background: 'rgba(0,255,163,0.08)',
              color: '#00FFA3',
              border: '1px solid rgba(0,255,163,0.2)',
              outline: 'none',
            }}
          >
            {myEntries.map((entry, idx) => (
              <option key={entry.entryId} value={idx}>
                Entry #{entry.entryNumber} ({entry.status === 'alive' ? 'Alive' : 'Eliminated'})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Compact My Picks Section - shows user's picks across all rounds */}
      {myEntries.length > 0 && currentEntry && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-3.5 h-3.5" style={{ color: '#00FFA3' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6B6B80' }}>
              My Picks (Entry #{currentEntry.entryNumber})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentEntry.picks && currentEntry.picks.length > 0 ? (
              currentEntry.picks.map((pick) => (
                <div
                  key={pick.round_number}
                  className="flex items-center gap-2 px-2 py-1 rounded-md text-xs"
                  style={{
                    background: pick.result === 'won' ? 'rgba(0,255,163,0.08)' : pick.result === 'eliminated' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${pick.result === 'won' ? 'rgba(0,255,163,0.15)' : pick.result === 'eliminated' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <span className="font-semibold" style={{ color: '#4A4A60' }}>R{pick.round_number}:</span>
                  <span className="font-medium" style={{ color: pick.result === 'won' ? '#00FFA3' : pick.result === 'eliminated' ? '#F87171' : '#E6E6FA' }}>
                    {pick.team_name}
                  </span>
                  {pick.result === 'won' && <CheckCircle className="w-3 h-3" style={{ color: '#00FFA3' }} />}
                  {pick.result === 'eliminated' && <XCircle className="w-3 h-3" style={{ color: '#F87171' }} />}
                </div>
              ))
            ) : (
              <span className="text-xs" style={{ color: '#4A4A60' }}>No picks made yet</span>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Bracket View */}
      {bracketData && (
        <SurvivorBracketView
          bracketData={bracketData}
          activeRound={activeRound}
        />
      )}

      {/* Main tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {(['contest', 'leaderboard', 'rules'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all"
            style={mainTab === tab
              ? { background: 'rgba(0,255,163,0.12)', color: '#00FFA3' }
              : { color: '#6B6B80' }
            }
          >
            {tab === 'contest' ? 'Make Picks' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Contest Tab - Main pick experience */}
      {mainTab === 'contest' && (
        <div className="space-y-4">
          {/* Prize pool (compact) */}
          <PrizePoolWidget prizePool={prizePool} totalEntrants={totalEntrants} />

          {/* Purchase banner */}
          <PurchaseBanner myEntryCount={myEntryCount} remainingSlots={remainingSlots} poolActive={pool.is_active} />

          {/* Entry tabs - if user has entries */}
          {myEntries.length > 0 && (
            <>
              {/* Entry sub-tabs */}
              {myEntries.length > 1 && (
                <div className="flex gap-2">
                  {myEntries.map((entry, idx) => (
                    <button
                      key={entry.entryId}
                      onClick={() => {
                        setActiveEntryIndex(idx)
                        setSaveError(null)
                        setSaveSuccess(null)
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={idx === activeEntryIndex
                        ? { background: 'rgba(0,255,163,0.12)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.25)' }
                        : { background: 'rgba(255,255,255,0.03)', color: '#6B6B80', border: '1px solid rgba(255,255,255,0.06)' }
                      }
                    >
                      <Ticket className="w-3 h-3" />
                      Entry #{entry.entryNumber}
                      <StatusBadge status={entry.status} />
                    </button>
                  ))}
                </div>
              )}

              {/* Active entry status card */}
              {currentEntry && (
                <div className="rounded-xl p-4 flex items-center justify-between" style={{
                  background: currentEntry.status === 'alive' ? 'rgba(0,255,163,0.04)' : 'rgba(239,68,68,0.04)',
                  border: `1px solid ${currentEntry.status === 'alive' ? 'rgba(0,255,163,0.12)' : 'rgba(239,68,68,0.12)'}`,
                }}>
                  <div className="flex items-center gap-3">
                    <Ticket className="w-4 h-4" style={{ color: currentEntry.status === 'alive' ? '#00FFA3' : '#F87171' }} />
                    <div>
                      <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>Entry #{currentEntry.entryNumber}</span>
                      <span className="text-xs ml-2" style={{ color: '#6B6B80' }}>Rank #{currentEntry.rank}</span>
                    </div>
                    <StatusBadge status={currentEntry.status} />
                  </div>
                  <div className="flex gap-4 text-center">
                    <div>
                      <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{currentEntry.roundsSurvived}</div>
                      <div className="text-[10px]" style={{ color: '#6B6B80' }}>Rounds</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{currentEntry.picksCorrect}</div>
                      <div className="text-[10px]" style={{ color: '#6B6B80' }}>Correct</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Game Cards for Active Round */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4" style={{ color: '#00FFA3' }} />
                  <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>
                    {RoundLabel(activeRound)} &mdash; Pick a Team to Survive
                  </span>
                  {activeRound >= 7 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
                      Tournament Complete
                    </span>
                  )}
                </div>

                {activeRound < 7 && (
                  <RoundGameCards
                    roundKey={activeRoundKey}
                    roundNumber={activeRound}
                    matchups={activeRoundMatchups}
                    selectedTeam={currentPick?.teamName ?? (existingPick?.result === 'pending' ? existingPick.team_name : null)}
                    usedTeams={currentUsedTeams}
                    isLocked={isCurrentRoundLocked}
                    isEliminated={isEntryEliminated}
                    onTeamSelect={(pick) => {
                      if (!currentEntryId) return
                      setPendingPicks((prev) => ({ ...prev, [currentEntryId]: pick }))
                      setSaveError(null)
                      setSaveSuccess(null)
                    }}
                  />
                )}
              </div>

              {/* Save Pick Button */}
              {currentEntryId && !isEntryEliminated && activeRound < 7 && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {hasPendingPick && (
                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      <Info className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F59E0B' }} />
                      <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>
                        Unsaved pick: <strong>{currentPick?.teamName}</strong> (#{currentPick?.teamSeed}) vs {currentPick?.opponentName}
                      </span>
                    </div>
                  )}
                  {saveError && (
                    <p className="text-xs font-medium" style={{ color: '#F87171' }}>{saveError}</p>
                  )}
                  {saveSuccess && (
                    <p className="text-xs font-medium flex items-center gap-1" style={{ color: '#00FFA3' }}>
                      <CheckCircle className="w-3 h-3" /> {saveSuccess}
                    </p>
                  )}
                  <Button
                    className="gradient-green text-black font-semibold border-0 hover:opacity-90 text-sm neon-glow w-full"
                    onClick={() => handleSavePick(currentEntryId)}
                    disabled={saving || !hasPendingPick}
                  >
                    {saving ? 'Locking in...' : hasPendingPick ? `Lock In: ${currentPick?.teamName}` : hasSubmittedPick ? `Pick Submitted: ${existingPick?.team_name}` : 'Select a Team Above'}
                  </Button>
                </div>
              )}

              {/* My Picks Summary for this entry */}
              {currentEntry && currentEntry.picks.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="px-4 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B6B80' }}>
                      Pick History &mdash; Entry #{currentEntry.entryNumber}
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    {currentEntry.picks.slice().sort((a, b) => a.round_number - b.round_number).map((pick) => (
                      <div key={pick.id} className="px-4 py-2.5 flex items-center gap-4">
                        <div className="w-14 flex-shrink-0">
                          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#4A4A60' }}>
                            {RoundLabel(pick.round_number).replace('Round of ', 'R').replace('Sweet 16', 'S16').replace('Elite Eight', 'E8').replace('Final Four', 'F4').replace('Championship', 'Champ')}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
                            {pick.team_name}
                            {pick.team_seed != null && <span className="text-xs font-normal ml-1" style={{ color: '#6B6B80' }}>(#{pick.team_seed})</span>}
                          </div>
                          {pick.opponent_name && (
                            <div className="text-[11px]" style={{ color: '#6B6B80' }}>vs {pick.opponent_name}</div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {pick.result === 'pending' && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                              <Clock className="w-2.5 h-2.5" /> Pending
                            </span>
                          )}
                          {pick.result === 'won' && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.2)' }}>
                              <CheckCircle className="w-2.5 h-2.5" /> Won
                            </span>
                          )}
                          {pick.result === 'eliminated' && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                              <XCircle className="w-2.5 h-2.5" /> Eliminated
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* No entries state */}
          {myEntries.length === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Ticket className="w-10 h-10 mx-auto mb-3" style={{ color: '#4A4A60' }} />
              <p className="text-sm font-semibold mb-1" style={{ color: '#E6E6FA' }}>No entries yet</p>
              <p className="text-xs" style={{ color: '#A0A0B0' }}>
                Purchase 1&ndash;{MAX_ENTRIES} entries at ${ENTRY_PRICE} each to join the contest.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {mainTab === 'leaderboard' && (
        <LeaderboardTab rows={leaderboard} currentRound={activeRound} />
      )}

      {/* Rules Tab */}
      {mainTab === 'rules' && (
        <div className="rounded-2xl p-6" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
          <RulesSection />
        </div>
      )}
    </div>
  )
}

// ─── Page Header ───────────────────────────────────────────────────────────

function PageHeader({ totalEntrants, currentRound }: { totalEntrants: number; currentRound: number }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <h1 className="text-xl font-bold" style={{ color: '#E6E6FA' }}>QuantEdge Official Survivor</h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
            Official
          </span>
        </div>
        <p className="text-sm" style={{ color: '#A0A0B0' }}>
          Pick one team per round to survive. Last entry standing wins.
        </p>
      </div>
      <div className="flex gap-5 text-right flex-shrink-0">
        <div>
          <div className="text-lg font-bold" style={{ color: '#00FFA3' }}>{totalEntrants}</div>
          <div className="text-[11px]" style={{ color: '#6B6B80' }}>Total Entries</div>
        </div>
        <div>
          <div className="text-lg font-bold" style={{ color: '#E6E6FA' }}>{RoundLabel(currentRound)}</div>
          <div className="text-[11px]" style={{ color: '#6B6B80' }}>Active Round</div>
        </div>
      </div>
    </div>
  )
}

// ─── Leaderboard Tab ───────────────────────────────────────────────────────

function LeaderboardTab({ rows, currentRound }: { rows: LeaderboardRow[]; currentRound: number }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl p-10 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Users className="w-10 h-10 mx-auto mb-3" style={{ color: '#4A4A60' }} />
        <p className="text-sm font-medium" style={{ color: '#A0A0B0' }}>No entries yet.</p>
      </div>
    )
  }

  const alive = rows.filter((r) => r.status === 'alive').length
  const eliminated = rows.filter((r) => r.status === 'eliminated').length

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B6B80' }}>
          Leaderboard &mdash; {RoundLabel(currentRound)}
        </span>
        <span className="text-xs" style={{ color: '#6B6B80' }}>
          {alive} alive &middot; {eliminated} out
        </span>
      </div>

      <div className="px-5 py-2 grid grid-cols-[1.5rem_1fr_auto_auto_auto_auto] gap-3 items-center border-b"
        style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <div />
        <div className="text-[10px] uppercase tracking-widest" style={{ color: '#4A4A60' }}>Player / Entry</div>
        <div className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: '#4A4A60' }}>Rounds</div>
        <div className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: '#4A4A60' }}>Correct</div>
        <div className="text-[10px] uppercase tracking-widest" style={{ color: '#4A4A60' }}>Status</div>
        <div />
      </div>

      <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {rows.map((row) => (
          <div
            key={row.entryId}
            className="px-5 py-3.5 grid grid-cols-[1.5rem_1fr_auto_auto_auto] gap-3 items-center sm:grid-cols-[1.5rem_1fr_auto_auto_auto_auto]"
            style={row.status === 'eliminated' ? { opacity: 0.5 } : {}}
          >
            <div className="flex justify-center">
              <RankIcon rank={row.rank} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: '#E6E6FA' }}>
                {row.displayName}
              </div>
              <div className="text-[11px]" style={{ color: '#6B6B80' }}>
                Entry #{row.entryNumber}
                {row.status === 'alive'
                  ? row.roundsSurvived > 0 ? ` &middot; Through ${RoundLabel(row.roundsSurvived)}` : ''
                  : ` &middot; Eliminated R${row.roundsSurvived + 1}`
                }
              </div>
            </div>
            <div className="text-sm font-bold text-center hidden sm:block" style={{ color: '#E6E6FA' }}>
              {row.roundsSurvived}
            </div>
            <div className="text-sm font-bold text-center hidden sm:block" style={{ color: '#E6E6FA' }}>
              {row.picksCorrect}
            </div>
            <div>
              <StatusBadge status={row.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Rules Section ─────────────────────────────────────────────────────────

function RulesSection() {
  const rules = [
    { icon: Ticket, title: `$${ENTRY_PRICE} Per Entry`, desc: `Any logged-in user may purchase 1-${MAX_ENTRIES} entries at $${ENTRY_PRICE} each. Each entry competes independently.` },
    { icon: Users, title: `Max ${MAX_ENTRIES} Entries Per User`, desc: 'You may hold up to 3 separate contest entries. Each is tracked independently.' },
    { icon: Shield, title: 'One Pick Per Round Per Entry', desc: 'Select one team to win each round. If that team loses, the entry is eliminated.' },
    { icon: XCircle, title: 'One Strike Rule', desc: 'A single wrong pick ends that entry. No second chances.' },
    { icon: CheckCircle, title: 'No Team Reuse', desc: 'Once you pick a team on a given entry, you cannot pick them again on that same entry.' },
    { icon: Trophy, title: 'Last Entry Standing', desc: 'The entry that survives the most rounds wins. Tiebreakers: most correct picks, then earliest entry.' },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Info className="w-4 h-4" style={{ color: '#A0A0B0' }} />
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#6B6B80' }}>Contest Rules</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {rules.map((rule) => {
          const Icon = rule.icon
          return (
            <div key={rule.title} className="flex gap-3">
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#00FFA3' }} />
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: '#E6E6FA' }}>{rule.title}</div>
                <div className="text-[11px]" style={{ color: '#6B6B80' }}>{rule.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4" style={{ color: '#F59E0B' }} />
          <span className="text-xs font-bold" style={{ color: '#F59E0B' }}>Prize Structure</span>
        </div>
        <div className="space-y-1.5 text-xs" style={{ color: '#A0A0B0' }}>
          <p><span className="font-semibold" style={{ color: '#FFD700' }}>Perfect Survivor:</span> If any entry never loses through the tournament, it wins 100% of the prize pool.</p>
          <p><span className="font-semibold" style={{ color: '#E6E6FA' }}>If no perfect survivor:</span></p>
          <p className="pl-3">&middot; 1st place &mdash; 50% of prize pool</p>
          <p className="pl-3">&middot; 2nd place &mdash; 25% of prize pool</p>
          <p className="pl-3">&middot; QuantEdge retains &mdash; 25%</p>
          <p className="mt-2 text-[10px]" style={{ color: '#4A4A60' }}>Prizes awarded at tournament conclusion.</p>
        </div>
      </div>
    </div>
  )
}
