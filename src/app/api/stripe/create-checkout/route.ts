import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { STRIPE_SECRET_KEY, STRIPE_PREMIUM_PRICE_ID, STRIPE_MADNESS_PRICE_ID, APP_URL } from '@/lib/stripe-config'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Accept optional plan param: 'premium' (default) or 'madness'
    let plan = 'premium'
    try {
      const body = await req.json()
      if (body.plan === 'madness') plan = 'madness'
    } catch { /* no body — default to premium */ }

    const priceId = plan === 'madness' ? STRIPE_MADNESS_PRICE_ID : STRIPE_PREMIUM_PRICE_ID

    if (!priceId) {
      return NextResponse.json({ error: `Price ID for plan "${plan}" is not configured.` }, { status: 500 })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    })

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, stripe_customer_id')
      .eq('id', session.userId)
      .single()

    if (userError || !user) {
      console.error('User fetch error:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let customerId = user.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      })
      customerId = customer.id

      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: `${APP_URL}/dashboard?upgrade=success`,
      cancel_url: `${APP_URL}/dashboard/pricing?upgrade=cancelled`,
      // Store which plan was purchased so the webhook can set plan_type correctly
      metadata: { userId: user.id, plan },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
