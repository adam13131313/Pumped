import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ActionReadiness } from "@/lib/types";

// Shared readiness indicator used by:
//   - TaskDependencies header (full variant)
//   - MyActions list rows (compact variant)
//   - (planned) Pulse widget badges
//
// "Ready" is the active goal-state, so we lean on emerald; "blocked" amber to
// match the existing RAG palette without colliding with red (which we reserve
// for hard failures / overdue). "Future" gets blue to read as informational
// rather than alarming — it's not actionable, but it's not wrong either.

const LABEL: Record<ActionReadiness, string> = {
  ready: "Ready",
  blocked: "Blocked",
  future: "Future start",
};

const ICON: Record<ActionReadiness, typeof CheckCircle2> = {
  ready: CheckCircle2,
  blocked: AlertCircle,
  future: Clock,
};

const TONE: Record<ActionReadiness, string> = {
  ready: "text-emerald-600 dark:text-emerald-400",
  blocked: "text-amber-600 dark:text-amber-400",
  future: "text-blue-600 dark:text-blue-400",
};

interface ReadinessBadgeProps {
  readiness: ActionReadiness;
  /**
   * 'full'    — pill with icon + label. For wide containers (dialog headers).
   * 'compact' — icon only with the same colour cue. For list rows / dense UI.
   */
  variant?: "full" | "compact";
  /** Override the default title text (e.g. "Blocked by Sarah's review"). */
  title?: string;
  className?: string;
}

export function ReadinessBadge({
  readiness,
  variant = "full",
  title,
  className,
}: ReadinessBadgeProps) {
  const Icon = ICON[readiness];
  const tone = TONE[readiness];
  const label = LABEL[readiness];
  const tooltip = title ?? label;

  if (variant === "compact") {
    return (
      <span
        aria-label={tooltip}
        title={tooltip}
        className={`inline-flex items-center justify-center ${tone} ${className ?? ""}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <Badge
      variant="outline"
      title={tooltip}
      className={`gap-1 ${tone} ${className ?? ""}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
