# Survivor Pool AI — Full Expansion Plan

## Overview
Expand the Survivor Pool AI from a recommendation tool into a full strategy planner with persistent multi-pool support, visual bracket, round-based pick tracking, and result syncing.

---

## Step 1 — DB Migration

```sql
-- Add picks_per_round (was silently failing), updated_at, result constraint
ALTER TABLE survivor_pools
  ADD COLUMN IF NOT EXISTS picks_per_round JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE survivor_picks
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Normalize result values for survivor picks
ALTER TABLE survivor_picks DROP CONSTRAINT IF EXISTS survivor_picks_result_check;
ALTER TABLE survivor_picks ADD CONSTRAINT survivor_picks_result_check
  CHECK (result IN ('pending', 'won', 'eliminated', 'win', 'loss'));
```

---

## Step 2 — API Changes (survivor/route.ts)

**GET:** Return all pools (`pools[]`) + picks for the active/selected pool. Response: `{ pools, picks, isPremium, testModeActive }`. Add `?pool_id=` query param to scope picks to a specific pool.

**POST:** Remove the "deactivate all pools" step. Each new pool is independent.

**PATCH:** Add `action` field to distinguish operations:
- `save_pick` — existing behavior (default)
- `update_pool` — update pool rules (name, size, format, etc.)
- `delete_pick` — delete a single pick by `pick_id`
- `sync_results` — auto-grade pending picks against game scores

---

## Step 3 — New Dynamic Route

Create `src/app/api/survivor/[id]/route.ts`:
- `GET` — fetch one pool + its picks
- `PATCH` — update pool rules
- `DELETE` — delete a pool

Follow the exact pattern of `src/app/api/brackets/[id]/route.ts`.

---

## Step 4 — UI Changes (page.tsx)

### New types
```typescript
interface Pool {
  id: string; pool_name: string; pool_size: string; pick_format: string
  team_reuse: boolean; late_round_rule: string; strike_rule: string
  picks_per_round: PicksPerRound | null; is_active: boolean
  created_at: string; updated_at?: string
}
interface BracketSlot { seed: number; team: string }
interface BracketGame { id: string; top: BracketSlot; bottom: BracketSlot; winner?: string }
interface BracketRegion { name: string; rounds: BracketGame[][] }
```

### New state
- `pools: Pool[]` — all user pools
- `activePoolId: string | null` — which pool is selected in dropdown
- `selectedRound: number` — which round the round selector is on (default: 1)
- `toast: { msg: string; type: 'success'|'error' } | null` — inline toast

### New components (all in page.tsx)
1. **`PoolSelectorBar`** — dropdown with all pools + "Create New Pool", compact rule badges
2. **`RoundSelector`** — sticky bar with 6 round tabs (Round of 64 → Championship), dots for rounds with picks
3. **`BracketTree`** — horizontal scrollable bracket grid by region; team slots colored amber (picked/pending), green (won), red (eliminated)
4. **`StrategyPlanner`** — replaces old pick history; picks grouped by round with delete button and result badges
5. **`InlineToast`** — fixed bottom center notification, auto-dismisses after 3s

### Updated handlers
- `handlePickTeam(teamName, roundNumber?)` — uses `selectedRound` if no roundNumber passed; fires toast "Pick Saved — {team} added to {round}"
- `handleDeletePick(pickId)` — PATCH with `action: 'delete_pick'`; fires toast "Pick removed"
- `handlePoolSave` — for new pool: POST + push to `pools[]`; for edit: PATCH `update_pool` + update in `pools[]`

### Updated `PoolSetupForm`
- Add `initialConfig?: PoolConfig` and `poolId?: string` props
- When `poolId` present: PATCH with `action: 'update_pool'`; button label = "Save Pool Strategy"
- When absent: POST (create); button label = "Save Pool Settings & Generate AI Picks"

### Post-bracket render order
1. PoolSelectorBar
2. BracketTree
3. UsedTeamsBadge
4. RoundSelector (sticky)
5. AIPickCard (pass round to onPickTeam)
6. SurvivorEdgeTable
7. ReservationTool
8. StrategyPlanner (replaces "My Pool History")
9. Premium upsell
10. InlineToast (fixed overlay)

---

## Mock Bracket Data
64 teams organized into 4 regions × 8 R64 games. Same teams as MOCK_EDGE_TABLE for pick-highlight lookup. Stored as `MOCK_BRACKET: BracketRegion[]` constant.

---

## Result Auto-Sync Logic
When `action: 'sync_results'`:
1. Find all `survivor_picks` with `result = 'pending'` for the pool
2. For each pick, query `games` table for NCAAB game where `home_team_name ilike %team%` OR `away_team_name ilike %team%` with `status in ('final', 'completed')`
3. Determine if team won from scores
4. Update `survivor_picks.result` to `'won'` or `'eliminated'`
