import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { findSimilar } from "@/lib/similarity";

interface DuplicateHintProps {
  query: string;
  excludeActionId?: string;
  className?: string;
}

/**
 * Inline hint shown beneath a task input. Surfaces existing items that look
 * similar so the user doesn't double-add. ADHD-friendly: never blocks save,
 * just informs.
 */
export function DuplicateHint({ query, excludeActionId, className }: DuplicateHintProps) {
  const actions = useAppStore((s) => s.actions);
  const inboxItems = useAppStore((s) => s.inboxItems);
  const waitingItems = useAppStore((s) => s.waitingItems);
  const wbsNodes = useAppStore((s) => s.wbsNodes);

  const matches = useMemo(() => {
    if (!query || query.trim().length < 4) return [];

    const nodeName = (id: string | null) => (id ? wbsNodes.find((n) => n.id === id)?.name ?? "" : "");

    const openActions = actions.filter(
      (a) => a.status !== "complete" && a.id !== excludeActionId,
    );

    const actionMatches = findSimilar(query, openActions, (a) => a.task, 0.5, 2)
      .map((m) => ({
        id: m.item.id,
        label: m.item.task,
        context: nodeName(m.item.wbsNodeId) || "My Actions",
        kind: "action" as const,
        score: m.score,
      }));

    const inboxMatches = findSimilar(query, inboxItems, (i) => i.task, 0.5, 2)
      .map((m) => ({
        id: m.item.id,
        label: m.item.task,
        context: "Rapid Capture",
        kind: "inbox" as const,
        score: m.score,
      }));

    const waitingMatches = findSimilar(query, waitingItems, (w) => w.description, 0.5, 2)
      .map((m) => ({
        id: m.item.id,
        label: m.item.description,
        context: `Waiting on ${m.item.fromWhomText || "someone"}`,
        kind: "waiting" as const,
        score: m.score,
      }));

    return [...actionMatches, ...inboxMatches, ...waitingMatches]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [query, actions, inboxItems, waitingItems, wbsNodes, excludeActionId]);

  if (matches.length === 0) return null;

  return (
    <div className={`mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
        <AlertCircle className="h-3.5 w-3.5" />
        Looks similar to {matches.length === 1 ? "an existing item" : `${matches.length} existing items`}
      </div>
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {matches.map((m) => (
          <li key={`${m.kind}-${m.id}`} className="truncate">
            <span className="text-foreground">{m.label}</span>
            <span className="text-muted-foreground/80"> · {m.context}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1 text-[11px] text-muted-foreground/80">You can still save — just checking.</div>
    </div>
  );
}
