// CSV import for the WBS hierarchy. Round-trips with src/lib/exportWBS.ts and
// also accepts "tasks" as leaf rows — Pumped models tasks as actions in a
// separate table, so task-typed rows are routed to actions rather than rejected.
//
// Header columns (case-insensitive, any order; "path" and "node_type" required):
//   path, node_type, description, project_status, start_date, due_date, rag_status, blockers
//
// Synonyms for node_type
//   - portfolio / programme / project / work_package  → WBS node
//   - task / action / activity                        → action (commitment)
//
// Handling for non-standard structure
//   - work_package nested under another work_package  → flattened to an action
//     under the nearest non-WP ancestor (sub-WP grouping name is preserved as
//     a prefix on its descendant actions' titles).
//   - dates / RAG / blockers / project_status set on a node_type that doesn't
//     normally accept them → silently dropped with a single grouped warning.

import type {
  Action,
  ActionPriority,
  NodeType,
  ProjectStatus,
  RagStatus,
  WbsNode,
} from "./types";
import { allowedChildTypes } from "./schemas";
import { PATH_SEPARATOR, buildPath } from "./exportWBS";

const NODE_TYPES: NodeType[] = ["portfolio", "programme", "project", "work_package"];
const ACTION_SYNONYMS = new Set(["task", "action", "activity"]);
const PROJECT_STATUSES: ProjectStatus[] = ["active", "on_hold", "complete"];
const RAG_STATUSES: RagStatus[] = ["green", "amber", "red"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WbsRowData {
  rowNumber: number;
  path: string;
  segments: string[];
  parentPath: string | null;
  name: string;
  nodeType: NodeType;
  description: string;
  projectStatus: ProjectStatus | null;
  startDate: string | null;
  dueDate: string | null;
  ragStatus: RagStatus | null;
  blockers: string | null;
}

export interface ActionRowData {
  rowNumber: number;
  task: string;
  parentPath: string | null; // wbs node path (any level)
  notes: string;
  startDate: string | null;
  dueDate: string | null;
  priority: ActionPriority;
}

export interface ErrorGroup {
  message: string;
  count: number;
  rows: number[]; // 1-indexed row numbers
}

export interface WbsCsvPreview {
  wbsToCreate: WbsRowData[];
  wbsToUpdate: { row: WbsRowData; existing: WbsNode; changes: Partial<WbsNode> }[];
  actionsToCreate: ActionRowData[];
  warnings: ErrorGroup[];
  errors: ErrorGroup[];
}

// ---------------------------------------------------------------------------
// CSV parsing (RFC-4180-ish, tolerates CRLF + quoted fields with embedded
// commas / quotes / newlines).
// ---------------------------------------------------------------------------

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const flushField = () => {
    row.push(field);
    field = "";
  };
  const flushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      flushField();
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      flushField();
      flushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    flushField();
    flushRow();
  }
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

interface HeaderMap {
  path: number;
  node_type: number;
  description: number | null;
  project_status: number | null;
  start_date: number | null;
  due_date: number | null;
  rag_status: number | null;
  blockers: number | null;
  priority: number | null;
}

function buildHeaderMap(header: string[]): HeaderMap | string {
  const lower = header.map((h) => h.trim().toLowerCase());
  const idx = (name: string) => {
    const i = lower.indexOf(name);
    return i === -1 ? null : i;
  };
  const path = idx("path");
  const nodeType = idx("node_type");
  if (path === null) return "Missing required column: path";
  if (nodeType === null) return "Missing required column: node_type";
  return {
    path,
    node_type: nodeType,
    description: idx("description"),
    project_status: idx("project_status"),
    start_date: idx("start_date"),
    due_date: idx("due_date"),
    rag_status: idx("rag_status"),
    blockers: idx("blockers"),
    priority: idx("priority"),
  };
}

function cell(row: string[], i: number | null): string {
  if (i === null || i >= row.length) return "";
  return (row[i] ?? "").trim();
}

function splitPath(p: string): string[] {
  return p.split(PATH_SEPARATOR).map((s) => s.trim()).filter((s) => s.length > 0);
}

function parentPathOf(segments: string[]): string | null {
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join(PATH_SEPARATOR);
}

function normalizePriority(raw: string): ActionPriority {
  const v = raw.trim().toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}

// ---------------------------------------------------------------------------
// Error accumulator — groups identical error messages
// ---------------------------------------------------------------------------

class GroupBucket {
  private buckets = new Map<string, ErrorGroup>();
  add(message: string, rowNumber?: number): void {
    const existing = this.buckets.get(message);
    if (existing) {
      existing.count++;
      if (rowNumber !== undefined && existing.rows.length < 50) existing.rows.push(rowNumber);
    } else {
      this.buckets.set(message, {
        message,
        count: 1,
        rows: rowNumber !== undefined ? [rowNumber] : [],
      });
    }
  }
  list(): ErrorGroup[] {
    return Array.from(this.buckets.values()).sort((a, b) => b.count - a.count);
  }
}

// ---------------------------------------------------------------------------
// Preview — validates everything WITHOUT writing.
// ---------------------------------------------------------------------------

export function previewWbsCsv(text: string, existingNodes: WbsNode[]): WbsCsvPreview {
  const errors = new GroupBucket();
  const warnings = new GroupBucket();

  const wbsToCreate: WbsRowData[] = [];
  const wbsToUpdate: WbsCsvPreview["wbsToUpdate"] = [];
  const actionsToCreate: ActionRowData[] = [];

  const rows = parseCSV(text);
  if (rows.length === 0) {
    errors.add("CSV is empty");
    return { wbsToCreate, wbsToUpdate, actionsToCreate, warnings: warnings.list(), errors: errors.list() };
  }
  const headerResult = buildHeaderMap(rows[0]);
  if (typeof headerResult === "string") {
    errors.add(headerResult);
    return { wbsToCreate, wbsToUpdate, actionsToCreate, warnings: warnings.list(), errors: errors.list() };
  }
  const header = headerResult;

  // Index existing nodes by path.
  const existingById = new Map(existingNodes.filter((n) => !n.archivedAt).map((n) => [n.id, n]));
  const existingByPath = new Map<string, WbsNode>();
  for (const node of existingById.values()) {
    const p = buildPath(node, existingById);
    if (p) existingByPath.set(p, node);
  }

  // First pass: parse every row into a normalized internal record.
  interface ParsedRow {
    rowNumber: number;
    path: string;
    segments: string[];
    parentPath: string | null;
    rawNodeType: string;
    kind: "wbs" | "action" | "error";
    nodeType: NodeType | null;
    description: string;
    projectStatus: ProjectStatus | null;
    startDate: string | null;
    dueDate: string | null;
    ragStatus: RagStatus | null;
    blockers: string | null;
    priority: ActionPriority;
  }

  const parsed: ParsedRow[] = [];
  const seenPaths = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNumber = r + 1;
    if (row.every((c) => c.trim() === "")) continue;

    const path = cell(row, header.path);
    const nodeTypeRaw = cell(row, header.node_type);

    if (!path) {
      errors.add("Missing path", rowNumber);
      continue;
    }
    if (!nodeTypeRaw) {
      errors.add("Missing node_type", rowNumber);
      continue;
    }

    const segments = splitPath(path);
    if (segments.length === 0) {
      errors.add("Empty path", rowNumber);
      continue;
    }
    const normalizedPath = segments.join(PATH_SEPARATOR);
    if (seenPaths.has(normalizedPath)) {
      errors.add(`Duplicate path: "${normalizedPath}"`, rowNumber);
      continue;
    }
    seenPaths.add(normalizedPath);

    const description = cell(row, header.description);
    const startDateRaw = cell(row, header.start_date);
    const dueDateRaw = cell(row, header.due_date);
    const ragRaw = cell(row, header.rag_status);
    const blockersRaw = cell(row, header.blockers);
    const projectStatusRaw = cell(row, header.project_status);
    const priorityRaw = cell(row, header.priority);

    if (startDateRaw && !DATE_RE.test(startDateRaw)) {
      errors.add(`start_date must be YYYY-MM-DD (got "${startDateRaw}")`, rowNumber);
      continue;
    }
    if (dueDateRaw && !DATE_RE.test(dueDateRaw)) {
      errors.add(`due_date must be YYYY-MM-DD (got "${dueDateRaw}")`, rowNumber);
      continue;
    }

    const lowerType = nodeTypeRaw.toLowerCase();
    const isWbs = NODE_TYPES.includes(lowerType as NodeType);
    const isAction = ACTION_SYNONYMS.has(lowerType);

    if (!isWbs && !isAction) {
      errors.add(
        `Unknown node_type: "${nodeTypeRaw}". Allowed: portfolio, programme, project, work_package, task, action, activity.`,
        rowNumber,
      );
      continue;
    }

    const nodeType = isWbs ? (lowerType as NodeType) : null;

    // Validate enum-shaped fields. project_status/rag_status only check the
    // value here; the "wrong-node-type" check (silent drop or warn) comes
    // later when we know what we're doing with the row.
    let projectStatus: ProjectStatus | null = null;
    if (projectStatusRaw) {
      if (!PROJECT_STATUSES.includes(projectStatusRaw as ProjectStatus)) {
        errors.add(`Invalid project_status: "${projectStatusRaw}". Allowed: active, on_hold, complete.`, rowNumber);
        continue;
      }
      projectStatus = projectStatusRaw as ProjectStatus;
    }

    let ragStatus: RagStatus | null = null;
    if (ragRaw) {
      if (!RAG_STATUSES.includes(ragRaw as RagStatus)) {
        errors.add(`Invalid rag_status: "${ragRaw}". Allowed: green, amber, red.`, rowNumber);
        continue;
      }
      ragStatus = ragRaw as RagStatus;
    }

    parsed.push({
      rowNumber,
      path: normalizedPath,
      segments,
      parentPath: parentPathOf(segments),
      rawNodeType: nodeTypeRaw,
      kind: isWbs ? "wbs" : "action",
      nodeType,
      description,
      projectStatus,
      startDate: startDateRaw || null,
      dueDate: dueDateRaw || null,
      ragStatus,
      blockers: blockersRaw || null,
      priority: normalizePriority(priorityRaw),
    });
  }

  // Sort by depth so parents are processed before children. Critical for
  // sub-WP rewriting + action parent resolution.
  parsed.sort((a, b) => a.segments.length - b.segments.length);

  // Track final logical state during the pass.
  // `livePath` is the path each row's children should reference after any
  // rewrites (e.g. sub-WPs collapse). `titleAccumulator` carries name prefixes
  // forward so descendant actions know what context they came from.
  interface PathEntry {
    nodeType: NodeType | null; // null = rewritten away (sub-WP collapsed)
    existing: WbsNode | null;
    effectivePath: string;     // path of nearest non-rewritten ancestor (incl. self)
    titlePrefix: string;       // joined names of collapsed ancestors
  }
  const pathTable = new Map<string, PathEntry>();

  // Seed with existing WBS nodes — they're already in the database, so their
  // paths are "live" with no rewrite needed.
  for (const [path, node] of existingByPath) {
    pathTable.set(path, {
      nodeType: node.nodeType,
      existing: node,
      effectivePath: path,
      titlePrefix: "",
    });
  }

  for (const row of parsed) {
    const parentInfo = row.parentPath !== null ? pathTable.get(row.parentPath) : null;

    if (row.parentPath !== null && !parentInfo) {
      errors.add(`Parent path not found: "${row.parentPath}"`, row.rowNumber);
      continue;
    }

    // For action rows: emit an action under the nearest effective WBS ancestor.
    if (row.kind === "action") {
      if (parentInfo === null) {
        errors.add(`Task/action rows must have a parent (top-level not allowed).`, row.rowNumber);
        continue;
      }
      // Title prefix carries through sub-WP collapses.
      const prefix = parentInfo.titlePrefix;
      const taskTitle = prefix
        ? `${prefix} — ${row.segments[row.segments.length - 1]}`
        : row.segments[row.segments.length - 1];

      // Notes / dates are accepted; flag any other type-scoped fields silently.
      if (row.ragStatus !== null) warnings.add("rag_status ignored on task/action rows");
      if (row.blockers !== null) warnings.add("blockers ignored on task/action rows");
      if (row.projectStatus !== null) warnings.add("project_status ignored on task/action rows");

      actionsToCreate.push({
        rowNumber: row.rowNumber,
        task: taskTitle,
        parentPath: parentInfo.effectivePath,
        notes: row.description,
        startDate: row.startDate,
        dueDate: row.dueDate,
        priority: row.priority,
      });
      // Actions don't have children but we still need the rewrite map to
      // resolve any rows that point at this row's path as their parent
      // (the importer treats those as errors at validation time, since
      // actions can't have children).
      pathTable.set(row.path, {
        nodeType: null,
        existing: null,
        effectivePath: parentInfo.effectivePath,
        titlePrefix: prefix ? `${prefix} — ${row.segments[row.segments.length - 1]}` : row.segments[row.segments.length - 1],
      });
      continue;
    }

    // From here, row.kind === "wbs".
    const nodeType = row.nodeType!;

    // Sub-WP detection: WP whose parent is also a WP → collapse to an action
    // under the parent WP, name = sub-WP's leaf name.
    const subWp =
      nodeType === "work_package" &&
      parentInfo !== null &&
      parentInfo.nodeType === "work_package";

    if (subWp) {
      const prefix = parentInfo!.titlePrefix;
      const taskTitle = prefix
        ? `${prefix} — ${row.segments[row.segments.length - 1]}`
        : row.segments[row.segments.length - 1];

      warnings.add("Sub-work-packages converted to actions under their parent work-package");

      // Drop work_package-only fields silently with a warning.
      if (row.ragStatus !== null) warnings.add("rag_status ignored on collapsed sub-work-package");
      if (row.blockers !== null) warnings.add("blockers ignored on collapsed sub-work-package");

      actionsToCreate.push({
        rowNumber: row.rowNumber,
        task: taskTitle,
        parentPath: parentInfo!.effectivePath,
        notes: row.description,
        startDate: row.startDate,
        dueDate: row.dueDate,
        priority: row.priority,
      });
      pathTable.set(row.path, {
        nodeType: null,
        existing: null,
        effectivePath: parentInfo!.effectivePath,
        titlePrefix: prefix
          ? `${prefix} — ${row.segments[row.segments.length - 1]}`
          : row.segments[row.segments.length - 1],
      });
      continue;
    }

    // Validate hierarchy for a regular WBS row.
    if (parentInfo !== null) {
      if (parentInfo.nodeType === null) {
        // Parent is a row that collapsed (e.g. action or sub-WP). WBS nodes
        // can't be under a non-WBS parent. Reject with a clearer message.
        errors.add(
          `${nodeType} cannot be a child of a task/action or collapsed sub-work-package.`,
          row.rowNumber,
        );
        continue;
      }
      const allowed = allowedChildTypes(parentInfo.nodeType);
      if (!allowed.includes(nodeType)) {
        errors.add(
          `${nodeType} cannot be a child of ${parentInfo.nodeType}. ` +
            `Allowed children of ${parentInfo.nodeType}: ${allowed.join(", ") || "none"}.`,
          row.rowNumber,
        );
        continue;
      }
    }

    // Silent-drop with grouped warning: type-scoped fields on the wrong type.
    let startDate = row.startDate;
    let dueDate = row.dueDate;
    let ragStatus = row.ragStatus;
    let blockers = row.blockers;
    let projectStatus = row.projectStatus;
    if (nodeType !== "work_package") {
      if (startDate || dueDate) {
        warnings.add(`Dates ignored on ${nodeType} rows (only work_packages have dates)`);
        startDate = null;
        dueDate = null;
      }
      if (ragStatus !== null) {
        warnings.add(`rag_status ignored on ${nodeType} rows`);
        ragStatus = null;
      }
      if (blockers !== null) {
        warnings.add(`blockers ignored on ${nodeType} rows`);
        blockers = null;
      }
    }
    if (nodeType !== "project" && projectStatus !== null) {
      warnings.add(`project_status ignored on ${nodeType} rows`);
      projectStatus = null;
    }

    const rowData: WbsRowData = {
      rowNumber: row.rowNumber,
      path: row.path,
      segments: row.segments,
      parentPath: row.parentPath,
      name: row.segments[row.segments.length - 1],
      nodeType,
      description: row.description,
      projectStatus,
      startDate,
      dueDate,
      ragStatus,
      blockers,
    };

    const existing = existingByPath.get(row.path);
    if (existing) {
      if (existing.nodeType !== nodeType) {
        errors.add(
          `node_type mismatch on existing path "${row.path}" ` +
            `(existing=${existing.nodeType}, csv=${nodeType}). Type changes not supported.`,
          row.rowNumber,
        );
        continue;
      }
      const changes = diff(rowData, existing);
      if (Object.keys(changes).length > 0) {
        wbsToUpdate.push({ row: rowData, existing, changes });
      }
      pathTable.set(row.path, {
        nodeType,
        existing,
        effectivePath: row.path,
        titlePrefix: "",
      });
    } else {
      wbsToCreate.push(rowData);
      pathTable.set(row.path, {
        nodeType,
        existing: null,
        effectivePath: row.path,
        titlePrefix: "",
      });
    }
  }

  return {
    wbsToCreate,
    wbsToUpdate,
    actionsToCreate,
    warnings: warnings.list(),
    errors: errors.list(),
  };
}

function diff(row: WbsRowData, existing: WbsNode): Partial<WbsNode> {
  const changes: Partial<WbsNode> = {};
  if (row.name !== existing.name) changes.name = row.name;
  if ((row.description ?? "") !== (existing.description ?? "")) changes.description = row.description;
  if (row.nodeType === "project" && row.projectStatus !== existing.projectStatus) {
    changes.projectStatus = row.projectStatus;
  }
  if (row.nodeType === "work_package") {
    if (row.startDate !== existing.startDate) changes.startDate = row.startDate;
    if (row.dueDate !== existing.dueDate) changes.dueDate = row.dueDate;
    if (row.ragStatus !== existing.ragStatus) changes.ragStatus = row.ragStatus;
    if ((row.blockers ?? null) !== (existing.blockers ?? null)) changes.blockers = row.blockers;
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Apply — does the actual writes via store mutators
// ---------------------------------------------------------------------------

export interface WbsCsvApplyDeps {
  organisationId: string;
  createdBy: string | null;
  existingNodes: WbsNode[];
  addWbsNode: (node: WbsNode) => void;
  updateWbsNode: (id: string, updates: Partial<WbsNode>) => void;
  bulkAddActions: (actions: Action[]) => void;
}

export interface WbsCsvApplyResult {
  wbsCreated: number;
  wbsUpdated: number;
  actionsCreated: number;
  createdWbsIds: string[];
  createdActionIds: string[];
  errors: ErrorGroup[];
}

export function applyWbsCsv(
  preview: WbsCsvPreview,
  deps: WbsCsvApplyDeps,
): WbsCsvApplyResult {
  const errors = [...preview.errors];

  // Updates first.
  for (const { existing, changes } of preview.wbsToUpdate) {
    deps.updateWbsNode(existing.id, changes);
  }

  // Build a working path → node map so creates can resolve parents.
  const byId = new Map(deps.existingNodes.filter((n) => !n.archivedAt).map((n) => [n.id, n]));
  const pathToNode = new Map<string, WbsNode>();
  for (const node of byId.values()) {
    const p = buildPath(node, byId);
    if (p) pathToNode.set(p, node);
  }
  // Reflect updates locally so later parent lookups see the new names.
  for (const { existing, changes } of preview.wbsToUpdate) {
    const updatedNode = { ...existing, ...changes } as WbsNode;
    byId.set(updatedNode.id, updatedNode);
    const newPath = buildPath(updatedNode, byId);
    if (newPath) pathToNode.set(newPath, updatedNode);
  }

  // WBS creates in depth order.
  const newRows = [...preview.wbsToCreate].sort((a, b) => a.segments.length - b.segments.length);
  let wbsCreated = 0;
  const createdWbsIds: string[] = [];
  for (const row of newRows) {
    let parentId: string | null = null;
    if (row.parentPath !== null) {
      const parent = pathToNode.get(row.parentPath);
      if (!parent) {
        errors.push({
          message: `Parent disappeared during import: "${row.parentPath}"`,
          count: 1,
          rows: [row.rowNumber],
        });
        continue;
      }
      parentId = parent.id;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const node: WbsNode = {
      id,
      organisationId: deps.organisationId,
      parentId,
      nodeType: row.nodeType,
      name: row.name,
      description: row.description ?? "",
      position: 0,
      archivedAt: null,
      projectStatus: row.nodeType === "project" ? row.projectStatus : null,
      leadUserId: null,
      startDate: row.nodeType === "work_package" ? row.startDate : null,
      dueDate: row.nodeType === "work_package" ? row.dueDate : null,
      ragStatus: row.nodeType === "work_package" ? row.ragStatus : null,
      blockers: row.nodeType === "work_package" ? row.blockers : null,
      createdBy: deps.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    deps.addWbsNode(node);
    byId.set(node.id, node);
    pathToNode.set(row.path, node);
    createdWbsIds.push(node.id);
    wbsCreated++;
  }

  // Actions — bulk insert at the end.
  const actionsToInsert: Action[] = [];
  for (const a of preview.actionsToCreate) {
    if (a.parentPath === null) continue; // already filtered in preview
    const parent = pathToNode.get(a.parentPath);
    if (!parent) {
      errors.push({
        message: `Action parent disappeared during import: "${a.parentPath}"`,
        count: 1,
        rows: [a.rowNumber],
      });
      continue;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    actionsToInsert.push({
      id,
      organisationId: deps.organisationId,
      wbsNodeId: parent.id,
      assignedTo: deps.createdBy,
      createdBy: deps.createdBy,
      task: a.task,
      priority: a.priority,
      status: "not_started",
      startDate: a.startDate,
      dueDate: a.dueDate,
      completedAt: null,
      notes: a.notes,
      labels: [],
      notStartedSince: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }
  if (actionsToInsert.length > 0) {
    deps.bulkAddActions(actionsToInsert);
  }

  return {
    wbsCreated,
    wbsUpdated: preview.wbsToUpdate.length,
    actionsCreated: actionsToInsert.length,
    createdWbsIds,
    createdActionIds: actionsToInsert.map((a) => a.id),
    errors,
  };
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export const TEMPLATE_HEADERS: string[] = [
  "path",
  "node_type",
  "description",
  "project_status",
  "start_date",
  "due_date",
  "rag_status",
  "blockers",
  "priority",
];

export const TEMPLATE_SAMPLE_ROWS: string[][] = [
  ["My Portfolio", "portfolio", "Top-level portfolio", "", "", "", "", "", ""],
  ["My Portfolio > Programme Alpha", "programme", "A programme", "", "", "", "", "", ""],
  ["My Portfolio > Programme Alpha > Project One", "project", "First project", "active", "", "", "", "", ""],
  ["My Portfolio > Programme Alpha > Project One > Design WP", "work_package", "Design work", "", "2026-06-01", "2026-06-30", "green", "", ""],
  ["My Portfolio > Programme Alpha > Project One > Design WP > Draft initial layout", "task", "An actionable task", "", "", "2026-06-15", "", "", "high"],
];

export function downloadCSVTemplate(filename = "pumped-wbs-template.csv"): void {
  const csvEscape = (f: string) => (/[",\n\r]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f);
  const rows = [TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE_ROWS];
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
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
