# Pumped Pulse Dashboard

A single context-aware `/dashboard` page that reads the existing global filter (Programme / Project / Work Package, plus a new "Unassigned" option) and reshapes every widget accordingly. No per-entity dashboard routes.

## Part 1 — Schema migrations (Supabase)

One migration covering:

**New tables**
- `rag_status_history` — `work_package_id`, `rag_status`, `recorded_at`, `user_id`. RLS: users manage own.
- `action_status_log` — `action_id`, `from_status`, `to_status`, `changed_at`, `user_id`. RLS: users manage own.
- `inbox_item_events` — `inbox_item_id`, `event` (`promoted`|`deleted`), `event_at`, `user_id`. RLS: users manage own.
- `health_score_history` — `user_id`, `score`, five component columns, `recorded_week` (Monday), `created_at`. RLS: users manage own.

**Column additions**
- `actions.not_started_since timestamptz` — set on insert when status = Not Started, cleared on transition away.
- `waiting_items.linked_project_id uuid` (nullable, FK projects). Free-text `project_wp` stays for display.
- `inbox_items.source` already exists — confirmed in schema, no change.

**Triggers**
- `wp_rag_history_trg` on `work_packages` AFTER UPDATE OF rag_status → insert into `rag_status_history`. Also AFTER INSERT to seed.
- `action_status_log_trg` on `actions` AFTER UPDATE OF status → insert into `action_status_log`; also maintain `not_started_since`. AFTER INSERT seeds `not_started_since` when applicable.
- Inbox event logging is done from app code (promote/delete paths) since promotion is an explicit user action.

**Indexes** on FK + recorded_at columns for chart queries.

## Part 2 — Weekly health-score snapshot

- New edge function `snapshot-health-scores` (verify_jwt = false, internal): iterates all users, computes the score using the same formula as the client and inserts a `health_score_history` row keyed to the current week (Monday). Idempotent on `(user_id, recorded_week)` via unique index.
- pg_cron job scheduled Mondays 03:00 UTC, calling the function with the project anon key.

## Part 3 — Dashboard page

`src/pages/DashboardPage.tsx` route `/dashboard`, lazy-loaded in `App.tsx`.

**Context layer**
- New hook `useDashboardScope()` reading from existing `GlobalFilter` store, returning `{ level: 'global'|'programme'|'project'|'wp'|'unassigned', ids, label, counts }`.
- Add `Unassigned` synthetic option to `GlobalFilter` Programme dropdown — selecting it sets a flag that makes `useFilteredData` and the dashboard scope to rows with no programme/project/wp linkage.

**Layout** — context banner → Section A (4 metric cards) → B (breakdown ring + stalled high) → C (velocity chart full width) → D (workload heatmap + RAG trend / WP completion fallback) → E (Waiting risk matrix + routine consistency, latter hidden unless Global) → F (Inbox lag by source, Global only).

**Components** under `src/components/dashboard/`:
- `ContextBanner`, `MetricCard`, `HealthRing`, `HealthBreakdownTable`, `StalledHighList`, `VelocityChart`, `WorkloadHeatmap`, `RagTrendChart`, `WPCompletionBars`, `WaitingRiskMatrix`, `RoutineConsistencyGrid`, `InboxLagBySource`, `WidgetTitle` (with ⓘ tooltip).

**Data fetching** — single React Query hook per widget, all keyed on `scope`. Empty states are icon + message components inside each widget.

**Charts** — Recharts (already a dep). Heatmap/risk matrix are custom SVG/Tailwind grids. Animations via Framer Motion fade-in only.

**Health score formula** — implemented once in `src/lib/healthScore.ts`, reused by client and edge function (edge function duplicates the math in TS).

## Part 4 — Nav & existing page updates

- `AppNav` and `MobileBottomNav`: add Dashboard as first item with `Gauge` icon (lucide).
- `Landing` redirect for authenticated users → `/dashboard`.
- `ProjectDetailPage`: add "View dashboard for this project" button that sets the global filter to that project and navigates to `/dashboard`.
- `WaitingDialog`: add "Linked project (for dashboard)" select bound to `linked_project_id`.
- Inbox promote/delete handlers (`InboxPage`): write to `inbox_item_events`.

## Technical details

- Migration first, single approval. Then code.
- `not_started_since` backfill: on migration, set it to `created_at` for existing actions where `status = 'Not Started'`.
- `rag_status_history` backfill: insert one row per existing WP with current rag_status and `created_at` so trends aren't blank on day one.
- Health score weekly cron uses `pg_cron` + `pg_net` with the published anon key (via insert tool, not migration, per scheduled-jobs guidance).
- All charts respect dark/light theme via existing CSS variables.
- Strict TypeScript types for scope + widget data.

## Out of scope
- No new "Unassigned" routing logic beyond the filter flag.
- Routines remain personal; not split per-context.
- No CSV export of dashboard data (can add later).

Implementation order: migrations → cron+edge function → scope hook + filter "Unassigned" → dashboard page + widgets → nav + page integrations.