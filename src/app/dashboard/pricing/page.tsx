'use client'

import { useState } from 'react'
import { Star, Check, Shield, ChevronDown, ChevronUp, Lock, Trophy, FlaskConical, Brain, Target, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const FREE_FEATURES = [
  '1 free AI pick per day',
  'Limited predictions access',
  'Basic game analysis',
  'Win probability view',
]

const MADNESS_FEATURES = [
  'Bracket Lab — AI bracket builder & grader',
  'Survivor Pool AI — round strategy engine',
  'AI win probability per team',
  'Upset radar & pool strategy',
  'Bracket optimizer (3 AI versions)',
  'Duplicate risk & uniqueness scoring',
]

const PREMIUM_FEATURES = [
  'Everything in Madness Special',
  'Full Top AI Edges access',
  'Upset Radar',
  'Betting Heat Map',
  'Daily AI Briefing',
  'Model Performance tracking',
  'All predictions unlocked',
  'Unlimited AI picks',
]

const FAQ = [
  {
    q: 'What is the Madness Special plan?',
    a: 'The Madness Special is a focused March Madness plan. It unlocks Bracket Lab and Survivor Pool AI only. Everything else behaves the same as a Free account.',
  },
  {
    q: 'How many free picks do I get?',
    a: 'Free users receive 1 AI pick per day, selected by the QuantEdge team from the top available edges.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Subscriptions can be cancelled anytime from your Account page. You keep access until the end of your billing period.',
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
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
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
  const { user, isPremium, isMadness } = useAuth()
  const planType = user?.planType ?? 'free'
  const [loadingPlan, setLoadingPlan] = useState<'premium' | 'madness' | null>(null)

  const handleUpgrade = async (plan: 'premium' | 'madness') => {
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Stripe is not configured yet. Please contact support.')
      }
    } catch {
      alert('Failed to start checkout. Please try again.')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10" style={{ background: '#0F0F1A', minHeight: '100%' }}>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-black mb-2" style={{ color: '#E6E6FA' }}>
          Choose Your Plan
        </h1>
        <p className="text-base" style={{ color: '#A0A0B0' }}>
          AI-powered March Madness tools to dominate your survivor pool and bracket.
        </p>
      </div>

      {/* Conversion section */}
      <div className="rounded-2xl px-6 py-7"
        style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(0,255,163,0.05))', border: '1px solid rgba(245,158,11,0.2)' }}>
        <h2 className="text-xl font-black mb-1.5 text-center" style={{ color: '#E6E6FA' }}>
          Win Your March Madness Survivor Pool With AI
        </h2>
        <p className="text-sm text-center mb-6" style={{ color: '#A0A0B0' }}>
          QuantEdge AI analyzes win probability, public pick trends, and runs thousands of tournament simulations — so you always know the smartest pick to advance.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <Brain className="w-4 h-4" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>AI Survivor Pool strategy engine</p>
              <p className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Round-by-round pick recommendations tailored to your pool</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <Cpu className="w-4 h-4" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>10,000 tournament simulations</p>
              <p className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Monte Carlo modeling surfaces teams most likely to survive</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <Target className="w-4 h-4" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>Smart bracket optimization</p>
              <p className="text-xs mt-0.5" style={{ color: '#6B6B80' }}>Balance chalk and value picks to maximize pool equity</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active plan banner */}
      {isPremium && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.25)' }}>
          <Star className="w-5 h-5 flex-shrink-0" style={{ color: '#00FFA3' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#00FFA3' }}>You&apos;re on Premium</p>
            <p className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>You have full access to all features. Manage billing in your Account page.</p>
          </div>
        </div>
      )}
      {isMadness && !isPremium && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Trophy className="w-5 h-5 flex-shrink-0" style={{ color: '#F59E0B' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#F59E0B' }}>You&apos;re on Madness Special</p>
            <p className="text-xs mt-0.5" style={{ color: '#A0A0B0' }}>Bracket Lab and Survivor Pool AI are unlocked. Upgrade to Premium for full platform access.</p>
          </div>
        </div>
      )}

      {/* Three plan cards */}
      <div className="grid md:grid-cols-3 gap-5">

        {/* Free Plan */}
        <div className="rounded-2xl p-6 flex flex-col"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="mb-5">
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6B6B80' }}>Free</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black" style={{ color: '#E6E6FA' }}>$0</span>
            </div>
            <p className="text-sm" style={{ color: '#6B6B80' }}>Forever free</p>
          </div>

          <ul className="space-y-2.5 mb-7 flex-1">
            {FREE_FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(160,160,176,0.15)' }}>
                  <Check className="w-3 h-3" style={{ color: '#A0A0B0' }} />
                </div>
                <span style={{ color: '#A0A0B0' }}>{feat}</span>
              </li>
            ))}
            {['Bracket Lab', 'Survivor Pool AI', 'Top AI Edges'].map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm opacity-40">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
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
            {planType === 'free' ? 'Current Plan' : 'Free Plan'}
          </Button>
        </div>

        {/* Madness Special — visual focus / most popular */}
        <div className="rounded-2xl flex flex-col relative"
          style={{
            padding: isMadness && !isPremium ? '1.75rem' : '1.75rem',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,191,36,0.07))',
            border: isMadness && !isPremium
              ? '2px solid rgba(245,158,11,0.7)'
              : '2px solid rgba(245,158,11,0.45)',
            boxShadow: isMadness && !isPremium
              ? '0 0 40px rgba(245,158,11,0.18), inset 0 0 40px rgba(245,158,11,0.04)'
              : '0 0 32px rgba(245,158,11,0.14), inset 0 0 40px rgba(245,158,11,0.03)',
          }}>
          {/* Most Popular badge (always visible unless current plan overrides) */}
          {!(isMadness && !isPremium) && !isPremium && (
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <div className="text-xs font-black px-4 py-1 rounded-full whitespace-nowrap"
                style={{ background: '#F59E0B', color: '#0F0F1A' }}>
                Most Popular
              </div>
            </div>
          )}
          {isMadness && !isPremium && (
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <div className="text-xs font-black px-4 py-1 rounded-full whitespace-nowrap"
                style={{ background: '#F59E0B', color: '#0F0F1A' }}>
                Current Plan
              </div>
            </div>
          )}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4" style={{ color: '#F59E0B' }} />
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F59E0B' }}>Madness Special</div>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black" style={{ color: '#E6E6FA' }}>$19.99</span>
              <span className="text-base" style={{ color: '#6B6B80' }}>/month</span>
            </div>
            <p className="text-sm" style={{ color: '#6B6B80' }}>March Madness tools only</p>
          </div>

          <ul className="space-y-2.5 mb-7 flex-1">
            {MADNESS_FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.2)' }}>
                  <Check className="w-3 h-3" style={{ color: '#F59E0B' }} />
                </div>
                <span style={{ color: '#E6E6FA' }}>{feat}</span>
              </li>
            ))}
            {['Top AI Edges', 'Betting Heat Map', 'Daily AI Briefing'].map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm opacity-40">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Lock className="w-3 h-3" style={{ color: '#6B6B80' }} />
                </div>
                <span style={{ color: '#6B6B80' }}>{feat}</span>
              </li>
            ))}
          </ul>

          {isMadness && !isPremium ? (
            <Button disabled className="w-full border-0"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
              <Trophy className="w-4 h-4 mr-2" />
              Current Plan
            </Button>
          ) : isPremium ? (
            <Button disabled variant="outline" className="w-full border-white/10" style={{ color: '#6B6B80' }}>
              Included in Premium
            </Button>
          ) : (
            <Button
              onClick={() => handleUpgrade('madness')}
              disabled={loadingPlan !== null}
              className="w-full font-black border-0 hover:opacity-90 py-4 text-sm"
              style={{ background: 'rgba(245,158,11,0.9)', color: '#0F0F1A' }}
            >
              {loadingPlan === 'madness' ? 'Redirecting...' : (
                <>
                  <FlaskConical className="w-4 h-4 mr-2" />
                  Get Madness Special
                </>
              )}
            </Button>
          )}
        </div>

        {/* Premium Plan */}
        <div className="rounded-2xl p-6 flex flex-col relative"
          style={{
            background: 'linear-gradient(135deg, rgba(0,255,163,0.07), rgba(59,130,246,0.07))',
            border: isPremium ? '1px solid rgba(0,255,163,0.5)' : '1px solid rgba(0,255,163,0.28)',
            boxShadow: isPremium ? '0 0 30px rgba(0,255,163,0.12)' : '0 0 20px rgba(0,255,163,0.04)',
          }}>
          {isPremium && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="text-xs font-black px-4 py-1 rounded-full"
                style={{ background: '#00FFA3', color: '#0F0F1A' }}>
                Current Plan
              </div>
            </div>
          )}
          <div className="mb-5">
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#00FFA3' }}>Premium</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black" style={{ color: '#E6E6FA' }}>$39.99</span>
              <span className="text-base" style={{ color: '#6B6B80' }}>/month</span>
            </div>
            <p className="text-sm" style={{ color: '#6B6B80' }}>Full platform access · Cancel anytime</p>
          </div>

          <ul className="space-y-2.5 mb-7 flex-1">
            {PREMIUM_FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(0,255,163,0.2)' }}>
                  <Check className="w-3 h-3" style={{ color: '#00FFA3' }} />
                </div>
                <span style={{ color: '#E6E6FA' }}>{feat}</span>
              </li>
            ))}
          </ul>

          {isPremium ? (
            <Button disabled className="w-full border-0"
              style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3' }}>
              <Star className="w-4 h-4 mr-2" />
              Current Plan
            </Button>
          ) : (
            <Button
              onClick={() => handleUpgrade('premium')}
              disabled={loadingPlan !== null}
              className="w-full gradient-green text-black font-black border-0 hover:opacity-90 neon-glow py-4 text-sm"
            >
              {loadingPlan === 'premium' ? 'Redirecting...' : (
                <>
                  <Star className="w-4 h-4 mr-2" />
                  {isMadness ? 'Upgrade to Premium' : 'Get Premium'}
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
