import type { Action, InboxItem, WaitingItem, WbsNode } from "./types";

// Pumped Pulse health score: a 0–100 composite. Mirrors the formula used by
// the snapshot-health-scores edge function — keep both in sync if the
// formula changes.

export interface HealthScoreInput {
  actions: Action[];                   // non-archived
  waitingItems: WaitingItem[];
  wbsNodes: WbsNode[];                 // work-package RAG comes from these
  inboxItems: InboxItem[];
  routineCompletionsLast7Days: number;
  routineTargetLast7Days: number;
  inboxLagAvgDays: number | null;
}

export interface HealthScoreResult {
  score: number;
  components: {
    base: number;
    onTime: number;            //   0..30
    overdueWaiting: number;    // -15..0
    routine: number;           //   0..20
    rag: number;               // -10..0
    inboxLag: number;          // -10..0
  };
}

export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // On-time delivery: completed actions in last 30 days where completedAt <= dueDate
  const thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const completedRecent = input.actions.filter((a) => {
    if (!a.completedAt) return false;
    return new Date(a.completedAt) >= thirtyAgo;
  });
  let onTimeRatio = 1;
  if (completedRecent.length > 0) {
    const onTime = completedRecent.filter((a) => {
      if (!a.dueDate) return true;
      return new Date(a.completedAt!) <= new Date(a.dueDate + "T23:59:59");
    }).length;
    onTimeRatio = onTime / completedRecent.length;
  }
  const onTime = Math.round(onTimeRatio * 30);

  // Overdue waiting penalty
  const overdue = input.waitingItems.filter((w) => {
    if (w.status !== "pending") return false;
    if (!w.dueBy) return false;
    return new Date(w.dueBy) < today;
  }).length;
  const overdueWaiting = -Math.min(15, overdue * 3);

  // Routine streak points
  let routine = 0;
  if (input.routineTargetLast7Days > 0) {
    const ratio = Math.min(1, input.routineCompletionsLast7Days / input.routineTargetLast7Days);
    routine = Math.round(ratio * 20);
  }

  // RAG red penalty — pulled from wbs_nodes filtered to work_package + 'red'
  const reds = input.wbsNodes.filter(
    (n) => n.nodeType === "work_package" && n.ragStatus === "red",
  ).length;
  const rag = -Math.min(10, reds * 2);

  // Inbox lag penalty
  let inboxLag = 0;
  if (input.inboxLagAvgDays !== null && input.inboxLagAvgDays > 1) {
    inboxLag = -Math.min(10, Math.round((input.inboxLagAvgDays - 1) * 4));
  }

  const base = 62;
  const score = Math.max(0, Math.min(100, base + onTime + overdueWaiting + routine + rag + inboxLag));

  return {
    score,
    components: { base, onTime, overdueWaiting, routine, rag, inboxLag },
  };
}

export function scoreColor(score: number): "green" | "amber" | "red" {
  if (score >= 70) return "green";
  if (score >= 50) return "amber";
  return "red";
}

export function mondayOf(d: Date): string {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}
