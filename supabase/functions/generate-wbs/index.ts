import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentTexts, additionalContext, currentWbs, iteratePrompt } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const combinedText = (documentTexts as string[]).join("\n\n---\n\n");

    const systemPrompt = `You are a project planning expert. Analyze the provided project documents and/or context and produce a Work Breakdown Structure (WBS) with initial tasks.

Return a JSON object with this exact structure:
{
  "programmes": [
    {
      "name": "string - programme name",
      "description": "string - programme description",
      "projects": [
        {
          "name": "string - project name",
          "description": "string - brief project description",
          "workPackages": [
            {
              "name": "string - work package name",
              "lead": "string - suggested lead or empty",
              "dueDate": "string - suggested due date YYYY-MM-DD or empty",
              "description": "string - what this work package covers",
              "actions": [
                {
                  "task": "string - specific actionable task",
                  "priority": "High" | "Medium" | "Low",
                  "dueDate": "string - YYYY-MM-DD or empty"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Group projects under programmes as instructed by the user
- If the user specifies multiple programmes, create multiple programme objects
- If no programme grouping is needed, use a single programme with an empty name
- Each project should have 2-8 work packages
- Each work package should have 2-6 initial actions (specific, actionable tasks)
- Actions should be concrete next steps, not vague descriptions
- Work package names should be specific and actionable
- If documents mention specific people, assign them as leads
- If dates are mentioned, use them
- If a current WBS is provided with a refinement request, modify and improve the existing structure based on the user's feedback. Keep what works, change what they asked for.
- Return ONLY the JSON, no markdown fences`;

    let userContent = "";
    if (combinedText) userContent += `Documents:\n${combinedText}\n\n`;
    if (additionalContext) userContent += `Additional context:\n${additionalContext}\n\n`;
    if (currentWbs && iteratePrompt) {
      userContent += `Current WBS (iterate on this):\n${JSON.stringify(currentWbs, null, 2)}\n\nUser's refinement request:\n${iteratePrompt}`;
    }

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
          { role: "user", content: userContent },
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

    // Strip markdown fences if present
    content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();

    const wbs = JSON.parse(content);

    return new Response(JSON.stringify(wbs), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-wbs error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
