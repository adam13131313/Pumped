import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { Action, InboxItem, WaitingItem, WbsNode } from "@/lib/types";

// Filters domain rows by the current global filter. Two modes:
//   * filter.unassigned: only rows with no wbs_node_id
//   * filter.nodeId set: rows whose wbs_node_id is in the selected node's
//     subtree (the node itself + every descendant)
//   * no filter: pass through
//
// Substantially simpler than v1 — all joins are UUID-on-UUID, no string
// matching, no Project/WorkPackage name-lookup machinery.

function buildSubtree(nodes: WbsNode[], rootId: string): Set<string> {
  const childrenByParent = new Map<string | null, WbsNode[]>();
  for (const n of nodes) {
    const list = childrenByParent.get(n.parentId) ?? [];
    list.push(n);
    childrenByParent.set(n.parentId, list);
  }
  const result = new Set<string>();
  const stack: string[] = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    const kids = childrenByParent.get(id);
    if (kids) for (const k of kids) stack.push(k.id);
  }
  return result;
}

function useScopeNodeIds(): { mode: "all" | "unassigned" | "subtree"; ids: Set<string> } {
  const filter = useAppStore((s) => s.globalFilter);
  const wbsNodes = useAppStore((s) => s.wbsNodes);

  return useMemo(() => {
    if (filter.unassigned) return { mode: "unassigned" as const, ids: new Set<string>() };
    if (!filter.nodeId) return { mode: "all" as const, ids: new Set<string>() };
    return { mode: "subtree" as const, ids: buildSubtree(wbsNodes, filter.nodeId) };
  }, [filter, wbsNodes]);
}

export function useFilteredData() {
  const wbsNodes = useAppStore((s) => s.wbsNodes);
  const actions = useAppStore((s) => s.actions);
  const waitingItems = useAppStore((s) => s.waitingItems);
  const inboxItems = useAppStore((s) => s.inboxItems);

  const scope = useScopeNodeIds();

  const filteredWbsNodes = useMemo<WbsNode[]>(() => {
    if (scope.mode === "all") return wbsNodes;
    if (scope.mode === "unassigned") return [];
    return wbsNodes.filter((n) => scope.ids.has(n.id));
  }, [wbsNodes, scope]);

  const filteredActions = useMemo<Action[]>(() => {
    if (scope.mode === "all") return actions;
    if (scope.mode === "unassigned") return actions.filter((a) => !a.wbsNodeId);
    return actions.filter((a) => a.wbsNodeId && scope.ids.has(a.wbsNodeId));
  }, [actions, scope]);

  const filteredWaiting = useMemo<WaitingItem[]>(() => {
    if (scope.mode === "all") return waitingItems;
    if (scope.mode === "unassigned") return waitingItems.filter((w) => !w.wbsNodeId);
    return waitingItems.filter((w) => w.wbsNodeId && scope.ids.has(w.wbsNodeId));
  }, [waitingItems, scope]);

  const filteredInbox = useMemo<InboxItem[]>(() => {
    if (scope.mode === "all") return inboxItems;
    if (scope.mode === "unassigned") return inboxItems.filter((i) => !i.wbsNodeId);
    return inboxItems.filter((i) => i.wbsNodeId && scope.ids.has(i.wbsNodeId));
  }, [inboxItems, scope]);

  return {
    wbsNodes: filteredWbsNodes,
    actions: filteredActions,
    waitingItems: filteredWaiting,
    inboxItems: filteredInbox,
  };
}
