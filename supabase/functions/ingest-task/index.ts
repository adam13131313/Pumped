import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// v2 ingest endpoint. Bearer token → integration_tokens row → webhook_sources
// (carries organisation_id and slug). Inserts into inbox_items scoped to that
// org. external_id is used for idempotency.

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
    const { data: tokenRow, error: tokErr } = await supabase
      .from("integration_tokens")
      .select("source_id, organisation_id, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokErr) {
      console.error("token lookup error", tokErr);
      return json(500, { error: "Lookup failed" });
    }
    if (!tokenRow || tokenRow.revoked_at) return json(401, { error: "Invalid token" });

    const { data: source, error: srcErr } = await supabase
      .from("webhook_sources")
      .select("id, slug, organisation_id")
      .eq("id", tokenRow.source_id)
      .eq("organisation_id", tokenRow.organisation_id)
      .maybeSingle();
    if (srcErr || !source) return json(401, { error: "Source not found" });

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const externalId = String(payload.source_id ?? payload.external_id ?? "").trim();
    const task = String(payload.task ?? payload.title ?? "").trim();
    if (!externalId) return json(400, { error: "source_id (external id) is required" });
    if (!task) return json(400, { error: "task (or title) is required" });
    if (task.length > 500) return json(400, { error: "task too long" });

    const allowedPriority = ["high", "medium", "low"];
    const rawPriority = String(payload.priority ?? "medium").toLowerCase();
    const priority = allowedPriority.includes(rawPriority) ? rawPriority : "medium";

    const dueDate = String(payload.due_date ?? "").trim().slice(0, 32) || null;
    const notes = String(payload.notes ?? "").trim().slice(0, 5000);
    const externalUrl = String(payload.source_url ?? payload.url ?? payload.external_url ?? "").trim().slice(0, 1000) || null;
    const wbsNodeId = typeof payload.wbs_node_id === "string" ? payload.wbs_node_id : null;

    const row = {
      organisation_id: source.organisation_id,
      source_id: source.id,
      wbs_node_id: wbsNodeId,
      task,
      priority,
      due_date: dueDate,
      notes,
      external_id: externalId,
      external_url: externalUrl,
    };

    // Manual upsert: external_id is not globally unique, but
    // (organisation_id, source_id, external_id) should resolve to one row.
    const { data: existing } = await supabase
      .from("inbox_items")
      .select("id")
      .eq("organisation_id", source.organisation_id)
      .eq("source_id", source.id)
      .eq("external_id", externalId)
      .maybeSingle();

    let inboxId: string;
    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("inbox_items")
        .update(row)
        .eq("id", existing.id);
      if (updErr) {
        console.error("update error", updErr);
        return json(500, { error: "Failed to ingest" });
      }
      inboxId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("inbox_items")
        .insert(row)
        .select("id")
        .single();
      if (insErr || !inserted) {
        console.error("insert error", insErr);
        return json(500, { error: "Failed to ingest" });
      }
      inboxId = inserted.id;
    }

    await supabase
      .from("webhook_sources")
      .update({ last_received_at: new Date().toISOString() })
      .eq("id", source.id);

    return json(200, { ok: true, id: inboxId });
  } catch (e) {
    console.error("ingest-task error", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
