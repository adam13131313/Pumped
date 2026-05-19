# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server on port 8080 (host ::)
npm run build        # Production build
npm run build:dev    # Build with development mode (keeps lovable-tagger)
npm run lint         # ESLint
npm run test         # Vitest run-once
npm run test:watch   # Vitest watch
```

Run a single test: `npx vitest run src/test/store.persistence.test.ts` (or pass a `-t "name"` filter).

There is no separate type-check script; `vite build` runs the TS compiler. `@typescript-eslint/no-unused-vars` is intentionally disabled in `eslint.config.js`.

Env vars required for the app to talk to Supabase (`.env`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

## Architecture

Pumped is a single-page React app (Vite + TS + shadcn/ui + Tailwind) backed by Supabase (Postgres + Auth + Edge Functions + pg_cron). It is a WBS-structured task manager: **Programme → Project → Work Package → Action**, plus Inbox, Waiting For, Routines, and a Pulse dashboard.

### State model — single Zustand store with optimistic Supabase writes

`src/lib/store.ts` (`useAppStore`) is the source of truth for the entire app's domain data (programmes, projects, work_packages, actions, waiting_items, inbox_items, sop_items, plus "gathered" focus state). Every mutator follows the same pattern:

1. Update Zustand state synchronously (optimistic).
2. Fire a `supabase.from(...)` write in the background.
3. On failure for create flows, roll back local state and `toast.error` via `notifySaveError`.

Consequences:
- DB column names are `snake_case`; domain types in `src/lib/types.ts` are `camelCase`. Mappers (`mapAction`, `mapWP`, etc.) live in `loadAllData` and every mutator manually translates updates into a `dbUpdates` object — when adding fields, update both the mapper and every mutator path.
- IDs are generated client-side with `crypto.randomUUID()` before insert.
- Most writes don't `await` or check errors; only `addAction`, `promoteInboxToActions`, `bulkAddActions`, and `takeBackWaiting` have rollback. Be deliberate about which path you mirror.
- `loadAllData` also runs two maintenance writes on every boot: backfills `completed_at` for any Complete tasks missing it, and archives any actions completed >24h ago. Archived actions are not loaded into state.

### Auth & data loading lifecycle

`AuthProvider` (`src/contexts/AuthContext.tsx`) subscribes to Supabase auth changes. When a session appears, it calls `loadAllData` exactly once per user id (guarded by `loadedUserIdRef`/`loadingUserIdRef`). `App.tsx` `ProtectedRoutes` blocks rendering until both session and `dataLoaded` are ready.

There is a **localhost-only auth bypass** in `App.tsx` (`isDevEnvironment`): on `localhost` / `127.0.0.1` routes render without a session. **Preview/staging URLs must sign in** — without an authenticated user, Supabase RLS silently drops writes, making tasks appear to save then vanish on refresh. Do not extend the bypass beyond true localhost.

### Global filter

`GlobalFilter` ({ programmeId, projectId, workPackageId, unassigned }) in the store is read by:
- `useFilteredData` (`src/hooks/useFilteredData.ts`) — filters actions/waiting/inbox/WPs/projects for list pages. Note the filter joins by **name string** (e.g. `actions.project === project.name`), not by FK, because action rows store project/WP as text.
- `useDashboardScope` (`src/hooks/useDashboardScope.ts`) — derives scope level for dashboard widgets.

The filter persists across navigation. `unassigned` is a synthetic mode that surfaces rows with no programme/project/WP linkage.

### Dashboard (Pulse)

`src/pages/DashboardPage.tsx` plus widgets in `src/components/dashboard/`. The health score formula lives in `src/lib/healthScore.ts` and is duplicated inside the `snapshot-health-scores` edge function — if you change the formula, change both. Weekly snapshots are written by a pg_cron job calling that edge function and stored in `health_score_history`.

History/trend tables (`rag_status_history`, `action_status_log`, `inbox_item_events`, `health_score_history`) are populated by Postgres triggers, except `inbox_item_events`, which is written from app code in `deleteInboxItem` / `bulkDeleteInboxItems` / `promoteInboxToActions` (promotion is an explicit user action and needs to log there too).

### Supabase backend

- Migrations: `supabase/migrations/` (timestamped SQL files). Generated types: `src/integrations/supabase/types.ts` — do not hand-edit, it's regenerated from the schema.
- Client: `src/integrations/supabase/client.ts` (auto-generated header, but currently checked in).
- Edge functions (`supabase/functions/`):
  - `ingest-task` — webhook endpoint. Auth is a per-source bearer token compared by SHA-256 hash against `ingest_sources.token_hash`. Upserts into `inbox_items` keyed on `(user_id, source, source_id)` for idempotency. `verify_jwt` is default (true) but the function uses the service role key internally.
  - `extract-tasks`, `generate-wbs`, `suggest-work-package`, `kb-chat`, `kb-suggest-feature` — AI-backed flows (Claude).
  - `transcribe-audio` — voice memo → text.
  - `auth-email-hook` (`verify_jwt = false`), `process-email-queue` (`verify_jwt = true`) — email infra.
  - `snapshot-health-scores` — weekly cron target.

### Routing & shell

`src/App.tsx` is the route table. Every authenticated route is wrapped in `AppShell` (sidebar + header with `GlobalFilter` + `CommandPalette` + `FeedbackButton`). The root `/` and `/actions` both render `MyActions`.

### UI conventions

- shadcn/ui components live in `src/components/ui/` (do not customize these in place unless intentional — they're copy-in primitives).
- Path alias `@/` → `src/` (configured in both `vite.config.ts` and `vitest.config.ts`).
- Toasts use both Radix `Toaster` and Sonner; store errors go through Sonner via `toast.error`.
- Tailwind + `tailwindcss-animate` + Framer Motion. Dark/light theme via `next-themes`.

### Testing

Vitest + jsdom + Testing Library. Setup file: `src/test/setup.ts`. Only two test files exist today (`example.test.ts`, `store.persistence.test.ts`) — the project does not currently aim for high coverage.

### Things to watch

- Adding a column to a domain entity means: migration → regenerate `types.ts` → add to `Action`/`WorkPackage`/etc. type → update the mapper in `loadAllData` → update every `dbUpdates` block in the relevant mutators (`add*`, `update*`, `bulkUpdate*`). Forgetting one causes silent data loss.
- The `lovable-tagger` Vite plugin runs only in development mode — it's a Lovable.dev integration, leave it alone.
- `package.json` `name` is still the Lovable template default (`vite_react_shadcn_ts`); not a bug.
