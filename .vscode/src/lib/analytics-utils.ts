// QuantEdge Analytics Utilities
// Shared helper functions for Model Strength, Pick Difficulty, Injury Impact, Upset Probability

export interface ModelStrength {
  label: string
  color: string
  bgColor: string
  pct: number
}

export function getModelStrength(confidence: number): ModelStrength {
  if (confidence >= 90) return { label: 'Elite Edge', color: '#00FFA3', bgColor: 'rgba(0,255,163,0.15)', pct: confidence }
  if (confidence >= 80) return { label: 'Strong Edge', color: '#00CC82', bgColor: 'rgba(0,204,130,0.12)', pct: confidence }
  if (confidence >= 70) return { label: 'Solid Edge', color: '#F59E0B', bgColor: 'rgba(245,158,11,0.12)', pct: confidence }
  if (confidence >= 60) return { label: 'Lean', color: '#A78BFA', bgColor: 'rgba(167,139,250,0.12)', pct: confidence }
  return { label: 'Low Confidence', color: '#A0A0B0', bgColor: 'rgba(160,160,176,0.08)', pct: confidence }
}

export interface PickDifficulty {
  label: string
  color: string
  bgColor: string
  border: string
}

export function getPickDifficulty(winProb: number, spread: number, isUnderdog: boolean): PickDifficulty {
  const absSpread = Math.abs(spread)
  // Upset Risk: underdog with close spread and meaningful AI win prob
  if (isUnderdog && winProb >= 35 && absSpread <= 7) {
    return { label: 'UPSET RISK', color: '#FF6B6B', bgColor: 'rgba(255,107,107,0.12)', border: 'rgba(255,107,107,0.35)' }
  }
  // High Risk: narrow win prob or large spread
  if (winProb < 55 || absSpread >= 10) {
    return { label: 'HIGH RISK', color: '#F97316', bgColor: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)' }
  }
  // Moderate Risk: mid-range
  if (winProb < 68 || absSpread >= 5) {
    return { label: 'MODERATE RISK', color: '#F59E0B', bgColor: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)' }
  }
  // Low Risk: high probability, small spread
  return { label: 'LOW RISK', color: '#00FFA3', bgColor: 'rgba(0,255,163,0.10)', border: 'rgba(0,255,163,0.30)' }
}

export interface InjuryImpact {
  label: string
  color: string
  bgColor: string
}

export function getInjuryImpactLevel(impactScore: number): InjuryImpact {
  if (impactScore >= 9) return { label: 'CRITICAL', color: '#FF6B6B', bgColor: 'rgba(255,107,107,0.15)' }
  if (impactScore >= 6) return { label: 'HIGH IMPACT', color: '#F97316', bgColor: 'rgba(249,115,22,0.12)' }
  if (impactScore >= 3) return { label: 'MEDIUM IMPACT', color: '#F59E0B', bgColor: 'rgba(245,158,11,0.10)' }
  return { label: 'LOW IMPACT', color: '#A0A0B0', bgColor: 'rgba(160,160,176,0.08)' }
}

// Compute upset probability for an underdog
// aiWinProb: AI's probability the underdog wins (0-100)
// spread: Vegas spread (positive = underdog is away team)
// Returns 0-100 upset probability score
export function getUpsetProbability(aiWinProb: number, spread: number): number {
  const absSpread = Math.abs(spread)
  // Implied sportsbook probability from spread
  // Rough conversion: each point of spread ~3% probability shift
  const impliedFavProb = 50 + absSpread * 2.8
  const impliedUnderdogProb = 100 - Math.min(impliedFavProb, 90)
  // AI edge over implied underdog probability
  const aiEdge = aiWinProb - impliedUnderdogProb
  // Scale: base is sportsbook implied, boosted by how much AI disagrees
  const upsetProb = Math.min(Math.max(impliedUnderdogProb + aiEdge * 0.7, 5), 65)
  return Math.round(upsetProb)
}

// Alert levels for upset radar
export function getUpsetAlertLevel(upsetProb: number): { label: string; color: string; bgColor: string } {
  if (upsetProb >= 35) return { label: 'High Upset Potential', color: '#FF6B6B', bgColor: 'rgba(255,107,107,0.15)' }
  if (upsetProb >= 20) return { label: 'Moderate Upset', color: '#F59E0B', bgColor: 'rgba(245,158,11,0.12)' }
  return { label: 'Low Upset Risk', color: '#A0A0B0', bgColor: 'rgba(160,160,176,0.08)' }
}

// Alert tags for public betting heat map
export function getHeatmapAlert(publicPct: number, aiWinProb: number): { label: string; color: string; bgColor: string } {
  const diff = publicPct - aiWinProb
  if (diff > 20) return { label: 'Public Trap', color: '#FF6B6B', bgColor: 'rgba(255,107,107,0.15)' }
  if (diff < -20) return { label: 'Sharp Edge', color: '#00FFA3', bgColor: 'rgba(0,255,163,0.12)' }
  return { label: 'Balanced Market', color: '#A0A0B0', bgColor: 'rgba(160,160,176,0.08)' }
}

// Deterministic seeded random for mock data
export function seedRandom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return function () {
    h ^= h << 13
    h ^= h >> 17
    h ^= h << 5
    h = h >>> 0
    return h / 4294967296
  }
}
