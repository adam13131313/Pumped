import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WidgetTitle } from "./WidgetTitle";
import { actionReadiness, useAppStore } from "@/lib/store";
import type { Action, ActionReadiness } from "@/lib/types";
import { cn } from "@/lib/utils";

// Personal readiness mix on Pulse.
//
// Three design calls worth knowing:
//
// 1. Counts come from `scopedActions` (the dashboard scope) filtered to the
//    current user's assignments only. Pumped's job here is personal coherence
//    — "what can I do right now?" — not portfolio-level monitoring. Aggregate
//    org-wide views of readiness belong in the scheduler product, not here.
//
// 2. Readiness is computed against `allActions` + `allDeps` (the full graph)
//    so a personal action with an out-of-scope blocker is classified correctly.
//
// 3. Terminal actions (complete / cancelled) are excluded — they're not "work
//    to do." The mix is about live commitments only.

interface ReadinessMixProps {
  scopedActions: Action[];
}

interface MixRow {
  label: string;
  count: number;
  Icon: typeof CheckCircle2;
  tone: string;
  bg: string;
  /** When set, clicking the row routes here and applies the appropriate filter. */
  onClick?: () => void;
}

export function ReadinessMix({ scopedActions }: ReadinessMixProps) {
  const allActions = useAppStore((s) => s.actions);
  const allDeps = useAppStore((s) => s.actionDependencies);
  const setGlobalFilter = useAppStore((s) => s.setGlobalFilter);
  const currentUserId = useAppStore((s) => s.currentMembership?.userId ?? null);
  const navigate = useNavigate();

  const { counts, total } = useMemo(() => {
    const counts: Record<ActionReadiness, number> = { ready: 0, blocked: 0, future: 0 };
    let total = 0;
    // Without a current user (signed-out / dev-bypass mode) we render zero —
    // the widget is meaningless without a "me" to anchor against.
    if (!currentUserId) return { counts, total };
    for (const a of scopedActions) {
      if (a.assignedTo !== currentUserId) continue;
      if (a.status === "complete" || a.status === "cancelled") continue;
      counts[actionReadiness(a.id, allActions, allDeps)]++;
      total++;
    }
    return { counts, total };
  }, [scopedActions, allActions, allDeps, currentUserId]);

  const rows: MixRow[] = [
    {
      label: "Ready",
      count: counts.ready,
      Icon: CheckCircle2,
      tone: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500",
      onClick: () => {
        // Preserve any existing node-scope on the global filter; just flip
        // readyOnly so MyActions opens with the right view.
        setGlobalFilter({ readyOnly: true });
        navigate("/actions");
      },
    },
    {
      label: "Blocked",
      count: counts.blocked,
      Icon: AlertCircle,
      tone: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500",
    },
    {
      label: "Future start",
      count: counts.future,
      Icon: Clock,
      tone: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500",
    },
  ];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <WidgetTitle
          title="Your readiness mix"
          info="Across the actions assigned to you in this scope: how many you can work on right now, how many are waiting on a blocker, and how many haven't reached their start date. Portfolio-level monitoring lives elsewhere — this is your personal view."
        />

        {/* Stacked bar — visual cue of the mix. Hidden when nothing live. */}
        {total > 0 ? (
          <div
            className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
            aria-hidden
          >
            {rows.map((r) =>
              r.count > 0 ? (
                <div
                  key={r.label}
                  className={cn("h-full", r.bg)}
                  style={{ width: `${(r.count / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">
            Nothing assigned to you in this scope.
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {rows.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={r.onClick}
              disabled={!r.onClick}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors",
                r.onClick ? "cursor-pointer hover:bg-muted" : "cursor-default",
              )}
            >
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <r.Icon className={cn("h-3 w-3", r.tone)} />
                {r.label}
              </div>
              <div className="text-2xl font-bold tabular-nums tracking-tight">
                {r.count}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
