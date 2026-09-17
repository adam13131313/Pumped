import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ANTHROPIC_MODELS, callAnthropic, explainAnthropicError } from "../_shared/anthropic.ts";

// v3 contract:
// Request body  :: { text, sourceType?, existingNodes?: NodeOption[] }
//   NodeOption  :: { id: string, path: string }    // "Programme › Project › WP"
// Response body :: { summary, tasks: ExtractedTask[], proposedNodes: ProposedNode[] }
//   ExtractedTask :: { task, priority: 'high'|'medium'|'low',
//                      status: 'not_started'|'in_progress'|'complete'|'blocked',
//                      startDate, dueDate,
//                      wbsNodeId: string | null,     // existing node
//                      wbsNodeKey: string | null,    // proposed node (mutually exclusive)
//                      notes, labels }
//   ProposedNode  :: { key: string,                  // "new-1", "new-2", …
//                      name: string,
//                      nodeType: 'portfolio'|'programme'|'project'|'work_package',
//                      parentId: string | null,      // existing node to nest under
//                      parentKey: string | null }    // or another proposed node
// proposedNodes lets the model honour structure instructions embedded in the
// source text ("these belong in a new project X with work package Y"). The
// client previews the nodes and only creates them on user approval.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_TEXT_LEN = 50_000;
const MAX_EXISTING_NODES = 500;

interface NodeOption {
  id: string;
  path: string;
}

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first === -1 || last === -1) throw new Error("Model response contained no JSON object");
    return JSON.parse(cleaned.slice(first, last + 1));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, sourceType, existingNodes } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > MAX_TEXT_LEN) {
      return new Response(
        JSON.stringify({ error: `Text exceeds ${MAX_TEXT_LEN} characters` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nodes: NodeOption[] = Array.isArray(existingNodes) ? existingNodes.slice(0, MAX_EXISTING_NODES) : [];

    const nodeRule = nodes.length > 0
      ? `- The user has these WBS nodes:
${nodes.map((n, i) => `${i + 1}. ${n.path} (id=${n.id})`).join("\n")}
- For each task, set "wbsNodeId" to the id of the most-fitting node, or null if no node clearly matches. NEVER invent ids.`
      : `- The user has no WBS nodes yet. Set "wbsNodeId" to null unless you propose new nodes. Do NOT invent ids.`;

    const systemPrompt = `You are a task extraction assistant. Analyze the provided text (meeting notes, voice memos, emails, free-form notes) and extract actionable tasks.

The source text may also contain INSTRUCTIONS about how to organise the tasks — e.g. "these all relate to X, which needs to be a project, with a work package Y". Follow such instructions: propose the new WBS nodes and assign the tasks to them.

Return a JSON object with this structure:
{
  "summary": "1-2 sentence summary of the source material",
  "proposedNodes": [
    {
      "key": "new-1",
      "name": "node name",
      "nodeType": "portfolio" | "programme" | "project" | "work_package",
      "parentId": "uuid of an EXISTING node to nest under, or null",
      "parentKey": "key of another proposed node to nest under, or null"
    }
  ],
  "tasks": [
    {
      "task": "specific, actionable task description starting with a verb",
      "priority": "high" | "medium" | "low",
      "status": "not_started",
      "startDate": "YYYY-MM-DD or empty",
      "dueDate":   "YYYY-MM-DD or empty",
      "wbsNodeId": "uuid of an EXISTING node, or null",
      "wbsNodeKey": "key of a proposed node, or null",
      "notes": "any relevant context, or empty string",
      "labels": []
    }
  ]
}

Rules:
- Extract EVERY actionable item, no matter how small.
- Tasks must be specific and start with a verb.
- If a deadline is mentioned (even relative like "by Friday"), convert to YYYY-MM-DD where possible.
- Map urgency cues: ASAP/urgent → "high", routine → "medium", nice-to-have → "low".
- All priority/status/nodeType values MUST be lowercase exactly as listed.
${nodeRule}

Rules for proposedNodes:
- Only propose new nodes when the text instructs it or clearly names a container that does not exist yet. If existing nodes fit, use them — do not duplicate. Default: propose nothing ("proposedNodes": []).
- WBS hierarchy: a portfolio may contain sub-portfolios, programmes, or projects. A programme may contain projects. A project contains work packages. Work packages hold the tasks.
- A parent is OPTIONAL at every level: a project (or programme, or portfolio) can stand alone with both parentId and parentKey null. If the text does not name a parent, leave the top proposed node at root — do NOT invent a wrapper.
- Each proposed node sets AT MOST ONE of parentId (existing node) / parentKey (proposed node). A work_package's parent must be a project.
- Keys must be unique strings like "new-1", "new-2". Tasks reference proposed nodes via "wbsNodeKey" and must set at most one of wbsNodeId / wbsNodeKey.
- Attach tasks to the most specific fitting node (usually a work package).

- Return ONLY the JSON, no markdown fences.
- Source type: ${sourceType || "unknown"}`;

    try {
      const raw = await callAnthropic({
        model: ANTHROPIC_MODELS.sonnet,
        systemPrompt,
        messages: [{ role: "user", content: text }],
        maxTokens: 4096,
      });
      const result = extractJson(raw);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      const { status, payload } = explainAnthropicError(e);
      return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("extract-tasks error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
