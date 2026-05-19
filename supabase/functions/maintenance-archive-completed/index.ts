// Archives Complete actions older than 24h and backfills missing completed_at.
// Internal cron-invoked function. Mirror of snapshot-health-scores pattern.
//
// Replaces the per-session maintenance UPDATEs that previously ran inline in
// the client's loadAllData. Those scaled with the user's row count and added
// 2-7s cold-start latency on large tenants — this runs once per hour against
// the whole table instead.
//
// To schedule (run once in the Supabase SQL editor; pattern mirrors
// process-email-queue in 20260501121310_email_infra.sql):
//
//   SELECT cron.schedule(
//     'maintenance-archive-completed',
//     '17 * * * *',  -- hourly at :17
//     $$
//     SELECT net.http_post(
//       url := 'https://<project>.supabase.co/functions/v1/maintenance-archive-completed',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
//       ),
//       body := '{}'::jsonb
//     );
//     $$
//   );
//
// To revert: SELECT cron.unschedule('maintenance-archive-completed');

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowIso = new Date().toISOString();
  const archiveCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { error: backfillErr, count: backfilled } = await supabase
    .from("actions")
    .update({ completed_at: nowIso }, { count: "exact" })
    .eq("status", "complete")
    .is("completed_at", null);

  const { error: archiveErr, count: archived } = await supabase
    .from("actions")
    .update({ archived_at: nowIso }, { count: "exact" })
    .is("archived_at", null)
    .eq("status", "complete")
    .not("completed_at", "is", null)
    .lt("completed_at", archiveCutoff);

  const errors = [backfillErr, archiveErr].filter(Boolean);
  const status = errors.length ? 500 : 200;

  return new Response(
    JSON.stringify({
      ok: errors.length === 0,
      backfilled: backfilled ?? 0,
      archived: archived ?? 0,
      errors: errors.map((e) => e?.message ?? String(e)),
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
