import { Action } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { differenceInCalendarDays } from "date-fns";
import { WidgetEmpty } from "./WidgetTitle";
import { CheckCircle2 } from "lucide-react";

export function StalledHighList({
  actions,
  notStartedSinceMap,
}: {
  actions: Action[];
  notStartedSinceMap: Map<string, string>;
}) {
  const today = new Date();
  const stalled = actions
    .filter((a) => a.priority === "High" && a.status === "Not Started")
    .map((a) => {
      const since = notStartedSinceMap.get(a.id);
      if (!since) return null;
      const ageDays = differenceInCalendarDays(today, new Date(since));
      return { action: a, ageDays };
    })
    .filter((x): x is { action: Action; ageDays: number } => !!x && x.ageDays > 3)
    .sort((a, b) => b.ageDays - a.ageDays);

  if (stalled.length === 0) {
    return <WidgetEmpty icon={CheckCircle2} message="No high-priority items are stalled. Nice." />;
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {stalled.map(({ action, ageDays }) => (
        <div key={action.id} className="flex items-start justify-between gap-3 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{action.task}</div>
            {(action.project || action.workPackage) && (
              <div className="text-xs text-muted-foreground truncate">
                {[action.project, action.workPackage].filter(Boolean).join(" / ")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge variant="outline" className="text-[10px] bg-rag-red/10 text-rag-red border-rag-red/30 font-mono">
              {ageDays}d
            </Badge>
            <Badge variant="outline" className="text-[10px] border-rag-red/40 text-rag-red">High</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
