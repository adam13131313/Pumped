import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useDashboardScope, actionInScope, waitingInScope, inboxInScope, wpInScope } from "@/hooks/useDashboardScope";
import { computeHealthScore, scoreColor } from "@/lib/healthScore";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { HealthRing, HealthBreakdown } from "@/components/dashboard/HealthRing";
import { StalledHighList } from "@/components/dashboard/StalledHighList";
import { VelocityChartWithCreated } from "@/components/dashboard/VelocityChart";
import { WorkloadHeatmap } from "@/components/dashboard/WorkloadHeatmap";
import { RagTrendChart, WPCompletionBars } from "@/components/dashboard/RagTrendChart";
import { WaitingRiskMatrix } from "@/components/dashboard/WaitingRiskMatrix";
import { WidgetTitle } from "@/components/dashboard/WidgetTitle";
import { Gauge } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";

export default function DashboardPage() {
  const scope = useDashboardScope();
  const programmes = useAppStore((s) => s.programmes);
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);
  const allActions = useAppStore((s) => s.actions);
  const waitingItems = useAppStore((s) => s.waitingItems);
  const inboxItems = useAppStore((s) => s.inboxItems);

  // Server-only data
  const [ragHistory, setRagHistory] = useState<any[]>([]);
  const [actionMeta, setActionMeta] = useState<{ createdAt: Map<string, string>; notStartedSince: Map<string, string> }>({ createdAt: new Map(), notStartedSince: new Map() });
  const [inboxLagDays, setInboxLagDays] = useState<number | null>(null);
  const [routine7, setRoutine7] = useState<{ count: number; target: number }>({ count: 0, target: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ragRes, actMeta, evRes, routinesRes, compsRes] = await Promise.all([
        supabase.from("rag_status_history").select("work_package_id,rag_status,recorded_at").order("recorded_at", { ascending: true }),
        supabase.from("actions").select("id,created_at,not_started_since"),
        supabase.from("inbox_item_events").select("event_at,created_at_snapshot").gte("event_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("routines").select("id,frequency_type,frequency_config").is("archived_at", null),
        supabase.from("routine_completions").select("completed_date").gte("completed_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
      ]);
      if (cancelled) return;

      setRagHistory((ragRes.data as any) ?? []);

      const ca = new Map<string, string>();
      const ns = new Map<string, string>();
      for (const r of (actMeta.data as any[]) ?? []) {
        if (r.created_at) ca.set(r.id, r.created_at);
        if (r.not_started_since) ns.set(r.id, r.not_started_since);
      }
      setActionMeta({ createdAt: ca, notStartedSince: ns });

      // Inbox lag avg
      const evs = (evRes.data as any[]) ?? [];
      const lags = evs
        .map((e) => (e.created_at_snapshot ? (new Date(e.event_at).getTime() - new Date(e.created_at_snapshot).getTime()) / 86400000 : null))
        .filter((n): n is number => n !== null && n >= 0);
      setInboxLagDays(lags.length === 0 ? null : lags.reduce((s, n) => s + n, 0) / lags.length);

      // Routine target/count for last 7 days (rough)
      const routines = (routinesRes.data as any[]) ?? [];
      const target = routines.reduce((sum, r) => {
        if (r.frequency_type === "daily") return sum + 7;
        if (r.frequency_type === "weekly_days") return sum + (Array.isArray(r.frequency_config?.days) ? r.frequency_config.days.length : 0);
        if (r.frequency_type === "weekly_count") return sum + (r.frequency_config?.target ?? 1);
        return sum;
      }, 0);
      setRoutine7({ count: ((compsRes.data as any[]) ?? []).length, target });
    })();
    return () => { cancelled = true; };
  }, []);

  // Scoped slices
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const scopedActions = useMemo(() => allActions.filter((a) => actionInScope(a, scope)), [allActions, scope]);
  const scopedWaiting = useMemo(() => waitingItems.filter((w) => waitingInScope(w, scope, projectsById)), [waitingItems, scope, projectsById]);
  const scopedInbox = useMemo(() => inboxItems.filter((i) => inboxInScope(i, scope)), [inboxItems, scope]);
  const scopedWPs = useMemo(() => workPackages.filter((wp) => wpInScope(wp, scope)), [workPackages, scope]);
  const scopedProjects = useMemo(() => {
    if (scope.level === "global") return projects;
    if (scope.level === "unassigned") return [];
    return projects.filter((p) => scope.projectIdSet.has(p.id));
  }, [projects, scope]);

  // Metrics
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay() + 1);
  const completedThisWeek = scopedActions.filter((a) => a.completedAt && new Date(a.completedAt) >= weekStart);
  const onTimeThisWeek = completedThisWeek.filter((a) => !a.dueDate || new Date(a.completedAt!) <= new Date(a.dueDate + "T23:59:59"));
  const onTimePct = completedThisWeek.length === 0 ? 0 : Math.round((onTimeThisWeek.length / completedThisWeek.length) * 100);
  const overdueWaiting = scopedWaiting.filter((w) => w.status === "Pending" && w.dueBy && new Date(w.dueBy) < today).length;

  const health = useMemo(() => computeHealthScore({
    actions: scopedActions,
    waitingItems: scopedWaiting,
    workPackages: scopedWPs,
    inboxItems: scopedInbox,
    routineCompletionsLast7Days: routine7.count,
    routineTargetLast7Days: routine7.target,
    inboxLagAvgDays: inboxLagDays,
  }), [scopedActions, scopedWaiting, scopedWPs, scopedInbox, routine7, inboxLagDays]);

  const isGlobalOrProgramme = scope.level === "global" || scope.level === "programme";

  return (
    <div className="space-y-5 pb-12">
      {/* Header / Context banner */}
      <div className="flex items-start gap-3">
        <div className="mt-1 p-2 rounded-md bg-primary/10 text-primary"><Gauge className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Pumped Pulse{scope.level !== "global" && scope.label ? ` — ${scope.label}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{scope.subLabel}</p>
        </div>
      </div>

      {/* Section A — top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Health score"
          info="A composite 0–100 score combining on-time delivery, waiting follow-ups, routine consistency, work-package health and inbox lag. Higher is better."
          value={health.score}
          tone={scoreColor(health.score)}
          sub="Score this week"
        />
        <MetricCard
          title="Completed on time"
          info="Of actions completed this week, the share where you finished on or before the due date. Aim for 80%+."
          value={`${onTimePct}%`}
          tone={onTimePct >= 80 ? "green" : onTimePct >= 60 ? "amber" : "red"}
          sub={`${onTimeThisWeek.length} of ${completedThisWeek.length} completed`}
        />
        <MetricCard
          title="Overdue waiting"
          info="Pending Waiting For items past their due date. Each one is a candidate for a chase message today."
          value={overdueWaiting}
          tone={overdueWaiting === 0 ? "green" : overdueWaiting <= 3 ? "amber" : "red"}
          sub="Pending past due"
        />
        <MetricCard
          title="Inbox lag"
          info="Average days between a captured idea landing in the inbox and you actually triaging it. Low lag means rapid capture is working."
          value={inboxLagDays === null ? "—" : `${inboxLagDays.toFixed(1)}d`}
          tone={inboxLagDays === null ? "neutral" : inboxLagDays < 1.5 ? "green" : inboxLagDays <= 3 ? "amber" : "red"}
          sub="Last 30 days"
        />
      </div>

      {/* Section B */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><WidgetTitle title="Health score breakdown" info="How each factor contributes to your current score. Negative values are penalties; positive values are credits added to the base of 62." /></CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-6">
            <HealthRing result={health} />
            <HealthBreakdown result={health} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><WidgetTitle title="Priority drift — stalled high items" info="High-priority actions that have been Not Started for more than 3 days. Either start them, lower priority, or delegate." /></CardHeader>
          <CardContent>
            <StalledHighList actions={scopedActions} notStartedSinceMap={actionMeta.notStartedSince} />
          </CardContent>
        </Card>
      </div>

      {/* Section C — velocity */}
      <Card>
        <CardHeader className="pb-2"><WidgetTitle title="Action velocity — added vs completed" info="Tasks created vs completed each week over the last 8 weeks. A widening gap (created > completed) means work is piling up." /></CardHeader>
        <CardContent>
          <VelocityChartWithCreated actions={scopedActions} createdAtById={actionMeta.createdAt} />
        </CardContent>
      </Card>

      {/* Section D */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><WidgetTitle title="Workload heatmap — tasks due per day" info="A 12-week look-ahead of due dates. Dark cells are heavy days — re-balance them before the week starts." /></CardHeader>
          <CardContent><WorkloadHeatmap actions={scopedActions} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <WidgetTitle
              title={isGlobalOrProgramme ? "Project RAG trend" : "Work-package completion"}
              info={isGlobalOrProgramme ? "Counts of work packages at each RAG status over the last 8 weeks. Watch for amber/red trends." : "Percent of actions complete in each work package within this scope."}
            />
          </CardHeader>
          <CardContent>
            {isGlobalOrProgramme
              ? <RagTrendChart history={ragHistory} wpIdSet={scope.workPackageIdSet} />
              : <WPCompletionBars workPackages={scopedWPs} actions={scopedActions} />}
          </CardContent>
        </Card>
      </div>

      {/* Section E */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><WidgetTitle title="Waiting For risk matrix" info="Each dot is a pending waiting item. Top-left = chase now (risky project, soon due). Bottom-right = comfortable." /></CardHeader>
          <CardContent>
            <WaitingRiskMatrix waitingItems={scopedWaiting} projects={scopedProjects.length ? scopedProjects : projects} workPackages={scopedWPs.length ? scopedWPs : workPackages} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><WidgetTitle title="At a glance" info="Quick scope summary so you can confirm the dashboard is showing what you expect." /></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Programmes</dt><dd className="font-mono">{scope.counts.programmes}</dd>
              <dt className="text-muted-foreground">Projects</dt><dd className="font-mono">{scopedProjects.length}</dd>
              <dt className="text-muted-foreground">Work packages</dt><dd className="font-mono">{scopedWPs.length}</dd>
              <dt className="text-muted-foreground">Active actions</dt><dd className="font-mono">{scopedActions.length}</dd>
              <dt className="text-muted-foreground">Pending waiting</dt><dd className="font-mono">{scopedWaiting.filter((w) => w.status === "Pending").length}</dd>
              <dt className="text-muted-foreground">Inbox items</dt><dd className="font-mono">{scopedInbox.length}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
