import { Priority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        priority === "High" && "bg-rag-red-bg text-rag-red",
        priority === "Medium" && "bg-rag-amber-bg text-rag-amber",
        priority === "Low" && "bg-secondary text-muted-foreground"
      )}
    >
      {priority}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        status === "Complete" && "bg-rag-green-bg text-rag-green",
        status === "In Progress" && "bg-primary/10 text-primary",
        status === "Not Started" && "bg-secondary text-muted-foreground",
        status === "Blocked" && "bg-rag-red-bg text-rag-red"
      )}
    >
      {status}
    </span>
  );
}
