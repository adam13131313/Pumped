// CSV import for the WBS hierarchy. Round-trips with src/lib/exportWBS.ts.
//
// Header columns (case-insensitive, any order; "path" and "node_type" required):
//   path, node_type, description, project_status, start_date, due_date, rag_status, blockers
//
// Match strategy: rows are matched to existing nodes by full `path`. Existing
// path → update fields. New path → create with parent resolved by path-minus-
// last-segment lookup. Parents must exist (in DB or earlier in the CSV) before
// their children.

import type { NodeType, ProjectStatus, RagStatus, WbsNode } from "./types";
import { allowedChildTypes } from "./schemas";
import { PATH_SEPARATOR, buildPath } from "./exportWBS";

const NODE_TYPES: NodeType[] = ["portfolio", "programme", "project", "work_package"];
const PROJECT_STATUSES: ProjectStatus[] = ["active", "on_hold", "complete"];
const RAG_STATUSES: RagStatus[] = ["green", "amber", "red"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type WbsCsvParsedRow = {
  rowNumber: number; // 1-indexed including header
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
};

export interface WbsCsvPreview {
  toCreate: WbsCsvParsedRow[];
  toUpdate: { row: WbsCsvParsedRow; existing: WbsNode; changes: Partial<WbsNode> }[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseCSV(text: string): string[][] {
  // RFC-4180-ish parser that tolerates CRLF / LF and quoted fields with
  // embedded commas / quotes / newlines.
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
  // tail
  if (field.length > 0 || row.length > 0) {
    flushField();
    flushRow();
  }
  // strip a trailing wholly-empty row (common when file ends with newline)
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Row validation
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

// ---------------------------------------------------------------------------
// Preview — validates everything WITHOUT writing
// ---------------------------------------------------------------------------

export function previewWbsCsv(text: string, existingNodes: WbsNode[]): WbsCsvPreview {
  const errors: string[] = [];
  const toCreate: WbsCsvParsedRow[] = [];
  const toUpdate: WbsCsvPreview["toUpdate"] = [];

  const rows = parseCSV(text);
  if (rows.length === 0) {
    return { toCreate, toUpdate, errors: ["CSV is empty"] };
  }
  const headerResult = buildHeaderMap(rows[0]);
  if (typeof headerResult === "string") {
    return { toCreate, toUpdate, errors: [headerResult] };
  }
  const header = headerResult;

  // Index existing nodes by path so we can match.
  const existingById = new Map(existingNodes.filter((n) => !n.archivedAt).map((n) => [n.id, n]));
  const existingByPath = new Map<string, WbsNode>();
  for (const node of existingById.values()) {
    const p = buildPath(node, existingById);
    if (p) existingByPath.set(p, node);
  }

  // Track paths we've validated this run so within-file dupes are caught.
  const seenPaths = new Set<string>();

  const parsedRows: WbsCsvParsedRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNumber = r + 1;
    if (row.every((c) => c.trim() === "")) continue; // skip blank rows

    const path = cell(row, header.path);
    const nodeTypeRaw = cell(row, header.node_type);

    if (!path) {
      errors.push(`Row ${rowNumber}: missing path`);
      continue;
    }
    if (!nodeTypeRaw) {
      errors.push(`Row ${rowNumber}: missing node_type`);
      continue;
    }
    if (!NODE_TYPES.includes(nodeTypeRaw as NodeType)) {
      errors.push(`Row ${rowNumber}: unknown node_type "${nodeTypeRaw}"`);
      continue;
    }
    const nodeType = nodeTypeRaw as NodeType;

    const segments = splitPath(path);
    if (segments.length === 0) {
      errors.push(`Row ${rowNumber}: empty path`);
      continue;
    }
    const normalizedPath = segments.join(PATH_SEPARATOR);
    if (seenPaths.has(normalizedPath)) {
      errors.push(`Row ${rowNumber}: duplicate path "${normalizedPath}"`);
      continue;
    }
    seenPaths.add(normalizedPath);

    const description = cell(row, header.description);

    const projectStatusRaw = cell(row, header.project_status);
    let projectStatus: ProjectStatus | null = null;
    if (projectStatusRaw) {
      if (!PROJECT_STATUSES.includes(projectStatusRaw as ProjectStatus)) {
        errors.push(`Row ${rowNumber}: invalid project_status "${projectStatusRaw}"`);
        continue;
      }
      if (nodeType !== "project") {
        errors.push(`Row ${rowNumber}: project_status only allowed on node_type=project`);
        continue;
      }
      projectStatus = projectStatusRaw as ProjectStatus;
    }

    const startDate = cell(row, header.start_date);
    const dueDate = cell(row, header.due_date);
    if (startDate && !DATE_RE.test(startDate)) {
      errors.push(`Row ${rowNumber}: start_date must be YYYY-MM-DD`);
      continue;
    }
    if (dueDate && !DATE_RE.test(dueDate)) {
      errors.push(`Row ${rowNumber}: due_date must be YYYY-MM-DD`);
      continue;
    }
    if ((startDate || dueDate) && nodeType !== "work_package") {
      errors.push(`Row ${rowNumber}: start_date / due_date only allowed on node_type=work_package`);
      continue;
    }

    const ragStatusRaw = cell(row, header.rag_status);
    let ragStatus: RagStatus | null = null;
    if (ragStatusRaw) {
      if (!RAG_STATUSES.includes(ragStatusRaw as RagStatus)) {
        errors.push(`Row ${rowNumber}: invalid rag_status "${ragStatusRaw}"`);
        continue;
      }
      if (nodeType !== "work_package") {
        errors.push(`Row ${rowNumber}: rag_status only allowed on node_type=work_package`);
        continue;
      }
      ragStatus = ragStatusRaw as RagStatus;
    }

    const blockers = cell(row, header.blockers);
    if (blockers && nodeType !== "work_package") {
      errors.push(`Row ${rowNumber}: blockers only allowed on node_type=work_package`);
      continue;
    }

    parsedRows.push({
      rowNumber,
      path: normalizedPath,
      segments,
      parentPath: parentPathOf(segments),
      name: segments[segments.length - 1],
      nodeType,
      description,
      projectStatus,
      startDate: startDate || null,
      dueDate: dueDate || null,
      ragStatus,
      blockers: blockers || null,
    });
  }

  // Sort by depth so parents come before children.
  parsedRows.sort((a, b) => a.segments.length - b.segments.length);

  // Track paths that will exist after this import (existing + newly-created)
  // so we can validate parents that come from THIS file.
  const willExist = new Map<string, { nodeType: NodeType; existing: WbsNode | null }>();
  for (const [p, node] of existingByPath) willExist.set(p, { nodeType: node.nodeType, existing: node });

  for (const row of parsedRows) {
    // Parent existence + child-type rules
    if (row.parentPath !== null) {
      const parent = willExist.get(row.parentPath);
      if (!parent) {
        errors.push(`Row ${row.rowNumber}: parent path not found: "${row.parentPath}"`);
        continue;
      }
      const allowed = allowedChildTypes(parent.nodeType);
      if (!allowed.includes(row.nodeType)) {
        errors.push(
          `Row ${row.rowNumber}: ${row.nodeType} cannot be a child of ${parent.nodeType}. ` +
            `Allowed children of ${parent.nodeType}: ${allowed.join(", ") || "none"}.`,
        );
        continue;
      }
    } else {
      // top-level — any type allowed
    }

    const existing = existingByPath.get(row.path);
    if (existing) {
      if (existing.nodeType !== row.nodeType) {
        errors.push(
          `Row ${row.rowNumber}: node_type mismatch for existing path "${row.path}" ` +
            `(existing=${existing.nodeType}, csv=${row.nodeType}). Type changes not supported via CSV.`,
        );
        continue;
      }
      const changes = diff(row, existing);
      if (Object.keys(changes).length > 0) {
        toUpdate.push({ row, existing, changes });
      }
      // ensure this path stays known for any descendant rows
      willExist.set(row.path, { nodeType: row.nodeType, existing });
    } else {
      toCreate.push(row);
      willExist.set(row.path, { nodeType: row.nodeType, existing: null });
    }
  }

  return { toCreate, toUpdate, errors };
}

function diff(row: WbsCsvParsedRow, existing: WbsNode): Partial<WbsNode> {
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
}

export interface WbsCsvApplyResult {
  created: number;
  updated: number;
  errors: string[];
}

export function applyWbsCsv(
  preview: WbsCsvPreview,
  deps: WbsCsvApplyDeps,
): WbsCsvApplyResult {
  const errors = [...preview.errors];

  // Update first (no path-dependency issues).
  let updated = 0;
  for (const { existing, changes } of preview.toUpdate) {
    deps.updateWbsNode(existing.id, changes);
    updated++;
  }

  // Build a path → node map of nodes we can use as parents, seeded with current state.
  const byId = new Map(deps.existingNodes.filter((n) => !n.archivedAt).map((n) => [n.id, n]));
  const pathToNode = new Map<string, WbsNode>();
  for (const node of byId.values()) {
    const p = buildPath(node, byId);
    if (p) pathToNode.set(p, node);
  }

  // Apply existing-row updates locally so later parent lookups see the new names.
  for (const { existing, changes } of preview.toUpdate) {
    const updatedNode = { ...existing, ...changes } as WbsNode;
    byId.set(updatedNode.id, updatedNode);
    const newPath = buildPath(updatedNode, byId);
    if (newPath) pathToNode.set(newPath, updatedNode);
  }

  // Creates in depth order (preview already sorted).
  const newRowsByDepth = [...preview.toCreate].sort((a, b) => a.segments.length - b.segments.length);
  let created = 0;
  for (const row of newRowsByDepth) {
    let parentId: string | null = null;
    if (row.parentPath !== null) {
      const parent = pathToNode.get(row.parentPath);
      if (!parent) {
        errors.push(`Row ${row.rowNumber}: parent disappeared during import: "${row.parentPath}"`);
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
    created++;
  }

  return { created, updated, errors };
}

// ---------------------------------------------------------------------------
// Sample CSV template — handy for users starting fresh
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
];

export const TEMPLATE_SAMPLE_ROWS: string[][] = [
  ["My Portfolio", "portfolio", "Top-level portfolio", "", "", "", "", ""],
  ["My Portfolio > Programme Alpha", "programme", "A programme", "", "", "", "", ""],
  ["My Portfolio > Programme Alpha > Project One", "project", "First project", "active", "", "", "", ""],
  ["My Portfolio > Programme Alpha > Project One > Design WP", "work_package", "Design work", "", "2026-06-01", "2026-06-30", "green", ""],
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
