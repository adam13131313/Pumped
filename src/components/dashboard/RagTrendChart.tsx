import { format, startOfWeek, addWeeks } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, BarChart, Bar } from "recharts";
import { WidgetEmpty } from "./WidgetTitle";
import { Activity } from "lucide-react";
import { WorkPackage, Action } from "@/lib/types";

interface RagHistoryRow {
  work_package_id: string;
  rag_status: string;
  recorded_at: string;
}

export function RagTrendChart({ history, wpIdSet }: { history: RagHistoryRow[]; wpIdSet: Set<string> }) {
  const filtered = history.filter((h) => wpIdSet.has(h.work_package_id));
  if (filtered.length === 0) {
    return <WidgetEmpty icon={Activity} message="No RAG history yet — update work-package status to start tracking." />;
  }

  const now = new Date();
  const weeks: Array<{ label: string; key: string; weekDate: Date; Green: number; Amber: number; Red: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const wkStart = startOfWeek(addWeeks(now, -i), { weekStartsOn: 1 });
    weeks.push({ label: format(wkStart, "MMM d"), key: format(wkStart, "yyyy-MM-dd"), weekDate: wkStart, Green: 0, Amber: 0, Red: 0 });
  }

  // For each week, determine the latest status of each WP up to that week's end
  for (const wkObj of weeks) {
    const cutoff = addWeeks(wkObj.weekDate, 1);
    const latestByWp = new Map<string, string>();
    for (const h of filtered) {
      const t = new Date(h.recorded_at);
      if (t < cutoff) {
        // keep only the most recent
        const existing = latestByWp.get(h.work_package_id);
        if (!existing || t > new Date(existing.split("|")[0])) {
          latestByWp.set(h.work_package_id, h.recorded_at + "|" + h.rag_status);
        }
      }
    }
    for (const v of latestByWp.values()) {
      const status = v.split("|")[1];
      if (status === "Green") wkObj.Green++;
      else if (status === "Amber") wkObj.Amber++;
      else if (status === "Red") wkObj.Red++;
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
          <Line type="monotone" dataKey="Green" stroke="hsl(var(--rag-green))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Amber" stroke="hsl(var(--rag-amber))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Red" stroke="hsl(var(--rag-red))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WPCompletionBars({ workPackages, actions }: { workPackages: WorkPackage[]; actions: Action[] }) {
  if (workPackages.length === 0) {
    return <WidgetEmpty icon={Activity} message="No work packages in this scope." />;
  }
  const data = workPackages.map((wp) => {
    const wpActions = actions.filter((a) => a.workPackage === wp.workPackage && a.project === wp.project);
    const total = wpActions.length;
    const done = wpActions.filter((a) => a.status === "Complete").length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { name: wp.workPackage.length > 18 ? wp.workPackage.slice(0, 18) + "…" : wp.workPackage, pct };
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
