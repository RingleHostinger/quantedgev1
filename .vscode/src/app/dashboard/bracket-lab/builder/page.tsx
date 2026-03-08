'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, ChevronDown } from 'lucide-react'
import { BracketBuilder } from '@/components/BracketBuilder'
import { BracketUpload } from '@/components/BracketUpload'
import { BracketTeam, BracketPicks } from '@/lib/bracket-analysis'
import { useAuth } from '@/hooks/useAuth'

const POOL_SIZES = [10, 25, 50, 100, 500]

export default function BracketBuilderPage() {
  const { isPremium, loading: authLoading } = useAuth()
  const router = useRouter()
  const [teams, setTeams] = useState<BracketTeam[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [bracketName, setBracketName] = useState('My 2025 Bracket')
  const [poolSize, setPoolSize] = useState(25)
  const [showUpload, setShowUpload] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [initialPicks, setInitialPicks] = useState<BracketPicks | undefined>()

  useEffect(() => {
    if (!authLoading && !isPremium) {
      router.push('/dashboard/pricing')
    }
  }, [authLoading, isPremium, router])

  useEffect(() => {
    fetch('/api/bracket-teams')
      .then(r => r.json())
      .then(d => { setTeams(d.teams ?? []); setLoadingTeams(false) })
      .catch(() => setLoadingTeams(false))
  }, [])

  async function handleSubmit(picks: BracketPicks) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bracketName, pool_size: poolSize, source: 'builder', picks }),
      })
      const data = await res.json()
      if (res.ok && data.bracket?.id) {
        router.push(`/dashboard/bracket-lab/analysis/${data.bracket.id}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  function handleUploaded(picks: BracketPicks) {
    setShowUpload(false)
    setInitialPicks(picks)
  }

  if (authLoading || loadingTeams) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#00FFA3', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="max-w-full px-4 py-6 space-y-6">
      {showUpload && (
        <BracketUpload onParsed={handleUploaded} onClose={() => setShowUpload(false)} />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
              March Madness 2025
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Bracket Builder</h1>
          <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>
            Click teams to advance them. Complete all 63 picks to analyze.
          </p>
        </div>

        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{ background: 'rgba(255,255,255,0.07)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Upload className="w-4 h-4" />
          Upload Instead
        </button>
      </div>

      {/* Settings bar */}
      <div className="flex flex-wrap gap-4 p-4 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#A0A0B0' }}>Bracket Name</label>
          <input
            value={bracketName}
            onChange={e => setBracketName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-white"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#A0A0B0' }}>Pool Size</label>
          <div className="relative">
            <select
              value={poolSize}
              onChange={e => setPoolSize(Number(e.target.value))}
              className="appearance-none px-4 py-2 pr-8 rounded-lg text-sm text-white"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {POOL_SIZES.map(s => (
                <option key={s} value={s} style={{ background: '#1A1A2E' }}>
                  {s === 500 ? '500+ entries' : `${s} entries`}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: '#6B6B80' }} />
          </div>
        </div>
        <div className="flex items-end">
          <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(0,255,163,0.08)', color: '#00FFA3' }}>
            AI will tailor strategy for {poolSize === 500 ? '500+' : poolSize} entries
          </div>
        </div>
      </div>

      {/* Bracket */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <BracketBuilder
          teams={teams}
          initialPicks={initialPicks}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </div>
    </div>
  )
}
