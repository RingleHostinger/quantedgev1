import { NextResponse } from 'next/server'
import { fetchBettingSplits, analyzeBettingSplit, isSdioConfigured } from '@/lib/sportsDataIOService'

export async function GET() {
  if (!isSdioConfigured()) {
    return NextResponse.json({
      splits: [],
      source: 'none',
      message: 'SportsDataIO keys not configured — betting splits unavailable',
    })
  }

  const { splits, errors } = await fetchBettingSplits()

  const enriched = splits.map((split) => ({
    ...split,
    ...analyzeBettingSplit(split),
  }))

  return NextResponse.json({
    splits: enriched,
    source: 'sportsdata.io',
    fetchErrors: errors.length > 0 ? errors : undefined,
  })
}
