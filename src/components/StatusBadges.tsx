import { ActionPriority, ActionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_LABEL: Record<ActionPriority, string> = { high: "High", medium: "Medium", low: "Low" };
const STATUS_LABEL: Record<ActionStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  complete: "Complete",
};

export function PriorityBadge({ priority }: { priority: ActionPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        priority === "high" && "bg-rag-red-bg text-rag-red",
        priority === "medium" && "bg-rag-amber-bg text-rag-amber",
        priority === "low" && "bg-secondary text-muted-foreground",
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function StatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        status === "complete" && "bg-rag-green-bg text-rag-green",
        status === "in_progress" && "bg-primary/10 text-primary",
        status === "not_started" && "bg-secondary text-muted-foreground",
        status === "blocked" && "bg-rag-red-bg text-rag-red",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
