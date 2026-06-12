import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ANTHROPIC_MODELS, callAnthropic, explainAnthropicError } from "../_shared/anthropic.ts";

// v2 contract:
// Request body  :: { task, notes?, currentNodeId?, workPackages: WPOption[] }
//   WPOption    :: { id: string, name: string, path: string }    // path = "Programme › Project › Work Package"
// Response body :: { suggestion: { nodeId: string } | null, confidence, reason }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WPOption {
  id: string;
  name: string;
  path: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { task, notes, currentNodeId, workPackages } = await req.json();

    if (!task || typeof task !== "string") {
      return new Response(JSON.stringify({ error: "Task is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wps: WPOption[] = Array.isArray(workPackages) ? workPackages : [];
    if (wps.length === 0) {
      return new Response(JSON.stringify({ suggestion: null, reason: "No work packages exist yet." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wpList = wps
      .map((w, i) => `${i + 1}. ${w.path} (id=${w.id})`)
      .join("\n");

    const systemPrompt = `You match a task to the most appropriate Work Package from a fixed list.

Return ONLY JSON in this exact shape:
{
  "matchIndex": number | null,
  "confidence": "high" | "medium" | "low",
  "reason": "short sentence explaining the match"
}

Rules:
- matchIndex is the 1-based index from the list, or null if no reasonable match exists.
- Prefer a Work Package whose path matches the task's currently linked node (if any).
- Do not invent work packages. Only choose from the list.
- If nothing is a sensible match, return matchIndex: null.`;

    const userPrompt = `Task: "${task}"
${notes ? `Notes: "${notes}"\n` : ""}${currentNodeId ? `Currently linked node id: "${currentNodeId}"\n` : ""}
Available Work Packages (with full breadcrumb path):
${wpList}`;

    try {
      const raw = await callAnthropic({
        model: ANTHROPIC_MODELS.haiku,
        systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        maxTokens: 512,
      });
      const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(cleaned);

      const idx = typeof parsed.matchIndex === "number" ? parsed.matchIndex - 1 : -1;
      const match = idx >= 0 && idx < wps.length ? wps[idx] : null;

      return new Response(
        JSON.stringify({
          suggestion: match ? { nodeId: match.id } : null,
          confidence: parsed.confidence ?? "low",
          reason: parsed.reason ?? "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      const { status, payload } = explainAnthropicError(e);
      return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("suggest-work-package error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
