import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { title, description } = await req.json();
    if (!title || typeof title !== "string" || title.length < 3 || title.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid title" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!description || typeof description !== "string" || description.length > 5000) {
      return new Response(JSON.stringify({ error: "Invalid description" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    const owner = Deno.env.get("GITHUB_REPO_OWNER");
    const repo = Deno.env.get("GITHUB_REPO_NAME");

    let issueUrl: string | null = null;
    let issueNumber: number | null = null;
    let status = "submitted";

    if (GITHUB_TOKEN && owner && repo) {
      const body = `**Suggested by:** ${user.email ?? user.id}\n\n${description}`;
      const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "pumped-kb-suggest",
        },
        body: JSON.stringify({ title: `[Feature] ${title}`, body, labels: ["feature-request", "from-app"] }),
      });
      if (ghRes.ok) {
        const issue = await ghRes.json();
        issueUrl = issue.html_url;
        issueNumber = issue.number;
        status = "github_issue_created";
      } else {
        const errText = await ghRes.text();
        console.error("GitHub issue creation failed:", ghRes.status, errText);
        status = "github_failed";
      }
    } else {
      console.warn("GitHub env vars missing — saving suggestion without issue.");
    }

    const { error: insertErr } = await supabase.from("feature_suggestions").insert({
      user_id: user.id,
      title,
      description,
      github_issue_url: issueUrl,
      github_issue_number: issueNumber,
      status,
    });
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true, github_issue_url: issueUrl, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kb-suggest-feature error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
