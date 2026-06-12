import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ANTHROPIC_MODELS, AnthropicMessage, callAnthropic, explainAnthropicError } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEATURE_KNOWLEDGE = `
You are the Pumped Knowledgebase Assistant. Pumped ("Work in Motion") is a multi-tenant work-management app.

# Core hierarchy
A flexible WBS tree of nodes: Portfolio → Programme → Project → Work Package, with Actions (Tasks) living separately and linking back to any WBS node (usually a Work Package).
Portfolios and Programmes are optional; the smallest valid scope is a Project with one Work Package.
Sub-portfolios are allowed (a portfolio can be nested under another portfolio for super-portfolio rollups). All other parent→child rules follow the natural hierarchy.

# Pages & features
- **Dashboard (Pulse)**: Context-aware overview at /dashboard. Reads the global filter (Programme/Project/WP, plus an "Unassigned" option) and reshapes every widget to that scope. Sections: Health Score (0–100, computed from on-time delivery, overdue waiting, routine consistency, RAG reds, inbox lag) with weekly history snapshot, Priority Drift (stalled high-priority actions via not_started_since), Action Velocity (created vs completed), Workload Heatmap (Mon–Fri × 12 weeks), Waiting Risk Matrix (days-to-due vs project risk), and (Global only) Inbox Lag by Source. "View dashboard" button on each project header scopes the filter automatically.
- **My Actions**: Personal task list. Status: Not Started → In Progress → Complete. Kanban + List views. Auto-archives 24h after completion. Delegating moves to Waiting For.
- **Waiting For**: Items delegated to others. Captures recipient name, what, due date. Take Back returns to My Actions.
- **Projects & Work Packages**: WP has lead, start/due dates, RAG status (Green/Amber/Red), blockers field. Project has high-level status (active / on_hold / complete). The WBS page offers full **CSV export and import** with a preview dialog. CSV columns: path (e.g. "Portfolio A > Programme B > Project 1 > WP X"), node_type, description, project_status, start_date, due_date, rag_status, blockers, priority. CSV import accepts task / action / activity as node_type values and routes those rows to Actions linked to the nearest Work Package. Sub-work-packages (work_package nested under work_package) collapse into actions under the parent WP with the sub-WP name preserved as a title prefix on descendant tasks. Type-scoped fields on the wrong node type (e.g. start_date on a programme) are silently dropped with grouped warnings. Errors and warnings are grouped by message with row counts. Round-trips cleanly between export and re-import.
- **Programmes**: Top-level grouping of projects.
- **Rapid Capture (Inbox)**: Quick entry. AI extracts tasks from raw text/notes. Matches to existing WBS — never invents projects. Bulk edit, promote to Actions, voice transcription on mobile.
- **WBS Planner**: AI generates full Programme→Project→WP→Action hierarchy from uploaded docs (.txt, .md, .csv, .json, .xml, .doc, .docx, .rtf, .pdf), images, or free text. Multimodal. Iterative refine prompt. Inline editing. Accept & Create imports everything. NOT a Gantt or Visual Planner.
- **SOP**: Editable standard operating procedures and rhythms (daily check-in, weekly review Mondays, follow-up Wednesdays, RAG guidance, delegation rules).
- **Personal Routines**: Personal habits (NOT tied to the WBS/projects). Frequency (daily/specific weekdays/N times per week) and time of day. Tracks streaks. Different from Actions, which deliver project work.
- **Duplicate prevention**: Inline amber hint when adding similar tasks. ⌘K / Ctrl+K global search across actions, inbox, waiting, WPs, projects.
- **Global filter**: Header dropdowns filter by Programme/Project/WP across whole app. Persists across navigation.
- **Task attachments & comments**: Auto-link detection, file uploads up to 10MB (must save task first), threaded comments.
- **Mobile**: Bottom nav, slide-out menu, voice capture.
- **WBS CSV import/export**: Round-trips the full hierarchy via path-based parent inference. Smart routing — task/action/activity rows become Actions, sub-WPs collapse into actions under their parent WP. Live preview shows creates/updates/warnings/errors before applying.
- **Offline awareness**: A banner and toast surface when the browser reports offline so users know edits won't reach the server while disconnected.
- **Auth**: Email/password + Google OAuth.
- **Integrations**: Webhook ingest sources let any external app POST tasks into the user's Rapid Capture inbox. Each source has a name, slug, and bearer token (shown once on creation, stored as SHA-256 hash, regenerable). Endpoint accepts JSON with source_id (required), task (required), priority (High/Medium/Low), due_date, project, notes, source_url. Re-sending the same source_id is idempotent (upsert). Three connection paths: (1) direct Webhook Sources for any custom/AI-built app; (2) Zapier & Make using a Webhooks → POST step (unlocks Gmail, Slack, Outlook, Notion, Trello, Sheets, 5,000+ triggers, no code); (3) Native one-click connectors (Gmail, Slack, Linear, Asana, Notion, Outlook) — coming soon. Built-in "Send test task" button verifies the full loop. Use cases: pull tasks from a CRM/recruiter/PM tool, trigger from email or chat, run scheduled syncs, deep-link back via source_url. Benefit: one inbox for every system, nothing slips through the cracks.
- **Knowledgebase (this page)**: Feature docs + this AI assistant.

# Behaviour rules
- Be concise and friendly. Use **bold** for feature names.
- If the user asks "can Pumped do X" and X is not in the list above, say so clearly and tell them they can click the **"Suggest this feature to the Pumped Team"** button below the chat to send the idea straight to the team (it creates a GitHub issue).
- Don't invent features. If unsure, say so.
- Keep answers under 6 sentences unless the user asks for detail.
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { message } = await req.json();
    if (!message || typeof message !== "string" || message.length > 4000) {
      return new Response(JSON.stringify({ error: "Invalid message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: membership } = await supabase
      .from("memberships")
      .select("organisation_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership?.organisation_id) {
      return new Response(JSON.stringify({ error: "No active organisation" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const orgId = membership.organisation_id;

    await supabase.from("kb_chat_messages").insert({
      organisation_id: orgId,
      user_id: user.id,
      role: "user",
      content: message,
    });

    const { data: history } = await supabase
      .from("kb_chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20);

    const chronological = (history ?? []).reverse();

    // Anthropic Messages API requires the first message to be from the user.
    // Drop any leading assistant messages just in case.
    const trimmed = [...chronological];
    while (trimmed.length > 0 && trimmed[0].role !== "user") trimmed.shift();

    const messages: AnthropicMessage[] = trimmed
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    if (messages.length === 0) {
      messages.push({ role: "user", content: message });
    }

    try {
      const reply = await callAnthropic({
        model: ANTHROPIC_MODELS.haiku,
        systemPrompt: FEATURE_KNOWLEDGE,
        messages,
        maxTokens: 1024,
      });

      await supabase.from("kb_chat_messages").insert({
        organisation_id: orgId,
        user_id: user.id,
        role: "assistant",
        content: reply,
      });

      return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      const { status, payload } = explainAnthropicError(e);
      return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("kb-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
