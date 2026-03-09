'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QuantEdgeLogo } from '@/components/QuantEdgeLogo'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Signup failed')
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#0F0F1A' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <QuantEdgeLogo variant="full" width={240} href="/dashboard" />
        </div>

        <div className="glass-card rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
          <p className="text-sm mb-2" style={{ color: '#A0A0B0' }}>Get 1–3 free AI picks daily, no credit card required</p>

          {/* Free features */}
          <div className="flex flex-wrap gap-2 mb-6">
            {['Free forever', '3 picks/day', 'No credit card'].map((f) => (
              <span key={f} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(0,255,163,0.1)', color: '#00FFA3' }}>
                <Check className="w-3 h-3" />
                {f}
              </span>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(255,107,107,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.3)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium" style={{ color: '#A0A0B0' }}>Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
                className="mt-1.5 border-white/10 text-white placeholder:text-white/30"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium" style={{ color: '#A0A0B0' }}>Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="mt-1.5 border-white/10 text-white placeholder:text-white/30"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium" style={{ color: '#A0A0B0' }}>Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                  className="border-white/10 text-white placeholder:text-white/30 pr-10"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#A0A0B0' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-5 font-semibold gradient-green text-black border-0 hover:opacity-90 neon-glow"
            >
              {loading ? 'Creating account...' : 'Create Free Account'}
            </Button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: '#A0A0B0' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: '#00FFA3' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
