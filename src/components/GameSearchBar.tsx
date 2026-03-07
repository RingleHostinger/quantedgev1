'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'

export interface GameSearchItem {
  id: string          // must match the DOM element id used on the card
  homeTeam: string
  awayTeam: string
  league?: string
}

interface Props {
  games: GameSearchItem[]
  placeholder?: string
}

export function GameSearchBar({ games, placeholder = 'Jump to game...' }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const q = query.trim().toLowerCase()

  const results = q.length === 0 ? [] : games.filter((g) => {
    const matchup = `${g.awayTeam} @ ${g.homeTeam} ${g.homeTeam} vs ${g.awayTeam}`.toLowerCase()
    return (
      g.homeTeam.toLowerCase().includes(q) ||
      g.awayTeam.toLowerCase().includes(q) ||
      matchup.includes(q) ||
      (g.league ?? '').toLowerCase().includes(q)
    )
  }).slice(0, 6)

  function handleSelect(item: GameSearchItem) {
    const el = document.getElementById(`game-card-${item.id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Brief highlight flash
      el.style.transition = 'box-shadow 0.2s'
      el.style.boxShadow = '0 0 0 2px rgba(0,255,163,0.6), 0 0 24px rgba(0,255,163,0.18)'
      setTimeout(() => { el.style.boxShadow = '' }, 1800)
    }
    setQuery('')
    setOpen(false)
  }

  function handleClear() {
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  // Close on click outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setOpen(true)
  }, [])

  const showDropdown = open && q.length > 0

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      {/* Input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          style={{ color: '#6B6B80' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => q.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-xl pl-8 pr-8 py-2 text-sm outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: showDropdown
              ? '1px solid rgba(0,255,163,0.35)'
              : '1px solid rgba(255,255,255,0.08)',
            color: '#E6E6FA',
          }}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: '#6B6B80' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute top-full mt-1.5 left-0 right-0 z-50 rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: '#12122A',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm" style={{ color: '#6B6B80' }}>
              No games match &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 flex items-center justify-between gap-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <span style={{ color: '#E6E6FA' }}>
                  <span style={{ color: '#A0A0B0' }}>{item.awayTeam}</span>
                  <span className="mx-1.5" style={{ color: '#4A4A60' }}>@</span>
                  <span>{item.homeTeam}</span>
                </span>
                {item.league && (
                  <span
                    className="text-xs font-semibold shrink-0 px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#6B6B80' }}
                  >
                    {item.league}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
