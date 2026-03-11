'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Trophy, Users, Shield, Crown, CheckCircle, XCircle, Clock,
  ChevronRight, Star, Medal, Zap, Info, DollarSign, Ticket,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  isTestMode?: boolean
  testBracketData?: unknown
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDollars(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

function RoundLabel(round: number): string {
  const labels: Record<number, string> = {
    1: 'Round of 64', 2: 'Round of 32', 3: 'Sweet 16',
    4: 'Elite Eight', 5: 'Final Four', 6: 'Championship',
  }
  return labels[round] ?? `Round ${round}`
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
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4" style={{ color: '#F59E0B' }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F59E0B' }}>Live Prize Pool</span>
      </div>

      {/* Big number */}
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

      {/* Prize breakdown */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-3.5 h-3.5" style={{ color: '#FFD700' }} />
            <span className="text-xs font-semibold" style={{ color: '#E6E6FA' }}>Perfect Survivor</span>
          </div>
          <span className="text-xs font-bold" style={{ color: '#FFD700' }}>Wins 100% — {fmtDollars(prizePool.perfectSurvivorPotCents)}</span>
        </div>
        <div className="border-t pt-2 space-y-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#4A4A60' }}>If no perfect survivor:</p>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#A0A0B0' }}>1st Place</span>
            <span className="text-xs font-bold" style={{ color: '#E6E6FA' }}>50% — {fmtDollars(prizePool.firstPlaceCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#A0A0B0' }}>2nd Place</span>
            <span className="text-xs font-bold" style={{ color: '#E6E6FA' }}>25% — {fmtDollars(prizePool.secondPlaceCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#4A4A60' }}>QuantEdge Retained</span>
            <span className="text-xs" style={{ color: '#4A4A60' }}>25% — {fmtDollars(prizePool.retainedCents)}</span>
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

      {/* Quantity selector */}
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

      {/* Coming Soon purchase button */}
      <div className="flex items-center gap-3">
        <Button
          disabled
          className="font-semibold text-sm border-0 cursor-not-allowed opacity-60"
          style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}
        >
          Purchase {quantity} {quantity === 1 ? 'Entry' : 'Entries'} — ${quantity * ENTRY_PRICE}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
          Payments coming soon
        </span>
      </div>

      <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: '#4A4A60' }}>
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        ${ENTRY_PRICE} per entry · Max {MAX_ENTRIES} entries per user · One-time purchase
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

  const [data, setData] = useState<OfficialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'my-entries' | 'rules'>('leaderboard')
  const [enteredView, setEnteredView] = useState(false)

  const bracketLive = new Date() >= BRACKET_RELEASE || (data?.bracketLive === true)
  // Use isTestMode from API (includes test entries in myEntries for preview)
  const isTestMode = data?.isTestMode === true

  // Determine if user can enter pool:
  // 1. Has real entries (myEntryCount > 0)
  // 2. OR test mode is enabled (admin preview)
  const hasEntries = (data?.myEntryCount ?? 0) > 0
  const canEnterPool = hasEntries || isTestMode

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

  // Switch to My Entries tab after successful purchase
  useEffect(() => {
    if (entrySuccess) setActiveTab('my-entries')
  }, [entrySuccess])

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

  // Pre-bracket gate - but show Enter Pool button if user has entries or test mode
  if (!bracketLive) {
    return (
      <div className="px-4 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
        <PageHeader totalEntrants={data?.totalEntrants ?? 0} currentRound={1} />
        {/* Show prize pool even pre-bracket if we have data */}
        {data && <PrizePoolWidget prizePool={data.prizePool} totalEntrants={data.totalEntrants} />}

        {/* Test mode banner */}
        {isTestMode && (
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <Shield className="w-4 h-4 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <p className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
              TEST MODE — You are previewing the contest as admin. This does not affect live contest data.
            </p>
          </div>
        )}

        {/* Enter Pool button - show if user has entries or test mode */}
        {canEnterPool && (
          <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(0,255,163,0.06)', border: '1px solid rgba(0,255,163,0.2)' }}>
            <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: '#00FFA3' }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: '#E6E6FA' }}>
              {isTestMode ? 'Preview: Enter Pool' : 'Ready to Play'}
            </h2>
            <p className="text-sm max-w-md mx-auto mb-4" style={{ color: '#A0A0B0' }}>
              {isTestMode
                ? 'You are viewing the contest as an admin preview. This is for testing only.'
                : 'Your entry is confirmed! Enter the pool to make your picks.'}
            </p>
            <Button
              onClick={() => setEnteredView(true)}
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
                The contest opens on Selection Sunday, March 16, 2026. Entries will be accepted then.
                The prize pool is live — it grows with every entry purchased.
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

  const { pool, myEntries, myEntryCount, canPurchaseMore, remainingSlots, leaderboard, currentRound, totalEntrants, prizePool } = data

  // If bracket is not live and user hasn't entered (or no test mode), show pre-entry view
  // But if they have entries or test mode, they can enter via Enter Pool button
  // Once enteredView is true, show the full entered experience
  if (!bracketLive && !enteredView) {
    // This is handled above in the pre-bracket gate
  }

  // Show entered experience if:
  // 1. bracketLive is true (tournament started), OR
  // 2. user clicked Enter Pool (enteredView = true)
  const showEnteredExperience = bracketLive || enteredView

  // If bracket hasn't started, user hasn't entered, and no test mode - show purchase prompt
  if (!showEnteredExperience) {
    return (
      <div className="px-4 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
        <PageHeader totalEntrants={data.totalEntrants} currentRound={1} />
        <PrizePoolWidget prizePool={data.prizePool} totalEntrants={data.totalEntrants} />
        <div className="rounded-2xl p-10 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Clock className="w-12 h-12 mx-auto mb-4" style={{ color: '#F59E0B' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: '#E6E6FA' }}>Bracket Releases March 16</h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: '#A0A0B0' }}>
            The contest opens on Selection Sunday, March 16, 2026. Entries will be accepted then.
            The prize pool is live — it grows with every entry purchased.
          </p>
        </div>
        <div className="rounded-2xl p-6" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
          <RulesSection />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-8 py-8 max-w-5xl mx-auto space-y-5">

      {/* Entry success banner */}
      {entrySuccess && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)' }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#00FFA3' }} />
          <p className="text-sm font-semibold" style={{ color: '#00FFA3' }}>
            Entry confirmed! Make your picks below to join the contest.
          </p>
        </div>
      )}

      {/* Test mode banner */}
      {isTestMode && (
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Shield className="w-4 h-4 flex-shrink-0" style={{ color: '#F59E0B' }} />
          <p className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
            TEST MODE — You are previewing as admin. Regular users see the countdown.
          </p>
        </div>
      )}

      {/* Header */}
      <PageHeader totalEntrants={totalEntrants} currentRound={currentRound} />

      {/* Live Prize Pool */}
      <PrizePoolWidget prizePool={prizePool} totalEntrants={totalEntrants} />

      {/* Purchase / entry limit banner */}
      <PurchaseBanner myEntryCount={myEntryCount} remainingSlots={remainingSlots} poolActive={pool.is_active} />

      {/* My active entries summary (if any) */}
      {myEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {myEntries.map((entry) => (
            <MyEntryCard key={entry.entryId} entry={entry} />
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {(['leaderboard', 'my-entries', 'rules'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all"
            style={activeTab === tab
              ? { background: 'rgba(0,255,163,0.12)', color: '#00FFA3' }
              : { color: '#6B6B80' }
            }
          >
            {tab === 'my-entries' ? 'My Entries' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'leaderboard' && (
        <LeaderboardTab rows={leaderboard} currentRound={currentRound} />
      )}
      {activeTab === 'my-entries' && (
        <MyEntriesTab
          myEntries={myEntries}
          currentRound={currentRound}
          poolActive={pool.is_active}
          onPickSubmitted={fetchData}
          canPurchaseMore={canPurchaseMore}
          remainingSlots={remainingSlots}
          myEntryCount={myEntryCount}
        />
      )}
      {activeTab === 'rules' && (
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
          Public survivor contest — up to {MAX_ENTRIES} entries per user at ${ENTRY_PRICE} each. Last one standing wins.
        </p>
      </div>
      <div className="flex gap-5 text-right flex-shrink-0">
        <div>
          <div className="text-lg font-bold" style={{ color: '#00FFA3' }}>{totalEntrants}</div>
          <div className="text-[11px]" style={{ color: '#6B6B80' }}>Total Entries</div>
        </div>
        <div>
          <div className="text-lg font-bold" style={{ color: '#E6E6FA' }}>{RoundLabel(currentRound)}</div>
          <div className="text-[11px]" style={{ color: '#6B6B80' }}>Current Round</div>
        </div>
      </div>
    </div>
  )
}

// ─── My Entry Card (summary) ───────────────────────────────────────────────

function MyEntryCard({ entry }: { entry: LeaderboardRow }) {
  const alive = entry.status === 'alive'
  return (
    <div className="rounded-xl p-4" style={{
      background: alive ? 'rgba(0,255,163,0.05)' : 'rgba(239,68,68,0.05)',
      border: `1px solid ${alive ? 'rgba(0,255,163,0.15)' : 'rgba(239,68,68,0.15)'}`,
    }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Ticket className="w-3.5 h-3.5" style={{ color: alive ? '#00FFA3' : '#F87171' }} />
          <span className="text-xs font-bold" style={{ color: '#E6E6FA' }}>Entry #{entry.entryNumber}</span>
        </div>
        <StatusBadge status={entry.status} />
      </div>
      <div className="flex gap-3 text-center">
        <div>
          <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{entry.roundsSurvived}</div>
          <div className="text-[10px]" style={{ color: '#6B6B80' }}>Rounds</div>
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{entry.picksCorrect}</div>
          <div className="text-[10px]" style={{ color: '#6B6B80' }}>Correct</div>
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>#{entry.rank}</div>
          <div className="text-[10px]" style={{ color: '#6B6B80' }}>Rank</div>
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
        <p className="text-sm font-medium" style={{ color: '#A0A0B0' }}>No entries yet — be the first to join!</p>
      </div>
    )
  }

  const alive = rows.filter((r) => r.status === 'alive').length
  const eliminated = rows.filter((r) => r.status === 'eliminated').length

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B6B80' }}>
          Leaderboard — {RoundLabel(currentRound)}
        </span>
        <span className="text-xs" style={{ color: '#6B6B80' }}>
          {alive} alive · {eliminated} out
        </span>
      </div>

      {/* Column headers */}
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
                  ? row.roundsSurvived > 0 ? ` · Through ${RoundLabel(row.roundsSurvived)}` : ''
                  : ` · Eliminated R${row.roundsSurvived + 1}`
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

// ─── My Entries Tab ────────────────────────────────────────────────────────

function MyEntriesTab({
  myEntries,
  currentRound,
  poolActive,
  onPickSubmitted,
  canPurchaseMore,
  remainingSlots,
  myEntryCount,
}: {
  myEntries: LeaderboardRow[]
  currentRound: number
  poolActive: boolean
  onPickSubmitted: () => void
  canPurchaseMore: boolean
  remainingSlots: number
  myEntryCount: number
}) {
  if (myEntries.length === 0) {
    return (
      <div className="rounded-2xl p-10 text-center" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Ticket className="w-10 h-10 mx-auto mb-3" style={{ color: '#4A4A60' }} />
        <p className="text-sm font-semibold mb-1" style={{ color: '#E6E6FA' }}>No entries yet</p>
        <p className="text-xs mb-4" style={{ color: '#A0A0B0' }}>
          Purchase 1–{MAX_ENTRIES} entries above at ${ENTRY_PRICE} each to join the contest.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {myEntries.map((entry) => (
        <EntryPickPanel
          key={entry.entryId}
          entry={entry}
          currentRound={currentRound}
          poolActive={poolActive}
          onPickSubmitted={onPickSubmitted}
        />
      ))}
    </div>
  )
}

// ─── Pick Panel per entry ──────────────────────────────────────────────────

function EntryPickPanel({
  entry,
  currentRound,
  poolActive,
  onPickSubmitted,
}: {
  entry: LeaderboardRow
  currentRound: number
  poolActive: boolean
  onPickSubmitted: () => void
}) {
  const [teamName, setTeamName] = useState('')
  const [teamSeed, setTeamSeed] = useState('')
  const [opponentName, setOpponentName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const alive = entry.status === 'alive'
  const canPick = alive && poolActive

  const handleSubmit = async () => {
    if (!teamName.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)
    try {
      const res = await fetch('/api/survivor/official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entry.entryId,
          round_number: currentRound,
          team_name: teamName.trim(),
          team_seed: teamSeed ? parseInt(teamSeed, 10) : null,
          opponent_name: opponentName.trim() || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setSubmitError(body.error ?? 'Failed to submit pick')
      } else {
        setSubmitSuccess(true)
        setTeamName('')
        setTeamSeed('')
        setOpponentName('')
        onPickSubmitted()
      }
    } catch {
      setSubmitError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#12122A', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Entry header */}
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <Ticket className="w-3.5 h-3.5" style={{ color: alive ? '#00FFA3' : '#F87171' }} />
          <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>Entry #{entry.entryNumber}</span>
          <span className="text-xs" style={{ color: '#6B6B80' }}>Rank #{entry.rank}</span>
        </div>
        <StatusBadge status={entry.status} />
      </div>

      {/* Pick history */}
      {entry.picks.length > 0 && (
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {entry.picks.slice().sort((a, b) => a.round_number - b.round_number).map((pick) => (
            <div key={pick.id} className="px-5 py-3 flex items-center gap-4">
              <div className="w-16 flex-shrink-0">
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
      )}

      {/* Submit pick */}
      {canPick && (
        <div className="px-5 py-4 border-t space-y-3" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,255,163,0.02)' }}>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" style={{ color: '#00FFA3' }} />
            <span className="text-xs font-bold" style={{ color: '#E6E6FA' }}>
              {RoundLabel(currentRound)} Pick
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team name *"
              className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E6E6FA' }}
            />
            <input
              type="number"
              min="1"
              max="16"
              value={teamSeed}
              onChange={(e) => setTeamSeed(e.target.value)}
              placeholder="Seed"
              className="w-20 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E6E6FA' }}
            />
            <input
              type="text"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="Opponent (optional)"
              className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E6E6FA' }}
            />
          </div>
          {submitError && <p className="text-xs" style={{ color: '#F87171' }}>{submitError}</p>}
          {submitSuccess && <p className="text-xs" style={{ color: '#00FFA3' }}>Pick locked in!</p>}
          <Button
            className="gradient-green text-black font-semibold border-0 hover:opacity-90 text-sm neon-glow"
            onClick={handleSubmit}
            disabled={submitting || !teamName.trim()}
          >
            {submitting ? 'Locking in...' : 'Lock In Pick'}
          </Button>
        </div>
      )}

      {/* Eliminated message */}
      {!alive && (
        <div className="px-5 py-4 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-xs" style={{ color: '#6B6B80' }}>
            This entry was eliminated after Round {entry.roundsSurvived}. {entry.roundsSurvived} correct pick{entry.roundsSurvived !== 1 ? 's' : ''}.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Rules Section ─────────────────────────────────────────────────────────

function RulesSection() {
  const rules = [
    { icon: Ticket, title: `$${ENTRY_PRICE} Per Entry`, desc: `Any logged-in user may purchase 1–${MAX_ENTRIES} entries at $${ENTRY_PRICE} each. Each entry competes independently on the leaderboard.` },
    { icon: Users, title: `Max ${MAX_ENTRIES} Entries Per User`, desc: 'You may hold up to 3 separate contest entries. Each entry is tracked and ranked independently.' },
    { icon: Shield, title: 'One Pick Per Round Per Entry', desc: 'Select one team to win for each of your entries each round. If that team loses, the entry is eliminated.' },
    { icon: XCircle, title: 'One Strike Rule', desc: 'A single wrong pick ends that entry. No second chances.' },
    { icon: CheckCircle, title: 'No Team Reuse', desc: 'Once you pick a team on a given entry, you cannot pick them again on that same entry.' },
    { icon: Trophy, title: 'Last Entry Standing', desc: 'The entry that survives the most rounds wins. Tiebreakers: most correct picks, then earliest entry purchase.' },
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

      {/* Prize structure */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4" style={{ color: '#F59E0B' }} />
          <span className="text-xs font-bold" style={{ color: '#F59E0B' }}>Prize Structure</span>
        </div>
        <div className="space-y-1.5 text-xs" style={{ color: '#A0A0B0' }}>
          <p><span className="font-semibold" style={{ color: '#FFD700' }}>Perfect Survivor:</span> If any entry never loses a pick through the entire tournament, it wins 100% of the prize pool.</p>
          <p><span className="font-semibold" style={{ color: '#E6E6FA' }}>If no perfect survivor:</span></p>
          <p className="pl-3">· 1st place — 50% of prize pool</p>
          <p className="pl-3">· 2nd place — 25% of prize pool</p>
          <p className="pl-3">· QuantEdge retains — 25%</p>
          <p className="mt-2 text-[10px]" style={{ color: '#4A4A60' }}>Prizes awarded at tournament conclusion. Prize pool grows with every entry purchased.</p>
        </div>
      </div>
    </div>
  )
}
