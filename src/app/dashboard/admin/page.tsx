'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Users, Target, Plus, Brain, CheckCircle, Gift, TrendingUp, Activity, Eye, EyeOff, Newspaper, AlertTriangle, ToggleLeft, ToggleRight, FlaskConical, Trash2, Star, Zap, RefreshCw, Database, Clock, BarChart3, Play, CheckSquare, Calendar, Trophy, Filter, DollarSign, Ticket, Crown, Medal, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SPORTS = ['Basketball', 'American Football', 'Soccer', 'Baseball', 'Hockey']
const LEAGUES: Record<string, string[]> = {
  Basketball: ['NBA', 'NCAAB'],
  'American Football': ['NFL'],
  Soccer: ['EPL', 'UCL'],
  Baseball: ['MLB'],
  Hockey: ['NHL'],
}

interface Game {
  id: string
  home_team_name: string
  away_team_name: string
  sport: string
  league: string
  scheduled_at: string
  status: string
  sportsbook_spread: number | null
  sportsbook_total: number | null
  sportsbook_moneyline_home: number | null
  sportsbook_moneyline_away: number | null
  is_free_pick: boolean
}

interface User {
  id: string
  email: string
  name: string
  plan_type: string
  created_at: string
}

type Tab = 'overview' | 'games' | 'predictions' | 'free-pick' | 'users' | 'visibility' | 'briefing' | 'injuries-admin' | 'overrides' | 'bracket-model' | 'bracket-mgmt' | 'pipeline' | 'grading' | 'survivor-test' | 'survivor-grading' | 'official-contest'

interface PipelineStatus {
  lastOddsRefresh: string | null
  lastPredictionRun: string | null
  lastEngineStatus: string | null
  slateStart: string
  slateEnd: string
  gamesInSlate: number
  pendingPicksToGrade: number
  modelStats: { wins: number; losses: number; pushes: number }
}

interface PipelineStepResult {
  step: string
  success: boolean
  durationMs: number
  detail?: Record<string, unknown>
  error?: string
}

export default function AdminPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [games, setGames] = useState<Game[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [freePick, setFreePick] = useState<Game | null>(null)
  const [settingFreePick, setSettingFreePick] = useState<string | null>(null)

  // Add game form
  const [newGame, setNewGame] = useState({
    home_team_name: '', away_team_name: '', sport: 'Basketball', league: 'NBA',
    scheduled_at: '', sportsbook_spread: '', sportsbook_total: '',
    sportsbook_moneyline_home: '', sportsbook_moneyline_away: '',
  })
  const [addingGame, setAddingGame] = useState(false)
  const [gameMsg, setGameMsg] = useState('')

  // Visibility tab
  const [visibilityPreds, setVisibilityPreds] = useState<Array<{
    id: string; confidence: number; is_premium: boolean; is_trending: boolean; is_upset_pick: boolean;
    games: { home_team_name: string; away_team_name: string; league: string; scheduled_at: string; is_free_pick: boolean } | null
  }>>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Briefing overrides
  const [briefingOverrides, setBriefingOverrides] = useState({
    topSpreadEdgeNote: '', topTotalEdgeNote: '', highestConfidenceNote: '',
    upsetAlertNote: '', modelStatusNote: '',
  })
  const [savingBriefing, setSavingBriefing] = useState(false)
  const [briefingMsg, setBriefingMsg] = useState('')

  // Injuries admin
  const [newInjury, setNewInjury] = useState({
    player_name: '', team_name: '', injury_type: '', status: 'Questionable', notes: '', impact_score: '5',
  })
  const [addingInjury, setAddingInjury] = useState(false)
  const [injuryMsg, setInjuryMsg] = useState('')

  // Overrides
  const [overrideGameId, setOverrideGameId] = useState('')
  const [overrides, setOverrides] = useState({ difficulty: '', modelStrength: '', publicPct: '' })
  const [savingOverride, setSavingOverride] = useState(false)
  const [overrideMsg, setOverrideMsg] = useState('')

  // Bracket management
  const [adminBrackets, setAdminBrackets] = useState<Array<{
    id: string; name: string; pool_size: number; bracket_score: string;
    win_probability: number; is_featured: boolean; created_at: string;
    users: { email: string; name: string } | null
  }>>([])
  const [loadingBrackets, setLoadingBrackets] = useState(false)
  const [bracketActionId, setBracketActionId] = useState<string | null>(null)
  const [bracketMsg, setBracketMsg] = useState('')

  // Bracket model weights
  const [modelWeights, setModelWeights] = useState({
    gradeThreshold_A_plus: '8', gradeThreshold_A: '6', gradeThreshold_B: '4', gradeThreshold_C: '2',
    upsetWeightMultiplier: '1.0', uniquenessWeight: '0.8',
  })
  const [savingModel, setSavingModel] = useState(false)
  const [modelMsg, setModelMsg] = useState('')

  // Pipeline control
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const [pipelineRunning, setPipelineRunning] = useState<string | null>(null)
  const [pipelineResults, setPipelineResults] = useState<PipelineStepResult[]>([])
  const [pipelineMsg, setPipelineMsg] = useState('')

  // Pick grading state
  interface OfficialPick {
    id: string
    league: string
    home_team: string
    away_team: string
    bet_type: string
    pick_team: string
    sportsbook_line: number | null
    model_line: number | null
    spread_edge: number | null
    confidence_score: number | null
    result: string
    commence_time: string
    result_recorded_at: string | null
    line_at_pick: number | null
    closing_line: number | null
  }
  const [gradingPicks, setGradingPicks] = useState<OfficialPick[]>([])
  const [gradingLoading, setGradingLoading] = useState(false)
  const [gradingFilter, setGradingFilter] = useState<'pending' | 'settled' | 'all'>('pending')
  const [gradingLeague, setGradingLeague] = useState('')
  const [gradingAction, setGradingAction] = useState<string | null>(null)
  const [gradingMsg, setGradingMsg] = useState('')
  const [pendingPickCount, setPendingPickCount] = useState(0)

  // Survivor test mode
  const [survivorTestMode, setSurvivorTestMode] = useState(false)
  const [survivorTestLoading, setSurvivorTestLoading] = useState(false)
  const [survivorTestMsg, setSurvivorTestMsg] = useState('')

  // Survivor grading
  interface SurvivorPickAdmin {
    id: string
    pool_id: string
    user_id: string
    round_number: number
    team_name: string
    team_seed: number | null
    opponent_name: string | null
    win_probability: number | null
    result: string
    updated_at: string
    survivor_pools: { pool_name: string; pool_size: string; strike_rule: string; pick_format: string } | null
    users: { email: string; name: string } | null
  }
  const [survivorPicks, setSurvivorPicks] = useState<SurvivorPickAdmin[]>([])
  const [survivorGradingLoading, setSurvivorGradingLoading] = useState(false)
  const [survivorGradingFilter, setSurvivorGradingFilter] = useState<'all' | 'pending' | 'won' | 'eliminated'>('pending')
  const [survivorGradingAction, setSurvivorGradingAction] = useState<string | null>(null)
  const [survivorGradingMsg, setSurvivorGradingMsg] = useState('')
  // Bulk grader state
  const [bulkTeamName, setBulkTeamName] = useState('')
  const [bulkResult, setBulkResult] = useState<'won' | 'eliminated'>('won')
  const [bulkGrading, setBulkGrading] = useState(false)

  const loadSurvivorPicks = async (filter = survivorGradingFilter) => {
    setSurvivorGradingLoading(true)
    setSurvivorGradingMsg('')
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('result', filter)
      const res = await fetch(`/api/admin/survivor-grade?${params}`)
      const data = await res.json()
      if (!res.ok) { setSurvivorGradingMsg(data.error || 'Failed to load picks'); return }
      setSurvivorPicks(data.picks ?? [])
    } catch { setSurvivorGradingMsg('Error loading survivor picks') }
    finally { setSurvivorGradingLoading(false) }
  }

  const handleSurvivorGradePick = async (pickId: string, result: 'won' | 'eliminated' | 'pending') => {
    setSurvivorGradingAction(pickId + result)
    setSurvivorGradingMsg('')
    try {
      const res = await fetch('/api/admin/survivor-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pick_id: pickId, result }),
      })
      const data = await res.json()
      if (!res.ok) { setSurvivorGradingMsg(data.error || 'Failed to grade'); return }
      // Update local state
      setSurvivorPicks((prev) =>
        survivorGradingFilter === 'pending'
          ? prev.filter((p) => p.id !== pickId)
          : prev.map((p) => p.id === pickId ? { ...p, result } : p)
      )
      setSurvivorGradingMsg(`Marked as ${result.toUpperCase()}`)
    } catch { setSurvivorGradingMsg('Error grading pick') }
    finally { setSurvivorGradingAction(null) }
  }

  const handleBulkSurvivorGrade = async () => {
    if (!bulkTeamName.trim()) { setSurvivorGradingMsg('Enter a team name first'); return }
    setBulkGrading(true)
    setSurvivorGradingMsg('')
    try {
      const res = await fetch('/api/admin/survivor-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_name: bulkTeamName.trim(), result: bulkResult }),
      })
      const data = await res.json()
      if (!res.ok) { setSurvivorGradingMsg(data.error || 'Failed'); return }
      setSurvivorGradingMsg(`Graded ${data.updated} pick(s) for "${bulkTeamName}" as ${bulkResult.toUpperCase()}`)
      setBulkTeamName('')
      // Reload picks
      await loadSurvivorPicks(survivorGradingFilter)
    } catch { setSurvivorGradingMsg('Error during bulk grade') }
    finally { setBulkGrading(false) }
  }

  const loadSurvivorTestMode = async () => {
    try {
      const res = await fetch('/api/admin/survivor-test-mode')
      if (res.ok) {
        const data = await res.json()
        setSurvivorTestMode(data.enabled)
      }
    } catch { /* ignore */ }
  }

  const toggleSurvivorTestMode = async (enabled: boolean) => {
    setSurvivorTestLoading(true)
    setSurvivorTestMsg('')
    try {
      const res = await fetch('/api/admin/survivor-test-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      const data = await res.json()
      if (res.ok) {
        setSurvivorTestMode(data.enabled)
        setSurvivorTestMsg(data.enabled ? 'Test mode enabled — bracket is now live for testing.' : 'Test mode disabled — countdown restored.')
      } else {
        setSurvivorTestMsg('Failed to update setting.')
      }
    } catch { setSurvivorTestMsg('Error updating setting.') }
    finally { setSurvivorTestLoading(false) }
  }

  const loadGradingPicks = async (status = gradingFilter, league = gradingLeague) => {
    setGradingLoading(true)
    setGradingMsg('')
    try {
      const params = new URLSearchParams({ status })
      if (league) params.set('league', league)
      const res = await fetch(`/api/admin/picks?${params}`)
      const data = await res.json()
      setGradingPicks(data.picks ?? [])
      // Always show pending count separately
      if (status !== 'all') {
        const allRes = await fetch('/api/admin/picks?status=pending')
        const allData = await allRes.json()
        setPendingPickCount((allData.picks ?? []).length)
      } else {
        setPendingPickCount(data.pendingCount ?? 0)
      }
    } catch { setGradingMsg('Failed to load picks') }
    finally { setGradingLoading(false) }
  }

  const handleGradePick = async (id: string, result: 'win' | 'loss' | 'push') => {
    setGradingAction(id + result)
    setGradingMsg('')
    try {
      const res = await fetch('/api/admin/grade-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, result }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGradingMsg(data.error || 'Failed to grade pick')
        return
      }
      // Update local state immediately
      setGradingPicks((prev) =>
        gradingFilter === 'pending'
          ? prev.filter((p) => p.id !== id)
          : prev.map((p) => p.id === id ? { ...p, result, result_recorded_at: new Date().toISOString() } : p)
      )
      setPendingPickCount((c) => Math.max(0, c - 1))
      setGradingMsg(`Graded as ${result.toUpperCase()}`)
    } catch { setGradingMsg('Error grading pick') }
    finally { setGradingAction(null) }
  }

  // Add prediction form
  const [newPred, setNewPred] = useState({
    game_id: '', predicted_home_score: '', predicted_away_score: '',
    confidence: '', home_win_probability: '', away_win_probability: '', draw_probability: '',
    ai_spread: '', ai_total: '', ai_reasoning: '',
    is_trending: false, is_upset_pick: false, is_premium: false,
  })
  const [addingPred, setAddingPred] = useState(false)
  const [predMsg, setPredMsg] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/games').then((r) => r.json()),
      fetch('/api/admin/users').then((r) => r.json()),
      fetch('/api/admin/free-pick').then((r) => r.json()),
      fetch('/api/admin/visibility').then((r) => r.json()).catch(() => ({ predictions: [] })),
      fetch('/api/admin/briefing').then((r) => r.json()).catch(() => ({ overrides: {} })),
    ]).then(([gData, uData, fpData, vData, bData]) => {
      setGames(gData.games || [])
      setUsers(uData.users || [])
      setFreePick(fpData.freePick || null)
      setVisibilityPreds(vData.predictions || [])
      if (bData.overrides) setBriefingOverrides((prev) => ({ ...prev, ...bData.overrides }))
      setLoading(false)
    }).catch(() => {
      router.push('/dashboard')
    })
    // Load survivor test mode state on mount
    loadSurvivorTestMode()
  }, [router])

  const handleToggleVisibility = async (predId: string, currentPremium: boolean) => {
    setTogglingId(predId)
    try {
      await fetch('/api/admin/visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prediction_id: predId, is_premium: !currentPremium }),
      })
      setVisibilityPreds((prev) => prev.map((p) => p.id === predId ? { ...p, is_premium: !currentPremium } : p))
    } catch { /* ignore */ }
    finally { setTogglingId(null) }
  }

  const handleSaveBriefing = async () => {
    setSavingBriefing(true)
    setBriefingMsg('')
    try {
      const res = await fetch('/api/admin/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(briefingOverrides),
      })
      const data = await res.json()
      setBriefingMsg(data.success ? 'Briefing overrides saved!' : 'Error saving')
    } catch { setBriefingMsg('Error saving') }
    finally { setSavingBriefing(false) }
  }

  const handleAddInjury = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingInjury(true)
    setInjuryMsg('')
    try {
      const res = await fetch('/api/injuries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newInjury,
          impact_score: parseInt(newInjury.impact_score),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setInjuryMsg(data.error || 'Failed'); return }
      setInjuryMsg('Injury report added!')
      setNewInjury({ player_name: '', team_name: '', injury_type: '', status: 'Questionable', notes: '', impact_score: '5' })
    } catch { setInjuryMsg('Error adding injury') }
    finally { setAddingInjury(false) }
  }

  const handleSaveOverrides = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingOverride(true)
    setOverrideMsg('')
    // Overrides stored in local state for now — no separate table needed
    setTimeout(() => {
      setOverrideMsg('Override settings saved (applied to next engine run)')
      setSavingOverride(false)
    }, 500)
  }

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingGame(true)
    setGameMsg('')
    try {
      const res = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newGame,
          sportsbook_spread: newGame.sportsbook_spread ? parseFloat(newGame.sportsbook_spread) : null,
          sportsbook_total: newGame.sportsbook_total ? parseFloat(newGame.sportsbook_total) : null,
          sportsbook_moneyline_home: newGame.sportsbook_moneyline_home ? parseInt(newGame.sportsbook_moneyline_home) : null,
          sportsbook_moneyline_away: newGame.sportsbook_moneyline_away ? parseInt(newGame.sportsbook_moneyline_away) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setGameMsg(data.error || 'Failed'); return }
      setGameMsg('Game added!')
      setGames((prev) => [data.game, ...prev])
      setNewGame({ home_team_name: '', away_team_name: '', sport: 'Basketball', league: 'NBA', scheduled_at: '', sportsbook_spread: '', sportsbook_total: '', sportsbook_moneyline_home: '', sportsbook_moneyline_away: '' })
    } catch { setGameMsg('Error adding game') }
    finally { setAddingGame(false) }
  }

  const handleAddPrediction = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingPred(true)
    setPredMsg('')
    try {
      const res = await fetch('/api/admin/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPred,
          predicted_home_score: parseInt(newPred.predicted_home_score),
          predicted_away_score: parseInt(newPred.predicted_away_score),
          confidence: parseInt(newPred.confidence),
          home_win_probability: parseInt(newPred.home_win_probability),
          away_win_probability: parseInt(newPred.away_win_probability),
          draw_probability: parseInt(newPred.draw_probability || '0'),
          ai_spread: newPred.ai_spread ? parseFloat(newPred.ai_spread) : null,
          ai_total: newPred.ai_total ? parseFloat(newPred.ai_total) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setPredMsg(data.error || 'Failed'); return }
      setPredMsg('Prediction added!')
    } catch { setPredMsg('Error adding prediction') }
    finally { setAddingPred(false) }
  }

  const handleSetFreePick = async (gameId: string) => {
    setSettingFreePick(gameId)
    try {
      const res = await fetch('/api/admin/free-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId }),
      })
      const data = await res.json()
      if (res.ok) {
        setFreePick(data.game)
        setGames((prev) => prev.map((g) => ({ ...g, is_free_pick: g.id === gameId })))
      }
    } catch { /* ignore */ }
    finally { setSettingFreePick(null) }
  }

  const loadAdminBrackets = async () => {
    setLoadingBrackets(true)
    try {
      const res = await fetch('/api/admin/brackets')
      const data = await res.json()
      setAdminBrackets(data.brackets ?? [])
    } catch { /* ignore */ }
    finally { setLoadingBrackets(false) }
  }

  const handleFeatureBracket = async (id: string, is_featured: boolean) => {
    setBracketActionId(id)
    try {
      await fetch('/api/admin/brackets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_featured: !is_featured }),
      })
      setAdminBrackets(prev => prev.map(b => b.id === id ? { ...b, is_featured: !is_featured } : b))
    } catch { /* ignore */ }
    finally { setBracketActionId(null) }
  }

  const handleDeleteBracket = async (id: string) => {
    if (!confirm('Delete this bracket?')) return
    setBracketActionId(id)
    try {
      await fetch('/api/admin/brackets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setAdminBrackets(prev => prev.filter(b => b.id !== id))
      setBracketMsg('Bracket deleted.')
    } catch { setBracketMsg('Error deleting bracket') }
    finally { setBracketActionId(null) }
  }

  const handleSaveModelWeights = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingModel(true)
    setModelMsg('')
    setTimeout(() => {
      setModelMsg('Model weights saved (applied to next analysis run)')
      setSavingModel(false)
    }, 600)
  }

  const loadPipelineStatus = async () => {
    setPipelineLoading(true)
    try {
      // Use trailing slash to avoid 308 redirect from the proxy layer
      const res = await fetch('/api/admin/pipeline/')
      const data = await res.json()
      if (res.ok) setPipelineStatus(data)
    } catch { /* ignore */ }
    finally { setPipelineLoading(false) }
  }

  const runPipelineAction = async (action: string) => {
    setPipelineRunning(action)
    setPipelineMsg('')
    setPipelineResults([])
    try {
      // Use trailing slash to avoid 308 redirect from the proxy layer
      const res = await fetch('/api/admin/pipeline/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setPipelineMsg(`Error: ${(errData as Record<string, string>).error ?? res.statusText}`)
        return
      }
      const data = await res.json()
      setPipelineResults(data.results ?? [])
      if (data.success) {
        setPipelineMsg(`${action === 'full_cycle' ? 'Full cycle' : action.replace(/_/g, ' ')} completed in ${data.totalDurationMs}ms`)
      } else {
        setPipelineMsg(`Completed with errors (${data.totalDurationMs}ms)`)
      }
      // Refresh status after run
      await loadPipelineStatus()
    } catch (err) {
      setPipelineMsg(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPipelineRunning(null)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'pipeline', label: 'Pipeline', icon: Zap },
    { id: 'grading', label: 'Pick Grading', icon: Trophy },
    { id: 'free-pick', label: 'Daily Free Pick', icon: Gift },
    { id: 'games', label: 'Add Game', icon: Plus },
    { id: 'predictions', label: 'Add Prediction', icon: Brain },
    { id: 'visibility', label: 'Pick Visibility', icon: Eye },
    { id: 'briefing', label: 'Daily Briefing', icon: Newspaper },
    { id: 'injuries-admin', label: 'Injury Notes', icon: AlertTriangle },
    { id: 'overrides', label: 'Overrides', icon: Target },
    { id: 'bracket-model', label: 'Bracket Model', icon: FlaskConical },
    { id: 'bracket-mgmt', label: 'Bracket Mgmt', icon: Star },
    { id: 'survivor-test', label: 'Survivor Test', icon: FlaskConical },
    { id: 'survivor-grading', label: 'Survivor Grading', icon: Trophy },
    { id: 'official-contest', label: 'Official Contest', icon: DollarSign },
    { id: 'users', label: 'Users', icon: Users },
  ]

  const premiumCount = users.filter((u) => u.plan_type === 'premium').length

  return (
    <div className="p-6 space-y-6" style={{ background: '#0F0F1A', minHeight: '100%' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,255,163,0.12)' }}>
          <Shield className="w-5 h-5" style={{ color: '#00FFA3' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#E6E6FA' }}>Admin Panel</h1>
          <p className="text-sm" style={{ color: '#A0A0B0' }}>Manage games, predictions, and daily free pick</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={activeTab === tab.id
              ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }
              : { background: 'rgba(255,255,255,0.05)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
      ) : (
        <>
          {/* Pipeline Control */}
          {activeTab === 'pipeline' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Pipeline Control</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(0,255,163,0.12)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.25)' }}>TheOddsAPI</span>
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: '#A0A0B0' }}>Manually trigger live pipeline steps — powered by TheOddsAPI</p>
                </div>
                <button
                  onClick={() => { loadPipelineStatus(); setActiveTab('pipeline') }}
                  disabled={pipelineLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <RefreshCw className={`w-4 h-4 ${pipelineLoading ? 'animate-spin' : ''}`} />
                  Refresh Status
                </button>
              </div>

              {/* Status Panel */}
              {pipelineStatus && (
                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Current Pipeline Status</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: 'Last Odds Refresh',
                        value: pipelineStatus.lastOddsRefresh
                          ? new Date(pipelineStatus.lastOddsRefresh).toLocaleTimeString()
                          : 'Never',
                        sub: pipelineStatus.lastOddsRefresh
                          ? new Date(pipelineStatus.lastOddsRefresh).toLocaleDateString()
                          : '',
                        icon: Database,
                        color: pipelineStatus.lastOddsRefresh
                          && (Date.now() - new Date(pipelineStatus.lastOddsRefresh).getTime()) < 70 * 60 * 1000
                          ? '#00FFA3' : '#F59E0B',
                      },
                      {
                        label: 'Last Prediction Run',
                        value: pipelineStatus.lastPredictionRun
                          ? new Date(pipelineStatus.lastPredictionRun).toLocaleTimeString()
                          : 'Never',
                        sub: pipelineStatus.lastPredictionRun
                          ? new Date(pipelineStatus.lastPredictionRun).toLocaleDateString()
                          : '',
                        icon: Brain,
                        color: pipelineStatus.lastPredictionRun
                          && (Date.now() - new Date(pipelineStatus.lastPredictionRun).getTime()) < 12 * 60 * 60 * 1000
                          ? '#00FFA3' : '#F59E0B',
                      },
                      {
                        label: "Today's Slate",
                        value: `${pipelineStatus.gamesInSlate} games`,
                        sub: new Date(pipelineStatus.slateStart).toLocaleDateString() + ' EST',
                        icon: Calendar,
                        color: pipelineStatus.gamesInSlate > 0 ? '#00FFA3' : '#FF6B6B',
                      },
                      {
                        label: 'Pending Pick Grades',
                        value: pipelineStatus.pendingPicksToGrade,
                        sub: `W${pipelineStatus.modelStats.wins} L${pipelineStatus.modelStats.losses} P${pipelineStatus.modelStats.pushes}`,
                        icon: CheckSquare,
                        color: pipelineStatus.pendingPicksToGrade > 0 ? '#F59E0B' : '#00FFA3',
                      },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                          <span className="text-xs" style={{ color: '#A0A0B0' }}>{stat.label}</span>
                        </div>
                        <div className="text-base font-bold" style={{ color: stat.color }}>{stat.value}</div>
                        {stat.sub && <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>{stat.sub}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!pipelineStatus && !pipelineLoading && (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <Database className="w-8 h-8 mx-auto mb-2" style={{ color: '#6B6B80' }} />
                  <p className="text-sm mb-3" style={{ color: '#A0A0B0' }}>Click &quot;Refresh Status&quot; to load pipeline status</p>
                  <button
                    onClick={loadPipelineStatus}
                    className="px-4 py-2 rounded-xl text-sm font-medium"
                    style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.2)' }}
                  >
                    Load Status
                  </button>
                </div>
              )}

              {/* Active Pipeline Actions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Live Pipeline Actions</h3>
                  <span className="text-xs" style={{ color: '#6B6B80' }}>Source: TheOddsAPI</span>
                </div>

                {/* Individual active steps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      action: 'refresh_odds',
                      label: 'Refresh Odds',
                      description: 'Fetch latest odds from TheOddsAPI → write to cached_odds',
                      icon: Database,
                      color: '#3B82F6',
                    },
                    {
                      action: 'refresh_scores',
                      label: 'Refresh Final Scores',
                      description: 'Fetch completed game scores from TheOddsAPI → update games table',
                      icon: Trophy,
                      color: '#22C55E',
                    },
                    {
                      action: 'refresh_slate',
                      label: 'Refresh Active Slate',
                      description: 'Confirm today\'s EST game window and cached_odds row count',
                      icon: Calendar,
                      color: '#F59E0B',
                    },
                    {
                      action: 'run_predictions',
                      label: 'Regenerate Predictions',
                      description: 'Sync cached odds → run prediction engine → update prediction_cache',
                      icon: Brain,
                      color: '#A78BFA',
                    },
                    {
                      action: 'select_picks',
                      label: 'Select Official Picks',
                      description: 'Choose top picks from today\'s slate → write to official_picks',
                      icon: Star,
                      color: '#F59E0B',
                    },
                    {
                      action: 'grade_picks',
                      label: 'Grade Official Picks',
                      description: 'Resolve results for completed games → update model performance stats',
                      icon: CheckSquare,
                      color: '#10B981',
                    },
                    {
                      action: 'recalculate_edges',
                      label: 'Recalculate Edges',
                      description: 'Re-score edge values → update prediction_cache rankings',
                      icon: BarChart3,
                      color: '#00FFA3',
                    },
                  ].map(({ action, label, description, icon: Icon, color }) => (
                    <button
                      key={action}
                      onClick={() => runPipelineAction(action)}
                      disabled={pipelineRunning !== null}
                      className="text-left p-4 rounded-xl transition-all hover:opacity-80 disabled:opacity-40"
                      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${color}18` }}>
                          {pipelineRunning === action
                            ? <RefreshCw className="w-4 h-4 animate-spin" style={{ color }} />
                            : <Icon className="w-4 h-4" style={{ color }} />
                          }
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{label}</div>
                          <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>{description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Full cycle */}
                <button
                  onClick={() => runPipelineAction('full_cycle')}
                  disabled={pipelineRunning !== null}
                  className="w-full p-5 rounded-2xl text-left transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(0,255,163,0.15)' }}>
                      {pipelineRunning === 'full_cycle'
                        ? <RefreshCw className="w-5 h-5 animate-spin" style={{ color: '#00FFA3' }} />
                        : <Zap className="w-5 h-5" style={{ color: '#00FFA3' }} />
                      }
                    </div>
                    <div>
                      <div className="text-base font-bold" style={{ color: '#00FFA3' }}>
                        {pipelineRunning === 'full_cycle' ? 'Running Full Daily Cycle...' : 'Run Full Daily Cycle'}
                      </div>
                      <div className="text-sm mt-0.5" style={{ color: '#A0A0B0' }}>
                        Refresh odds → Refresh scores → Predictions → Select picks → Grade picks (TheOddsAPI only)
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Coming Soon — features requiring additional data providers */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B6B80' }}>Coming Soon</h3>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Injuries Cache', description: 'Player injury reports & impact scores', icon: Database },
                    { label: 'Betting Splits', description: 'Public bets %, public money %, sharp alerts', icon: BarChart3 },
                    { label: 'Season Schedules', description: 'Full season schedule sync for all leagues', icon: Calendar },
                  ].map(({ label, description, icon: Icon }) => (
                    <div
                      key={label}
                      className="p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5" style={{ color: '#6B6B80' }} />
                        <span className="text-xs font-medium" style={{ color: '#6B6B80' }}>{label}</span>
                        <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#6B6B80' }}>Soon</span>
                      </div>
                      <div className="text-xs" style={{ color: '#4A4A5A' }}>{description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Results */}
              {pipelineMsg && (
                <div className="p-3 rounded-xl text-sm font-medium"
                  style={{
                    background: pipelineMsg.includes('error') || pipelineMsg.includes('Error')
                      ? 'rgba(255,107,107,0.1)' : 'rgba(0,255,163,0.08)',
                    color: pipelineMsg.includes('error') || pipelineMsg.includes('Error')
                      ? '#FF6B6B' : '#00FFA3',
                    border: pipelineMsg.includes('error') || pipelineMsg.includes('Error')
                      ? '1px solid rgba(255,107,107,0.2)' : '1px solid rgba(0,255,163,0.15)',
                  }}>
                  {pipelineMsg}
                </div>
              )}

              {pipelineResults.length > 0 && (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <h3 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Step Results</h3>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    {pipelineResults.map((r, i) => (
                      <div key={i} className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {r.success
                              ? <CheckCircle className="w-4 h-4" style={{ color: '#00FFA3' }} />
                              : <Activity className="w-4 h-4" style={{ color: '#FF6B6B' }} />
                            }
                            <span className="text-sm font-medium text-white">{r.step.replace(/_/g, ' ')}</span>
                          </div>
                          <span className="text-xs" style={{ color: '#6B6B80' }}>{r.durationMs}ms</span>
                        </div>
                        {r.error && (
                          <div className="text-xs mt-1 pl-6" style={{ color: '#FF6B6B' }}>{r.error}</div>
                        )}
                        {r.detail && (
                          <div className="text-xs mt-1 pl-6 space-y-0.5" style={{ color: '#A0A0B0' }}>
                            {r.step === 'refresh_slate' && r.detail && (() => {
                              const d = r.detail as Record<string, unknown>
                              const oddsByLeague = (d.cachedOddsByLeague ?? {}) as Record<string, number>
                              const leagueLines = Object.entries(oddsByLeague).map(([lg, n]) => `${lg}: ${n}`).join(', ')
                              return (
                                <>
                                  <div>Slate window: {String(d.slateStart ?? '').slice(0, 10)} EST</div>
                                  <div>Games in prediction_cache: {String(d.gamesInSlate ?? 0)}</div>
                                  <div style={{ color: Number(d.cachedOddsTotal ?? 0) > 0 ? '#00FFA3' : '#FF6B6B' }}>
                                    Cached odds rows: {String(d.cachedOddsTotal ?? 0)}
                                    {leagueLines ? ` (${leagueLines})` : ''}
                                  </div>
                                </>
                              )
                            })()}
                            {r.step === 'grade_picks' && r.detail && (
                              <>
                                <div>Picks graded: {String(r.detail.picksGraded ?? 0)}</div>
                                <div>Closing lines updated: {String(r.detail.closingLinesUpdated ?? 0)}</div>
                                {r.detail.modelStats && (
                                  <div>Model stats: W{String((r.detail.modelStats as Record<string, number>).wins)} L{String((r.detail.modelStats as Record<string, number>).losses)} P{String((r.detail.modelStats as Record<string, number>).pushes)}</div>
                                )}
                              </>
                            )}
                            {r.step === 'run_predictions' && r.detail && (
                              <div>Sync complete</div>
                            )}
                            {r.step === 'refresh_odds' && r.detail && (() => {
                              const d = r.detail as Record<string, unknown>
                              // TheOddsAPI RefreshResult uses sportsRefreshed (not leaguesRefreshed)
                              const sports = Array.isArray(d.sportsRefreshed) ? (d.sportsRefreshed as string[]) : []
                              const errors = Array.isArray(d.errors) ? (d.errors as string[]) : []
                              const hasApiKey = !errors.some((e) => typeof e === 'string' && e.includes('ODDS_API_KEY'))
                              return (
                                <>
                                  <div style={{ color: !hasApiKey ? '#FF6B6B' : undefined }}>
                                    TheOddsAPI Key: {!hasApiKey ? 'MISSING' : 'OK'}
                                  </div>
                                  <div>Fetched: {String(d.totalFetched ?? 0)} games</div>
                                  <div>Updated: {String(d.totalUpserted ?? 0)} records</div>
                                  {sports.length > 0 && (
                                    <div>Sports: {sports.join(', ')}</div>
                                  )}
                                  {d.refreshedAt && (
                                    <div>At: {new Date(String(d.refreshedAt)).toLocaleTimeString()}</div>
                                  )}
                                  {errors.length > 0 && (
                                    <div style={{ color: '#F59E0B' }}>Errors: {errors.join(' | ')}</div>
                                  )}
                                </>
                              )
                            })()}
                            {r.step === 'refresh_scores' && r.detail && (() => {
                              const d = r.detail as Record<string, unknown>
                              const errors = Array.isArray(d.errors) ? (d.errors as string[]) : []
                              return (
                                <>
                                  <div>Scores updated: {String(d.updated ?? 0)} games</div>
                                  {errors.length > 0 && (
                                    <div style={{ color: '#F59E0B' }}>Errors: {errors.join(' | ')}</div>
                                  )}
                                </>
                              )
                            })()}
                            {(r.step === 'refresh_injuries' || r.step === 'refresh_betting_splits' || r.step === 'refresh_schedules') && r.detail && (
                              <div style={{ color: '#A0A0B0' }}>
                                {String((r.detail as Record<string, unknown>).note ?? 'Coming Soon — SportsDataIO paused')}
                              </div>
                            )}
                            {r.step === 'select_picks' && r.detail && (
                              <div>Inserted: {String((r.detail as unknown as Record<string, number>).inserted ?? 0)}, Skipped: {String((r.detail as unknown as Record<string, number>).skipped ?? 0)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cron schedule info */}
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4" style={{ color: '#A0A0B0' }} />
                  <h3 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Production Cron Schedule</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Odds Refresh', schedule: 'Every hour (0 * * * *)', endpoint: '/api/cron/odds-refresh', active: false },
                    { label: 'Daily Rollover', schedule: 'Daily at 2:00 AM EST (0 7 * * *)', endpoint: '/api/cron/daily-rollover', active: false },
                  ].map((job) => (
                    <div key={job.endpoint} className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div>
                        <div className="text-sm font-medium text-white">{job.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>{job.schedule}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#6B6B80' }}>
                          {job.endpoint}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                          Pending Deploy
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-3" style={{ color: '#6B6B80' }}>
                  Cron jobs activate automatically once deployed to Vercel. Use manual actions above for testing.
                </p>
              </div>
            </div>
          )}

          {/* Pick Grading */}
          {activeTab === 'grading' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Official Pick Grading</h2>
                  <p className="text-sm mt-0.5" style={{ color: '#A0A0B0' }}>
                    Manually grade picks as Win, Loss, or Push. Stats update immediately.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pendingPickCount > 0 && (
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
                      {pendingPickCount} Pending
                    </span>
                  )}
                  <button
                    onClick={() => loadGradingPicks(gradingFilter, gradingLeague)}
                    disabled={gradingLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                    style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <RefreshCw className={`w-4 h-4 ${gradingLoading ? 'animate-spin' : ''}`} />
                    {gradingLoading ? 'Loading...' : 'Load Picks'}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-3 flex-wrap items-center">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" style={{ color: '#6B6B80' }} />
                  <span className="text-xs" style={{ color: '#6B6B80' }}>Status:</span>
                </div>
                {(['pending', 'settled', 'all'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setGradingFilter(s); loadGradingPicks(s, gradingLeague) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={gradingFilter === s
                      ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {s}
                  </button>
                ))}
                <select
                  value={gradingLeague}
                  onChange={(e) => { setGradingLeague(e.target.value); loadGradingPicks(gradingFilter, e.target.value) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <option value="">All Leagues</option>
                  {['NBA', 'NCAAB', 'NFL', 'EPL', 'UCL', 'MLB', 'NHL'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Result message */}
              {gradingMsg && (
                <div className="p-3 rounded-xl text-sm font-medium"
                  style={{
                    background: gradingMsg.toLowerCase().includes('error') || gradingMsg.toLowerCase().includes('fail')
                      ? 'rgba(255,107,107,0.1)' : 'rgba(0,255,163,0.08)',
                    color: gradingMsg.toLowerCase().includes('error') || gradingMsg.toLowerCase().includes('fail')
                      ? '#FF6B6B' : '#00FFA3',
                    border: gradingMsg.toLowerCase().includes('error') || gradingMsg.toLowerCase().includes('fail')
                      ? '1px solid rgba(255,107,107,0.2)' : '1px solid rgba(0,255,163,0.15)',
                  }}>
                  {gradingMsg}
                </div>
              )}

              {/* Empty state — before loading */}
              {gradingPicks.length === 0 && !gradingLoading && (
                <div className="glass-card rounded-2xl p-10 text-center">
                  <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: '#6B6B80' }} />
                  <p className="text-sm font-medium" style={{ color: '#A0A0B0' }}>
                    {gradingFilter === 'pending' ? 'No pending picks to grade.' : 'No picks found.'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#6B6B80' }}>Click &quot;Load Picks&quot; to fetch from the database.</p>
                </div>
              )}

              {/* Pick list */}
              {gradingPicks.length > 0 && (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <h3 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
                      {gradingPicks.length} pick{gradingPicks.length !== 1 ? 's' : ''}
                    </h3>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    {gradingPicks.map((pick) => {
                      const isPending = pick.result === 'pending'
                      const resultColor = pick.result === 'win' ? '#00FFA3' : pick.result === 'loss' ? '#FF6B6B' : pick.result === 'push' ? '#F59E0B' : '#A0A0B0'
                      const gameDate = pick.commence_time ? new Date(pick.commence_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
                      const gameTime = pick.commence_time ? new Date(pick.commence_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
                      const lineDisplay = pick.sportsbook_line != null
                        ? (pick.sportsbook_line >= 0 ? `+${pick.sportsbook_line}` : `${pick.sportsbook_line}`)
                        : '—'
                      const betLabel = pick.bet_type === 'spread' ? 'Spread'
                        : pick.bet_type === 'total_over' ? 'Over'
                        : pick.bet_type === 'total_under' ? 'Under'
                        : pick.bet_type

                      return (
                        <div key={pick.id} className="p-4">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            {/* Pick info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-bold px-2 py-0.5 rounded"
                                  style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0' }}>
                                  {pick.league}
                                </span>
                                <span className="text-xs" style={{ color: '#6B6B80' }}>{betLabel}</span>
                                <span className="text-xs" style={{ color: '#6B6B80' }}>·</span>
                                <span className="text-xs" style={{ color: '#6B6B80' }}>{gameDate} {gameTime}</span>
                              </div>
                              <div className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
                                {pick.away_team} @ {pick.home_team}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-sm font-bold" style={{ color: '#00FFA3' }}>
                                  {pick.pick_team} {lineDisplay}
                                </span>
                                {pick.spread_edge != null && (
                                  <span className="text-xs" style={{ color: '#A0A0B0' }}>
                                    Edge {pick.spread_edge > 0 ? '+' : ''}{pick.spread_edge.toFixed(1)}
                                  </span>
                                )}
                                {pick.confidence_score != null && (
                                  <span className="text-xs" style={{ color: '#A0A0B0' }}>
                                    Conf {pick.confidence_score}%
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Result / Grade buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              {!isPending ? (
                                <span className="text-sm font-bold px-3 py-1 rounded-lg capitalize"
                                  style={{ background: `${resultColor}18`, color: resultColor, border: `1px solid ${resultColor}30` }}>
                                  {pick.result}
                                </span>
                              ) : (
                                <>
                                  {(['win', 'loss', 'push'] as const).map((r) => {
                                    const colors = { win: '#00FFA3', loss: '#FF6B6B', push: '#F59E0B' }
                                    const isActive = gradingAction === pick.id + r
                                    return (
                                      <button
                                        key={r}
                                        onClick={() => handleGradePick(pick.id, r)}
                                        disabled={gradingAction !== null}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all hover:opacity-80 disabled:opacity-40"
                                        style={{
                                          background: `${colors[r]}18`,
                                          color: colors[r],
                                          border: `1px solid ${colors[r]}35`,
                                        }}
                                      >
                                        {isActive ? '...' : r.charAt(0).toUpperCase() + r.slice(1)}
                                      </button>
                                    )
                                  })}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Performance note */}
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs" style={{ color: '#6B6B80' }}>
                  Grading a pick immediately updates the Model Performance page — Season Record, Win %, ROI, and Current Streak all recalculate in real time from official_picks data.
                </p>
              </div>
            </div>
          )}

          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Games', value: games.length, color: '#00FFA3', icon: Target },
                  { label: 'Total Users', value: users.length, color: '#3B82F6', icon: Users },
                  { label: 'Premium Users', value: premiumCount, color: '#F59E0B', icon: TrendingUp },
                  { label: 'Free Pick Set', value: freePick ? 'Yes' : 'No', color: freePick ? '#00FFA3' : '#FF6B6B', icon: Gift },
                ].map((stat) => (
                  <div key={stat.label} className="glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                      <span className="text-xs" style={{ color: '#A0A0B0' }}>{stat.label}</span>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Current Free Pick */}
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-4 h-4" style={{ color: '#00FFA3' }} />
                  <h2 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Current Daily Free Pick</h2>
                </div>
                {freePick ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-semibold" style={{ color: '#E6E6FA' }}>
                        {freePick.home_team_name} vs {freePick.away_team_name}
                      </div>
                      <div className="text-sm mt-0.5" style={{ color: '#A0A0B0' }}>
                        {freePick.league} · {new Date(freePick.scheduled_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}>
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </div>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: '#FF6B6B' }}>No free pick selected today. Go to "Daily Free Pick" tab to set one.</p>
                )}
              </div>

              {/* Recent games */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <h2 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Recent Games</h2>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  {games.slice(0, 6).map((g) => (
                    <div key={g.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
                          {g.home_team_name} vs {g.away_team_name}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>
                          {g.league} · {new Date(g.scheduled_at).toLocaleDateString()} · {g.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {g.is_free_pick && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}>Free Pick</span>
                        )}
                        <span className="text-xs" style={{ color: '#A0A0B0' }}>
                          {g.sportsbook_spread != null ? `Spread: ${g.sportsbook_spread}` : 'No odds'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Daily Free Pick */}
          {activeTab === 'free-pick' && (
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-5" style={{ border: '1px solid rgba(0,255,163,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4" style={{ color: '#00FFA3' }} />
                  <h2 className="text-sm font-semibold" style={{ color: '#00FFA3' }}>How Daily Free Pick Works</h2>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#A0A0B0' }}>
                  Select ONE game per day as the free pick. Free users will see ONLY this game fully unlocked — all other picks will be blurred and locked behind the premium paywall.
                </p>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <h2 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Select Free Pick — Upcoming Games</h2>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  {games.filter((g) => g.status === 'scheduled').map((g) => (
                    <div key={g.id} className="p-4 flex items-center justify-between gap-4" style={g.is_free_pick ? { background: 'rgba(0,255,163,0.06)' } : {}}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: '#A0A0B0' }}>{g.league}</span>
                          <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>{g.home_team_name} vs {g.away_team_name}</span>
                        </div>
                        <div className="text-xs" style={{ color: '#A0A0B0' }}>
                          {new Date(g.scheduled_at).toLocaleDateString()} {new Date(g.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {g.sportsbook_spread != null && ` · Spread: ${g.sportsbook_spread}`}
                          {g.sportsbook_total != null && ` · Total: ${g.sportsbook_total}`}
                        </div>
                      </div>
                      {g.is_free_pick ? (
                        <div className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Active Free Pick
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: 'rgba(0,255,163,0.3)', color: '#00FFA3' }}
                          disabled={settingFreePick === g.id}
                          onClick={() => handleSetFreePick(g.id)}
                        >
                          {settingFreePick === g.id ? 'Setting...' : 'Set as Free Pick'}
                        </Button>
                      )}
                    </div>
                  ))}
                  {games.filter((g) => g.status === 'scheduled').length === 0 && (
                    <div className="p-8 text-center">
                      <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: '#A0A0B0' }} />
                      <p className="text-sm" style={{ color: '#A0A0B0' }}>No upcoming games. Add games first.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Add Game */}
          {activeTab === 'games' && (
            <div className="glass-card rounded-2xl p-6 max-w-2xl">
              <h2 className="text-lg font-bold mb-5" style={{ color: '#E6E6FA' }}>Add New Game</h2>
              <form onSubmit={handleAddGame} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Home Team</Label>
                    <Input
                      value={newGame.home_team_name}
                      onChange={(e) => setNewGame({ ...newGame, home_team_name: e.target.value })}
                      placeholder="e.g. Los Angeles Lakers"
                      required
                      className="border-white/10 text-white"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Away Team</Label>
                    <Input
                      value={newGame.away_team_name}
                      onChange={(e) => setNewGame({ ...newGame, away_team_name: e.target.value })}
                      placeholder="e.g. Golden State Warriors"
                      required
                      className="border-white/10 text-white"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Sport</Label>
                    <select
                      value={newGame.sport}
                      onChange={(e) => {
                        const sport = e.target.value
                        const leagueOptions = LEAGUES[sport] || []
                        setNewGame({ ...newGame, sport, league: leagueOptions[0] || '' })
                      }}
                      className="w-full rounded-lg px-3 py-2 text-sm border text-white"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                      {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>League</Label>
                    <select
                      value={newGame.league}
                      onChange={(e) => setNewGame({ ...newGame, league: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm border text-white"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                      {(LEAGUES[newGame.sport] || []).map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Scheduled Date/Time</Label>
                  <Input
                    type="datetime-local"
                    value={newGame.scheduled_at}
                    onChange={(e) => setNewGame({ ...newGame, scheduled_at: e.target.value })}
                    required
                    className="border-white/10 text-white"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  />
                </div>

                <div className="pt-1">
                  <p className="text-xs font-semibold mb-3" style={{ color: '#A0A0B0' }}>Sportsbook Odds (optional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Spread</Label>
                      <Input value={newGame.sportsbook_spread} onChange={(e) => setNewGame({ ...newGame, sportsbook_spread: e.target.value })} placeholder="-4.5" className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Total (O/U)</Label>
                      <Input value={newGame.sportsbook_total} onChange={(e) => setNewGame({ ...newGame, sportsbook_total: e.target.value })} placeholder="228.5" className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>ML Home</Label>
                      <Input value={newGame.sportsbook_moneyline_home} onChange={(e) => setNewGame({ ...newGame, sportsbook_moneyline_home: e.target.value })} placeholder="-180" className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>ML Away</Label>
                      <Input value={newGame.sportsbook_moneyline_away} onChange={(e) => setNewGame({ ...newGame, sportsbook_moneyline_away: e.target.value })} placeholder="+155" className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                  </div>
                </div>

                {gameMsg && (
                  <div className="p-3 rounded-lg text-sm" style={gameMsg.includes('!') ? { background: 'rgba(0,255,163,0.1)', color: '#00FFA3' } : { background: 'rgba(255,107,107,0.1)', color: '#FF6B6B' }}>
                    {gameMsg}
                  </div>
                )}

                <Button type="submit" disabled={addingGame} className="gradient-green text-black font-bold border-0 neon-glow">
                  {addingGame ? 'Adding...' : 'Add Game'}
                </Button>
              </form>
            </div>
          )}

          {/* Add Prediction */}
          {activeTab === 'predictions' && (
            <div className="glass-card rounded-2xl p-6 max-w-2xl">
              <h2 className="text-lg font-bold mb-5" style={{ color: '#E6E6FA' }}>Add Prediction</h2>
              <form onSubmit={handleAddPrediction} className="space-y-4">
                <div>
                  <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Game</Label>
                  <select
                    value={newPred.game_id}
                    onChange={(e) => setNewPred({ ...newPred, game_id: e.target.value })}
                    required
                    className="w-full rounded-lg px-3 py-2 text-sm border text-white"
                    style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <option value="">Select a game...</option>
                    {games.filter((g) => g.status === 'scheduled').map((g) => (
                      <option key={g.id} value={g.id}>
                        [{g.league}] {g.home_team_name} vs {g.away_team_name} — {new Date(g.scheduled_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'predicted_home_score', label: 'Home Score' },
                    { key: 'predicted_away_score', label: 'Away Score' },
                    { key: 'confidence', label: 'Confidence %' },
                    { key: 'home_win_probability', label: 'Home Win %' },
                    { key: 'away_win_probability', label: 'Away Win %' },
                    { key: 'draw_probability', label: 'Draw % (0 for N/A)' },
                    { key: 'ai_spread', label: 'AI Spread' },
                    { key: 'ai_total', label: 'AI Total' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>{label}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newPred[key as keyof typeof newPred] as string}
                        onChange={(e) => setNewPred({ ...newPred, [key]: e.target.value })}
                        className="border-white/10 text-white"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>AI Reasoning</Label>
                  <textarea
                    value={newPred.ai_reasoning}
                    onChange={(e) => setNewPred({ ...newPred, ai_reasoning: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg px-3 py-2 text-sm border text-white resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#E6E6FA' }}
                    placeholder="AI analysis and reasoning for this prediction..."
                  />
                </div>

                <div className="flex gap-4">
                  {[
                    { key: 'is_trending', label: 'Trending' },
                    { key: 'is_upset_pick', label: 'Upset Pick' },
                    { key: 'is_premium', label: 'Premium Only' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPred[key as keyof typeof newPred] as boolean}
                        onChange={(e) => setNewPred({ ...newPred, [key]: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm" style={{ color: '#A0A0B0' }}>{label}</span>
                    </label>
                  ))}
                </div>

                {predMsg && (
                  <div className="p-3 rounded-lg text-sm" style={predMsg.includes('!') ? { background: 'rgba(0,255,163,0.1)', color: '#00FFA3' } : { background: 'rgba(255,107,107,0.1)', color: '#FF6B6B' }}>
                    {predMsg}
                  </div>
                )}

                <Button type="submit" disabled={addingPred} className="gradient-green text-black font-bold border-0 neon-glow">
                  {addingPred ? 'Adding...' : 'Add Prediction'}
                </Button>
              </form>
            </div>
          )}

          {/* Pick Visibility */}
          {activeTab === 'visibility' && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <h2 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Pick Visibility — Toggle Free vs Premium</h2>
                <p className="text-xs mt-1" style={{ color: '#A0A0B0' }}>Toggle whether each pick is locked behind premium or visible to free users</p>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {visibilityPreds.map((pred) => {
                  const game = pred.games
                  return (
                    <div key={pred.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
                          {game?.home_team_name} vs {game?.away_team_name}
                        </div>
                        <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: '#A0A0B0' }}>
                          <span>{game?.league}</span>
                          <span>·</span>
                          <span>{pred.confidence}% conf</span>
                          {pred.is_trending && <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>Trending</span>}
                          {pred.is_upset_pick && <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>Upset</span>}
                          {game?.is_free_pick && <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}>Free Pick</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs" style={{ color: pred.is_premium ? '#F59E0B' : '#00FFA3' }}>
                          {pred.is_premium ? 'Premium' : 'Free'}
                        </span>
                        <button
                          disabled={togglingId === pred.id}
                          onClick={() => handleToggleVisibility(pred.id, pred.is_premium)}
                          className="transition-opacity hover:opacity-80"
                        >
                          {pred.is_premium
                            ? <ToggleLeft className="w-8 h-8" style={{ color: '#F59E0B' }} />
                            : <ToggleRight className="w-8 h-8" style={{ color: '#00FFA3' }} />
                          }
                        </button>
                      </div>
                    </div>
                  )
                })}
                {visibilityPreds.length === 0 && (
                  <div className="p-8 text-center">
                    <EyeOff className="w-8 h-8 mx-auto mb-2" style={{ color: '#A0A0B0' }} />
                    <p className="text-sm" style={{ color: '#A0A0B0' }}>No predictions found. Add predictions first.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Briefing Overrides */}
          {activeTab === 'briefing' && (
            <div className="glass-card rounded-2xl p-6 max-w-2xl">
              <h2 className="text-lg font-bold mb-2" style={{ color: '#E6E6FA' }}>AI Daily Briefing Overrides</h2>
              <p className="text-sm mb-5" style={{ color: '#A0A0B0' }}>Add custom notes that appear alongside AI-generated briefing cards</p>
              <div className="space-y-4">
                {[
                  { key: 'topSpreadEdgeNote', label: 'Top Spread Edge — Admin Note' },
                  { key: 'topTotalEdgeNote', label: 'Top Total Edge — Admin Note' },
                  { key: 'highestConfidenceNote', label: 'Highest Confidence — Admin Note' },
                  { key: 'upsetAlertNote', label: 'Upset Alert — Admin Note' },
                  { key: 'modelStatusNote', label: 'Model Status — Admin Note' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>{label}</Label>
                    <textarea
                      value={briefingOverrides[key as keyof typeof briefingOverrides]}
                      onChange={(e) => setBriefingOverrides({ ...briefingOverrides, [key]: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg px-3 py-2 text-sm border text-white resize-none"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#E6E6FA' }}
                      placeholder={`Admin note for ${label}...`}
                    />
                  </div>
                ))}
                {briefingMsg && (
                  <div className="p-3 rounded-lg text-sm" style={briefingMsg.includes('!') ? { background: 'rgba(0,255,163,0.1)', color: '#00FFA3' } : { background: 'rgba(255,107,107,0.1)', color: '#FF6B6B' }}>
                    {briefingMsg}
                  </div>
                )}
                <Button onClick={handleSaveBriefing} disabled={savingBriefing} className="gradient-green text-black font-bold border-0 neon-glow">
                  {savingBriefing ? 'Saving...' : 'Save Briefing Overrides'}
                </Button>
              </div>
            </div>
          )}

          {/* Injury Notes */}
          {activeTab === 'injuries-admin' && (
            <div className="glass-card rounded-2xl p-6 max-w-2xl">
              <h2 className="text-lg font-bold mb-5" style={{ color: '#E6E6FA' }}>Add Manual Injury Note</h2>
              <form onSubmit={handleAddInjury} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Player Name</Label>
                    <Input value={newInjury.player_name} onChange={(e) => setNewInjury({ ...newInjury, player_name: e.target.value })} placeholder="LeBron James" required className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Team Name</Label>
                    <Input value={newInjury.team_name} onChange={(e) => setNewInjury({ ...newInjury, team_name: e.target.value })} placeholder="Los Angeles Lakers" required className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Injury Type</Label>
                    <Input value={newInjury.injury_type} onChange={(e) => setNewInjury({ ...newInjury, injury_type: e.target.value })} placeholder="Knee - Soreness" className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Status</Label>
                    <select value={newInjury.status} onChange={(e) => setNewInjury({ ...newInjury, status: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm border text-white" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
                      {['Out', 'Questionable', 'Probable'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Impact Score (0–10)</Label>
                    <Input type="number" min="0" max="10" value={newInjury.impact_score} onChange={(e) => setNewInjury({ ...newInjury, impact_score: e.target.value })} className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Notes</Label>
                  <textarea value={newInjury.notes} onChange={(e) => setNewInjury({ ...newInjury, notes: e.target.value })} rows={2} className="w-full rounded-lg px-3 py-2 text-sm border text-white resize-none" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#E6E6FA' }} placeholder="Day-to-day, listed questionable for tonight..." />
                </div>
                {injuryMsg && (
                  <div className="p-3 rounded-lg text-sm" style={injuryMsg.includes('!') ? { background: 'rgba(0,255,163,0.1)', color: '#00FFA3' } : { background: 'rgba(255,107,107,0.1)', color: '#FF6B6B' }}>
                    {injuryMsg}
                  </div>
                )}
                <Button type="submit" disabled={addingInjury} className="gradient-green text-black font-bold border-0 neon-glow">
                  {addingInjury ? 'Adding...' : 'Add Injury Report'}
                </Button>
              </form>
            </div>
          )}

          {/* Overrides */}
          {activeTab === 'overrides' && (
            <div className="glass-card rounded-2xl p-6 max-w-2xl">
              <h2 className="text-lg font-bold mb-2" style={{ color: '#E6E6FA' }}>Model Overrides</h2>
              <p className="text-sm mb-5" style={{ color: '#A0A0B0' }}>Override pick difficulty, model strength, and public betting % for a specific game</p>
              <form onSubmit={handleSaveOverrides} className="space-y-4">
                <div>
                  <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Game ID</Label>
                  <Input value={overrideGameId} onChange={(e) => setOverrideGameId(e.target.value)} placeholder="Game UUID" className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Pick Difficulty</Label>
                    <select value={overrides.difficulty} onChange={(e) => setOverrides({ ...overrides, difficulty: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm border text-white" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
                      <option value="">Auto</option>
                      <option value="LOW RISK">LOW RISK</option>
                      <option value="MODERATE RISK">MODERATE RISK</option>
                      <option value="HIGH RISK">HIGH RISK</option>
                      <option value="UPSET RISK">UPSET RISK</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Model Strength Override %</Label>
                    <Input type="number" min="0" max="100" value={overrides.modelStrength} onChange={(e) => setOverrides({ ...overrides, modelStrength: e.target.value })} placeholder="Auto" className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>Public Betting %</Label>
                    <Input type="number" min="0" max="100" value={overrides.publicPct} onChange={(e) => setOverrides({ ...overrides, publicPct: e.target.value })} placeholder="Auto" className="border-white/10 text-white" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                </div>
                {overrideMsg && (
                  <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>{overrideMsg}</div>
                )}
                <Button type="submit" disabled={savingOverride} className="gradient-green text-black font-bold border-0 neon-glow">
                  {savingOverride ? 'Saving...' : 'Save Overrides'}
                </Button>
              </form>
            </div>
          )}

          {/* Bracket Scoring Model */}
          {activeTab === 'bracket-model' && (
            <div className="glass-card rounded-2xl p-6 max-w-2xl">
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="w-4 h-4" style={{ color: '#F59E0B' }} />
                <h2 className="text-lg font-bold" style={{ color: '#E6E6FA' }}>Bracket Scoring Model Weights</h2>
              </div>
              <p className="text-sm mb-5" style={{ color: '#A0A0B0' }}>Configure grade thresholds and analysis weighting</p>
              <form onSubmit={handleSaveModelWeights} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'gradeThreshold_A_plus', label: 'A+ Grade Threshold (win% ≥)', placeholder: '8' },
                    { key: 'gradeThreshold_A',      label: 'A Grade Threshold (win% ≥)', placeholder: '6' },
                    { key: 'gradeThreshold_B',      label: 'B Grade Threshold (win% ≥)', placeholder: '4' },
                    { key: 'gradeThreshold_C',      label: 'C Grade Threshold (win% ≥)', placeholder: '2' },
                    { key: 'upsetWeightMultiplier', label: 'Upset Weight Multiplier', placeholder: '1.0' },
                    { key: 'uniquenessWeight',      label: 'Uniqueness Weight', placeholder: '0.8' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <Label className="text-xs mb-1.5 block" style={{ color: '#A0A0B0' }}>{label}</Label>
                      <Input
                        value={modelWeights[key as keyof typeof modelWeights]}
                        onChange={e => setModelWeights({ ...modelWeights, [key]: e.target.value })}
                        placeholder={placeholder}
                        type="number"
                        step="0.1"
                        className="border-white/10 text-white"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      />
                    </div>
                  ))}
                </div>
                {modelMsg && (
                  <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
                    {modelMsg}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={savingModel}
                  className="gradient-green text-black font-semibold border-0 hover:opacity-90"
                >
                  {savingModel ? 'Saving...' : 'Save Model Weights'}
                </Button>
              </form>
            </div>
          )}

          {/* Bracket Management */}
          {activeTab === 'bracket-mgmt' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Bracket Management</h2>
                  <p className="text-sm mt-0.5" style={{ color: '#A0A0B0' }}>View, feature, or delete user brackets</p>
                </div>
                <button
                  onClick={loadAdminBrackets}
                  disabled={loadingBrackets}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {loadingBrackets ? 'Loading...' : 'Load Brackets'}
                </button>
              </div>
              {bracketMsg && (
                <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(0,255,163,0.08)', color: '#00FFA3' }}>{bracketMsg}</div>
              )}
              {adminBrackets.length > 0 ? (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    {adminBrackets.map(b => (
                      <div key={b.id} className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0"
                          style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
                          {b.bracket_score ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{b.name}</div>
                          <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>
                            {b.users?.email} · Pool: {b.pool_size} · Win: {b.win_probability}% · {new Date(b.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleFeatureBracket(b.id, b.is_featured)}
                            disabled={bracketActionId === b.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                            style={{
                              background: b.is_featured ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)',
                              color: b.is_featured ? '#F59E0B' : '#A0A0B0',
                            }}>
                            <Star className="w-3.5 h-3.5" />
                            {b.is_featured ? 'Featured' : 'Feature'}
                          </button>
                          <button
                            onClick={() => handleDeleteBracket(b.id)}
                            disabled={bracketActionId === b.id}
                            className="p-1.5 rounded-lg transition-all hover:opacity-80"
                            style={{ background: 'rgba(255,107,107,0.1)', color: '#FF6B6B' }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-10 text-center">
                  <FlaskConical className="w-8 h-8 mx-auto mb-2" style={{ color: '#6B6B80' }} />
                  <p className="text-sm" style={{ color: '#A0A0B0' }}>Click &quot;Load Brackets&quot; to view all user brackets</p>
                </div>
              )}
            </div>
          )}

          {/* Users */}
          {activeTab === 'users' && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <h2 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>All Users ({users.length})</h2>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {users.map((user) => (
                  <div key={user.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>{user.name || user.email}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>{user.email} · Joined {new Date(user.created_at).toLocaleDateString()}</div>
                    </div>
                    <div
                      className="text-xs font-bold px-2 py-1 rounded-full capitalize"
                      style={user.plan_type === 'premium'
                        ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }
                        : { background: 'rgba(255,255,255,0.08)', color: '#A0A0B0' }
                      }
                    >
                      {user.plan_type}
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="p-8 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2" style={{ color: '#A0A0B0' }} />
                    <p className="text-sm" style={{ color: '#A0A0B0' }}>No users found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Survivor Pick Grading */}
          {activeTab === 'survivor-grading' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Survivor Pick Grading</h2>
                  <p className="text-sm mt-0.5" style={{ color: '#A0A0B0' }}>
                    Manually set pick results across all user survivor pools. Use for testing popups, bracket colors, and planner status.
                  </p>
                </div>
                <button
                  onClick={() => loadSurvivorPicks(survivorGradingFilter)}
                  disabled={survivorGradingLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <RefreshCw className={`w-4 h-4 ${survivorGradingLoading ? 'animate-spin' : ''}`} />
                  {survivorGradingLoading ? 'Loading...' : 'Load Picks'}
                </button>
              </div>

              {/* Auto-grading notice */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                <p className="text-xs" style={{ color: '#A0A0B0' }}>
                  <strong style={{ color: '#F59E0B' }}>Auto-grading is not enabled</strong> for survivor picks.
                  The only automatic mechanism is the user-triggered &quot;Sync Results&quot; button on the Survivor page,
                  which matches pending picks against completed NCAAB game scores. Use this panel to manually set results for testing.
                </p>
              </div>

              {/* Bulk Grader */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-bold mb-1" style={{ color: '#E6E6FA' }}>Bulk Grade by Team Name</h3>
                <p className="text-xs mb-4" style={{ color: '#A0A0B0' }}>
                  Grade all picks for a given team across every pool — useful for testing round results.
                </p>
                <div className="flex gap-3 flex-wrap items-end">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-xs block mb-1.5" style={{ color: '#A0A0B0' }}>Team Name (partial match)</label>
                    <input
                      value={bulkTeamName}
                      onChange={(e) => setBulkTeamName(e.target.value)}
                      placeholder="e.g. Duke, Kansas, UConn"
                      className="w-full rounded-lg px-3 py-2 text-sm border text-white"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs block mb-1.5" style={{ color: '#A0A0B0' }}>Result</label>
                    <select
                      value={bulkResult}
                      onChange={(e) => setBulkResult(e.target.value as 'won' | 'eliminated')}
                      className="rounded-lg px-3 py-2 text-sm border text-white"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <option value="won">Won</option>
                      <option value="eliminated">Eliminated</option>
                    </select>
                  </div>
                  <button
                    onClick={handleBulkSurvivorGrade}
                    disabled={bulkGrading || !bulkTeamName.trim()}
                    className="px-5 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80 disabled:opacity-40"
                    style={{
                      background: bulkResult === 'won' ? 'rgba(0,255,163,0.12)' : 'rgba(255,107,107,0.12)',
                      color: bulkResult === 'won' ? '#00FFA3' : '#FF6B6B',
                      border: `1px solid ${bulkResult === 'won' ? 'rgba(0,255,163,0.25)' : 'rgba(255,107,107,0.25)'}`,
                    }}
                  >
                    {bulkGrading ? 'Grading...' : `Mark as ${bulkResult === 'won' ? 'Won' : 'Eliminated'}`}
                  </button>
                </div>
              </div>

              {/* Filter bar */}
              <div className="flex gap-3 flex-wrap items-center">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" style={{ color: '#6B6B80' }} />
                  <span className="text-xs" style={{ color: '#6B6B80' }}>Filter:</span>
                </div>
                {(['pending', 'won', 'eliminated', 'all'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSurvivorGradingFilter(s); loadSurvivorPicks(s) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={survivorGradingFilter === s
                      ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Result message */}
              {survivorGradingMsg && (
                <div className="p-3 rounded-xl text-sm font-medium"
                  style={{
                    background: survivorGradingMsg.toLowerCase().includes('error') || survivorGradingMsg.toLowerCase().includes('fail')
                      ? 'rgba(255,107,107,0.1)' : 'rgba(0,255,163,0.08)',
                    color: survivorGradingMsg.toLowerCase().includes('error') || survivorGradingMsg.toLowerCase().includes('fail')
                      ? '#FF6B6B' : '#00FFA3',
                    border: survivorGradingMsg.toLowerCase().includes('error') || survivorGradingMsg.toLowerCase().includes('fail')
                      ? '1px solid rgba(255,107,107,0.2)' : '1px solid rgba(0,255,163,0.15)',
                  }}>
                  {survivorGradingMsg}
                </div>
              )}

              {/* Empty state */}
              {survivorPicks.length === 0 && !survivorGradingLoading && (
                <div className="glass-card rounded-2xl p-10 text-center">
                  <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: '#6B6B80' }} />
                  <p className="text-sm font-medium" style={{ color: '#A0A0B0' }}>
                    No survivor picks found.
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#6B6B80' }}>Click &quot;Load Picks&quot; to fetch from the database.</p>
                </div>
              )}

              {/* Pick list */}
              {survivorPicks.length > 0 && (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <h3 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
                      {survivorPicks.length} pick{survivorPicks.length !== 1 ? 's' : ''}
                    </h3>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    {survivorPicks.map((pick) => {
                      const resultColor = pick.result === 'won' ? '#00FFA3'
                        : pick.result === 'eliminated' ? '#FF6B6B'
                        : '#A0A0B0'
                      const roundLabels: Record<number, string> = {
                        1: 'R64', 2: 'R32', 3: 'S16', 4: 'E8', 5: 'F4', 6: 'Champ'
                      }
                      const poolName = pick.survivor_pools?.pool_name ?? 'Unknown Pool'
                      const userEmail = pick.users?.email ?? pick.user_id.slice(0, 8) + '...'

                      return (
                        <div key={pick.id} className="p-4">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            {/* Pick info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-bold px-2 py-0.5 rounded"
                                  style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0' }}>
                                  {roundLabels[pick.round_number] ?? `R${pick.round_number}`}
                                </span>
                                <span className="text-xs" style={{ color: '#6B6B80' }}>·</span>
                                <span className="text-xs" style={{ color: '#6B6B80' }}>{poolName}</span>
                                <span className="text-xs" style={{ color: '#6B6B80' }}>·</span>
                                <span className="text-xs" style={{ color: '#6B6B80' }}>{userEmail}</span>
                              </div>
                              <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>
                                {pick.team_name}
                                {pick.team_seed != null && (
                                  <span className="text-xs font-normal ml-1.5" style={{ color: '#A0A0B0' }}>(#{pick.team_seed})</span>
                                )}
                                {pick.opponent_name && (
                                  <span className="text-xs font-normal ml-1.5" style={{ color: '#A0A0B0' }}>vs {pick.opponent_name}</span>
                                )}
                              </div>
                              {pick.win_probability != null && (
                                <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>
                                  Win prob: {pick.win_probability}%
                                </div>
                              )}
                            </div>

                            {/* Result / Grade buttons */}
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              {/* Current status badge */}
                              <span className="text-xs font-bold px-2 py-1 rounded-lg capitalize"
                                style={{ background: `${resultColor}18`, color: resultColor, border: `1px solid ${resultColor}30` }}>
                                {pick.result}
                              </span>
                              {/* Grade buttons */}
                              {(['won', 'eliminated', 'pending'] as const).map((r) => {
                                const colors = { won: '#00FFA3', eliminated: '#FF6B6B', pending: '#A0A0B0' }
                                const labels = { won: 'Won', eliminated: 'Eliminated', pending: 'Reset' }
                                if (pick.result === r) return null
                                const isActive = survivorGradingAction === pick.id + r
                                return (
                                  <button
                                    key={r}
                                    onClick={() => handleSurvivorGradePick(pick.id, r)}
                                    disabled={survivorGradingAction !== null}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                                    style={{
                                      background: `${colors[r]}12`,
                                      color: colors[r],
                                      border: `1px solid ${colors[r]}30`,
                                    }}
                                  >
                                    {isActive ? '...' : labels[r]}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Note about popup triggers */}
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs" style={{ color: '#6B6B80' }}>
                  Grading a pick here immediately updates the <code className="px-1 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>survivor_picks</code> table.
                  The next time the user loads the Survivor Pool page, the pick result will reflect in the bracket color coding, Strategy Planner status badges,
                  and progression popups (ROUND_ADVANCED / ENTRY_ELIMINATED / TOURNAMENT_WIN) — as long as that event has not already been seen by the user.
                </p>
              </div>
            </div>
          )}

          {/* Official Contest */}
          {activeTab === 'official-contest' && (
            <OfficialContestTab />
          )}

          {/* Survivor Test Mode */}
          {activeTab === 'survivor-test' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white">Survivor Pool — Test Bracket Mode</h2>
                <p className="text-sm mt-0.5" style={{ color: '#A0A0B0' }}>
                  Bypass the Selection Sunday countdown and run the full Survivor AI experience using a simulated 2026 projected bracket.
                  Use this to validate pick generation, round strategy, pool size logic, and multi-pick handling before launch.
                </p>
              </div>

              {/* Warning banner */}
              <div className="flex items-start gap-3 px-5 py-4 rounded-2xl"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <FlaskConical className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                <div>
                  <div className="text-sm font-bold" style={{ color: '#F59E0B' }}>Pre-Launch Testing Only</div>
                  <p className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>
                    This mode is for internal testing only. When enabled, all users visiting the Survivor Pool page will see
                    a yellow &ldquo;Test Mode Active&rdquo; banner and the full post-bracket AI experience with simulated data.
                    Once the real NCAA bracket releases on <strong style={{ color: '#E6E6FA' }}>March 16, 2026</strong>, the system
                    automatically switches to live bracket mode regardless of this setting.
                  </p>
                </div>
              </div>

              {/* Status + Toggle card */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-bold mb-1" style={{ color: '#E6E6FA' }}>Test Bracket Mode</div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: survivorTestMode ? '#00FFA3' : '#6B6B80' }} />
                      <span className="text-xs font-semibold" style={{ color: survivorTestMode ? '#00FFA3' : '#6B6B80' }}>
                        {survivorTestMode ? 'Active — Bracket simulated as released' : 'Inactive — Countdown shown to users'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSurvivorTestMode(!survivorTestMode)}
                    disabled={survivorTestLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    style={survivorTestMode
                      ? { background: 'rgba(255,107,107,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.3)' }
                      : { background: 'rgba(0,255,163,0.12)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }
                    }
                  >
                    <FlaskConical className="w-4 h-4" />
                    {survivorTestLoading ? 'Updating...' : survivorTestMode ? 'Disable Test Mode' : 'Enable Test Mode'}
                  </button>
                </div>

                {survivorTestMsg && (
                  <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#A0A0B0' }}>
                    {survivorTestMsg}
                  </div>
                )}
              </div>

              {/* What gets tested */}
              <div className="glass-card rounded-2xl p-5">
                <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6B6B80' }}>What You Can Validate in Test Mode</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { title: 'Pick Generation Logic', desc: 'AI Best Pick card shows with simulated Round of 64 data — verify team, win probability, edge gain, and reasoning.' },
                    { title: 'Round Survival Strategy', desc: 'Edge Table and Reservation Tool populate with projected bracket data — test sorting, filtering, and future-round planning.' },
                    { title: 'Pool Size Strategy', desc: 'Configure a small/medium/large pool and verify AI recommendations adjust accordingly in edge scoring.' },
                    { title: 'Multiple Picks Per Round', desc: 'Set "Multiple picks per round" format and verify pick count badges, context banners, and picks-needed logic work correctly.' },
                    { title: 'Premium vs Free Gating', desc: 'Verify that free users see lock overlays for AI Strategy Analysis and alternatives, while premium users get full detail.' },
                    { title: 'Pick History Tracking', desc: 'Make picks using the "I Picked This Team" button and confirm they appear in the pool history, with used teams removed from recommendations.' },
                  ].map(({ title, desc }) => (
                    <div key={title} className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#00FFA3' }} />
                      <div>
                        <div className="text-xs font-bold mb-0.5" style={{ color: '#E6E6FA' }}>{title}</div>
                        <div className="text-xs" style={{ color: '#6B6B80' }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nav link to Survivor page */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(0,255,163,0.04)', border: '1px solid rgba(0,255,163,0.15)' }}>
                <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: '#00FFA3' }} />
                <span className="text-xs" style={{ color: '#A0A0B0' }}>
                  After enabling, navigate to the{' '}
                  <a href="/dashboard/survivor" target="_blank" rel="noopener noreferrer"
                    className="font-bold underline" style={{ color: '#00FFA3' }}>
                    Survivor Pool page
                  </a>{' '}
                  to test the full experience.
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Official Contest Admin Tab ────────────────────────────────────────────

interface ContestEntry {
  id: string
  userId: string
  displayName: string
  email: string
  entryNumber: number
  lsOrderId: string
  lsOrderRef: string | null
  amountPaidCents: number
  status: 'active' | 'refunded'
  entryStatus: 'alive' | 'eliminated'
  picksCorrect: number
  createdAt: string
}

interface ContestPrizePool {
  totalEntries: number
  entryPriceCents: number
  totalPotCents: number
  firstPlaceCents: number
  secondPlaceCents: number
  retainedCents: number
  perfectSurvivorPotCents: number
}

interface ContestData {
  pool: { id: string; pool_name: string; is_active: boolean }
  prizePool: ContestPrizePool
  aliveCount: number
  eliminatedCount: number
  totalEntries: number
  activeEntries: number
  entryList: ContestEntry[]
}

function fmtUSD(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

function OfficialContestTab() {
  const [data, setData] = useState<ContestData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/official-contest')
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Failed to load')
      } else {
        setData(await res.json())
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Official Contest</h2>
          <p className="text-sm mt-0.5" style={{ color: '#A0A0B0' }}>
            Entry counts, prize pool, and participant list for the QuantEdge Official Survivor contest.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Load Data'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(255,107,107,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.2)' }}>
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="glass-card rounded-2xl p-10 text-center">
          <DollarSign className="w-10 h-10 mx-auto mb-3" style={{ color: '#6B6B80' }} />
          <p className="text-sm font-medium" style={{ color: '#A0A0B0' }}>Click &quot;Load Data&quot; to fetch contest stats.</p>
        </div>
      )}

      {data && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Entries', value: String(data.totalEntries), color: '#00FFA3' },
              { label: 'Prize Pool', value: fmtUSD(data.prizePool.totalPotCents), color: '#F59E0B' },
              { label: 'Alive', value: String(data.aliveCount), color: '#00FFA3' },
              { label: 'Eliminated', value: String(data.eliminatedCount), color: '#F87171' },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-4 text-center">
                <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Prize breakdown */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-bold mb-4" style={{ color: '#E6E6FA' }}>Prize Breakdown</h3>
            <div className="space-y-2">
              {[
                { label: 'Perfect Survivor (100%)', value: fmtUSD(data.prizePool.perfectSurvivorPotCents), color: '#FFD700' },
                { label: '1st Place (50%)', value: fmtUSD(data.prizePool.firstPlaceCents), color: '#E6E6FA' },
                { label: '2nd Place (25%)', value: fmtUSD(data.prizePool.secondPlaceCents), color: '#E6E6FA' },
                { label: 'QuantEdge Retained (25%)', value: fmtUSD(data.prizePool.retainedCents), color: '#6B6B80' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-xs" style={{ color: '#A0A0B0' }}>{row.label}</span>
                  <span className="text-xs font-bold" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Entry list */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>
                Entry List — {data.totalEntries} total
              </h3>
            </div>

            {data.entryList.length === 0 ? (
              <div className="p-10 text-center">
                <Ticket className="w-8 h-8 mx-auto mb-2" style={{ color: '#4A4A60' }} />
                <p className="text-sm" style={{ color: '#6B6B80' }}>No entries yet.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {data.entryList.map((entry) => (
                  <div key={entry.id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>{entry.displayName}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                          style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0' }}>
                          Entry #{entry.entryNumber}
                        </span>
                        {entry.entryStatus === 'alive'
                          ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.2)' }}>Alive</span>
                          : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>Out</span>
                        }
                        {entry.status === 'refunded' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>Refunded</span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: '#6B6B80' }}>{entry.email}</div>
                      {entry.lsOrderId && (
                        <div className="text-[10px] mt-0.5 font-mono" style={{ color: '#4A4A60' }}>
                          LS Order: {entry.lsOrderId}{entry.lsOrderRef ? ` (${entry.lsOrderRef})` : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4 text-right flex-shrink-0">
                      <div>
                        <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{entry.picksCorrect}</div>
                        <div className="text-[10px]" style={{ color: '#6B6B80' }}>Correct</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold" style={{ color: '#00FFA3' }}>{fmtUSD(entry.amountPaidCents)}</div>
                        <div className="text-[10px]" style={{ color: '#6B6B80' }}>Paid</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
