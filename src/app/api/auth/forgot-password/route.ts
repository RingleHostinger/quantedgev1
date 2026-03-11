import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { supabaseAdmin } from '@/integrations/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    })

    // Look up user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (!user) {
      // Don't reveal that the email doesn't exist
      return successResponse
    }

    // Invalidate any existing unused tokens for this user
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null)

    // Generate a secure random token
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    // Store hashed token in DB
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })

    if (insertError) {
      console.error('Failed to create reset token:', insertError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Build reset URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`

    // Log the reset link (replace with email service in production)
    console.log(`[PASSWORD RESET] Email: ${user.email}, Reset URL: ${resetUrl}`)

    return successResponse
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
