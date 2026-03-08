'use client'

import { useEffect, useState, useCallback } from 'react'
import { Cpu, Play, RefreshCw, CheckCircle, XCircle, AlertTriangle, Zap, Database, Activity, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────

interface DataSource {
  name: string
  connected: boolean
  envVar: string
}

interface EngineStatus {
  engineVersion: string
  status: string
  usingMockData: boolean
  lastRun: {
    runAt: string
    gamesProcessed: number
    predictionsGenerated: number
    predictionsUpdated: number
    runStatus: string
  } | null
  totalPredictions: number
  scheduledGames: number
  pendingGames: number
  leagueCounts: Record<string, number>
  dataSources: Record<string, DataSource>
  supportedLeagues: string[]
}

interface RunLog {
  id: string
  run_at: string
  games_processed: number
  predictions_generated: number
  predictions_updated: number
  status: string
  error_message: string | null
  engine_version: string
}

interface RunResult {
  success: boolean
  gamesProcessed: number
  predictionsGenerated: number
  predictionsUpdated: number
  errors: { gameId: string; error: string }[]
  durationMs: number
  engineVersion: string
}

const LEAGUE_COLORS: Record<string, string> = {
  NBA: '#F97316', NFL: '#3B82F6', MLB: '#EF4444',
  NHL: '#A78BFA', NCAAB: '#F59E0B', EPL: '#00FFA3', UCL: '#06B6D4',
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function EnginePage() {
  const [status, setStatus] = useState<EngineStatus | null>(null)
  const [logs, setLogs] = useState<RunLog[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<RunResult | null>(null)
  const [selectedLeague, setSelectedLeague] = useState<string>('all')
  const [forceRefresh, setForceRefresh] = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    const [statusRes, logsRes] = await Promise.all([
      fetch('/api/engine/status'),
      fetch('/api/engine/run'),
    ])
    if (statusRes.ok) setStatus(await statusRes.json())
    if (logsRes.ok) {
      const data = await logsRes.json()
      setLogs(data.runs || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const handleRun = async () => {
    setRunning(true)
    setLastResult(null)
    try {
      const res = await fetch('/api/engine/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league: selectedLeague !== 'all' ? selectedLeague : undefined,
          forceRefresh,
        }),
      })
      const data = await res.json()
      setLastResult(data)
      await loadStatus()
    } finally {
      setRunning(false)
    }
  }

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Cpu className="w-5 h-5" style={{ color: '#00FFA3' }} />
        <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Prediction Engine</h1>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="rounded-2xl h-28 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
    </div>
  )

  const leagues = ['all', ...(status?.supportedLeagues || [])]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="w-5 h-5" style={{ color: '#00FFA3' }} />
          <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>QuantEdge AI Prediction Engine</h1>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full ml-1"
            style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.25)' }}>
            {status?.engineVersion || 'v1.0'}
          </span>
        </div>
        <p className="text-sm" style={{ color: '#A0A0B0' }}>
          Run the AI model to generate predictions, spreads, totals, and edge calculations for all scheduled games.
        </p>
      </div>

      {/* Status overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Engine Status', value: status?.status === 'operational' ? 'Operational' : 'Offline', icon: Activity, color: '#00FFA3' },
          { label: 'Total Predictions', value: status?.totalPredictions?.toString() || '0', icon: Database, color: '#06B6D4' },
          { label: 'Scheduled Games', value: status?.scheduledGames?.toString() || '0', icon: Clock, color: '#F59E0B' },
          { label: 'Pending Run', value: status?.pendingGames?.toString() || '0', icon: Zap, color: status?.pendingGames ? '#FF6B6B' : '#A0A0B0' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Icon className="w-4 h-4 mb-2" style={{ color }} />
            <div className="text-xl font-black" style={{ color }}>{value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Mock data warning */}
      {status?.usingMockData && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl"
          style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
          <div>
            <div className="text-sm font-bold mb-1" style={{ color: '#F59E0B' }}>Running on Mock Data</div>
            <p className="text-xs" style={{ color: '#A0A0B0' }}>
              No real sports data APIs are connected. Predictions are generated using a deterministic mock model.
              Connect a real API by adding the environment variables below to enable live data.
            </p>
          </div>
        </div>
      )}

      {/* Run engine panel */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,255,163,0.18)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4" style={{ color: '#00FFA3' }} />
            <h3 className="font-black text-base" style={{ color: '#E6E6FA' }}>Run Prediction Engine</h3>
          </div>
          <p className="text-xs mt-1" style={{ color: '#6B6B80' }}>
            Generates AI scores, spreads, totals, edges, and reasoning for all scheduled games.
            Games with fresh predictions (under 1 hour old) are skipped unless force refresh is on.
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* League filter */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6B6B80' }}>League Filter</div>
            <div className="flex flex-wrap gap-2">
              {leagues.map((l) => (
                <button key={l} onClick={() => setSelectedLeague(l)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: selectedLeague === l ? (l === 'all' ? 'rgba(0,255,163,0.12)' : `${LEAGUE_COLORS[l] || '#A0A0B0'}18`) : 'rgba(255,255,255,0.04)',
                    color: selectedLeague === l ? (l === 'all' ? '#00FFA3' : (LEAGUE_COLORS[l] || '#E6E6FA')) : '#A0A0B0',
                    border: selectedLeague === l ? `1px solid ${l === 'all' ? 'rgba(0,255,163,0.3)' : (LEAGUE_COLORS[l] || '#A0A0B0') + '40'}` : '1px solid rgba(255,255,255,0.07)',
                  }}>
                  {l === 'all' ? 'All Leagues' : l}
                </button>
              ))}
            </div>
          </div>

          {/* Force refresh toggle */}
          <div className="flex items-center gap-3">
            <button onClick={() => setForceRefresh(!forceRefresh)}
              className="flex items-center gap-2 text-sm"
              style={{ color: forceRefresh ? '#00FFA3' : '#A0A0B0' }}>
              <div className="w-8 h-4 rounded-full relative transition-colors"
                style={{ background: forceRefresh ? '#00FFA3' : 'rgba(255,255,255,0.12)' }}>
                <div className="w-3 h-3 bg-black rounded-full absolute top-0.5 transition-all"
                  style={{ left: forceRefresh ? '17px' : '2px' }} />
              </div>
              Force refresh (re-run recent predictions)
            </button>
          </div>

          {/* Run button */}
          <Button onClick={handleRun} disabled={running}
            className="gradient-green text-black font-black px-8 py-4 rounded-xl border-0 hover:opacity-90 neon-glow">
            {running
              ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Running Engine...</>
              : <><Play className="w-4 h-4 mr-2" />Run Prediction Engine</>}
          </Button>
        </div>

        {/* Last run result */}
        {lastResult && (
          <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-2 mb-3">
              {lastResult.success
                ? <CheckCircle className="w-4 h-4" style={{ color: '#00FFA3' }} />
                : <XCircle className="w-4 h-4" style={{ color: '#FF6B6B' }} />}
              <span className="text-sm font-bold" style={{ color: lastResult.success ? '#00FFA3' : '#FF6B6B' }}>
                {lastResult.success ? 'Engine run complete' : 'Engine run completed with errors'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Games Processed', value: lastResult.gamesProcessed },
                { label: 'New Predictions', value: lastResult.predictionsGenerated },
                { label: 'Updated', value: lastResult.predictionsUpdated },
                { label: 'Duration', value: `${lastResult.durationMs}ms` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3 text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-lg font-black" style={{ color: '#E6E6FA' }}>{value}</div>
                  <div className="text-xs" style={{ color: '#6B6B80' }}>{label}</div>
                </div>
              ))}
            </div>
            {lastResult.errors.length > 0 && (
              <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.15)' }}>
                <div className="text-xs font-bold mb-1" style={{ color: '#FF6B6B' }}>{lastResult.errors.length} error(s)</div>
                {lastResult.errors.slice(0, 3).map((e) => (
                  <div key={e.gameId} className="text-xs" style={{ color: '#A0A0B0' }}>{e.gameId}: {e.error}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data sources panel */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4" style={{ color: '#06B6D4' }} />
            <h3 className="font-black text-base" style={{ color: '#E6E6FA' }}>Data Sources</h3>
          </div>
          <p className="text-xs mt-1" style={{ color: '#6B6B80' }}>
            Connect real sports APIs to replace mock data. Set the environment variable for each provider to activate it.
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {status && Object.entries(status.dataSources).map(([key, ds]) => (
            <div key={key} className="px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{ds.name}</div>
                <div className="text-xs mt-0.5 font-mono" style={{ color: '#6B6B80' }}>
                  {ds.envVar}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {ds.connected ? (
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(0,255,163,0.12)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.25)' }}>
                    Connected
                  </span>
                ) : (
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}>
                    Not connected
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs" style={{ color: '#4A4A60' }}>
            Add env vars to .env.local to connect real APIs. The engine will use real data automatically once connected.
          </p>
        </div>
      </div>

      {/* League counts */}
      {status && Object.keys(status.leagueCounts).length > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6B6B80' }}>
            Scheduled Games by League
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(status.leagueCounts).map(([league, count]) => (
              <div key={league} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: `${LEAGUE_COLORS[league] || '#A0A0B0'}10`, border: `1px solid ${LEAGUE_COLORS[league] || '#A0A0B0'}25` }}>
                <span className="text-xs font-bold" style={{ color: LEAGUE_COLORS[league] || '#E6E6FA' }}>{league}</span>
                <span className="text-xs font-black" style={{ color: '#E6E6FA' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engine run history */}
      {logs.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: '#A0A0B0' }} />
              <h3 className="font-black text-base" style={{ color: '#E6E6FA' }}>Run History</h3>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {logs.map((log) => (
              <div key={log.id}>
                <button
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="w-full px-5 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0`}
                    style={{ background: log.status === 'completed' ? '#00FFA3' : log.status === 'partial' ? '#F59E0B' : '#FF6B6B' }} />
                  <div className="flex-1">
                    <div className="text-xs font-bold" style={{ color: '#E6E6FA' }}>
                      {new Date(log.run_at).toLocaleString()}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>
                      {log.games_processed} games · {log.predictions_generated} new · {log.predictions_updated} updated
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: log.status === 'completed' ? 'rgba(0,255,163,0.1)' : 'rgba(245,158,11,0.1)',
                      color: log.status === 'completed' ? '#00FFA3' : '#F59E0B',
                    }}>
                    {log.status}
                  </span>
                  {expandedLog === log.id ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#6B6B80' }} /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#6B6B80' }} />}
                </button>
                {expandedLog === log.id && (
                  <div className="px-5 pb-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-xs font-mono" style={{ color: '#A0A0B0' }}>
                      Engine: {log.engine_version}<br />
                      {log.error_message && <span style={{ color: '#FF6B6B' }}>Errors: {log.error_message}</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model architecture reference */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6B6B80' }}>
          Model Architecture — v1.0
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-xs" style={{ color: '#A0A0B0' }}>
          <div>
            <div className="font-bold mb-2" style={{ color: '#E6E6FA' }}>Confidence Factors</div>
            <ul className="space-y-1">
              {['Offensive / defensive efficiency', 'Recent form (last 5 games)', 'Home vs away performance', 'Head-to-head record', 'Injury impact', 'Rest days advantage', 'Pace of play', 'Strength of schedule'].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-bold mb-2" style={{ color: '#E6E6FA' }}>Edge Thresholds</div>
            <div className="space-y-2">
              {[
                { tier: 'Strong Edge', range: '> 5 pts', color: '#00FFA3' },
                { tier: 'Moderate Edge', range: '3–5 pts', color: '#F59E0B' },
                { tier: 'Lean', range: '1–3 pts', color: '#A0A0B0' },
              ].map(({ tier, range, color }) => (
                <div key={tier} className="flex items-center justify-between">
                  <span className="font-bold" style={{ color }}>{tier}</span>
                  <span>{range}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 font-bold mb-2" style={{ color: '#E6E6FA' }}>Confidence Tiers</div>
            <div className="space-y-2">
              {[
                { tier: 'High', range: '80–100%', color: '#00FFA3' },
                { tier: 'Medium', range: '65–79%', color: '#F59E0B' },
                { tier: 'Low', range: '< 65%', color: '#A0A0B0' },
              ].map(({ tier, range, color }) => (
                <div key={tier} className="flex items-center justify-between">
                  <span className="font-bold" style={{ color }}>{tier}</span>
                  <span>{range}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#4A4A60' }}>
          Predictions are cached in the database. The engine skips games with fresh predictions (under 1 hour).
          Connect real data APIs to improve model accuracy beyond the mock provider.
        </div>
      </div>

      {/* Back to admin */}
      <div>
        <Link href="/dashboard/admin">
          <button className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: '#6B6B80' }}>
            ← Back to Admin Panel
          </button>
        </Link>
      </div>
    </div>
  )
}
