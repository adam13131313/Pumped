import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useDashboardScope } from "@/hooks/useDashboardScope";
import { computeHealthScore, scoreColor } from "@/lib/healthScore";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { HealthRing, HealthBreakdown } from "@/components/dashboard/HealthRing";
import { ReadinessMix } from "@/components/dashboard/ReadinessMix";
import { StalledHighList } from "@/components/dashboard/StalledHighList";
import { VelocityChartWithCreated } from "@/components/dashboard/VelocityChart";
import { WorkloadHeatmap } from "@/components/dashboard/WorkloadHeatmap";
import { WaitingRiskMatrix } from "@/components/dashboard/WaitingRiskMatrix";
import { RagTrendChart, WPCompletionBars } from "@/components/dashboard/RagTrendChart";
import { WidgetTitle } from "@/components/dashboard/WidgetTitle";
import { Gauge } from "lucide-react";
import type { RagStatus } from "@/lib/types";

interface RagHistoryRow {
  wbs_node_id: string;
  to_status: RagStatus;
  recorded_at: string;
}

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
  const [ragHistory, setRagHistory] = useState<RagHistoryRow[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;
    (async () => {
      const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const [actMeta, routinesRes, compsRes, ragRes] = await Promise.all([
        supabase.from("actions").select("id,created_at,not_started_since").eq("organisation_id", currentOrg.id),
        supabase.from("routines").select("id,frequency_type,frequency_config").is("archived_at", null).eq("organisation_id", currentOrg.id),
        supabase.from("routine_completions").select("completed_date").gte("completed_date", sevenAgo).eq("organisation_id", currentOrg.id),
        supabase.from("rag_status_history").select("wbs_node_id,to_status,recorded_at").eq("organisation_id", currentOrg.id).order("recorded_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setRagHistory((ragRes.data ?? []) as RagHistoryRow[]);

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
  const scopedWorkPackages = useMemo(
    () => scopedNodes.filter((n) => n.nodeType === "work_package" && !n.archivedAt),
    [scopedNodes],
  );
  const isGlobalOrProgramme = scope.level === "global" || scope.level === "programme" || scope.level === "portfolio";

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ReadinessMix scopedActions={scopedActions} />
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
          <CardHeader className="pb-2">
            <WidgetTitle
              title={isGlobalOrProgramme ? "Project RAG trend" : "Work-package completion"}
              info={isGlobalOrProgramme ? "Counts of work packages at each RAG status over the last 8 weeks." : "Percent of actions complete in each work package within this scope."}
            />
          </CardHeader>
          <CardContent>
            {isGlobalOrProgramme
              ? <RagTrendChart history={ragHistory} nodeIdSet={scope.nodeIdSet} />
              : <WPCompletionBars workPackages={scopedWorkPackages} actions={scopedActions} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><WidgetTitle title="Waiting For risk matrix" info="Each dot is a pending waiting item. Top-left = chase now." /></CardHeader>
          <CardContent>
            <WaitingRiskMatrix waitingItems={scopedWaiting} wbsNodes={wbsNodes} />
          </CardContent>
        </Card>
        <AtAGlance
          counts={counts}
          activeActions={scopedActions.length}
          pendingWaiting={scopedWaiting.filter((w) => w.status === "pending").length}
          inboxItems={scopedInbox.length}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// At a glance
// ---------------------------------------------------------------------------
// Two grouped stat blocks. Numbers are the protagonist (text-2xl bold);
// labels sit underneath as tiny muted text. Zero counts get dimmed so they
// fade into the background instead of competing with real data. Empty state
// surfaces when the entire scope has nothing in it — typical for a fresh
// organisation right after bootstrap.

function AtAGlance({
  counts,
  activeActions,
  pendingWaiting,
  inboxItems,
}: {
  counts: { portfolio: number; programme: number; project: number; work_package: number };
  activeActions: number;
  pendingWaiting: number;
  inboxItems: number;
}) {
  const structure = [
    { label: "Portfolios", value: counts.portfolio },
    { label: "Programmes", value: counts.programme },
    { label: "Projects",   value: counts.project },
    { label: "Work pkgs.", value: counts.work_package },
  ];
  const openWork = [
    { label: "Active actions", value: activeActions },
    { label: "Awaiting reply", value: pendingWaiting },
    { label: "Inbox",          value: inboxItems },
  ];

  const totalStructure = structure.reduce((s, x) => s + x.value, 0);
  const totalOpenWork = openWork.reduce((s, x) => s + x.value, 0);
  const isEmpty = totalStructure === 0 && totalOpenWork === 0;

  return (
    <Card>
      <CardHeader className="pb-2"><WidgetTitle title="At a glance" info="Counts of WBS structure and open work within the current scope." /></CardHeader>
      <CardContent className="space-y-5">
        {isEmpty ? (
          <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing in this scope yet — create a programme, project, or capture a task to get going.
          </p>
        ) : (
          <>
            <StatGroup heading="Structure" stats={structure} cols="grid-cols-2 sm:grid-cols-4" />
            <StatGroup heading="Open work" stats={openWork}  cols="grid-cols-3" />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatGroup({
  heading, stats, cols,
}: {
  heading: string;
  stats: { label: string; value: number }[];
  cols: string;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {heading}
      </div>
      <div className={`grid ${cols} gap-3`}>
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border bg-card px-3 py-2">
            <div className={`text-2xl font-bold tabular-nums leading-none ${s.value === 0 ? "text-muted-foreground/40" : "text-foreground"}`}>
              {s.value}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

