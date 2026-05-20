import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content ?? "";
    content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(content);

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
    console.error("suggest-work-package error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
