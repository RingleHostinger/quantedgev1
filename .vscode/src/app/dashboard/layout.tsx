'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Target, Lightbulb,
  DollarSign, Settings, LogOut, Star, Menu, Shield, Zap, AlertTriangle, Trophy,
  Newspaper, BarChart2, AlertOctagon, FlaskConical, TrendingUp, CheckSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { QuantEdgeLogo } from '@/components/QuantEdgeLogo'
import { DataFreshnessIndicator } from '@/components/DataFreshnessIndicator'
import Image from 'next/image'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/briefing', label: 'Daily Briefing', icon: Newspaper },
  { href: '/dashboard/edges', label: 'Top AI Edges', icon: Zap },
  { href: '/dashboard/official-picks', label: 'Official Picks', icon: CheckSquare },
  { href: '/dashboard/heatmap', label: 'Betting Heat Map', icon: BarChart2 },
  { href: '/dashboard/picks', label: 'Predictions', icon: Target },
  { href: '/dashboard/survivor', label: 'Survivor Pool AI', icon: Trophy },
  { href: '/dashboard/upset', label: 'Upset Radar', icon: AlertOctagon },
  { href: '/dashboard/injuries', label: 'Injuries', icon: AlertTriangle },
  { href: '/dashboard/model-performance', label: 'Model Performance', icon: TrendingUp },
  { href: '/dashboard/insights', label: 'Insights', icon: Lightbulb },
  { href: '/dashboard/pricing', label: 'Pricing', icon: DollarSign },
  { href: '/dashboard/account', label: 'Account', icon: Settings },
]

const ncaabNavItems = [
  { href: '/dashboard/bracket-lab', label: 'Bracket Lab', icon: FlaskConical, badge: 'NEW' },
]

const adminNavItems = [
  { href: '/dashboard/admin', label: 'Admin Panel', icon: Shield },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isPremium, isAdmin } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0F1A' }}>
        <div className="text-center flex flex-col items-center">
          {/* Animated logo icon */}
          <div className="relative mb-6">
            {/* Outer glow ring */}
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                background: 'radial-gradient(circle, rgba(0,255,163,0.25) 0%, transparent 70%)',
                transform: 'scale(1.8)',
              }}
            />
            {/* Icon */}
            <div
              className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(0,255,163,0.08)',
                border: '1px solid rgba(0,255,163,0.25)',
                boxShadow: '0 0 32px rgba(0,255,163,0.2)',
              }}
            >
              <Image
                src="/quantedge-logo.png"
                alt="QuantEdge"
                width={80}
                height={80}
                priority
                className="object-contain object-left animate-pulse"
                style={{
                  maxWidth: 'none',
                  height: 72,
                  width: 'auto',
                  clipPath: 'inset(0 60% 0 0)',
                }}
              />
            </div>
          </div>
          {/* Full logo */}
          <div className="mb-4">
            <QuantEdgeLogo variant="full" height={36} linked={false} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#A0A0B0' }}>
            QuantEdge AI is analyzing the data...
          </p>
          {/* Progress bar */}
          <div className="mt-4 w-48 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #00FFA3, #06B6D4)',
                animation: 'loading-bar 1.6s ease-in-out infinite',
                width: '40%',
              }}
            />
          </div>
          <style>{`
            @keyframes loading-bar {
              0% { transform: translateX(-100%); width: 40%; }
              50% { width: 60%; }
              100% { transform: translateX(300%); width: 40%; }
            }
          `}</style>
        </div>
      </div>
    )
  }

  if (!user) return null

  const allNavItems = isAdmin ? [...navItems, ...adminNavItems] : navItems

  const NavLink = ({ item }: { item: { href: string; label: string; icon: React.ElementType; badge?: string } }) => {
    const active = pathname === item.href || pathname.startsWith(item.href + '/')
    const Icon = item.icon
    return (
      <Link
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
          active ? '' : 'hover:bg-white/5'
        )}
        style={
          active
            ? { background: 'rgba(0,255,163,0.12)', color: '#00FFA3', boxShadow: 'inset 3px 0 0 #00FFA3' }
            : { color: '#A0A0B0' }
        }
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}>
            {item.badge}
          </span>
        )}
      </Link>
    )
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <QuantEdgeLogo variant="auto" height={38} href="/dashboard" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {allNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {/* NCAAB Section */}
        <div className="pt-3 pb-1">
          <div className="px-3 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4A4A60' }}>NCAAB</span>
          </div>
          {ncaabNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t space-y-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {!isPremium && (
          <Link href="/dashboard/pricing" onClick={() => setSidebarOpen(false)}>
            <div
              className="rounded-xl p-3 cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                background: 'linear-gradient(135deg, rgba(0,255,163,0.12), rgba(59,130,246,0.12))',
                border: '1px solid rgba(0,255,163,0.25)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-3 h-3" style={{ color: '#00FFA3' }} />
                <span className="text-xs font-semibold" style={{ color: '#00FFA3' }}>Upgrade to Premium</span>
              </div>
              <p className="text-xs" style={{ color: '#A0A0B0' }}>Unlock unlimited picks & AI insights</p>
            </div>
          </Link>
        )}
        <div className="flex items-center gap-3 px-2 py-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 gradient-green"
          >
            <span className="text-xs font-bold text-black">{user.name[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: '#E6E6FA' }}>{user.name}</div>
            <div className="text-xs truncate" style={{ color: '#A0A0B0' }}>{user.email}</div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
            style={{ color: '#A0A0B0' }}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen" style={{ background: '#0F0F1A' }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 border-r flex-shrink-0"
        style={{ background: '#0C0C18', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setSidebarOpen(false)} />
          <aside
            className="relative flex flex-col w-72 border-r z-10"
            style={{ background: '#0C0C18', borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="border-b px-4 lg:px-6 py-3 flex items-center justify-between flex-shrink-0"
          style={{ background: '#0C0C18', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-white/5"
              style={{ color: '#A0A0B0' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <QuantEdgeLogo variant="full" height={30} href="/dashboard" />
          </div>

          {/* Desktop: current page label */}
          <div className="hidden lg:block">
            <h2 className="text-sm font-medium" style={{ color: '#A0A0B0' }}>
              {allNavItems.find((n) => n.href === pathname)?.label || 'Dashboard'}
            </h2>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <DataFreshnessIndicator />
            <Badge
              className="text-xs font-semibold px-3 py-1"
              style={
                isPremium
                  ? { background: 'rgba(0,255,163,0.15)', color: '#00FFA3', border: '1px solid rgba(0,255,163,0.3)' }
                  : { background: 'rgba(160,160,176,0.12)', color: '#A0A0B0', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {isPremium ? '★ PREMIUM' : 'FREE'}
            </Badge>
            <span className="text-sm font-medium hidden sm:block" style={{ color: '#E6E6FA' }}>{user.name}</span>
            {!isPremium && (
              <Link href="/dashboard/pricing">
                <Button
                  size="sm"
                  className="gradient-green text-black font-semibold border-0 hover:opacity-90 text-xs neon-glow"
                >
                  Upgrade
                </Button>
              </Link>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
