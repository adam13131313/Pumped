import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Action } from "@/lib/types";
import { useAppStore } from "@/lib/store";

// Single-click "mark as complete" button for action rows. Owns its own
// brief flash animation so the user sees confirmation BEFORE the row
// disappears from a filtered list (most pages hide completed actions).
//
// Already-complete actions show a filled green tick — click again to
// revert. Reverting clears completedAt so dashboards/streaks stay
// honest about when work was actually finished.

interface CompleteActionButtonProps {
  action: Action;
  /** Tweak the size for compact rows like the dashboard widgets. */
  size?: "sm" | "md";
  /** Optional className applied to the outer button. */
  className?: string;
}

const FLASH_MS = 350;

export function CompleteActionButton({ action, size = "md", className }: CompleteActionButtonProps) {
  const updateAction = useAppStore((s) => s.updateAction);
  const [flashing, setFlashing] = useState(false);
  const isComplete = action.status === "complete";

  const dim = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const icon = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (flashing) return;

    if (isComplete) {
      // Toggle off — instant, no animation needed; the row's visual
      // state changes are enough.
      updateAction(action.id, { status: "not_started", completedAt: null });
      toast("Marked as not started");
      return;
    }

    // Flash first so the user gets confirmation before the row
    // disappears from a filtered list.
    setFlashing(true);
    window.setTimeout(() => {
      updateAction(action.id, {
        status: "complete",
        completedAt: new Date().toISOString(),
      });
      // We don't clear `flashing` — by now the row's status has changed
      // and either it's unmounting (filtered out) or it's rendering the
      // complete state which the next condition above handles.
    }, FLASH_MS);
    toast.success("Done");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isComplete ? "Mark as not started" : "Mark complete"}
      aria-label={isComplete ? "Mark as not started" : "Mark complete"}
      aria-pressed={isComplete}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border transition-all duration-200",
        dim,
        // Pre-click resting states
        !isComplete && !flashing &&
          "border-muted-foreground/30 bg-background text-muted-foreground hover:border-rag-green/50 hover:bg-rag-green/10 hover:text-rag-green",
        // Mid-click flash — solid green, slightly enlarged
        flashing &&
          "scale-110 border-rag-green bg-rag-green text-white shadow-sm",
        // Already-complete resting state
        isComplete && !flashing &&
          "border-rag-green/40 bg-rag-green/10 text-rag-green hover:bg-rag-green/20",
        className,
      )}
    >
      <Check className={icon} strokeWidth={3} />
    </button>
  );
}
