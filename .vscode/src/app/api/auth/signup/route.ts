import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { setSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Check if user already exists
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const password_hash = await bcrypt.hash(password, 10)

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({ name, email, password_hash, plan_type: 'free', role: 'user' })
      .select('id, name, email, role, plan_type')
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    await setSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      planType: user.plan_type,
    })

    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email, planType: user.plan_type, role: user.role } })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
