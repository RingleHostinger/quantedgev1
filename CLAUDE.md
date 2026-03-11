# Zoer Next.js Template

Next.js 15 full-stack template with Supabase, TailwindCSS 4, and shadcn/ui.

**Core Principle:** Prefer Server Components/Actions. Only create API routes when necessary (webhooks, third-party APIs, etc.).

---

## 1. Tech Stack

| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Runtime | Node.js | 18+ | - |
| Package Manager | pnpm | Latest | - |
| Framework | Next.js | 15 | App Router |
| Language | TypeScript | 5+ | Strict mode |
| Styling | TailwindCSS | 4 | CSS variables |
| UI Library | shadcn/ui | Latest | Pre-installed |
| Icons | Lucide React | Latest | - |
| Database | Supabase | Latest | PostgreSQL + Auth |
| Theme | next-themes | Latest | Dark/Light mode |

---

## 2. Directory Structure

```
src/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (ThemeProvider + Toaster)
│   ├── page.tsx                      # Home page (redirects to dashboard)
│   ├── globals.css                   # Global styles + theme variables
│   ├── login/page.tsx                # Login page
│   ├── signup/page.tsx               # Signup page
│   ├── forgot-password/page.tsx      # Password reset
│   ├── pricing/page.tsx              # Pricing page
│   ├── dashboard/
│   │   ├── layout.tsx                # Dashboard layout (sidebar nav + collapse context)
│   │   ├── page.tsx                  # Dashboard home
│   │   ├── admin/page.tsx            # Admin panel (multi-tab)
│   │   ├── official-survivor/page.tsx # Official Survivor contest (visual bracket + game cards)
│   │   ├── survivor/page.tsx         # Survivor pool builder
│   │   ├── bracket-lab/              # Bracket Lab (builder, analysis, compare)
│   │   ├── official-picks/page.tsx   # AI daily picks
│   │   ├── picks/page.tsx            # User picks
│   │   ├── edges/page.tsx            # Betting edges
│   │   ├── briefing/page.tsx         # Daily briefing
│   │   ├── heatmap/page.tsx          # Prediction heatmap
│   │   ├── injuries/page.tsx         # Injury reports
│   │   ├── insights/page.tsx         # AI insights
│   │   ├── teams/page.tsx            # Teams data
│   │   ├── players/page.tsx          # Player stats
│   │   ├── results/page.tsx          # Past results
│   │   ├── engine/page.tsx           # Prediction engine
│   │   ├── model-performance/page.tsx # Model performance metrics
│   │   ├── account/page.tsx          # User account settings
│   │   └── pricing/page.tsx          # Pricing (in-dash)
│   └── api/
│       ├── auth/                     # Auth routes (login, signup, logout, me)
│       ├── admin/                    # Admin API routes
│       │   ├── survivor-bracket/     # Bracket mgmt (load_teams, grade_game, confirm)
│       │   ├── survivor-test-entry/  # Test entry creation
│       │   ├── survivor-test-mode/   # Test mode toggle
│       │   ├── survivor-grade/       # Survivor pick grading
│       │   ├── official-contest/     # Contest management
│       │   ├── games/                # Game management
│       │   ├── predictions/          # Prediction admin
│       │   ├── pipeline/             # Data pipeline
│       │   └── ...                   # Other admin routes
│       ├── survivor/                 # Survivor pool APIs
│       │   ├── official/             # Official contest (GET/POST)
│       │   ├── analyze/              # AI analysis
│       │   └── simulate/             # Monte Carlo simulation
│       ├── predictions/              # Prediction API
│       ├── odds/                     # Odds + refresh
│       ├── brackets/                 # Bracket CRUD + analysis
│       ├── stripe/                   # Stripe checkout + webhook
│       ├── cron/                     # Scheduled jobs
│       └── ...                       # Other API routes
├── components/
│   ├── ui/                           # shadcn/ui components (DO NOT recreate)
│   ├── AdminBracketEditor.tsx        # Visual bracket editor (edit + grade modes)
│   ├── ContestStatusHeader.tsx       # Survivor contest status metrics bar
│   ├── SurvivorBracketView.tsx       # Read-only collapsible bracket display
│   ├── RoundGameCards.tsx            # Interactive game cards for pick selection
│   ├── BracketBuilder.tsx            # User bracket builder
│   ├── BracketMatchup.tsx            # Bracket matchup display
│   ├── BracketRegion.tsx             # Bracket region component
│   ├── BracketUpload.tsx             # Bracket CSV upload
│   ├── ThemeProvider.tsx             # Theme context wrapper
│   ├── QuantEdgeLogo.tsx             # App logo
│   └── ...                           # Other shared components
├── hooks/
│   ├── use-mobile.tsx                # Mobile detection (<768px)
│   ├── use-toast.tsx                 # Toast notifications
│   ├── useAuth.ts                    # Auth state hook
│   ├── useSidebarCollapse.ts         # Sidebar collapse context (used by Official Survivor)
│   └── useZoerIframe.ts             # Zoer iframe integration
├── lib/
│   ├── auth.ts                       # Session/auth utilities (getSession)
│   ├── utils.ts                      # Utilities (cn function)
│   ├── bracketTypes.ts               # Shared bracket types, constants, helpers
│   ├── officialContestUtils.ts       # Prize pool calculation
│   ├── officialPicksService.ts       # Official picks service
│   ├── prediction-engine.ts          # AI prediction engine
│   ├── bracket-analysis.ts           # Bracket analysis utilities
│   ├── oddsSyncService.ts            # Odds synchronization
│   ├── oddsCacheService.ts           # Odds caching
│   ├── stripe-config.ts              # Stripe configuration
│   └── ...                           # Other utilities
└── integrations/
    └── supabase/
        ├── client.ts                 # Client-side (RLS enabled)
        └── server.ts                 # Server-side (RLS bypassed)
```

**Key Directories:**
- `app/` - Next.js routes and layouts
- `app/dashboard/` - Main application pages (behind auth)
- `app/api/admin/` - Admin-only API routes
- `components/ui/` - shadcn/ui components (DO NOT recreate)
- `components/` - Custom shared components
- `lib/` - Business logic and utilities
- `integrations/supabase/` - Database client configuration

---

## 3. Core Systems

### 3.1 Authentication
- **Provider:** Supabase Auth (custom JWT via `src/lib/auth.ts`)
- **Status:** Implemented
- **Routes:** `/login`, `/signup`, `/forgot-password`
- **Hook:** `useAuth()` for client-side auth state
- **Server:** `getSession()` from `src/lib/auth.ts` for API routes
- **Admin:** Role-based (`users.role === 'admin'`), admin UUID: `55555555-0000-0000-0000-000000000001`

### 3.2 UI Components
- **Library:** shadcn/ui (Radix UI + TailwindCSS)
- **Status:** Fully installed
- **Location:** `src/components/ui/`
- **Usage:** `import { Button } from "@/components/ui/button"`
- **Critical:** DO NOT recreate these components

### 3.3 Theme System
- **Provider:** next-themes
- **Modes:** light, dark, system
- **Variables:** `globals.css` (`:root` and `.dark`)
- **Usage:** `useTheme()` hook

### 3.4 Database
- **Provider:** Supabase (PostgreSQL)
- **RLS:** Enabled (use client.ts) / Bypassed (use server.ts)
- **Key Tables:** `users`, `games`, `predictions`, `survivor_pools`, `survivor_picks`, `official_survivor_entries`, `bracket_teams`, `admin_settings`, `brackets`
- **Types:** Auto-generate with `npx supabase gen types`

### 3.5 Routing
- **Pattern:** App Router (Next.js 15)
- **Server Components:** Default
- **Client Components:** Add `'use client'` when needed

### 3.6 Official Survivor Contest
- **Status:** Implemented (full live contest UI)
- **User Page:** `/dashboard/official-survivor` — visual bracket, interactive game cards, entry tabs, leaderboard, entry purchase
- **Admin:** "Official Contest" tab in admin panel
- **Bracket Editor:** `AdminBracketEditor.tsx` — visual editor with edit mode (4 regions x 16 seeds) and grade mode (game-by-game winner selection with automatic advancement)
- **Date Gate:** Users see countdown until `2026-03-16T23:00:00Z`; admin test mode bypasses this
- **Test Mode:** Admin toggle via `admin_settings.survivor_test_mode`; test entries (`is_test_entry=true`) excluded from public stats
- **Bracket Data Structure:** `{ regions: { [region]: [{seed, name}] }, results: { [roundKey]: { [matchupKey]: { team1, team2, team1Seed, team2Seed, winner } } } }`
- **Round Keys:** `round64`, `round32`, `sweet16`, `elite8`, `finalFour`, `championship`
- **Seed Pairings:** `[[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]]`
- **Prize Pool:** Calculated via `computePrizePool()` in `officialContestUtils.ts`
- **Pick Limit:** 1 pick per entry per day (enforced server-side)
- **Team Reuse Prevention:** Each team can only be picked once per entry across all rounds (client + server enforced)
- **Shared Types:** `src/lib/bracketTypes.ts` — types (BracketMatchup, OfficialBracketData, RoundCompletionStatus), constants, and helpers (parseMatchupIndex, computeActiveRound, computeRoundCompletion)
- **Live Contest Components:**
  - `ContestStatusHeader.tsx` — status metrics bar (current round, entries alive, games done, pick status)
  - `SurvivorBracketView.tsx` — read-only collapsible bracket display (6 round columns, horizontal scroll)
  - `RoundGameCards.tsx` — interactive game cards for pick selection (click-to-pick replaces text input)
- **Sidebar Collapse:** Official Survivor page auto-collapses sidebar for more space via `useSidebarCollapse` context
- **Active Round Logic:** First round where not all matchups have winners; 7 = tournament complete
- **Matchup Key Formats:** Admin confirm uses `m0`-`m31`; `parseMatchupIndex()` handles both `m0` and `east_0` formats

### 3.7 Admin Panel
- **Location:** `/dashboard/admin` (multi-tab)
- **Tabs:** overview, games, predictions, free-pick, users, visibility, briefing, injuries-admin, overrides, bracket-model, bracket-mgmt, pipeline, grading, survivor-test, survivor-grading, official-contest
- **Key Admin APIs:** `survivor-bracket` (load_teams, grade_game, confirm, save), `survivor-test-entry`, `survivor-test-mode`, `official-contest`, `games`, `predictions`, `pipeline`

### 3.8 Prediction Engine
- **Location:** `src/lib/prediction-engine.ts`
- **Features:** AI-powered sports predictions, odds sync, model performance tracking
- **Cron Jobs:** `daily-full`, `daily-rollover`, `odds-refresh`

### 3.9 Payments
- **Provider:** Stripe
- **Routes:** `/api/stripe/create-checkout`, `/api/stripe/webhook`
- **Config:** `src/lib/stripe-config.ts`

---

## 4. Development Conventions

### Naming
- Components: `PascalCase.tsx` (UserProfile.tsx)
- Functions/Files: `camelCase.ts` (getUserData.ts)
- Constants: `UPPER_SNAKE_CASE` (API_URL)

### Component Patterns
- Function components + hooks
- Server Components by default
- Use shadcn/ui first, then custom
- NO class components

### Styling
- TailwindCSS classes
- CSS variables from globals.css (`bg-background`, `text-foreground`)
- `cn()` utility for conditional classes
- NO hardcoded colors (#fff, rgb())

### API Routes
- **Minimize usage** - prefer Server Components/Actions
- **Only for:** Webhooks, third-party API proxies
- **Location:** `src/app/api/[name]/route.ts`

---

## 5. Extension Patterns

### Add New Page
```typescript
// src/app/dashboard/page.tsx
export default function DashboardPage() {
  return <div>Dashboard</div>
}
```

### Use shadcn/ui Components
```typescript
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent } from "@/components/ui/card"

<Button variant="outline">Click</Button>
```

### Supabase Query
```typescript
// Client Component
'use client'
import { supabase } from '@/integrations/supabase/client'
const { data } = await supabase.from('users').select('*')

// Server Component
import { supabaseAdmin } from '@/integrations/supabase/server'
const { data } = await supabaseAdmin.from('users').select('*')
```

### Responsive Design
```typescript
import { useMobile } from '@/hooks/use-mobile'
const isMobile = useMobile() // true if < 768px
```

---

## 6. Current State

### Implemented Features
- User authentication (login, signup, password reset)
- Role-based access control (admin vs regular user)
- Dashboard with sidebar navigation
- AI prediction engine with model performance tracking
- Official daily picks (1 pick/day per user)
- Bracket Lab (builder, analysis, comparison)
- Official Survivor contest (entries, picks, leaderboard, prize pool)
- Official Survivor live contest UI (visual bracket, interactive game cards, round progression)
- Sidebar collapse context for full-width views (Official Survivor)
- Team reuse prevention (client + server enforced)
- Visual bracket editor for admin (edit mode + grade mode)
- Admin test mode for previewing survivor contest before go-live
- Test data isolation (test entries excluded from public metrics)
- Game-by-game grading with automatic winner advancement
- Betting edges, heatmap, injury reports
- Stripe payment integration
- Theme system (light/dark mode)
- shadcn/ui components library
- Toast notifications
- Mobile responsive design

### Installed Dependencies
- next 15
- react 18
- typescript 5+
- tailwindcss 4
- shadcn/ui (all components)
- lucide-react
- next-themes
- @supabase/supabase-js
- stripe

### Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### Key Database Tables
- `users` — User accounts with role field (admin/user)
- `games` — Sports games with odds data
- `predictions` — AI model predictions
- `survivor_pools` — Survivor pool configuration (official pool has `is_official=true`)
- `survivor_picks` — Individual picks with result tracking (pending/won/eliminated)
- `official_survivor_entries` — Contest entries with `is_test_entry` flag
- `bracket_teams` — Tournament team data by region and seed
- `brackets` — User bracket builds
- `admin_settings` — Key-value admin config (test mode, live mode, etc.)

---

## 7. Critical Notes for AI

### Top Rules
1. **shadcn/ui is pre-installed** - NEVER recreate components in `src/components/ui/`
2. **Server Components first** - Only add `'use client'` when absolutely necessary
3. **Avoid API routes** - Use Server Components/Actions instead
4. **RLS awareness** - `client.ts` for users, `server.ts` for admin operations
5. **Theme-safe colors** - Use CSS variables, NOT hardcoded values
6. **TypeScript strict** - Leverage Supabase generated types
- **CRITICAL - DO NOT write `src/middleware.ts` for auth protection**
- Prohibit the use of `@supabase/ssr`

### Common Mistakes to Avoid
- Creating new Button/Card/Dialog components (already exist)
- Using `'use client'` everywhere (Server Component is default)
- Creating API routes for simple data fetching (use Server Component)
- Hardcoding colors like `#ffffff` (use `bg-background`)
- Ignoring mobile responsiveness (use `useMobile()` or Tailwind breakpoints)

### Quick Checklist
Before modifying files:
- [ ] Check if shadcn/ui component exists
- [ ] Determine if Client Component needed (`'use client'`)
- [ ] Choose correct Supabase client (client.ts vs server.ts)
- [ ] Use theme-aware CSS variables
- [ ] Consider mobile responsiveness
- [ ] Check TypeScript types

---

## 8. Maintenance Log

- **2026-03-11**: Added visual bracket editor (AdminBracketEditor), game-by-game grading, admin test mode preview, test data isolation (`is_test_entry` column), updated survivor APIs with bracketLive/isAdmin flags, integrated bracket editor into admin page replacing JSON textarea
- **2026-03-11**: Added Official Survivor live contest experience — visual bracket display (SurvivorBracketView), interactive game cards (RoundGameCards), contest status header (ContestStatusHeader), shared bracket types (bracketTypes.ts), sidebar collapse context (useSidebarCollapse), team reuse prevention, round progression logic. Replaced text-input pick forms with click-to-pick game card UI.