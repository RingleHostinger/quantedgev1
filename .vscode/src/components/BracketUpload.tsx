'use client'

import { useState, useRef } from 'react'
import { Upload, Link, FileImage, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BracketPicks } from '@/lib/bracket-analysis'

interface BracketUploadProps {
  onParsed: (picks: BracketPicks) => void
  onClose: () => void
}

type UploadTab = 'image' | 'espn'

// Mock popular bracket picks (returned when image is "parsed")
const POPULAR_BRACKET: BracketPicks = {
  round64: {
    East_r64_0: 'Connecticut', East_r64_1: 'Northwestern', East_r64_2: 'San Diego State',
    East_r64_3: 'Auburn', East_r64_4: 'BYU', East_r64_5: 'Illinois',
    East_r64_6: 'Washington State', East_r64_7: 'Iowa State',
    West_r64_0: 'North Carolina', West_r64_1: 'Michigan State', West_r64_2: 'Saint Mary\'s',
    West_r64_3: 'Alabama', West_r64_4: 'Clemson', West_r64_5: 'Baylor',
    West_r64_6: 'Dayton', West_r64_7: 'Arizona',
    South_r64_0: 'Houston', South_r64_1: 'Nebraska', South_r64_2: 'Wisconsin',
    South_r64_3: 'Duke', South_r64_4: 'Texas Tech', South_r64_5: 'Kentucky',
    South_r64_6: 'Florida', South_r64_7: 'Marquette',
    Midwest_r64_0: 'Purdue', Midwest_r64_1: 'Utah State', Midwest_r64_2: 'Gonzaga',
    Midwest_r64_3: 'Kansas', Midwest_r64_4: 'South Carolina', Midwest_r64_5: 'Creighton',
    Midwest_r64_6: 'Texas', Midwest_r64_7: 'Tennessee',
  },
  round32: {
    East_r32_0: 'Connecticut', East_r32_1: 'San Diego State', East_r32_2: 'Illinois', East_r32_3: 'Iowa State',
    West_r32_0: 'North Carolina', West_r32_1: 'Saint Mary\'s', West_r32_2: 'Baylor', West_r32_3: 'Arizona',
    South_r32_0: 'Houston', South_r32_1: 'Wisconsin', South_r32_2: 'Kentucky', South_r32_3: 'Marquette',
    Midwest_r32_0: 'Purdue', Midwest_r32_1: 'Gonzaga', Midwest_r32_2: 'Creighton', Midwest_r32_3: 'Tennessee',
  },
  sweet16: {
    East_s16_0: 'Connecticut', East_s16_1: 'Iowa State',
    West_s16_0: 'North Carolina', West_s16_1: 'Arizona',
    South_s16_0: 'Houston', South_s16_1: 'Marquette',
    Midwest_s16_0: 'Purdue', Midwest_s16_1: 'Tennessee',
  },
  elite8: {
    East_e8_0: 'Connecticut',
    West_e8_0: 'North Carolina',
    South_e8_0: 'Houston',
    Midwest_e8_0: 'Purdue',
  },
  finalFour: {
    ff_top: 'Connecticut',
    ff_bottom: 'Houston',
  },
  championship: 'Connecticut',
  champion: 'Connecticut',
}

export function BracketUpload({ onParsed, onClose }: BracketUploadProps) {
  const [activeTab, setActiveTab] = useState<UploadTab>('image')
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(false)
  const [error, setError] = useState('')
  const [espnUrl, setEspnUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG)')
      return
    }
    setError('')
    setParsing(true)

    // Simulate AI parsing delay
    await new Promise(r => setTimeout(r, 2500))
    setParsing(false)
    setParsed(true)

    // After brief success display, pass picks back
    setTimeout(() => {
      onParsed(POPULAR_BRACKET)
    }, 800)
  }

  async function handleEspnImport() {
    if (!espnUrl.trim()) {
      setError('Please enter an ESPN bracket URL')
      return
    }
    setError('')
    setParsing(true)

    // Simulate ESPN import
    await new Promise(r => setTimeout(r, 1800))
    setParsing(false)
    setParsed(true)

    setTimeout(() => {
      onParsed(POPULAR_BRACKET)
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: '#1A1A2E', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Upload Your Bracket</h2>
          <button onClick={onClose} className="text-sm hover:text-white transition-colors"
            style={{ color: '#A0A0B0' }}>Close</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {([
            { id: 'image' as const, label: 'Screenshot / Image', icon: FileImage },
            { id: 'espn'  as const, label: 'ESPN Import', icon: Link },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setError(''); setParsed(false) }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === id ? 'rgba(0,255,163,0.15)' : 'transparent',
                color: activeTab === id ? '#00FFA3' : '#A0A0B0',
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {parsed ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#00FFA3' }} />
            <p className="text-white font-semibold mb-1">Bracket parsed successfully!</p>
            <p className="text-sm" style={{ color: '#A0A0B0' }}>Loading your picks into the builder...</p>
          </div>
        ) : parsing ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full border-2 border-t-transparent mx-auto mb-3 animate-spin"
              style={{ borderColor: '#00FFA3', borderTopColor: 'transparent' }} />
            <p className="text-white font-semibold mb-1">
              {activeTab === 'image' ? 'AI is parsing your bracket...' : 'Importing from ESPN...'}
            </p>
            <p className="text-sm" style={{ color: '#A0A0B0' }}>Identifying teams and picks</p>
          </div>
        ) : activeTab === 'image' ? (
          <div>
            <div
              className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
              style={{
                borderColor: dragOver ? '#00FFA3' : 'rgba(255,255,255,0.12)',
                background: dragOver ? 'rgba(0,255,163,0.05)' : 'rgba(255,255,255,0.02)',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file) handleFile(file)
              }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: dragOver ? '#00FFA3' : '#6B6B80' }} />
              <p className="text-sm font-medium text-white mb-1">Drop your bracket screenshot here</p>
              <p className="text-xs" style={{ color: '#6B6B80' }}>or click to browse — JPG, PNG supported</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
            <p className="text-xs mt-3 text-center" style={{ color: '#6B6B80' }}>
              Works with ESPN, CBS Sports, NCAA.com bracket screenshots
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block" style={{ color: '#A0A0B0' }}>
                ESPN Bracket URL
              </Label>
              <Input
                value={espnUrl}
                onChange={e => setEspnUrl(e.target.value)}
                placeholder="https://fantasy.espn.com/tournament-challenge-bracket/..."
                className="border-white/10 text-white placeholder:text-white/30"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              />
            </div>
            <p className="text-xs" style={{ color: '#6B6B80' }}>
              Paste your ESPN Tournament Challenge bracket URL or share link
            </p>
            <Button
              onClick={handleEspnImport}
              className="w-full gradient-green text-black font-semibold border-0 hover:opacity-90"
            >
              Import Bracket
            </Button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-lg text-sm"
            style={{ background: 'rgba(255,107,107,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.2)' }}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
