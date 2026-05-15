[README (1).md](https://github.com/user-attachments/files/27781996/README.1.md)
# Pumped — Work in Motion

> Capture, plan, and ship your work. One inbox for everything, zero dropped balls.

Pumped is a personal productivity app built for project managers and team leads who juggle multiple projects, delegate constantly, and can't afford to chase from memory. It combines a GTD-style action list, a waiting-for tracker, AI-powered task capture, and a full Work Breakdown Structure planner — all in one place.

---

## Features

### My Actions
Your personal task list and daily command centre.

- Add actions with title, project, work package, due date, priority, status, notes, and labels
- Status workflow: **Not Started → In Progress → Complete → Blocked**
- Delegate an action to someone → it moves automatically to Waiting For
- Filter by project, priority, or label
- **Gathered focus** — pin tasks to a persistent "Gathered" set for the day; scatter when done
- Bulk select → bulk gather/scatter, update, or delete
- Task attachments (files up to 10MB, auto-detected URLs)
- Threaded comments on tasks
- Duplicate detection — inline warning while typing a similar task name

### Inbox / Rapid Capture
Your quick-entry inbox for capturing tasks from anywhere.

- Paste raw text from meetings, emails, or voice memos → **AI extracts structured tasks** with project, priority, and due date
- Projects are matched to your existing WBS — the AI never invents project names
- Bulk edit priority or project across multiple items
- Promote to My Actions in one click
- Voice transcription on mobile

### Waiting For
Never chase from memory again.

- Log everything you've asked others to deliver — who, what, and when
- Status tracking: **Pending / Received / Overdue**
- "Take Back" — convert a waiting item back into your own action
- Overdue highlighting
- Built-in review cadence in the SOP (Mon + Wed sweeps)

### Projects & Work Packages
Organise work into a clear hierarchy.

- **Programme → Project → Work Package → Action**
- Project statuses: Active / On Hold / Complete
- Work Package fields: lead, start date, due date, RAG status, blockers, dependencies
- RAG statuses: 🟢 Green / 🟡 Amber / 🔴 Red
- Dependency types: FS, FF, SS, SF with optional lag days
- Export the full WBS hierarchy as CSV

### WBS Planner
AI-generated project plans from documents, images, or free text.

- Paste a brief, upload a doc, or describe a project — AI generates a full Work Breakdown Structure
- Edit inline and refine iteratively
- Accept & Create imports the entire hierarchy in one click

### Routines
Build habits alongside your project work.

- Create routines with flexible frequency: daily, weekly by day, or weekly by count target
- Time of day: Morning / Afternoon / Evening / Anytime
- Streak tracking with completion history
- Weekly calendar view
- Archive and restore routines

### Integrations
One inbox for every tool you use.

- **Webhook Sources** — generate a bearer token, POST tasks from any external app directly into your Pumped inbox
- Idempotent ingest: re-sending the same `source_id` updates the existing item safely
- Tokens stored as SHA-256 hashes; regeneratable if compromised
- "Send test task" verifies the full end-to-end loop
- Auto-generated **curl and JS code snippets** per source
- **Zapier / Make** compatible — use a "Webhooks → POST" step to connect 5,000+ apps with no code
- **Native connectors coming soon**: Gmail, Slack, Linear, Asana, Notion, Outlook

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
- **Global Filter** — filter by Programme / Project / Work Package across the entire app; persists across navigation
- **Command Palette** (⌘K / Ctrl+K) — search across actions, inbox, waiting, work packages, and projects
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
| Backend | Supabase (Postgres, Edge Functions, Auth) |
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

Open [Lovable](https://lovable.dev) and click **Share → Publish**. You can also connect a custom domain under **Project → Settings → Domains**.
