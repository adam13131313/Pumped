[README (7).md](https://github.com/user-attachments/files/27785109/README.7.md)
# Pumped — Work in Motion

> One place to capture, organise, execute, and complete every task — regardless of where it came from.

---

## What is Pumped?

Most task tools ask you to choose: either you manage work inside the tool, or you manage it inside the apps your team already uses. Pumped refuses that trade-off.

At its core, Pumped is a **WBS-structured task layer** — every action you own is organised into a clean Programme → Project → Work Package → Action hierarchy, giving even the busiest portfolio a shape you can reason about. Used standalone, it replaces the spreadsheets, sticky notes, and half-finished Notion pages that most project managers rely on.

Its real power, however, is **connectivity**. Pumped sits across the top of your existing toolset — Slack, Linear, Asana, Gmail, Outlook, and more — acting as the single system of record for everything that requires your attention. Tasks flow in from any source. You triage, prioritise, and execute inside Pumped. When status changes, updates travel back to the originating system automatically. The source never goes stale; your WBS never goes blind.

The result: one inbox for every tool you use, one hierarchy for every programme you run, and one dashboard that tells you — at any scope, in real time — whether the work is on track.

---

## Features

### Pumped Pulse Dashboard
A context-aware analytics dashboard that shows how you're actually working — not just what's on your list.

The dashboard reads the global filter bar (Programme / Project / Work Package) and scopes every widget to your current context automatically:

| Filter state | Dashboard shows |
|---|---|
| All (no filter) | Global rollup across all your work |
| Programme selected | All projects and work packages within that programme |
| Project selected | Work packages, actions, and RAG for that project |
| Work Package selected | Actions and status for that work package |
| Unassigned | Only tasks with no programme, project, or WP linked |

Every data point is clickable and navigates directly to the relevant page with filters pre-applied — the dashboard is a launchpad, not just a read-only report.

**Widgets:**
- **Health score** — a 0–100 composite score built from on-time delivery, overdue waiting items, routine streaks, project RAG spread, and inbox lag; colour coded green/amber/red with a week-on-week delta
- **Health score breakdown** — donut ring with a per-component breakdown showing exactly what's helping or hurting your score
- **Completed on time** — percentage of actions completed on or before their due date this week
- **Overdue waiting for** — count of pending waiting items past their due date; click to jump straight to them
- **Inbox lag** — average days between capture and promotion to action, across all sources
- **Priority drift** — high-priority actions sitting in Not Started for 3+ days; sorted by age, click any row to go directly to that task
- **Action velocity** — line chart of tasks added vs completed over 8 weeks; reveals whether work is accumulating faster than you're clearing it
- **Workload heatmap** — 12-week day-by-day grid of tasks due; darker = heavier load; click any cell to see those tasks
- **Project RAG trend** — how Green/Amber/Red project counts have shifted week by week; switches to WP completion bars at project/WP scope
- **Waiting For risk matrix** — 2×2 scatter of waiting items by urgency and project risk; top-left quadrant = chase now
- **Routine consistency** — 4-week habit grid showing which routines are genuinely embedded vs aspirational
- **Inbox lag by source** — average days to action broken down by capture source

Every widget has a hover tooltip explaining what it measures and how to act on it.

---

### My Actions
Your personal task list and daily command centre.

- Add actions with title, project, work package, due date, priority, status, notes, and labels
- Status workflow: **Not Started → In Progress → Complete → Blocked**
- Switch between **List** and **Kanban** views without losing context
- Delegate an action to someone → it moves automatically to Waiting For
- Filter by task name, priority, or status; global Programme/Project/WP filter applied across the whole app
- **Gathered focus** — pin tasks to a persistent "Gathered" set for the day; scatter when done
- Bulk select → bulk update status, bulk update priority, bulk delete, bulk gather/scatter
- Task attachments (files up to 10MB, auto-detected URLs)
- Threaded comments on tasks
- Duplicate detection — inline warning while typing a similar task name

### Inbox / Rapid Capture
Every task, from every source, in one place.

- Label captures by source type (meeting notes, email, voice memo, webhook, etc.)
- Paste raw text → **AI extracts structured tasks** with project, priority, and due date matched to your existing WBS
- Tasks piped in via webhook arrive here automatically, tagged with their originating source
- Bulk edit priority or project across multiple items at once
- Promote to My Actions in one click
- Voice transcription support on mobile

### Waiting For
Never chase from memory again.

- Log everything you've asked others to deliver — who, what, and when
- Status tracking: **Pending / Received / Overdue** with overdue highlighting
- Filter by description, from whom, project, or status
- Link waiting items to a project (used by the dashboard risk matrix)
- "Take Back" — convert a waiting item back into your own action
- Built-in review cadence in the SOP (Mon + Wed sweeps)

### Projects & Work Packages
Organise work into a clear hierarchy.

- **Programme → Project → Work Package → Action** — a strict structure that keeps strategic intent and daily execution in the same shape
- Project statuses: Active / On Hold / Complete
- Work Package fields: lead, start date, due date, RAG status, blockers, dependencies
- RAG statuses: 🟢 Green / 🟡 Amber / 🔴 Red — full history tracked over time for dashboard trend charts
- Dependency types: FS, FF, SS, SF with optional lag days
- Export the full WBS hierarchy as CSV
- "View dashboard for this project" — one click to the scoped Pulse dashboard from any project detail page

### WBS Planner
AI-generated project plans from documents, images, or free text.

- Paste a brief, upload a doc, or describe a project — AI generates a full Work Breakdown Structure
- Edit inline and refine iteratively
- Accept & Create imports the entire hierarchy in one click

### Personal Routines
Build habits alongside your project work.

- Create routines with flexible frequency: daily, weekly by specific days, or weekly by count target
- Time of day: Morning / Afternoon / Evening / Anytime
- Streak tracking with completion history
- Weekly calendar grid view
- Archive and restore routines
- Routine consistency feeds directly into the dashboard health score

### Integrations & Two-Way Sync
Pumped sits across your existing toolset, not alongside it.

- **Webhook ingest** — generate a bearer token per source and POST tasks from any external app directly into your Pumped inbox; tasks arrive pre-tagged with their origin
- **Idempotent updates** — re-sending the same `source_id` updates the existing task rather than creating a duplicate; status changes in Pumped flow back to the source via the stored `source_url` deep link
- Tokens stored as SHA-256 hashes; regeneratable without disrupting existing flows
- "Send test task" verifies the full end-to-end loop before you go live
- Auto-generated **curl and JS code snippets** per webhook source
- **Zapier / Make** compatible — connect 5,000+ apps with a single Webhooks → POST step, no code required
- **Native two-way connectors coming**: Gmail, Slack, Linear, Asana, Notion, Outlook — tasks sync in, completions sync back

### Knowledge Base
Built-in help and an AI assistant.

- Full in-app documentation covering every feature
- AI chat assistant — ask how anything works, powered by Claude
- Persistent chat history
- Feature suggestion form

### SOP (Standard Operating Procedures)
An editable operating rhythm baked into the app.

- Default procedures for: daily check-in, post-meeting capture, weekly review, follow-up sweep, RAG guidance, and delegation rules
- Fully editable to match your own workflow

### Global Features
- **Global Filter** — filter by Programme / Project / Work Package / Unassigned across the entire app and dashboard; persists as you navigate
- **Command Palette** (⌘K / Ctrl+K) — instant search across actions, inbox items, waiting items, projects, and work packages
- Dark / light mode
- Mobile-first — bottom nav, slide-out menu, mobile-friendly forms, voice transcription
- Supabase auth with email/password and password reset

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, Framer Motion |
| State | Zustand, TanStack Query |
| Backend | Supabase (Postgres, Edge Functions, Auth, Cron) |
| Charts | Recharts |
| Export | jsPDF, ExcelJS |
| Validation | Zod |

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/adam13131313/Pumped.git
cd Pumped

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Add your Supabase credentials to a `.env` file:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

---

## Deployment

Build for production with:

```bash
npm run build
```

Deploy the `dist` folder to any static hosting platform (Vercel, Netlify, Cloudflare Pages, etc.). Set the three Supabase environment variables in your hosting provider's settings.
# project-finance
