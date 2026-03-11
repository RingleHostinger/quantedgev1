'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QuantEdgeLogo } from '@/components/QuantEdgeLogo'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <h1 className="text-xl font-bold text-white mb-2">Invalid Reset Link</h1>
        <p className="text-sm mb-6" style={{ color: '#A0A0B0' }}>
          This password reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password">
          <Button className="gradient-green text-black font-semibold border-0 hover:opacity-90 neon-glow">
            Request New Link
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl p-8">
      {success ? (
        <div className="text-center py-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(0,255,163,0.12)', border: '1px solid rgba(0,255,163,0.25)' }}
          >
            <CheckCircle className="w-7 h-7" style={{ color: '#00FFA3' }} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Password Reset</h1>
          <p className="text-sm mb-6" style={{ color: '#A0A0B0' }}>
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <Link href="/login">
            <Button className="gradient-green text-black font-semibold border-0 hover:opacity-90 neon-glow">
              Sign In
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-white mb-1">Set new password</h1>
          <p className="text-sm mb-8" style={{ color: '#A0A0B0' }}>
            Enter your new password below.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(255,107,107,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.3)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password" className="text-sm font-medium" style={{ color: '#A0A0B0' }}>New Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
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

            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium" style={{ color: '#A0A0B0' }}>Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
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
              {loading ? 'Resetting...' : 'Reset Password'}
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
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0F0F1A' }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <QuantEdgeLogo variant="full" width={240} href="/login" />
        </div>
        <Suspense fallback={
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-sm" style={{ color: '#A0A0B0' }}>Loading...</p>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
