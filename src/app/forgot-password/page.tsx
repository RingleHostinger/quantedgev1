'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QuantEdgeLogo } from '@/components/QuantEdgeLogo'
import { CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0F0F1A' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <QuantEdgeLogo variant="full" width={240} href="/login" />
        </div>

        <div className="glass-card rounded-2xl p-8">
          {submitted ? (
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(0,255,163,0.12)', border: '1px solid rgba(0,255,163,0.25)' }}
              >
                <CheckCircle className="w-7 h-7" style={{ color: '#00FFA3' }} />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Check your email</h1>
              <p className="text-sm mb-6" style={{ color: '#A0A0B0' }}>
                If an account exists for <span className="font-semibold text-white">{email}</span>, you&apos;ll receive a password reset link shortly.
              </p>
              <Link href="/login">
                <Button className="gradient-green text-black font-semibold border-0 hover:opacity-90 neon-glow">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white mb-1">Reset your password</h1>
              <p className="text-sm mb-8" style={{ color: '#A0A0B0' }}>
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(255,107,107,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.3)' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 font-semibold gradient-green text-black border-0 hover:opacity-90 neon-glow"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>

              <p className="text-center text-sm mt-6" style={{ color: '#A0A0B0' }}>
                Remember your password?{' '}
                <Link href="/login" className="font-semibold hover:underline" style={{ color: '#00FFA3' }}>
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
