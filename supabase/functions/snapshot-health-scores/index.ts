// Weekly health-score snapshot. v2: iterate every (organisation, member),
// compute score for that membership, upsert into health_score_history.
// Internal cron-invoked function. verify_jwt = false.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mondayOf(d: Date): string {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}

interface ActionRow { status: string; due_date: string | null; completed_at: string | null; archived_at: string | null }
interface WaitingRow { status: string; due_by: string | null }
interface WbsRow { node_type: string; rag_status: string | null; archived_at: string | null }
interface RoutineRow { id: string; archived_at: string | null; frequency_type: string; frequency_config: { days?: number[]; target?: number } | null }

function computeScore(opts: {
  actions: ActionRow[];
  waiting: WaitingRow[];
  wbsNodes: WbsRow[];
  routineCompletionsLast7: number;
  routineTargetLast7: number;
  inboxLagAvgDays: number | null;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyAgo = new Date(today.getTime() - 30 * 86400000);

  const completedRecent = opts.actions.filter((a) => a.completed_at && new Date(a.completed_at) >= thirtyAgo);
  let onTimeRatio = 1;
  if (completedRecent.length > 0) {
    const onTime = completedRecent.filter((a) => {
      if (!a.due_date) return true;
      return new Date(a.completed_at!) <= new Date(a.due_date + "T23:59:59");
    }).length;
    onTimeRatio = onTime / completedRecent.length;
  }
  const onTime = Math.round(onTimeRatio * 30);

  const overdue = opts.waiting.filter((w) => w.status === "pending" && w.due_by && new Date(w.due_by) < today).length;
  const overdueWaiting = -Math.min(15, overdue * 3);

  let routine = 0;
  if (opts.routineTargetLast7 > 0) {
    const ratio = Math.min(1, opts.routineCompletionsLast7 / opts.routineTargetLast7);
    routine = Math.round(ratio * 20);
  }

  const reds = opts.wbsNodes.filter((n) => n.node_type === "work_package" && n.rag_status === "red").length;
  const rag = -Math.min(10, reds * 2);

  let inboxLag = 0;
  if (opts.inboxLagAvgDays !== null && opts.inboxLagAvgDays > 1) {
    inboxLag = -Math.min(10, Math.round((opts.inboxLagAvgDays - 1) * 4));
  }

  const base = 62;
  const score = Math.max(0, Math.min(100, base + onTime + overdueWaiting + routine + rag + inboxLag));
  return {
    score,
    components: { base, onTime, overdueWaiting, routine, rag, inboxLag },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: memberships, error: memErr } = await supabase
      .from("memberships")
      .select("organisation_id, user_id");
    if (memErr) throw memErr;

    const week = mondayOf(new Date());
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    let processed = 0;

    for (const m of memberships ?? []) {
      const orgId = m.organisation_id as string;
      const userId = m.user_id as string;

      const [actionsRes, waitingRes, wbsRes, routinesRes, completionsRes] = await Promise.all([
        supabase.from("actions").select("status,due_date,completed_at,archived_at")
          .eq("organisation_id", orgId).is("archived_at", null),
        supabase.from("waiting_items").select("status,due_by").eq("organisation_id", orgId),
        supabase.from("wbs_nodes").select("node_type,rag_status,archived_at").eq("organisation_id", orgId).is("archived_at", null),
        supabase.from("routines").select("id,archived_at,frequency_type,frequency_config")
          .eq("organisation_id", orgId).is("archived_at", null),
        supabase.from("routine_completions").select("routine_id,completed_date")
          .eq("organisation_id", orgId).eq("user_id", userId).gte("completed_date", sevenDaysAgo),
      ]);

      const actions = (actionsRes.data ?? []) as ActionRow[];
      const waiting = (waitingRes.data ?? []) as WaitingRow[];
      const wbsNodes = (wbsRes.data ?? []) as WbsRow[];

      const routines = (routinesRes.data ?? []) as RoutineRow[];
      const routineTargetLast7 = routines.reduce((sum, r) => {
        const cfg = r.frequency_config ?? {};
        if (r.frequency_type === "daily") return sum + 7;
        if (r.frequency_type === "weekly_days") return sum + (Array.isArray(cfg.days) ? cfg.days.length : 0);
        if (r.frequency_type === "weekly_count") return sum + (cfg.target ?? 1);
        return sum;
      }, 0);
      const routineCompletionsLast7 = (completionsRes.data ?? []).length;

      // Inbox lag is deferred: v1's inbox_item_events table is gone in v2.
      const result = computeScore({
        actions, waiting, wbsNodes,
        routineCompletionsLast7,
        routineTargetLast7: Math.round(routineTargetLast7),
        inboxLagAvgDays: null,
      });

      const { error: upErr } = await supabase
        .from("health_score_history")
        .upsert(
          {
            organisation_id: orgId,
            user_id: userId,
            score: result.score,
            components: result.components,
            recorded_week: week,
          },
          { onConflict: "organisation_id,user_id,recorded_week" },
        );
      if (upErr) {
        console.error("upsert error", { orgId, userId, upErr });
        continue;
      }
      processed++;
    }

    return new Response(JSON.stringify({ ok: true, processed, week }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("snapshot-health-scores error", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
