import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_MADNESS_PRICE_ID } from '@/lib/stripe-config'

// Resolve a Stripe subscription's plan_type by checking the price IDs on the subscription
async function resolvePlanFromSubscription(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscription: any
): Promise<'premium' | 'madness'> {
  const priceId = subscription.items?.data?.[0]?.price?.id ?? ''
  if (STRIPE_MADNESS_PRICE_ID && priceId === STRIPE_MADNESS_PRICE_ID) {
    return 'madness'
  }
  return 'premium'
}

export async function POST(req: NextRequest) {
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  })

  const body = await req.text()
  const sig = req.headers.get('stripe-signature') || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any

  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.userId
      const subscriptionId = session.subscription
      // plan is stored in checkout session metadata (set by create-checkout)
      const plan: 'premium' | 'madness' = session.metadata?.plan === 'madness' ? 'madness' : 'premium'
      if (userId && subscriptionId) {
        await supabaseAdmin
          .from('users')
          .update({ plan_type: plan, stripe_subscription_id: subscriptionId })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const customerId = subscription.customer
      const isActive = subscription.status === 'active'
      if (isActive) {
        const plan = await resolvePlanFromSubscription(subscription)
        await supabaseAdmin
          .from('users')
          .update({ plan_type: plan })
          .eq('stripe_customer_id', customerId)
      } else {
        // Inactive subscription (paused, past_due, cancelled) → downgrade to free
        await supabaseAdmin
          .from('users')
          .update({ plan_type: 'free' })
          .eq('stripe_customer_id', customerId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customerId = subscription.customer
      await supabaseAdmin
        .from('users')
        .update({ plan_type: 'free', stripe_subscription_id: null })
        .eq('stripe_customer_id', customerId)
      break
    }

    case 'invoice.payment_failed': {
      // Optional: log payment failures — do not immediately downgrade
      const invoice = event.data.object
      console.warn('[webhook] Payment failed for customer:', invoice.customer)
      break
    }
  }

  return NextResponse.json({ received: true })
}
