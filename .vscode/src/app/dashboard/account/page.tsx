'use client'

import { useState } from 'react'
import { User, Star, CreditCard, LogOut, CheckCircle, ExternalLink, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function AccountPage() {
  const { user, isPremium, logout } = useAuth()
  const [billingLoading, setBillingLoading] = useState(false)

  const handleBillingPortal = async () => {
    setBillingLoading(true)
    try {
      const res = await fetch('/api/stripe/billing-portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Billing portal is not configured yet. Please contact support to manage your subscription.')
      }
    } catch {
      alert('Unable to open billing portal. Please try again or contact support.')
    } finally {
      setBillingLoading(false)
    }
  }

  if (!user) return null

  const initials = user.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email[0]?.toUpperCase()

  return (
    <div className="p-6 max-w-xl mx-auto space-y-5" style={{ background: '#0F0F1A', minHeight: '100%' }}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: '#E6E6FA' }}>Account</h1>
        <p className="text-sm mt-1" style={{ color: '#A0A0B0' }}>Manage your profile and subscription</p>
      </div>

      {/* Current Plan Banner */}
      <div
        className="rounded-2xl p-5"
        style={isPremium
          ? { background: 'rgba(0,255,163,0.07)', border: '1px solid rgba(0,255,163,0.25)' }
          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
        }
      >
        <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: isPremium ? '#00FFA3' : '#6B6B80' }}>
          Current Plan
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-black" style={{ color: '#E6E6FA' }}>
              {isPremium ? 'Premium' : 'Free Plan'}
            </div>
            {isPremium && (
              <div className="flex items-center gap-1.5 mt-1">
                <CheckCircle className="w-3.5 h-3.5" style={{ color: '#00FFA3' }} />
                <span className="text-sm font-semibold" style={{ color: '#00FFA3' }}>Active</span>
              </div>
            )}
          </div>
          <div
            className="text-xs font-black px-3 py-1.5 rounded-full"
            style={isPremium
              ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }
              : { background: 'rgba(255,255,255,0.06)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            {isPremium ? 'PREMIUM' : 'FREE'}
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4" style={{ color: '#A0A0B0' }} />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#A0A0B0' }}>Account Information</h2>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm"
            style={{ background: 'linear-gradient(135deg, #00FFA3, #3B82F6)', color: '#0F0F1A' }}
          >
            {initials}
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: '#E6E6FA' }}>{user.name}</div>
            <div className="text-xs" style={{ color: '#6B6B80' }}>Member since {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}</div>
          </div>
        </div>

        <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Fields */}
        {[
          { label: 'Email', value: user.email },
          { label: 'Plan', value: isPremium ? 'Premium' : 'Free Plan' },
          { label: 'Status', value: isPremium ? 'Active' : 'Free tier' },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>{label}</span>
            <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>{value}</span>
          </div>
        ))}

        <p className="text-xs pt-1" style={{ color: '#4A4A60' }}>
          To update your name or email, please contact support.
        </p>
      </div>

      {/* Subscription Management */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" style={{ color: '#A0A0B0' }} />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#A0A0B0' }}>Subscription</h2>
        </div>

        {isPremium ? (
          <div className="space-y-3">
            <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Plan</span>
                <span className="text-sm font-bold" style={{ color: '#E6E6FA' }}>Premium — $19.99/month</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Billing</span>
                <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Monthly</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold" style={{ color: '#6B6B80' }}>Status</span>
                <span className="text-sm font-semibold" style={{ color: '#00FFA3' }}>Active</span>
              </div>
            </div>

            <Button
              onClick={handleBillingPortal}
              disabled={billingLoading}
              variant="outline"
              className="w-full border-white/10 hover:bg-white/5"
              style={{ color: '#E6E6FA' }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {billingLoading ? 'Opening...' : 'Manage Billing'}
            </Button>
            <p className="text-xs text-center" style={{ color: '#4A4A60' }}>
              Cancel, update payment method, or view billing history
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-xs font-semibold mb-3" style={{ color: '#6B6B80' }}>Upgrade to Premium to unlock:</div>
              {[
                'Top AI Edges',
                'Upset Radar',
                'Betting Heat Map',
                'Daily AI Briefing',
                'Advanced analytics',
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2">
                  <Lock className="w-3 h-3 flex-shrink-0" style={{ color: '#4A4A60' }} />
                  <span className="text-sm" style={{ color: '#A0A0B0' }}>{feat}</span>
                </div>
              ))}
            </div>
            <Link href="/dashboard/pricing">
              <Button className="w-full gradient-green text-black font-black border-0 neon-glow py-5">
                <Star className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Sign Out */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Button
          onClick={logout}
          variant="outline"
          className="w-full border-white/10 hover:bg-red-500/10 hover:border-red-500/30"
          style={{ color: '#A0A0B0' }}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
