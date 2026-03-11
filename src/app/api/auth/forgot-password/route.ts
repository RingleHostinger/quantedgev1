import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/integrations/supabase/server'

function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')
  return new Resend(apiKey)
}

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

    // Send password reset email via Resend
    const fromAddress = process.env.EMAIL_FROM || 'no-reply@getquantedge.app'

    const { error: emailError } = await getResend().emails.send({
      from: fromAddress,
      to: user.email,
      replyTo: 'admin@getquantedge.app',
      subject: 'QuantEdge Password Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You requested a password reset for your QuantEdge account.</p>
          <p>Click the link below to reset your password:</p>
          <p><a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a></p>
          <p style="margin-top: 16px;">Or copy and paste this URL into your browser:</p>
          <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.</p>
          <p style="color: #6b7280; font-size: 14px;">&mdash; The QuantEdge Team</p>
        </div>
      `,
      text: `Password Reset Request

You requested a password reset for your QuantEdge account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.

— The QuantEdge Team`,
    })

    if (emailError) {
      console.error('Failed to send reset email:', emailError)
      // Still return success to prevent email enumeration
    }

    return successResponse
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
