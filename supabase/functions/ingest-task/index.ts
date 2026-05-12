import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return json(401, { error: "Missing bearer token" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tokenHash = await sha256Hex(token);
    const { data: source, error: srcErr } = await supabase
      .from("ingest_sources")
      .select("id, user_id, slug")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (srcErr) {
      console.error("source lookup error", srcErr);
      return json(500, { error: "Lookup failed" });
    }
    if (!source) return json(401, { error: "Invalid token" });

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    // Minimal validation
    const sourceId = String(payload.source_id ?? "").trim();
    const task = String(payload.task ?? payload.title ?? "").trim();
    if (!sourceId) return json(400, { error: "source_id is required" });
    if (!task) return json(400, { error: "task (or title) is required" });
    if (task.length > 500) return json(400, { error: "task too long" });

    const allowedPriority = ["High", "Medium", "Low"];
    const priority = allowedPriority.includes(String(payload.priority))
      ? String(payload.priority)
      : "Medium";

    const dueDate = String(payload.due_date ?? "").trim().slice(0, 32);
    const project = String(payload.project ?? "").trim().slice(0, 200);
    const notes = String(payload.notes ?? "").trim().slice(0, 5000);
    const sourceUrl = String(payload.source_url ?? payload.url ?? "").trim().slice(0, 1000);

    const row = {
      user_id: source.user_id,
      source: source.slug,
      source_id: sourceId,
      source_url: sourceUrl,
      task,
      priority,
      due_date: dueDate,
      project,
      notes,
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from("inbox_items")
      .upsert(row, { onConflict: "user_id,source,source_id" })
      .select("id")
      .single();

    if (upsertErr) {
      console.error("upsert error", upsertErr);
      return json(500, { error: "Failed to ingest" });
    }

    await supabase
      .from("ingest_sources")
      .update({ last_received_at: new Date().toISOString() })
      .eq("id", source.id);

    return json(200, { ok: true, id: upserted.id });
  } catch (e) {
    console.error("ingest-task error", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
