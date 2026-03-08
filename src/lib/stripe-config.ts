// Stripe configuration — all keys must be set as environment variables.
// Set these in Vercel Project Settings → Environment Variables before deploying.

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe-config] STRIPE_SECRET_KEY is not set — Stripe features will not work.')
}

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? ''

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

// Full-access plan: $39.99/month
export const STRIPE_PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID ?? ''

// March Madness only plan: Bracket Lab + Survivor Pool AI
export const STRIPE_MADNESS_PRICE_ID = process.env.STRIPE_MADNESS_PRICE_ID ?? ''

const rawAppUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_STRIPE_URL ||
  ''

export const APP_URL = rawAppUrl.startsWith('http') ? rawAppUrl : ''
