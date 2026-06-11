# Pumped MCP server (local-only spike)

A Model Context Protocol server that exposes Pumped's commitment graph to Claude Desktop and other MCP clients. Lets you use your existing Claude-chat workflows — meeting reconciliation, bulk import, ad-hoc queries — to read and write Pumped directly.

> **Spike-grade.** Uses your Supabase service-role key, bypasses RLS, scopes everything to one hardcoded org. Appropriate for personal use on your own machine. Not a production product surface. The real product MCP server (phase 5) will use per-user OAuth + scoped tokens.

## What it exposes

Seven tools:

| Tool | What it does |
|---|---|
| `list_wbs_nodes` | List portfolios / programmes / projects / work packages |
| `create_wbs_node` | Create a new WBS node anywhere in the hierarchy |
| `list_commitments` | List actions and/or waiting items with filters |
| `get_commitment` | Full detail of one commitment by id |
| `create_commitment` | Create a new action or waiting item |
| `update_commitment` | Patch any field on an existing commitment |
| `close_commitment` | Convenience: mark action complete or waiting item received |

## Setup

### 1. Get the four config values

You need:

- `SUPABASE_URL` — from Supabase dashboard → Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY` — same page, under "Project API keys" → `service_role`. **Treat like a password — never commit this to git or share it.**
- `PUMPED_USER_ID` — your auth user id
- `PUMPED_ORGANISATION_ID` — your Pumped org id

The two Pumped IDs are easiest to grab from your local Pumped tab. Open the browser devtools console (Cmd-Option-I → Console) and run:

```js
// Both values you need:
(await window.supabase.auth.getUser()).data.user.id
(await window.supabase.from("memberships").select("organisation_id").limit(1).single()).data.organisation_id
```

(If `window.supabase` isn't defined, you can grab the same values from a Supabase SQL query in the dashboard.)

### 2. Configure Claude Desktop

Open your Claude Desktop config:

```bash
open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Add (or merge into) the `mcpServers` block:

```json
{
  "mcpServers": {
    "pumped": {
      "command": "npx",
      "args": [
        "tsx",
        "/Users/adamhyde/Developer/Pumped/scripts/pumped-mcp/server.ts"
      ],
      "env": {
        "SUPABASE_URL": "https://your-project-ref.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJ...",
        "PUMPED_USER_ID": "your-auth-uid",
        "PUMPED_ORGANISATION_ID": "your-org-uuid"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

Quit completely (Cmd-Q) and reopen. In a new chat, the wrench/tools icon should show `pumped` with the seven tools listed. If it doesn't, check `~/Library/Logs/Claude/mcp*.log` for errors.

## Example prompts

### Meeting reconciliation

After a Google Meet, paste the transcript or notes and:

> I just had a meeting. Transcript below.
>
> 1. List my current open actions and waiting items via `list_commitments`.
> 2. List my WBS nodes via `list_wbs_nodes` so you have project context.
> 3. Extract commitments discussed in the meeting.
> 4. For each, decide if it matches an existing item (propose update or closure) or is net-new (propose create).
> 5. Show me a diff: **Closures**, **Updates**, **New**.
> 6. **WAIT for my confirmation before calling any write tools.**
> 7. After I confirm, apply all the changes.
>
> Transcript:
> [paste here]

### Bulk import existing tasks

> I have a list of existing commitments I want in Pumped. First call `list_wbs_nodes` to see what structure exists. Then for each item below, infer the right WBS node (or note it's unassigned), and create it via `create_commitment`. Use today's date as `asked_on` for waiting items. Show me a summary at the end.
>
> [paste your task list]

### Ad-hoc queries

> What's overdue or at risk this week? Use list_commitments, then explain.

> What am I waiting on from [name]? Use list_commitments with type='waiting' and the appropriate fromWhomText filter.

## Tool details

### `list_wbs_nodes`
- `nodeType?` — filter to one type
- `includeArchived?` — default false

### `create_wbs_node`
- `name` (required)
- `nodeType` (required) — portfolio / programme / project / work_package
- `parentId?` — required for everything except portfolio
- Project-only: `projectStatus`
- Work-package-only: `startDate`, `dueDate`, `ragStatus`, `blockers`

### `list_commitments`
- `type?` — `action` / `waiting` / omit for both
- `actionStatus?`, `waitingStatus?`
- `wbsNodeId?`, `assignedTo?`
- `includeArchived?` — default false
- `limit?` — default 200

### `get_commitment`
- `id`, `type`

### `create_commitment`
- `type` (required) — `action` or `waiting`
- Action shape: `task` (required), `priority`, `actionStatus`, `assignedTo`, `startDate`, `dueDate`, `notes`, `labels`, `wbsNodeId`
- Waiting shape: `description` (required), `fromUserId` or `fromWhomText` (one required), `askedOn`, `dueBy`, `waitingStatus`, `notes`, `wbsNodeId`

### `update_commitment`
- `id`, `type` (required), plus any subset of the create fields you want to patch
- Setting `actionStatus='complete'` auto-sets `completed_at`

### `close_commitment`
- `id`, `type`
- `note?` — optional closure note prepended with `[closed]` and appended to existing notes

## Security

- Service-role key bypasses Row-Level Security. The server scopes every query to your `PUMPED_ORGANISATION_ID` but a bug in the server code could in principle read other orgs. Don't share this server.
- The `.env` and Claude Desktop config contain secrets. Never commit them. The `.env` is already gitignored in this directory.
- The server runs on stdio inside Claude Desktop's process; there's no network listener. It only talks to Supabase outbound.

## Troubleshooting

**Tools don't appear in Claude Desktop:** check `~/Library/Logs/Claude/mcp-server-pumped.log` (or `mcp.log`) for errors. Most often a typo in the config path or a missing env var.

**`No rows found` errors:** your `PUMPED_USER_ID` or `PUMPED_ORGANISATION_ID` may be wrong. Re-grab them from devtools.

**Write tools fail with constraint errors:** the server doesn't validate everything — e.g. it won't catch a WBS child whose `parentId` is in a different org. The error message from Supabase usually points at the cause.

## Caveats for the spike

- **Single-user only.** All actions you create are assigned to you; all waiting items have `from_whom_text` or your specified `from_user_id`. There's no good way to represent "Sarah owes Marcus something" yet because Sarah and Marcus aren't in your org.
- **No fuzzy matching built in.** Meeting reconciliation depends on Claude's reasoning over the JSON lists this server returns — the server itself doesn't propose matches. That's fine for personal use; the in-product reconciliation flow (phase 2) will do better.
- **No audit log entry.** Changes via MCP look identical to direct DB writes. Once the phase-1 audit log lands, MCP writes will appear there with a `source: 'mcp'` marker.
