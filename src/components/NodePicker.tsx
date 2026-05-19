import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import type { NodeType, WbsNode } from "@/lib/types";

// Reusable hierarchical wbs_node selector. Shows nodes as indented options
// in a single Select so the entire tree is reachable from one control.
// Used by GlobalFilter, NodeDialog (parent), ActionDialog, WaitingDialog,
// InboxPage bulk-edit, and the WBS Planner.
//
// A tree-popover with search would be nicer on big trees; deferring that to
// a phase 5 polish item.

interface NodePickerProps {
  value: string | null;
  onChange: (nodeId: string | null) => void;
  /** Restrict the picker to specific node types. Empty = all types. */
  allowedTypes?: NodeType[];
  /** Show a "(none)" option that maps to null. */
  includeNone?: boolean;
  noneLabel?: string;
  /** Show a "Unassigned" option that calls onChange(null) but with a distinct semantic. */
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const NODE_TYPE_LABEL: Record<NodeType, string> = {
  portfolio: "Portfolio",
  programme: "Programme",
  project: "Project",
  work_package: "Work Package",
};

const NODE_TYPE_DEPTH: Record<NodeType, number> = {
  portfolio: 0,
  programme: 1,
  project: 2,
  work_package: 3,
};

interface FlatNode {
  node: WbsNode;
  depth: number;
}

// Walks the tree from each root, producing a flat list in display order
// with depth annotations for indentation. Falls back to type-based depth
// when a node has a parent in another type's natural slot (e.g. a Project
// whose parent is a Portfolio rather than a Programme).
function flattenTree(nodes: WbsNode[]): FlatNode[] {
  const byParent = new Map<string | null, WbsNode[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  for (const [, list] of byParent) {
    list.sort((a, b) => {
      // Order: by natural type depth, then by position, then by name
      const dt = NODE_TYPE_DEPTH[a.nodeType] - NODE_TYPE_DEPTH[b.nodeType];
      if (dt !== 0) return dt;
      if (a.position !== b.position) return a.position - b.position;
      return a.name.localeCompare(b.name);
    });
  }

  const result: FlatNode[] = [];
  function walk(parentId: string | null, depth: number) {
    const kids = byParent.get(parentId) ?? [];
    for (const kid of kids) {
      result.push({ node: kid, depth });
      walk(kid.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

const NONE_VALUE = "__none__";

export function NodePicker({
  value,
  onChange,
  allowedTypes,
  includeNone = false,
  noneLabel = "(none)",
  placeholder = "Select a node",
  disabled,
  id,
  className,
}: NodePickerProps) {
  const wbsNodes = useAppStore((s) => s.wbsNodes);

  const flat = useMemo(() => {
    const items = flattenTree(wbsNodes.filter((n) => !n.archivedAt));
    if (!allowedTypes || allowedTypes.length === 0) return items;
    return items.filter((f) => allowedTypes.includes(f.node.nodeType));
  }, [wbsNodes, allowedTypes]);

  const selectValue = value ?? NONE_VALUE;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeNone && <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>}
        {flat.length === 0 && !includeNone && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No matching nodes</div>
        )}
        {flat.map(({ node, depth }) => (
          <SelectItem key={node.id} value={node.id}>
            <span className="inline-flex items-center gap-1.5">
              {depth > 0 && (
                <span className="text-muted-foreground" aria-hidden>
                  {"—".repeat(depth)}
                </span>
              )}
              <span>{node.name}</span>
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                {NODE_TYPE_LABEL[node.nodeType]}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Resolve the path of a node up to the root, for breadcrumb display.
export function nodePath(wbsNodes: WbsNode[], nodeId: string | null): WbsNode[] {
  if (!nodeId) return [];
  const byId = new Map(wbsNodes.map((n) => [n.id, n]));
  const path: WbsNode[] = [];
  let current = byId.get(nodeId) ?? null;
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) ?? null : null;
  }
  return path;
}
