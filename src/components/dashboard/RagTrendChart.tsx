import { format, startOfWeek, addWeeks } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, BarChart, Bar } from "recharts";
import { WidgetEmpty } from "./WidgetTitle";
import { Activity } from "lucide-react";
import type { Action, RagStatus, WbsNode } from "@/lib/types";

interface RagHistoryRow {
  wbs_node_id: string;
  to_status: RagStatus;
  recorded_at: string;
}

export function RagTrendChart({ history, nodeIdSet }: { history: RagHistoryRow[]; nodeIdSet: Set<string> }) {
  // When nodeIdSet is empty we treat that as "all" (global scope).
  const filtered = nodeIdSet.size === 0
    ? history
    : history.filter((h) => nodeIdSet.has(h.wbs_node_id));

  if (filtered.length === 0) {
    return <WidgetEmpty icon={Activity} message="No RAG history yet — update work-package status to start tracking." />;
  }

  const now = new Date();
  const weeks: Array<{ label: string; key: string; weekDate: Date; green: number; amber: number; red: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const wkStart = startOfWeek(addWeeks(now, -i), { weekStartsOn: 1 });
    weeks.push({
      label: format(wkStart, "MMM d"),
      key: format(wkStart, "yyyy-MM-dd"),
      weekDate: wkStart,
      green: 0, amber: 0, red: 0,
    });
  }

  // For each week, take the most recent rag_status per node up to that week's end.
  for (const wk of weeks) {
    const cutoff = addWeeks(wk.weekDate, 1);
    const latestByNode = new Map<string, { at: number; status: RagStatus }>();
    for (const h of filtered) {
      const t = new Date(h.recorded_at).getTime();
      if (t >= cutoff.getTime()) continue;
      const existing = latestByNode.get(h.wbs_node_id);
      if (!existing || t > existing.at) {
        latestByNode.set(h.wbs_node_id, { at: t, status: h.to_status });
      }
    }
    for (const { status } of latestByNode.values()) {
      if (status === "green") wk.green++;
      else if (status === "amber") wk.amber++;
      else if (status === "red") wk.red++;
    }
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={weeks} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" allowDecimals={false} />
          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="green" stroke="hsl(var(--rag-green))" strokeWidth={2} dot={false} name="Green" />
          <Line type="monotone" dataKey="amber" stroke="hsl(var(--rag-amber))" strokeWidth={2} dot={false} name="Amber" />
          <Line type="monotone" dataKey="red" stroke="hsl(var(--rag-red))" strokeWidth={2} dot={false} name="Red" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WPCompletionBars({ workPackages, actions }: { workPackages: WbsNode[]; actions: Action[] }) {
  if (workPackages.length === 0) {
    return <WidgetEmpty icon={Activity} message="No work packages in this scope." />;
  }
  const data = workPackages.map((wp) => {
    const wpActions = actions.filter((a) => a.wbsNodeId === wp.id);
    const total = wpActions.length;
    const done = wpActions.filter((a) => a.status === "complete").length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { name: wp.name.length > 18 ? wp.name.slice(0, 18) + "…" : wp.name, pct };
  });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }} layout="vertical">
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" width={120} />
          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(v) => `${v}%`} />
          <Bar dataKey="pct" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
