'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export interface User {
  id: string
  name: string
  email: string
  planType: string
  role: string
  daily_free_picks_used?: number
  picks_reset_at?: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  created_at?: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          planType: data.user.plan_type,
          role: data.user.role,
          daily_free_picks_used: data.user.daily_free_picks_used,
          picks_reset_at: data.user.picks_reset_at,
          stripe_customer_id: data.user.stripe_customer_id,
          stripe_subscription_id: data.user.stripe_subscription_id,
          created_at: data.user.created_at,
        })
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
  }

  const isPremium = user?.planType === 'premium'
  const isAdmin = user?.role === 'admin'

  return { user, loading, logout, isPremium, isAdmin, refetch: fetchUser }
}
