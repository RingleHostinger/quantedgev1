'use client'

import Link from 'next/link'
import { Brain, TrendingUp, Shield, Zap, Star, ChevronRight, Target, BarChart3, Users, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-green flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold" style={{ color: '#E6E6FA' }}>SportsPick<span style={{ color: '#00FFA3' }}>.AI</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm transition-colors hover:text-white" style={{ color: '#A0A0B0' }}>Features</a>
            <a href="#predictions" className="text-sm transition-colors hover:text-white" style={{ color: '#A0A0B0' }}>Predictions</a>
            <a href="#pricing" className="text-sm transition-colors hover:text-white" style={{ color: '#A0A0B0' }}>Pricing</a>
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
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#E6E6FA' }}>Simple, Transparent Pricing</h2>
            <p style={{ color: '#A0A0B0' }}>Start free, upgrade when you&apos;re ready</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free */}
            <div className="glass-card rounded-2xl p-8">
              <div className="text-sm font-semibold mb-2" style={{ color: '#A0A0B0' }}>FREE</div>
              <div className="text-4xl font-bold mb-1" style={{ color: '#E6E6FA' }}>$0</div>
              <div className="text-sm mb-8" style={{ color: '#A0A0B0' }}>Forever free</div>
              <ul className="space-y-3 mb-8">
                {['1–3 AI picks per day', 'Basic team stats', 'Limited insights', 'Community access'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm" style={{ color: '#A0A0B0' }}>
                    <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs">✓</span>
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button className="w-full" variant="outline" style={{ borderColor: 'rgba(255,255,255,0.2)', color: '#E6E6FA' }}>
                  Get Started Free
                </Button>
              </Link>
            </div>

            {/* Premium */}
            <div className="rounded-2xl p-8 relative" style={{ background: 'linear-gradient(135deg, rgba(0,255,163,0.15), rgba(59,130,246,0.15))', border: '1px solid rgba(0,255,163,0.3)' }}>
              <div className="absolute top-4 right-4">
                <Badge style={{ background: '#00FFA3', color: '#0F0F1A' }} className="text-xs font-bold">POPULAR</Badge>
              </div>
              <div className="text-sm font-semibold mb-2" style={{ color: '#00FFA3' }}>PREMIUM</div>
              <div className="text-4xl font-bold mb-1" style={{ color: '#E6E6FA' }}>$19.99</div>
              <div className="text-sm mb-8" style={{ color: '#A0A0B0' }}>per month</div>
              <ul className="space-y-3 mb-8">
                {['Unlimited AI picks', 'Full AI analysis reports', 'Advanced team/player trends', 'Confidence scores & reasoning', 'Injury impact analysis', 'Priority feature updates'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm" style={{ color: '#E6E6FA' }}>
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,255,163,0.2)' }}>
                      <span className="text-xs" style={{ color: '#00FFA3' }}>✓</span>
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button className="w-full gradient-green text-black font-semibold border-0 hover:opacity-90 neon-glow">
                  Upgrade to Premium
                  <Star className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
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
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-green flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold" style={{ color: '#E6E6FA' }}>SportsPick<span style={{ color: '#00FFA3' }}>.AI</span></span>
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
