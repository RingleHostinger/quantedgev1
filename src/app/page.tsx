'use client'

import Link from 'next/link'
import { Brain, TrendingUp, Shield, Zap, Star, ChevronRight, Target, BarChart3, Users, Trophy, Check, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { QuantEdgeLogo } from '@/components/QuantEdgeLogo'

const recentPredictions = [
  { home: 'Liverpool', away: 'Arsenal', predicted: '2-1', actual: '2-1', correct: true, confidence: 74 },
  { home: 'Real Madrid', away: 'Barcelona', predicted: '3-1', actual: '3-1', correct: true, confidence: 86 },
  { home: 'Chelsea', away: 'Man City', predicted: '0-2', actual: '0-2', correct: true, confidence: 79 },
  { home: 'Bayern', away: 'PSG', predicted: '2-1', actual: '1-2', correct: false, confidence: 65 },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0F0F1A', color: '#E6E6FA' }}>
      {/* Nav */}
      <nav className="border-b border-white/8 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <QuantEdgeLogo variant="full" width={200} href="/dashboard" />
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm transition-colors hover:text-white" style={{ color: '#A0A0B0' }}>Features</a>
            <a href="#predictions" className="text-sm transition-colors hover:text-white" style={{ color: '#A0A0B0' }}>Predictions</a>
            <Link href="/pricing" className="text-sm transition-colors hover:text-white" style={{ color: '#A0A0B0' }}>Pricing</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-sm" style={{ color: '#A0A0B0' }}>Log in</Button>
            </Link>
            <Link href="/signup">
              <Button className="text-sm font-semibold gradient-green text-black border-0 hover:opacity-90">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-6 px-4 py-2 text-xs font-semibold" style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }}>
            <Zap className="w-3 h-3 mr-1 inline" />
            AI-Powered Sports Intelligence
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight" style={{ color: '#E6E6FA' }}>
            AI-Powered Sports
            <span className="block gradient-text-green">Predictions</span>
          </h1>
          <p className="text-xl mb-10 max-w-2xl mx-auto" style={{ color: '#A0A0B0' }}>
            Data-driven picks powered by advanced AI analysis. Historical trends, player form, injury reports, and head-to-head matchups — all in one platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="px-8 py-6 text-base font-semibold gradient-green text-black border-0 hover:opacity-90 neon-glow">
                View Today&apos;s Picks
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="px-8 py-6 text-base font-semibold border-white/20 text-white hover:bg-white/5">
                Upgrade to Premium
              </Button>
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { value: '68%', label: 'Accuracy Rate' },
              { value: '500+', label: 'Predictions Made' },
              { value: '12K+', label: 'Active Users' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold gradient-text-green">{stat.value}</div>
                <div className="text-sm mt-1" style={{ color: '#A0A0B0' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#E6E6FA' }}>Everything You Need to Win</h2>
            <p style={{ color: '#A0A0B0' }}>Advanced AI analytics built for serious sports bettors</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Brain, title: 'AI Score Predictions', desc: 'Machine learning models analyze thousands of data points to generate accurate score predictions.', color: '#00FFA3' },
              { icon: BarChart3, title: 'Deep Stat Analysis', desc: 'Form guides, head-to-head records, home/away splits, and advanced performance metrics.', color: '#3B82F6' },
              { icon: Users, title: 'Player Insights', desc: 'Track individual player form, injury status, and AI-generated performance insights.', color: '#F59E0B' },
              { icon: Target, title: 'Confidence Ratings', desc: 'Every pick comes with a confidence score and win probability so you know when to bet big.', color: '#A78BFA' },
            ].map((f) => (
              <div key={f.title} className="glass-card glass-card-hover rounded-2xl p-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}20` }}>
                  <f.icon className="w-6 h-6" style={{ color: f.color }} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#E6E6FA' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#A0A0B0' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Predictions */}
      <section id="predictions" className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#E6E6FA' }}>Recent Predictions</h2>
            <p style={{ color: '#A0A0B0' }}>Transparent track record — you can see exactly how we perform</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {recentPredictions.map((p, idx) => (
              <div key={idx} className="glass-card rounded-2xl p-5 flex items-center justify-between glass-card-hover">
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#E6E6FA' }}>{p.home} vs {p.away}</div>
                  <div className="text-xs mt-1" style={{ color: '#A0A0B0' }}>Predicted: {p.predicted} &bull; Actual: {p.actual}</div>
                  <div className="text-xs mt-1" style={{ color: '#A0A0B0' }}>Confidence: {p.confidence}%</div>
                </div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={p.correct
                    ? { background: 'rgba(0,255,163,0.18)', color: '#00FFA3' }
                    : { background: 'rgba(255,107,107,0.18)', color: '#FF6B6B' }
                  }
                >
                  {p.correct ? '✓' : '✗'}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass-card">
              <Trophy className="w-4 h-4" style={{ color: '#00FFA3' }} />
              <span className="text-sm font-semibold" style={{ color: '#00FFA3' }}>75% accuracy on recent predictions</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#E6E6FA' }}>Simple, Transparent Pricing</h2>
            <p style={{ color: '#A0A0B0' }}>Start free with 1 AI pick per day. Upgrade for full access.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Free */}
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
                {['1 free AI pick per day', 'Limited predictions access', 'Basic game analysis', 'Win probability view'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(160,160,176,0.15)' }}>
                      <Check className="w-3 h-3" style={{ color: '#A0A0B0' }} />
                    </div>
                    <span style={{ color: '#A0A0B0' }}>{f}</span>
                  </li>
                ))}
                {['Bracket Lab', 'Survivor Pool AI', 'Top AI Edges'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm opacity-40">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <Lock className="w-3 h-3" style={{ color: '#6B6B80' }} />
                    </div>
                    <span style={{ color: '#6B6B80' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button variant="outline" className="w-full border-white/10 hover:border-white/20" style={{ color: '#E6E6FA' }}>
                  Create Free Account
                </Button>
              </Link>
            </div>

            {/* Madness Special */}
            <div className="rounded-2xl p-6 flex flex-col"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(251,191,36,0.05))',
                border: '1px solid rgba(245,158,11,0.25)',
              }}>
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
                {['Bracket Lab — AI bracket builder & grader', 'Survivor Pool AI — round strategy engine', 'AI win probability per team', 'Upset radar & pool strategy', 'Bracket optimizer (3 AI versions)', 'Duplicate risk & uniqueness scoring'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(245,158,11,0.2)' }}>
                      <Check className="w-3 h-3" style={{ color: '#F59E0B' }} />
                    </div>
                    <span style={{ color: '#E6E6FA' }}>{f}</span>
                  </li>
                ))}
                {['Top AI Edges', 'Betting Heat Map', 'Daily AI Briefing'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm opacity-40">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <Lock className="w-3 h-3" style={{ color: '#6B6B80' }} />
                    </div>
                    <span style={{ color: '#6B6B80' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup?plan=madness">
                <Button className="w-full font-black border-0 hover:opacity-90 py-4 text-sm"
                  style={{ background: 'rgba(245,158,11,0.9)', color: '#0F0F1A' }}>
                  <Trophy className="w-4 h-4 mr-2" />
                  Get Madness Special
                </Button>
              </Link>
            </div>

            {/* Premium */}
            <div className="rounded-2xl p-6 flex flex-col relative"
              style={{
                background: 'linear-gradient(135deg, rgba(0,255,163,0.07), rgba(59,130,246,0.07))',
                border: '1px solid rgba(0,255,163,0.28)',
                boxShadow: '0 0 30px rgba(0,255,163,0.06)',
              }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="text-xs font-black px-4 py-1 rounded-full"
                  style={{ background: '#00FFA3', color: '#0F0F1A' }}>
                  Most Popular
                </div>
              </div>
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#00FFA3' }}>Premium</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black" style={{ color: '#E6E6FA' }}>$39.99</span>
                  <span className="text-base" style={{ color: '#6B6B80' }}>/month</span>
                </div>
                <p className="text-sm" style={{ color: '#6B6B80' }}>Full platform access · Cancel anytime</p>
              </div>
              <ul className="space-y-2.5 mb-7 flex-1">
                {['Everything in Madness Special', 'Full Top AI Edges access', 'Upset Radar', 'Betting Heat Map', 'Daily AI Briefing', 'Model Performance tracking', 'All predictions unlocked', 'Unlimited AI picks'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(0,255,163,0.2)' }}>
                      <Check className="w-3 h-3" style={{ color: '#00FFA3' }} />
                    </div>
                    <span style={{ color: '#E6E6FA' }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup?plan=premium">
                <Button className="w-full gradient-green text-black font-black border-0 hover:opacity-90 neon-glow py-4 text-sm">
                  <Star className="w-4 h-4 mr-2" />
                  Get Premium
                </Button>
              </Link>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href="/pricing" className="text-sm font-medium hover:underline transition-colors"
              style={{ color: '#00FFA3' }}>
              View full pricing details &amp; FAQ →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center glass-card rounded-3xl p-16">
          <h2 className="text-4xl font-bold mb-4" style={{ color: '#E6E6FA' }}>Ready to Make Smarter Picks?</h2>
          <p className="mb-8" style={{ color: '#A0A0B0' }}>Join thousands of sports fans using AI-powered predictions to make better decisions.</p>
          <Link href="/signup">
            <Button size="lg" className="px-10 py-6 text-base font-semibold gradient-green text-black border-0 hover:opacity-90 neon-glow">
              Start for Free Today
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-10" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <QuantEdgeLogo variant="full" width={200} href="/dashboard" />
          </div>
          <div className="flex gap-6 text-sm" style={{ color: '#A0A0B0' }}>
            <Link href="/login" className="hover:text-white transition-colors">Login</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <p className="text-sm" style={{ color: '#A0A0B0' }}>For entertainment purposes only. Bet responsibly.</p>
        </div>
      </footer>
    </div>
  )
}
