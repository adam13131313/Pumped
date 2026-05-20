import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { Action, NodeType, WbsNode } from "@/lib/types";

export type ScopeLevel =
  | "global"
  | "portfolio"
  | "programme"
  | "project"
  | "wp"
  | "unassigned";

export interface DashboardScope {
  level: ScopeLevel;
  selectedNodeId: string | null;
  selectedNode: WbsNode | null;
  label: string;
  subLabel: string;

  // Set of wbs_node_ids included in this scope (the selected node + its
  // descendants). Empty for `global` (means "no scoping") and for `unassigned`.
  nodeIdSet: Set<string>;

  // Convenience predicates — pass any action / waiting / inbox row through
  // these without re-implementing the scope rules in every widget.
  actionInScope: (action: Action) => boolean;
  nodeInScope: (node: WbsNode) => boolean;
  countsByType: Record<NodeType, number>;
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  portfolio: "Portfolio",
  programme: "Programme",
  project: "Project",
  work_package: "Work Package",
};

function scopeLevelFromNodeType(t: NodeType): Exclude<ScopeLevel, "global" | "unassigned"> {
  if (t === "work_package") return "wp";
  return t; // 'portfolio' | 'programme' | 'project'
}

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

export function useDashboardScope(): DashboardScope {
  const filter = useAppStore((s) => s.globalFilter);
  const wbsNodes = useAppStore((s) => s.wbsNodes);

  return useMemo(() => {
    // ----- Unassigned -----
    if (filter.unassigned) {
      const countsByType: Record<NodeType, number> = {
        portfolio: 0, programme: 0, project: 0, work_package: 0,
      };
      return {
        level: "unassigned",
        selectedNodeId: null,
        selectedNode: null,
        label: "Unassigned",
        subLabel: "Rows with no WBS link",
        nodeIdSet: new Set<string>(),
        actionInScope: (a) => !a.wbsNodeId,
        nodeInScope: () => false,
        countsByType,
      };
    }

    // ----- Global (no filter) -----
    if (!filter.nodeId) {
      const countsByType = countByType(wbsNodes);
      return {
        level: "global",
        selectedNodeId: null,
        selectedNode: null,
        label: "All work",
        subLabel: "Global view",
        nodeIdSet: new Set<string>(),
        actionInScope: () => true,
        nodeInScope: () => true,
        countsByType,
      };
    }

    // ----- Scoped to a specific node + its subtree -----
    const selected = wbsNodes.find((n) => n.id === filter.nodeId) ?? null;
    if (!selected) {
      // Stale filter pointing at a node that no longer exists. Fall back to global.
      return {
        level: "global",
        selectedNodeId: null,
        selectedNode: null,
        label: "All work",
        subLabel: "Selected scope no longer exists",
        nodeIdSet: new Set<string>(),
        actionInScope: () => true,
        nodeInScope: () => true,
        countsByType: countByType(wbsNodes),
      };
    }

    const nodeIdSet = buildSubtree(wbsNodes, selected.id);
    const subtreeNodes = wbsNodes.filter((n) => nodeIdSet.has(n.id));
    return {
      level: scopeLevelFromNodeType(selected.nodeType),
      selectedNodeId: selected.id,
      selectedNode: selected,
      label: selected.name,
      subLabel: NODE_TYPE_LABELS[selected.nodeType],
      nodeIdSet,
      actionInScope: (a) => Boolean(a.wbsNodeId && nodeIdSet.has(a.wbsNodeId)),
      nodeInScope: (n) => nodeIdSet.has(n.id),
      countsByType: countByType(subtreeNodes),
    };
  }, [filter, wbsNodes]);
}

function countByType(nodes: WbsNode[]): Record<NodeType, number> {
  const out: Record<NodeType, number> = {
    portfolio: 0, programme: 0, project: 0, work_package: 0,
  };
  for (const n of nodes) out[n.nodeType] += 1;
  return out;
}
