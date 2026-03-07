import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/integrations/supabase/server'
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe-config'

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
      if (userId && subscriptionId) {
        await supabaseAdmin
          .from('users')
          .update({ plan_type: 'premium', stripe_subscription_id: subscriptionId })
          .eq('id', userId)
      }
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const customerId = subscription.customer
      const isActive = subscription.status === 'active'
      await supabaseAdmin
        .from('users')
        .update({ plan_type: isActive ? 'premium' : 'free' })
        .eq('stripe_customer_id', customerId)
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
  }

  return NextResponse.json({ received: true })
}
