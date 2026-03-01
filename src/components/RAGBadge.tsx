import { RAGStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ragConfig: Record<RAGStatus, { dot: string; badge: string; label: string }> = {
  Green: { dot: "rag-dot-green", badge: "rag-green", label: "On Track" },
  Amber: { dot: "rag-dot-amber", badge: "rag-amber", label: "At Risk" },
  Red: { dot: "rag-dot-red", badge: "rag-red", label: "Off Track" },
};

export function RAGBadge({ status, showLabel = false }: { status: RAGStatus; showLabel?: boolean }) {
  const config = ragConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", config.badge)}>
      <span className={cn("h-2 w-2 rounded-full", config.dot)} />
      {showLabel ? config.label : status}
    </span>
  );
}
