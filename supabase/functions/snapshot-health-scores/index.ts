// Weekly health-score snapshot. Iterates all users, computes score, upserts into health_score_history.
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

interface ActionRow { status: string; due_date: string; completed_at: string | null; archived: boolean; }
interface WaitingRow { status: string; due_by: string; }
interface WPRow { rag_status: string; }
interface InboxRow { id: string; created_at: string; }
interface InboxEvent { inbox_item_id: string; event: string; event_at: string; created_at_snapshot: string | null; }
interface RoutineRow { id: string; archived_at: string | null; frequency_type: string; frequency_config: any; }
interface RoutineCompletion { routine_id: string; completed_date: string; }

function computeScore(opts: {
  actions: ActionRow[];
  waiting: WaitingRow[];
  wps: WPRow[];
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

  const overdue = opts.waiting.filter((w) => w.status === "Pending" && w.due_by && new Date(w.due_by) < today).length;
  const overdueWaiting = -Math.min(15, overdue * 3);

  let routine = 0;
  if (opts.routineTargetLast7 > 0) {
    const ratio = Math.min(1, opts.routineCompletionsLast7 / opts.routineTargetLast7);
    routine = Math.round(ratio * 20);
  }

  const reds = opts.wps.filter((wp) => wp.rag_status === "Red").length;
  const rag = -Math.min(10, reds * 2);

  let inboxLag = 0;
  if (opts.inboxLagAvgDays !== null && opts.inboxLagAvgDays > 1) {
    inboxLag = -Math.min(10, Math.round((opts.inboxLagAvgDays - 1) * 4));
  }

  const base = 62;
  const score = Math.max(0, Math.min(100, base + onTime + overdueWaiting + routine + rag + inboxLag));
  return { score, onTime, overdueWaiting, routine, rag, inboxLag };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get distinct users from actions/waiting/wps
    const { data: profiles, error: profErr } = await supabase.from("profiles").select("user_id");
    if (profErr) throw profErr;
    const userIds = Array.from(new Set((profiles ?? []).map((p: any) => p.user_id).filter(Boolean)));

    const week = mondayOf(new Date());
    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    let processed = 0;

    for (const userId of userIds) {
      const [actionsRes, waitingRes, wpsRes, inboxRes, eventsRes, routinesRes, completionsRes] = await Promise.all([
        supabase.from("actions").select("status,due_date,completed_at,archived").eq("user_id", userId).eq("archived", false),
        supabase.from("waiting_items").select("status,due_by").eq("user_id", userId),
        supabase.from("work_packages").select("rag_status").eq("user_id", userId),
        supabase.from("inbox_items").select("id,created_at").eq("user_id", userId).gte("created_at", sevenAgo),
        supabase.from("inbox_item_events").select("inbox_item_id,event,event_at,created_at_snapshot").eq("user_id", userId).eq("event", "promoted").gte("event_at", sevenAgo),
        supabase.from("routines").select("id,archived_at,frequency_type,frequency_config").eq("user_id", userId).is("archived_at", null),
        supabase.from("routine_completions").select("routine_id,completed_date").eq("user_id", userId).gte("completed_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
      ]);

      const actions = (actionsRes.data ?? []) as ActionRow[];
      const waiting = (waitingRes.data ?? []) as WaitingRow[];
      const wps = (wpsRes.data ?? []) as WPRow[];
      const events = (eventsRes.data ?? []) as InboxEvent[];

      // Inbox lag avg days from promoted events in last 7 days
      let inboxLagAvgDays: number | null = null;
      const lags = events
        .map((e) => {
          if (!e.created_at_snapshot) return null;
          const ms = new Date(e.event_at).getTime() - new Date(e.created_at_snapshot).getTime();
          return ms / 86400000;
        })
        .filter((v): v is number => v !== null && v >= 0);
      if (lags.length > 0) inboxLagAvgDays = lags.reduce((a, b) => a + b, 0) / lags.length;

      // Routine target: simple heuristic — daily routines = 7, weekly = 1, monthly = 0.25
      const routines = (routinesRes.data ?? []) as RoutineRow[];
      const routineTargetLast7 = routines.reduce((sum, r) => {
        if (r.frequency_type === "daily") return sum + 7;
        if (r.frequency_type === "weekly") return sum + 1;
        return sum + 0.25;
      }, 0);
      const routineCompletionsLast7 = (completionsRes.data ?? []).length;

      const result = computeScore({
        actions,
        waiting,
        wps,
        routineCompletionsLast7,
        routineTargetLast7: Math.round(routineTargetLast7),
        inboxLagAvgDays,
      });

      // Upsert by (user_id, recorded_week)
      await supabase
        .from("health_score_history")
        .upsert(
          {
            user_id: userId,
            recorded_week: week,
            score: result.score,
            on_time_component: result.onTime,
            overdue_waiting_component: result.overdueWaiting,
            routine_component: result.routine,
            rag_component: result.rag,
            inbox_lag_component: result.inboxLag,
          },
          { onConflict: "user_id,recorded_week" },
        );
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
