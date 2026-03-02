import { WorkPackage, DependencyType } from "./types";

interface CPMNode {
  id: string;
  startDate: Date;
  endDate: Date;
  duration: number; // in days
  es: number; // early start
  ef: number; // early finish
  ls: number; // late start
  lf: number; // late finish
  slack: number;
  isCritical: boolean;
  dependencies: { targetId: string; type: DependencyType; lagDays: number }[];
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate critical path using CPM (Critical Path Method).
 * Returns a map of WP id -> CPMNode with slack and critical flag.
 */
export function calculateCriticalPath(workPackages: WorkPackage[]): Map<string, CPMNode> {
  const nodes = new Map<string, CPMNode>();

  // Build nodes
  for (const wp of workPackages) {
    if (!wp.startDate || !wp.dueDate) continue;
    const start = new Date(wp.startDate);
    const end = new Date(wp.dueDate);
    const duration = Math.max(1, daysBetween(start, end));
    nodes.set(wp.id, {
      id: wp.id,
      startDate: start,
      endDate: end,
      duration,
      es: 0,
      ef: 0,
      ls: Infinity,
      lf: Infinity,
      slack: 0,
      isCritical: false,
      dependencies: (wp.dependencies || []).map((d) => ({
        targetId: d.targetId,
        type: d.type,
        lagDays: d.lagDays || 0,
      })),
    });
  }

  if (nodes.size === 0) return nodes;

  // Topological sort
  const sorted = topologicalSort(nodes);

  // Forward pass - calculate ES and EF
  for (const id of sorted) {
    const node = nodes.get(id)!;
    let maxES = 0;

    for (const dep of node.dependencies) {
      const pred = nodes.get(dep.targetId);
      if (!pred) continue;

      let constraintDate: number;
      switch (dep.type) {
        case "FS": // Finish-to-Start: successor starts after predecessor finishes
          constraintDate = pred.ef + dep.lagDays;
          break;
        case "FF": // Finish-to-Finish: successor finishes after predecessor finishes
          constraintDate = pred.ef + dep.lagDays - node.duration;
          break;
        case "SS": // Start-to-Start: successor starts after predecessor starts
          constraintDate = pred.es + dep.lagDays;
          break;
        case "SF": // Start-to-Finish: successor finishes after predecessor starts
          constraintDate = pred.es + dep.lagDays - node.duration;
          break;
        default:
          constraintDate = pred.ef;
      }
      maxES = Math.max(maxES, constraintDate);
    }

    node.es = maxES;
    node.ef = node.es + node.duration;
  }

  // Find project end
  let projectEnd = 0;
  for (const node of nodes.values()) {
    projectEnd = Math.max(projectEnd, node.ef);
  }

  // Backward pass - calculate LS and LF
  for (let i = sorted.length - 1; i >= 0; i--) {
    const node = nodes.get(sorted[i])!;

    // Find all successors of this node
    let minLF = projectEnd;
    for (const [, other] of nodes) {
      for (const dep of other.dependencies) {
        if (dep.targetId !== node.id) continue;

        let constraintDate: number;
        switch (dep.type) {
          case "FS":
            constraintDate = other.ls - dep.lagDays;
            break;
          case "FF":
            constraintDate = other.lf - dep.lagDays;
            break;
          case "SS":
            constraintDate = other.ls - dep.lagDays + node.duration;
            break;
          case "SF":
            constraintDate = other.lf - dep.lagDays + node.duration;
            break;
          default:
            constraintDate = other.ls;
        }
        minLF = Math.min(minLF, constraintDate);
      }
    }

    node.lf = minLF;
    node.ls = node.lf - node.duration;
    node.slack = node.ls - node.es;
    node.isCritical = Math.abs(node.slack) < 0.5; // float tolerance
  }

  return nodes;
}

function topologicalSort(nodes: Map<string, CPMNode>): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodes.get(id);
    if (!node) return;
    for (const dep of node.dependencies) {
      if (nodes.has(dep.targetId)) {
        visit(dep.targetId);
      }
    }
    result.push(id);
  }

  for (const id of nodes.keys()) {
    visit(id);
  }

  return result;
}
