import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractAndParseJson(raw: string): any {
  // Strip markdown fences
  let content = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

  // Try direct parse
  try {
    return JSON.parse(content);
  } catch (_) {}

  // Try to find JSON object boundaries
  const firstBrace = content.indexOf("{");
  if (firstBrace >= 0) {
    // Find matching closing brace
    let depth = 0;
    let lastBrace = -1;
    for (let i = firstBrace; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) { lastBrace = i; break; }
      }
    }
    if (lastBrace > 0) {
      try {
        return JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } catch (_) {}
    }
  }

  // Fix trailing commas and retry
  const cleaned = content
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\x00-\x1F\x7F]/g, " ");
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  throw new Error("Could not parse AI response as valid JSON. Please try again.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentTexts, images, additionalContext, currentWbs, iteratePrompt } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const combinedText = (documentTexts as string[]).join("\n\n---\n\n");

    const systemPrompt = `You are a project planning expert. Analyze the provided project documents, images, and/or context and produce a Work Breakdown Structure (WBS) with initial tasks.

CRITICAL RULES:
- You MUST faithfully reflect the information provided by the user. Do NOT invent, hallucinate, or fabricate project names, descriptions, or details.
- If the user provides an image showing specific projects, use EXACTLY those project names and descriptions. Do not make up new ones.
- If the user instructs you to group projects under specific programmes, follow their instructions exactly.
- Only add work packages and actions that are reasonable next steps for the actual projects shown/described.
- If information is unclear, use generic but honest placeholders rather than fabricating details.

Return a JSON object with this exact structure:
{
  "programmes": [
    {
      "name": "string - programme name as specified by user",
      "description": "string - programme description",
      "projects": [
        {
          "name": "string - exact project name from user's input",
          "description": "string - project description from user's input",
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
- Group projects under programmes EXACTLY as instructed by the user
- Use the EXACT project names and descriptions from the user's documents/images
- If the user specifies multiple programmes, create multiple programme objects
- If no programme grouping is needed, use a single programme with an empty name
- Each project should have 2-5 work packages
- Each work package should have 2-4 initial actions (specific, actionable tasks)
- Actions should be concrete next steps, not vague descriptions
- If documents mention specific people, assign them as leads
- If dates are mentioned, use them
- If a current WBS is provided with a refinement request, modify and improve the existing structure based on the user's feedback
- Return ONLY the JSON, no markdown fences, no extra text`;

    // Build multimodal user message content
    const userParts: any[] = [];

    // Add images first so the AI can see them
    if (images && Array.isArray(images)) {
      for (const img of images) {
        userParts.push({
          type: "image_url",
          image_url: { url: img.dataUrl },
        });
        userParts.push({
          type: "text",
          text: `[Image uploaded: ${img.name}] — Extract ALL project names, descriptions, and any other details visible in this image EXACTLY as shown. Do not paraphrase or invent new names.`,
        });
      }
    }

    if (combinedText) {
      userParts.push({ type: "text", text: `Documents:\n${combinedText}` });
    }
    if (additionalContext) {
      userParts.push({ type: "text", text: `User instructions:\n${additionalContext}` });
    }
    if (currentWbs && iteratePrompt) {
      userParts.push({
        type: "text",
        text: `Current WBS (iterate on this):\n${JSON.stringify(currentWbs, null, 2)}\n\nUser's refinement request:\n${iteratePrompt}`,
      });
    }

    // Use a vision-capable model
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
          { role: "user", content: userParts.length === 1 ? userParts[0].text : userParts },
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
    const rawContent = data.choices?.[0]?.message?.content ?? "";
    console.log("Raw AI response length:", rawContent.length);

    const wbs = extractAndParseJson(rawContent);

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
