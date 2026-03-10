export function computePrizePool(totalEntries: number) {
  const entryPrice = 50_00 // cents
  const totalPot = totalEntries * entryPrice
  return {
    totalEntries,
    entryPriceCents: entryPrice,
    totalPotCents: totalPot,
    firstPlaceCents: Math.floor(totalPot * 0.5),
    secondPlaceCents: Math.floor(totalPot * 0.25),
    retainedCents: totalPot - Math.floor(totalPot * 0.5) - Math.floor(totalPot * 0.25),
    perfectSurvivorPotCents: totalPot,
  }
}
