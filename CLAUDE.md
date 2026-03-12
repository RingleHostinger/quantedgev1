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
│   │   ├── admin/page.tsx            # Admin panel (multi-tab, includes Official Contest tab)
│   │   ├── official-survivor/page.tsx # Official Survivor contest (bracket view + game cards + picks)
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
│       │   ├── survivor-contest/     # Official contest admin (bracket, days, games, grading)
│       │   ├── games/                # Game management
│       │   ├── predictions/          # Prediction admin
│       │   ├── pipeline/             # Data pipeline
│       │   └── ...                   # Other admin routes
│       ├── survivor/                 # Official Survivor APIs
│       │   ├── contest/              # Contest data + user entries/picks (GET)
│       │   ├── picks/                # Pick submission (POST)
│       │   └── entries/              # Entry management (GET/POST)
│       ├── predictions/              # Prediction API
│       ├── odds/                     # Odds + refresh
│       ├── brackets/                 # Bracket CRUD + analysis
│       ├── stripe/                   # Stripe checkout + webhook
│       ├── cron/                     # Scheduled jobs
│       └── ...                       # Other API routes
├── components/
│   ├── ui/                           # shadcn/ui components (DO NOT recreate)
│   ├── AdminOfficialContest.tsx      # Admin Official Contest tab (bracket, days, games, grading)
│   ├── SurvivorBracket.tsx           # Read-only bracket display (Bracket Lab style, per-entry highlighting)
│   ├── SurvivorGameCards.tsx         # Interactive game cards for pick selection
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
│   └── useZoerIframe.ts             # Zoer iframe integration
├── lib/
│   ├── auth.ts                       # Session/auth utilities (getSession)
│   ├── utils.ts                      # Utilities (cn function)
│   ├── bracketTypes.ts               # Shared bracket types, constants, helpers
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
- **Key Tables:** `users`, `games`, `predictions`, `survivor_contest`, `survivor_contest_days`, `survivor_contest_games`, `survivor_entries`, `survivor_entry_picks`, `bracket_teams`, `admin_settings`, `brackets`
- **Types:** Auto-generate with `npx supabase gen types`

### 3.5 Routing
- **Pattern:** App Router (Next.js 15)
- **Server Components:** Default
- **Client Components:** Add `'use client'` when needed

### 3.6 Official Survivor Contest (Rebuilt)
- **Status:** Implemented (clean rebuild, day-based contest system)
- **Architecture:** Fully admin-controlled — no payment gating, no countdown timers, no auto-grading
- **User Page:** `/dashboard/official-survivor` — view-only bracket, day selector tabs, game card picks, entry switcher
- **Admin:** "Official Contest" tab in admin panel (`AdminOfficialContest.tsx`)
- **Database Tables (new):**
  - `survivor_contest` — single-row config (bracket_data jsonb, bracket_confirmed, status: setup/active/completed)
  - `survivor_contest_days` — admin-created contest days (day_number, round_label, picks_required, status: pending/open/locked/completed, lock_time)
  - `survivor_contest_games` — games posted by admin for each day (team1/team2 with seeds, region, round_key, winner, is_locked, status: posted/locked/graded)
  - `survivor_entries` — user entries (user_id, entry_number, status: active/eliminated/winner, eliminated_at_day, last_advanced_day)
  - `survivor_entry_picks` — per-entry picks per day (entry_id, contest_day_id, game_id, team_name, team_seed, result: pending/won/lost)
- **Bracket Data Structure:** `{ regions: { [region]: [{seed, name}] }, results: {} }` (results populated by grading)
- **User-Side Components:**
  - `SurvivorBracket.tsx` — Bracket Lab-style read-only bracket with per-entry pick highlighting (yellow=pending, green=won, red=lost)
  - `SurvivorGameCards.tsx` — interactive game cards for click-to-pick selection with pick counter dots, team reuse indicators
- **Admin-Side Component:**
  - `AdminOfficialContest.tsx` — collapsible sections: contest status, bracket editor (4 regions x 16 seeds), day management, game posting/grading/locking, entries overview
- **API Routes:**
  - `GET /api/survivor/contest` — contest data, days with games, user entries and picks
  - `POST /api/survivor/picks` — submit/update picks (validates entry ownership, day status, lock time, team reuse, pick count)
  - `GET/POST /api/survivor/entries` — get or create user entries
  - `GET/POST /api/admin/survivor-contest` — admin contest management (save_bracket, confirm_bracket, load_teams, create_day, update_day, post_games, grade_game, lock_game, complete_day, activate_contest)
- **Pick Rules:** Variable picks per day (set by admin via picks_required), team can only be used once per entry across all days (server-enforced)
- **Grading Flow:** Admin grades game -> picks marked won/lost -> losing entries eliminated -> admin completes day -> surviving entries get last_advanced_day updated
- **User Experience:** Entry selector dropdown, day tabs with status indicators, game cards, submit button, advancement/elimination toast notifications
- **No payment, purchase, countdown, or test mode logic**

### 3.7 Admin Panel
- **Location:** `/dashboard/admin` (multi-tab)
- **Tabs:** overview, pipeline, grading, free-pick, games, predictions, visibility, briefing, injuries-admin, overrides, bracket-model, bracket-mgmt, users, official-contest
- **Key Admin APIs:** `survivor-contest` (bracket/day/game/grading management), `games`, `predictions`, `pipeline`

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
- Official Survivor contest (rebuilt: day-based system, admin-controlled, no payment gating)
- Survivor bracket view (Bracket Lab style, per-entry pick highlighting)
- Survivor game cards (click-to-pick, team reuse prevention, pick counter)
- Admin Official Contest panel (bracket editor, day/game management, grading, entries)
- Multiple entries per user with per-entry tracking
- Automatic elimination on loss, advancement tracking on day completion
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
- `survivor_contest` — Single-row contest config (bracket_data, bracket_confirmed, status)
- `survivor_contest_days` — Contest days with round_label, picks_required, status, lock_time
- `survivor_contest_games` — Games posted by admin per day (teams, seeds, region, winner, is_locked)
- `survivor_entries` — User entries (entry_number, status: active/eliminated/winner)
- `survivor_entry_picks` — Per-entry picks per day (team_name, team_seed, result: pending/won/lost)
- `bracket_teams` — Tournament team data by region and seed
- `brackets` — User bracket builds
- `admin_settings` — Key-value admin config

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
- **2026-03-12**: Complete rebuild of Official Survivor system. Removed all old survivor code (AdminBracketEditor, ContestStatusHeader, SurvivorBracketView, RoundGameCards, useSidebarCollapse, officialContestUtils, old API routes). Created new day-based contest system with 5 new database tables (survivor_contest, survivor_contest_days, survivor_contest_games, survivor_entries, survivor_entry_picks). Built new components: SurvivorBracket.tsx (Bracket Lab-style view-only bracket), SurvivorGameCards.tsx (interactive pick cards), AdminOfficialContest.tsx (full admin control panel). Built new API routes: /api/survivor/contest, /api/survivor/picks, /api/survivor/entries, /api/admin/survivor-contest. No payment gating, no countdown timers, fully admin-controlled day-by-day contest flow.