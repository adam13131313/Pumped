import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEATURE_KNOWLEDGE = `
You are the Pumped Knowledgebase Assistant. Pumped ("Work in Motion") is a personal work-management app.

# Core hierarchy
Programme → Project → Work Package → Action (Task). Strict — no other levels.

# Pages & features
- **Dashboard (Pulse)**: Context-aware overview at /dashboard. Reads the global filter (Programme/Project/WP, plus an "Unassigned" option) and reshapes every widget to that scope. Sections: Health Score (0–100, computed from on-time delivery, overdue waiting, routine consistency, RAG reds, inbox lag) with weekly history snapshot, Priority Drift (stalled high-priority actions via `not_started_since`), Action Velocity (created vs completed), Workload Heatmap (Mon–Fri × 12 weeks), Waiting Risk Matrix (days-to-due vs project risk), and (Global only) Inbox Lag by Source. "View dashboard" button on each project header scopes the filter automatically.
- **My Actions**: Personal task list. Status: Not Started → In Progress → Complete. Kanban + List views. Auto-archives 24h after completion. Delegating moves to Waiting For.
- **Waiting For**: Items delegated to others. Captures recipient name, what, due date. Take Back returns to My Actions.
- **Projects & Work Packages**: WP has lead, due date, RAG status (Green/Amber/Red). Export full WBS as CSV.
- **Programmes**: Top-level grouping of projects.
- **Rapid Capture (Inbox)**: Quick entry. AI extracts tasks from raw text/notes. Matches to existing WBS — never invents projects. Bulk edit, promote to Actions, voice transcription on mobile.
- **WBS Planner**: AI generates full Programme→Project→WP→Action hierarchy from uploaded docs (.txt, .md, .csv, .json, .xml, .doc, .docx, .rtf, .pdf), images, or free text. Multimodal. Iterative refine prompt. Inline editing. Accept & Create imports everything. NOT a Gantt or Visual Planner.
- **SOP**: Editable standard operating procedures and rhythms (daily check-in, weekly review Mondays, follow-up Wednesdays, RAG guidance, delegation rules).
- **Personal Routines**: Personal habits (NOT tied to the WBS/projects). Frequency (daily/specific weekdays/N times per week) and time of day. Tracks streaks. Different from Actions, which deliver project work.
- **Duplicate prevention**: Inline amber hint when adding similar tasks. ⌘K / Ctrl+K global search across actions, inbox, waiting, WPs, projects.
- **Global filter**: Header dropdowns filter by Programme/Project/WP across whole app. Persists across navigation.
- **Task attachments & comments**: Auto-link detection, file uploads up to 10MB (must save task first), threaded comments.
- **Mobile**: Bottom nav, slide-out menu, voice capture.
- **CSV/XLSX import**: Templates, column mapping, direct-to-actions import.
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

    // Save user message
    await supabase.from("kb_chat_messages").insert({ user_id: user.id, role: "user", content: message });

    // Load recent history (last 20)
    const { data: history } = await supabase
      .from("kb_chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const messages = [
      { role: "system", content: FEATURE_KNOWLEDGE },
      ...(history ?? []).reverse().map((m) => ({ role: m.role, content: m.content })),
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up Lovable AI." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const reply = aiData.choices?.[0]?.message?.content ?? "Sorry, no response.";

    await supabase.from("kb_chat_messages").insert({ user_id: user.id, role: "assistant", content: reply });

    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("kb-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
