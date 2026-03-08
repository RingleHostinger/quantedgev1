'use client'

import { useState } from 'react'
import { Star, Check, Shield, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const FREE_FEATURES = [
  '1 free AI pick per day',
  'Limited predictions access',
  'Basic game analysis',
  'Win probability view',
]

const PREMIUM_FEATURES = [
  'Full Top AI Edges access',
  'Upset Radar',
  'Betting Heat Map',
  'Daily AI Briefing',
  'Model Performance tracking',
  'Bracket Lab tools',
  'All predictions unlocked',
]

const FAQ = [
  {
    q: 'How many free picks do I get?',
    a: 'Free users receive 1 AI pick per day, selected by the QuantEdge team from the top available edges.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Subscriptions can be cancelled anytime from your Account page. You keep Premium access until the end of your billing period.',
  },
  {
    q: 'When does billing occur?',
    a: 'Billing occurs monthly from the date of your subscription. You can view your next billing date from the Account page.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'All major credit and debit cards are accepted via Stripe. Your payment details are never stored on our servers.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <span className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: '#6B6B80' }} />
          : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#6B6B80' }} />
        }
      </button>
      {open && (
        <div className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-sm leading-relaxed" style={{ color: '#A0A0B0' }}>{a}</p>
        </div>
      )}
    </div>
  )
}

export default function PricingPage() {
  const { isPremium } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Stripe is not configured yet. Please contact support.')
      }
    } catch {
      alert('Failed to start checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-10" style={{ background: '#0F0F1A', minHeight: '100%' }}>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-black mb-2" style={{ color: '#E6E6FA' }}>
          Unlock the Full QuantEdge AI Model
        </h1>
        <p className="text-base" style={{ color: '#A0A0B0' }}>
          Get access to advanced AI betting insights, edges, and analytics.
        </p>
      </div>

      {/* Already premium banner */}
      {isPremium && (
        <div
          className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.25)' }}
        >
          <Star className="w-5 h-5 flex-shrink-0" style={{ color: '#00FFA3' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#00FFA3' }}>You&apos;re on Premium</p>
            <p className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>You have full access to all features. Manage billing in your Account page.</p>
          </div>
        </div>
      )}

      {/* Two plan cards */}
      <div className="grid md:grid-cols-2 gap-5">

        {/* Free Plan */}
        <div
          className="rounded-2xl p-7 flex flex-col"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="mb-5">
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6B6B80' }}>Free</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black" style={{ color: '#E6E6FA' }}>$0</span>
            </div>
            <p className="text-sm" style={{ color: '#6B6B80' }}>Forever free</p>
          </div>

          <ul className="space-y-3 mb-7 flex-1">
            {FREE_FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(160,160,176,0.15)' }}>
                  <Check className="w-3 h-3" style={{ color: '#A0A0B0' }} />
                </div>
                <span style={{ color: '#A0A0B0' }}>{feat}</span>
              </li>
            ))}
            {/* Locked features preview */}
            {['Top AI Edges', 'Upset Radar', 'Betting Heat Map'].map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm opacity-40">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Lock className="w-3 h-3" style={{ color: '#6B6B80' }} />
                </div>
                <span style={{ color: '#6B6B80' }}>{feat}</span>
              </li>
            ))}
          </ul>

          <Button
            disabled
            variant="outline"
            className="w-full border-white/10"
            style={{ color: '#6B6B80' }}
          >
            {isPremium ? 'Downgrade' : 'Get Started Free'}
          </Button>
        </div>

        {/* Premium Plan */}
        <div
          className="rounded-2xl p-7 flex flex-col relative"
          style={{
            background: 'linear-gradient(135deg, rgba(0,255,163,0.07), rgba(59,130,246,0.07))',
            border: '1px solid rgba(0,255,163,0.28)',
            boxShadow: '0 0 30px rgba(0,255,163,0.08)',
          }}
        >
          {/* Most Popular badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <div
              className="text-xs font-black px-4 py-1 rounded-full"
              style={{ background: '#00FFA3', color: '#0F0F1A' }}
            >
              Most Popular
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#00FFA3' }}>Premium</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black" style={{ color: '#E6E6FA' }}>$19.99</span>
              <span className="text-base" style={{ color: '#6B6B80' }}>/month</span>
            </div>
            <p className="text-sm" style={{ color: '#6B6B80' }}>Cancel anytime</p>
          </div>

          <ul className="space-y-3 mb-7 flex-1">
            {PREMIUM_FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,255,163,0.2)' }}>
                  <Check className="w-3 h-3" style={{ color: '#00FFA3' }} />
                </div>
                <span style={{ color: '#E6E6FA' }}>{feat}</span>
              </li>
            ))}
          </ul>

          {isPremium ? (
            <Button
              disabled
              className="w-full border-0"
              style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}
            >
              <Star className="w-4 h-4 mr-2" />
              Current Plan
            </Button>
          ) : (
            <Button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full gradient-green text-black font-black border-0 hover:opacity-90 neon-glow py-5 text-base"
            >
              {loading ? 'Redirecting...' : (
                <>
                  <Star className="w-4 h-4 mr-2" />
                  Upgrade to Premium
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Trust signals */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: '#00FFA3' }} />
          <span className="text-sm" style={{ color: '#A0A0B0' }}>Secure payments powered by Stripe</span>
        </div>
        <span className="hidden sm:block" style={{ color: '#4A4A60' }}>·</span>
        <span className="text-sm" style={{ color: '#A0A0B0' }}>Cancel anytime, no commitment</span>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-black mb-4 text-center" style={{ color: '#E6E6FA' }}>
          Frequently Asked Questions
        </h2>
        <div className="space-y-2">
          {FAQ.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      <p className="text-xs text-center pb-4" style={{ color: '#4A4A60' }}>
        For entertainment purposes only. Past performance does not guarantee future results.
      </p>
    </div>
  )
}
