import { Action } from "@/lib/types";
import { startOfWeek, addWeeks, format, parseISO } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { WidgetEmpty } from "./WidgetTitle";
import { Activity } from "lucide-react";

export function VelocityChart({ actions }: { actions: Action[] }) {
  const now = new Date();
  const weeks: Array<{ label: string; key: string; created: number; completed: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const wkStart = startOfWeek(addWeeks(now, -i), { weekStartsOn: 1 });
    weeks.push({
      label: format(wkStart, "MMM d"),
      key: format(wkStart, "yyyy-MM-dd"),
      created: 0,
      completed: 0,
    });
  }
  const indexByKey = new Map(weeks.map((w, idx) => [w.key, idx]));

  for (const a of actions) {
    // We don't have createdAt on Action — derive from notStartedSince fallback skipped; use due_date / completedAt only.
    if (a.completedAt) {
      const wk = format(startOfWeek(new Date(a.completedAt), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const idx = indexByKey.get(wk);
      if (idx !== undefined) weeks[idx].completed++;
    }
  }

  // Created = use a synthetic source via passed createdMap
  // Since action does not carry createdAt in the store, we compute "created" from the passed actionsCreated map (see Dashboard).

  const total = weeks.reduce((s, w) => s + w.created + w.completed, 0);
  if (total === 0) {
    return <WidgetEmpty icon={Activity} message="Not enough activity yet to chart velocity." />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={weeks} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="created" stroke="hsl(var(--rag-amber))" strokeWidth={2} dot={false} name="Created" />
          <Line type="monotone" dataKey="completed" stroke="hsl(var(--rag-green))" strokeWidth={2} dot={false} name="Completed" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VelocityChartWithCreated({
  actions,
  createdAtById,
}: {
  actions: Action[];
  createdAtById: Map<string, string>;
}) {
  const now = new Date();
  const weeks: Array<{ label: string; key: string; created: number; completed: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const wkStart = startOfWeek(addWeeks(now, -i), { weekStartsOn: 1 });
    weeks.push({
      label: format(wkStart, "MMM d"),
      key: format(wkStart, "yyyy-MM-dd"),
      created: 0,
      completed: 0,
    });
  }
  const indexByKey = new Map(weeks.map((w, idx) => [w.key, idx]));

  for (const a of actions) {
    const created = createdAtById.get(a.id);
    if (created) {
      const wk = format(startOfWeek(new Date(created), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const idx = indexByKey.get(wk);
      if (idx !== undefined) weeks[idx].created++;
    }
    if (a.completedAt) {
      const wk = format(startOfWeek(new Date(a.completedAt), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const idx = indexByKey.get(wk);
      if (idx !== undefined) weeks[idx].completed++;
    }
  }

  const total = weeks.reduce((s, w) => s + w.created + w.completed, 0);
  if (total === 0) {
    return <WidgetEmpty icon={Activity} message="Not enough activity yet to chart velocity." />;
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
          <Line type="monotone" dataKey="created" stroke="hsl(var(--rag-amber))" strokeWidth={2} dot={false} name="Created" />
          <Line type="monotone" dataKey="completed" stroke="hsl(var(--rag-green))" strokeWidth={2} dot={false} name="Completed" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
