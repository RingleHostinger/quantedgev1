'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Clock } from 'lucide-react'

interface DataStatus {
  oddsUpdatedAt: string | null
  predictionsGeneratedAt: string | null
  lastPickGradeAt: string | null
  gamesInSlate: number
  slateStart: string
  slateEnd: string
  nextRefreshInMinutes: number | null
}

const POLL_INTERVAL_MS = 3 * 60 * 1000 // re-fetch every 3 minutes

function formatAge(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

function Dot({ stale }: { stale: boolean }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ background: stale ? '#F59E0B' : '#00FFA3' }}
    />
  )
}

function StatusRow({
  label,
  time,
  age,
  stale,
  tick,
}: {
  label: string
  time: string | null
  age: string | null
  stale: boolean
  tick: number
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Dot stale={stale} />
          <span className="text-xs font-semibold" style={{ color: '#E6E6FA' }}>{label}</span>
        </div>
        <div className="text-[11px] pl-3" style={{ color: '#6B6B80' }}>
          {formatTime(time)}
        </div>
      </div>
      <span
        className="text-[11px] font-medium mt-0.5 flex-shrink-0"
        style={{ color: stale ? '#F59E0B' : '#A0A0B0' }}
      >
        {tick >= 0 && formatAge(age)}
      </span>
    </div>
  )
}

export function DataFreshnessIndicator() {
  const [status, setStatus] = useState<DataStatus | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [tick, setTick] = useState(0) // forces age labels to re-render every minute

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/data-status')
      if (res.ok) setStatus(await res.json())
    } catch {
      // silent — indicator just won't show
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const poll = setInterval(fetchStatus, POLL_INTERVAL_MS)
    return () => clearInterval(poll)
  }, [fetchStatus])

  // Tick every minute so relative timestamps stay fresh
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  if (!status) return null

  const oddsStale =
    status.oddsUpdatedAt == null ||
    (Date.now() - new Date(status.oddsUpdatedAt).getTime()) > 70 * 60 * 1000 // > 70 min

  const predsStale =
    status.predictionsGeneratedAt == null ||
    (Date.now() - new Date(status.predictionsGeneratedAt).getTime()) > 12 * 60 * 60 * 1000 // > 12 h

  const anyStale = oddsStale || predsStale

  // Collapsed pill
  const pill = (
    <button
      onClick={() => setExpanded(v => !v)}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80"
      style={{
        background: anyStale ? 'rgba(245,158,11,0.1)' : 'rgba(0,255,163,0.08)',
        border: `1px solid ${anyStale ? 'rgba(245,158,11,0.25)' : 'rgba(0,255,163,0.18)'}`,
        color: anyStale ? '#F59E0B' : '#00FFA3',
      }}
      title="Data freshness"
    >
      <Clock className="w-3 h-3 flex-shrink-0" />
      <span className="hidden sm:inline">
        {anyStale ? 'Data may be stale' : 'Data live'}
      </span>
      <Dot stale={anyStale} />
    </button>
  )

  // Expanded dropdown
  const dropdown = expanded && (
    <div
      className="absolute right-0 top-full mt-2 w-72 rounded-2xl z-50 overflow-hidden shadow-2xl"
      style={{
        background: '#12122A',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6B6B80' }}>
          Data Status
        </span>
        <RefreshCw
          className="w-3 h-3 cursor-pointer hover:opacity-70 transition-opacity"
          style={{ color: '#6B6B80' }}
          onClick={(e) => { e.stopPropagation(); fetchStatus() }}
        />
      </div>

      {/* Rows */}
      <div className="px-4 py-3 space-y-3">
        {/* Odds */}
        <StatusRow
          label="Odds Updated"
          time={status.oddsUpdatedAt}
          age={status.oddsUpdatedAt}
          stale={oddsStale}
          tick={tick}
        />

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

        {/* Predictions */}
        <StatusRow
          label="Predictions Generated"
          time={status.predictionsGeneratedAt}
          age={status.predictionsGeneratedAt}
          stale={predsStale}
          tick={tick}
        />

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

        {/* Active Slate */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Dot stale={status.gamesInSlate === 0} />
              <span className="text-xs font-semibold" style={{ color: '#E6E6FA' }}>Active Slate</span>
            </div>
            <div className="text-[11px] pl-3" style={{ color: '#6B6B80' }}>
              {new Date(status.slateStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} EST window
            </div>
          </div>
          <span
            className="text-[11px] font-medium mt-0.5 flex-shrink-0"
            style={{ color: status.gamesInSlate > 0 ? '#A0A0B0' : '#F59E0B' }}
          >
            {status.gamesInSlate} games
          </span>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

        {/* Last Pick Grade */}
        <StatusRow
          label="Last Pick Grade"
          time={status.lastPickGradeAt}
          age={status.lastPickGradeAt}
          stale={status.lastPickGradeAt == null}
          tick={tick}
        />

        {/* Next refresh */}
        {status.nextRefreshInMinutes != null && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: '#6B6B80' }}>Next Odds Refresh</span>
              <span className="text-[11px] font-semibold" style={{ color: '#A0A0B0' }}>
                {status.nextRefreshInMinutes === 0
                  ? 'Any moment'
                  : `~${status.nextRefreshInMinutes}m`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="relative">
      {pill}
      {dropdown}
      {/* Click-outside close */}
      {expanded && (
        <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
      )}
    </div>
  )
}
