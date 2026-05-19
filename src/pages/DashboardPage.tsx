import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useDashboardScope } from "@/hooks/useDashboardScope";
import { computeHealthScore, scoreColor } from "@/lib/healthScore";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { HealthRing, HealthBreakdown } from "@/components/dashboard/HealthRing";
import { StalledHighList } from "@/components/dashboard/StalledHighList";
import { VelocityChartWithCreated } from "@/components/dashboard/VelocityChart";
import { WorkloadHeatmap } from "@/components/dashboard/WorkloadHeatmap";
import { WaitingRiskMatrix } from "@/components/dashboard/WaitingRiskMatrix";
import { WidgetTitle } from "@/components/dashboard/WidgetTitle";
import { Gauge } from "lucide-react";

// v2 dashboard. Scope is keyed off useDashboardScope's nodeIdSet + predicates,
// so widgets no longer need their own subtree-walking logic. Server-only
// reads (RAG history, routine targets, inbox lag) are intentionally kept
// here; phase 5 will move them into dedicated hooks.

export default function DashboardPage() {
  const scope = useDashboardScope();
  const wbsNodes = useAppStore((s) => s.wbsNodes);
  const allActions = useAppStore((s) => s.actions);
  const waitingItems = useAppStore((s) => s.waitingItems);
  const inboxItems = useAppStore((s) => s.inboxItems);
  const currentOrg = useAppStore((s) => s.currentOrg);

  const [actionMeta, setActionMeta] = useState<{ createdAt: Map<string, string>; notStartedSince: Map<string, string> }>({ createdAt: new Map(), notStartedSince: new Map() });
  const [inboxLagDays, setInboxLagDays] = useState<number | null>(null);
  const [routine7, setRoutine7] = useState<{ count: number; target: number }>({ count: 0, target: 0 });

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;
    (async () => {
      const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const [actMeta, routinesRes, compsRes] = await Promise.all([
        supabase.from("actions").select("id,created_at,not_started_since").eq("organisation_id", currentOrg.id),
        supabase.from("routines").select("id,frequency_type,frequency_config").is("archived_at", null).eq("organisation_id", currentOrg.id),
        supabase.from("routine_completions").select("completed_date").gte("completed_date", sevenAgo).eq("organisation_id", currentOrg.id),
      ]);
      if (cancelled) return;

      const ca = new Map<string, string>();
      const ns = new Map<string, string>();
      for (const r of actMeta.data ?? []) {
        if (r.created_at) ca.set(r.id, r.created_at);
        if (r.not_started_since) ns.set(r.id, r.not_started_since);
      }
      setActionMeta({ createdAt: ca, notStartedSince: ns });

      const routines = routinesRes.data ?? [];
      const target = routines.reduce((sum, r) => {
        const cfg = r.frequency_config as { days?: number[]; target?: number } | null;
        if (r.frequency_type === "daily") return sum + 7;
        if (r.frequency_type === "weekly_days") return sum + (Array.isArray(cfg?.days) ? cfg.days.length : 0);
        if (r.frequency_type === "weekly_count") return sum + (cfg?.target ?? 1);
        return sum;
      }, 0);
      setRoutine7({ count: (compsRes.data ?? []).length, target });

      // Inbox lag deferred to phase 5; v1's inbox_item_events table is gone.
      setInboxLagDays(null);
    })();
    return () => { cancelled = true; };
  }, [currentOrg]);

  const scopedActions = useMemo(() => allActions.filter(scope.actionInScope), [allActions, scope]);
  const scopedWaiting = useMemo(() => {
    if (scope.level === "global") return waitingItems;
    if (scope.level === "unassigned") return waitingItems.filter((w) => !w.wbsNodeId);
    return waitingItems.filter((w) => w.wbsNodeId && scope.nodeIdSet.has(w.wbsNodeId));
  }, [waitingItems, scope]);
  const scopedInbox = useMemo(() => {
    if (scope.level === "global") return inboxItems;
    if (scope.level === "unassigned") return inboxItems.filter((i) => !i.wbsNodeId);
    return inboxItems.filter((i) => i.wbsNodeId && scope.nodeIdSet.has(i.wbsNodeId));
  }, [inboxItems, scope]);
  const scopedNodes = useMemo(() => {
    if (scope.level === "global") return wbsNodes;
    if (scope.level === "unassigned") return [];
    return wbsNodes.filter(scope.nodeInScope);
  }, [wbsNodes, scope]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + 1);
  const completedThisWeek = scopedActions.filter((a) => a.completedAt && new Date(a.completedAt) >= weekStart);
  const onTimeThisWeek = completedThisWeek.filter((a) => !a.dueDate || new Date(a.completedAt!) <= new Date(a.dueDate + "T23:59:59"));
  const onTimePct = completedThisWeek.length === 0 ? 0 : Math.round((onTimeThisWeek.length / completedThisWeek.length) * 100);
  const overdueWaiting = scopedWaiting.filter((w) => w.status === "pending" && w.dueBy && new Date(w.dueBy) < today).length;

  const health = useMemo(() => computeHealthScore({
    actions: scopedActions,
    waitingItems: scopedWaiting,
    wbsNodes: scopedNodes,
    inboxItems: scopedInbox,
    routineCompletionsLast7Days: routine7.count,
    routineTargetLast7Days: routine7.target,
    inboxLagAvgDays: inboxLagDays,
  }), [scopedActions, scopedWaiting, scopedNodes, scopedInbox, routine7, inboxLagDays]);

  const counts = scope.countsByType;

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-start gap-3">
        <div className="mt-1 p-2 rounded-md bg-primary/10 text-primary"><Gauge className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Pumped Pulse{scope.level !== "global" && scope.label ? ` — ${scope.label}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{scope.subLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Health score"
          info="A composite 0–100 score combining on-time delivery, waiting follow-ups, routine consistency, work-package health and inbox lag."
          value={health.score}
          tone={scoreColor(health.score)}
          sub="Score this week"
        />
        <MetricCard
          title="Completed on time"
          info="Of actions completed this week, the share where you finished on or before the due date."
          value={`${onTimePct}%`}
          tone={onTimePct >= 80 ? "green" : onTimePct >= 60 ? "amber" : "red"}
          sub={`${onTimeThisWeek.length} of ${completedThisWeek.length} completed`}
        />
        <MetricCard
          title="Overdue waiting"
          info="Pending Waiting For items past their due date."
          value={overdueWaiting}
          tone={overdueWaiting === 0 ? "green" : overdueWaiting <= 3 ? "amber" : "red"}
          sub="Pending past due"
        />
        <MetricCard
          title="Inbox lag"
          info="Average days between capture and triage. Deferred to phase 5."
          value={inboxLagDays === null ? "—" : `${inboxLagDays.toFixed(1)}d`}
          tone="neutral"
          sub="Last 30 days"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><WidgetTitle title="Health score breakdown" info="How each factor contributes to your current score." /></CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-6">
            <HealthRing result={health} />
            <HealthBreakdown result={health} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><WidgetTitle title="Priority drift — stalled high items" info="High-priority actions that have been Not Started for more than 3 days." /></CardHeader>
          <CardContent>
            <StalledHighList actions={scopedActions} wbsNodes={wbsNodes} notStartedSinceMap={actionMeta.notStartedSince} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><WidgetTitle title="Action velocity — added vs completed" info="Tasks created vs completed each week over the last 8 weeks." /></CardHeader>
        <CardContent>
          <VelocityChartWithCreated actions={scopedActions} createdAtById={actionMeta.createdAt} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><WidgetTitle title="Workload heatmap — tasks due per day" info="A 12-week look-ahead of due dates." /></CardHeader>
          <CardContent><WorkloadHeatmap actions={scopedActions} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><WidgetTitle title="Waiting For risk matrix" info="Each dot is a pending waiting item. Top-left = chase now." /></CardHeader>
          <CardContent>
            <WaitingRiskMatrix waitingItems={scopedWaiting} wbsNodes={wbsNodes} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><WidgetTitle title="At a glance" info="Quick scope summary." /></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Portfolios</dt><dd className="font-mono">{counts.portfolio}</dd>
            <dt className="text-muted-foreground">Programmes</dt><dd className="font-mono">{counts.programme}</dd>
            <dt className="text-muted-foreground">Projects</dt><dd className="font-mono">{counts.project}</dd>
            <dt className="text-muted-foreground">Work packages</dt><dd className="font-mono">{counts.work_package}</dd>
            <dt className="text-muted-foreground">Active actions</dt><dd className="font-mono">{scopedActions.length}</dd>
            <dt className="text-muted-foreground">Pending waiting</dt><dd className="font-mono">{scopedWaiting.filter((w) => w.status === "pending").length}</dd>
            <dt className="text-muted-foreground">Inbox items</dt><dd className="font-mono">{scopedInbox.length}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
