'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, AlertCircle, Calendar, Clock } from 'lucide-react'
import { BracketBuilder } from '@/components/BracketBuilder'
import { BracketTeam, BracketPicks } from '@/lib/bracket-analysis'
import { useAuth } from '@/hooks/useAuth'

interface BracketMeta {
  id: string
  name: string
  pool_size: number
  picks: BracketPicks
  created_at: string
  updated_at: string
}

const POOL_SIZES = [10, 25, 50, 100, 500]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

export default function BracketEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isPremium, loading: authLoading } = useAuth()
  const router = useRouter()

  const [bracket, setBracket] = useState<BracketMeta | null>(null)
  const [teams, setTeams] = useState<BracketTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [bracketName, setBracketName] = useState('')
  const [poolSize, setPoolSize] = useState(25)

  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Track whether picks have changed since last save
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    if (!authLoading && !isPremium) router.push('/dashboard/pricing')
  }, [authLoading, isPremium, router])

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/brackets/${id}`).then(r => r.json()),
      fetch('/api/bracket-teams').then(r => r.json()),
    ])
      .then(([bracketData, teamsData]) => {
        const b = bracketData.bracket
        if (b) {
          setBracket(b)
          setBracketName(b.name)
          setPoolSize(b.pool_size ?? 25)
        }
        setTeams(teamsData.teams ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  function handlePicksChange(_picks: BracketPicks) {
    setHasUnsavedChanges(true)
    setSavedOk(false)
    setSaveError(null)
  }

  async function handleSave(picks: BracketPicks) {
    setSaving(true)
    setSavedOk(false)
    setSaveError(null)
    try {
      const res = await fetch(`/api/brackets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bracketName, pool_size: poolSize, picks }),
      })
      if (res.ok) {
        const data = await res.json()
        setBracket(prev => prev ? { ...prev, updated_at: data.bracket?.updated_at ?? new Date().toISOString(), name: bracketName, pool_size: poolSize, picks } : prev)
        setSavedOk(true)
        setHasUnsavedChanges(false)
      } else {
        setSaveError('Failed to save. Please try again.')
      }
    } catch {
      setSaveError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAnalyze(picks: BracketPicks) {
    // If there are unsaved changes, save first silently, then analyze
    if (hasUnsavedChanges) return
    setAnalyzing(true)
    try {
      const res = await fetch(`/api/brackets/${id}/analyze`, { method: 'POST' })
      if (res.ok) {
        router.push(`/dashboard/bracket-lab/bracket/${id}/analysis`)
      }
    } catch {
      // silently ignore — redirect won't happen
    } finally {
      setAnalyzing(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#00FFA3', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!bracket) {
    return (
      <div className="text-center py-20">
        <p style={{ color: '#A0A0B0' }}>Bracket not found.</p>
        <button onClick={() => router.push('/dashboard/bracket-lab')}
          className="mt-4 text-sm underline" style={{ color: '#00FFA3' }}>
          Back to My Brackets
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-full px-4 py-6 space-y-5">

      {/* Back nav */}
      <button onClick={() => router.push(`/dashboard/bracket-lab/bracket/${id}`)}
        className="text-xs hover:underline flex items-center gap-1" style={{ color: '#6B6B80' }}>
        <ArrowLeft className="w-3 h-3" />
        Back to Bracket
      </button>

      {/* Bracket metadata header */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{bracket.name}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6B6B80' }}>
                <Calendar className="w-3.5 h-3.5" />
                Created {formatDate(bracket.created_at)}
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6B6B80' }}>
                <Clock className="w-3.5 h-3.5" />
                Last Updated {formatDate(bracket.updated_at)}
              </span>
            </div>
          </div>

          {/* Settings inline */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#A0A0B0' }}>Bracket Name</label>
              <input
                value={bracketName}
                onChange={e => { setBracketName(e.target.value); setHasUnsavedChanges(true); setSavedOk(false) }}
                className="w-48 px-3 py-2 rounded-lg text-sm text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#A0A0B0' }}>Pool Size</label>
              <select
                value={poolSize}
                onChange={e => { setPoolSize(Number(e.target.value)); setHasUnsavedChanges(true); setSavedOk(false) }}
                className="appearance-none px-4 py-2 rounded-lg text-sm text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {POOL_SIZES.map(s => (
                  <option key={s} value={s} style={{ background: '#1A1A2E' }}>
                    {s === 500 ? '500+ entries' : `${s} entries`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved changes warning */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#F59E0B' }} />
          <p className="text-sm font-medium" style={{ color: '#F59E0B' }}>
            You have unsaved changes. Save before running AI analysis.
          </p>
        </div>
      )}

      {/* Save success */}
      {savedOk && !hasUnsavedChanges && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(0,255,163,0.07)', border: '1px solid rgba(0,255,163,0.22)' }}>
          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#00FFA3' }} />
          <p className="text-sm font-medium" style={{ color: '#00FFA3' }}>
            Changes saved. You can now run AI analysis.
          </p>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#FF6B6B' }} />
          <p className="text-sm font-medium" style={{ color: '#FF6B6B' }}>{saveError}</p>
        </div>
      )}

      {/* Bracket editor */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <BracketBuilder
          teams={teams}
          initialPicks={bracket.picks}
          onSave={handleSave}
          onAnalyze={handleAnalyze}
          onPicksChange={handlePicksChange}
          saving={saving}
          analyzing={analyzing}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      </div>

      <p className="text-xs text-center" style={{ color: '#4B4B60' }}>
        Save Changes stores your picks. Analyze Bracket runs the AI model on your saved bracket.
      </p>
    </div>
  )
}
