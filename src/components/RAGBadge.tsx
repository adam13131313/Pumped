import { RagStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ragConfig: Record<RagStatus, { dot: string; badge: string; label: string; display: string }> = {
  green: { dot: "rag-dot-green", badge: "rag-green", label: "On Track", display: "Green" },
  amber: { dot: "rag-dot-amber", badge: "rag-amber", label: "At Risk", display: "Amber" },
  red:   { dot: "rag-dot-red",   badge: "rag-red",   label: "Off Track", display: "Red" },
};

export function RAGBadge({ status, showLabel = false }: { status: RagStatus; showLabel?: boolean }) {
  const config = ragConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", config.badge)}>
      <span className={cn("h-2 w-2 rounded-full", config.dot)} />
      {showLabel ? config.label : config.display}
    </span>
  );
}
