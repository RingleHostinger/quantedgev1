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
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (ThemeProvider + Toaster)
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles + theme variables
│   └── api/                # API routes (minimal use)
├── components/
│   ├── ui/                 # shadcn/ui components (pre-installed)
│   └── ThemeProvider.tsx   # Theme context wrapper
├── hooks/
│   └── use-mobile.tsx      # Mobile detection (<768px)
├── lib/
│   └── utils.ts            # Utilities (cn function)
└── integrations/
    └── supabase/
        ├── client.ts       # Client-side (RLS enabled)
        └── server.ts       # Server-side (RLS bypassed)

.zoer/                      # Zoer Agent context
├── STRUCTURE.md            # This file (project knowledge base)
└── PLAN.md                 # Project plan and tasks
```

**Key Directories:**
- `app/` - Next.js routes and layouts
- `components/ui/` - shadcn/ui components (DO NOT recreate)
- `integrations/supabase/` - Database client configuration

---

## 3. Core Systems

### 3.1 Authentication
- **Provider:** Supabase Auth
- **Status:** Not implemented yet
- **Location:** TBD

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
- **Tables:** None yet
- **Types:** Auto-generate with `npx supabase gen types`

### 3.5 Routing
- **Pattern:** App Router (Next.js 15)
- **Server Components:** Default
- **Client Components:** Add `'use client'` when needed

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
- Theme system (light/dark mode)
- shadcn/ui components library
- Supabase client setup
- Toast notifications
- Mobile detection hook
- User authentication (not yet)
- Database tables (not yet)

### Installed Dependencies
- next 15
- react 18
- typescript 5+
- tailwindcss 4
- shadcn/ui (all components)
- lucide-react
- next-themes
- @supabase/supabase-js

### Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Database Schema
No tables created yet.

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