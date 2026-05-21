import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import type { Action, ActionStatus } from "@/lib/types";
import { toast } from "sonner";

// Inline status picker for action rows. Renders the current status as
// a colour-coded pill; clicking opens a dropdown of every status value.
// Selecting one updates the action immediately — no dialog. Also keeps
// completed_at honest by stamping/clearing it on transition.

interface StatusOption {
  value: ActionStatus;
  label: string;
  /** Resting pill colours. */
  pill: string;
  /** Coloured dot used inside the dropdown items. */
  dot: string;
}

// NOTE: only the four statuses defined in the action_status Postgres
// enum (foundation migration §3) — not_started / in_progress / blocked
// / complete. "Cancelled" and "Deferred" aren't in the schema; adding
// them needs an ALTER TYPE migration.
const STATUS_OPTIONS: StatusOption[] = [
  { value: "not_started", label: "Not Started", pill: "bg-secondary text-muted-foreground border-muted-foreground/20", dot: "bg-muted-foreground/40" },
  { value: "in_progress", label: "In Progress", pill: "bg-primary/10 text-primary border-primary/30",                  dot: "bg-primary" },
  { value: "blocked",     label: "Blocked",     pill: "bg-rag-red-bg text-rag-red border-rag-red/30",                 dot: "bg-rag-red" },
  { value: "complete",    label: "Complete",    pill: "bg-rag-green-bg text-rag-green border-rag-green/30",           dot: "bg-rag-green" },
];

const OPTION_BY_VALUE: Record<ActionStatus, StatusOption> =
  Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o])) as Record<ActionStatus, StatusOption>;

interface StatusPickerProps {
  action: Action;
  size?: "sm" | "md";
  className?: string;
}

export function StatusPicker({ action, size = "md", className }: StatusPickerProps) {
  const updateAction = useAppStore((s) => s.updateAction);
  const current = OPTION_BY_VALUE[action.status] ?? STATUS_OPTIONS[0];

  const onPick = (next: ActionStatus) => {
    if (next === action.status) return;
    const patch: Partial<Action> = { status: next };
    // completed_at is what dashboards / streaks key off, so keep it
    // honest on the transitions in and out of `complete`.
    if (next === "complete" && action.status !== "complete") {
      patch.completedAt = new Date().toISOString();
    } else if (next !== "complete" && action.status === "complete") {
      patch.completedAt = null;
    }
    updateAction(action.id, patch);
    toast.success(`Status: ${OPTION_BY_VALUE[next].label}`);
  };

  const heightClass = size === "sm" ? "h-6 text-[10px] px-1.5" : "h-7 text-xs px-2";
  const chevronClass = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border font-medium uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            heightClass,
            current.pill,
            "hover:brightness-95",
            className,
          )}
          aria-label={`Change status (currently ${current.label})`}
        >
          <span className="whitespace-nowrap">{current.label}</span>
          <ChevronDown className={cn(chevronClass, "opacity-70")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[10rem]"
        onClick={(e) => e.stopPropagation()}
      >
        {STATUS_OPTIONS.map((opt) => {
          const isCurrent = opt.value === action.status;
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => onPick(opt.value)}
              className="gap-2 text-xs"
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", opt.dot)} />
              <span className="flex-1">{opt.label}</span>
              {isCurrent && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
