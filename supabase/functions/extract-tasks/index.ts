import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, sourceType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a task extraction assistant. Analyze the provided text (which may be meeting notes, voice memo transcripts, emails, spreadsheet data, or free-form notes) and extract actionable tasks.

Return a JSON object with this structure:
{
  "summary": "string - brief summary of the source material (1-2 sentences)",
  "tasks": [
    {
      "task": "string - clear, specific, actionable task description",
      "priority": "High" | "Medium" | "Low",
      "dueDate": "string - YYYY-MM-DD if mentioned or inferrable, otherwise empty string",
      "project": "string - suggested project name if identifiable, otherwise empty string",
      "notes": "string - any relevant context from the source, or empty string"
    }
  ]
}

Rules:
- Extract EVERY actionable item, no matter how small
- Tasks must be specific and start with a verb (e.g. "Send", "Review", "Schedule", "Follow up on")
- If people are mentioned as responsible, note that in the task or notes
- If deadlines are mentioned (even relative like "by Friday"), convert to dates where possible
- Prioritize based on urgency cues in the text (ASAP/urgent = High, routine = Medium, nice-to-have = Low)
- Group related tasks under the same project if a project name is apparent
- Return ONLY the JSON, no markdown fences
- Source type: ${sourceType || "unknown"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
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

    const result = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-tasks error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
