// WBS hierarchy → CSV. Round-trips with src/lib/csvImport.ts.
//
// CSV shape (header row + one row per node):
//   path, node_type, description, project_status, start_date, due_date, rag_status, blockers
//
// `path` is the hierarchical name joined by " > ", e.g.
//   "Portfolio Alpha > Programme A > Project 1 > Design WP"
// Parent of any row is the path minus the last segment; top-level rows have no parent.
// Sibling names should be unique under a given parent; the export skips ambiguous
// children (logged to console) rather than producing rows that won't round-trip.

import type { WbsNode } from "./types";

export const WBS_CSV_HEADERS = [
  "path",
  "node_type",
  "description",
  "project_status",
  "start_date",
  "due_date",
  "rag_status",
  "blockers",
] as const;

export const PATH_SEPARATOR = " > ";

export function buildPath(node: WbsNode, byId: Map<string, WbsNode>): string | null {
  const segments: string[] = [];
  let current: WbsNode | undefined = node;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id)) return null; // cycle guard
    seen.add(current.id);
    segments.unshift(current.name);
    if (!current.parentId) break;
    current = byId.get(current.parentId);
    if (!current) return null; // dangling parent
  }
  return segments.join(PATH_SEPARATOR);
}

export function wbsNodesToCsv(nodes: WbsNode[]): string {
  const visible = nodes.filter((n) => !n.archivedAt);
  const byId = new Map(visible.map((n) => [n.id, n]));

  const rows: string[][] = [];
  rows.push([...WBS_CSV_HEADERS]);

  // Deterministic order: by path so the file is stable across exports.
  const withPaths: { node: WbsNode; path: string }[] = [];
  for (const node of visible) {
    const path = buildPath(node, byId);
    if (!path) {
      console.warn(`[exportWBS] skipping node ${node.id} (${node.name}) — dangling parent or cycle`);
      continue;
    }
    withPaths.push({ node, path });
  }
  withPaths.sort((a, b) => a.path.localeCompare(b.path));

  // Detect duplicate paths (sibling-name collisions) — first occurrence wins,
  // duplicates are skipped because they wouldn't round-trip cleanly.
  const seenPaths = new Set<string>();
  for (const { node, path } of withPaths) {
    if (seenPaths.has(path)) {
      console.warn(`[exportWBS] skipping duplicate path: ${path}`);
      continue;
    }
    seenPaths.add(path);
    rows.push([
      path,
      node.nodeType,
      node.description ?? "",
      node.projectStatus ?? "",
      node.startDate ?? "",
      node.dueDate ?? "",
      node.ragStatus ?? "",
      node.blockers ?? "",
    ]);
  }

  return rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
}

function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function downloadWbsCsv(nodes: WbsNode[], filename = "pumped-wbs.csv"): void {
  const csv = wbsNodesToCsv(nodes);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Backwards compatibility — the stub used to throw on call. Now the canonical
// names are wbsNodesToCsv + downloadWbsCsv, but we keep this thin wrapper for
// any older callers that haven't been migrated.
export function exportWBStoCSV(nodes: WbsNode[]): void {
  downloadWbsCsv(nodes);
}
