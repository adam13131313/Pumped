// Stubbed for v2 phase 1. The v1 implementation parsed CSV/XLSX rows into
// {task, project (text), workPackage (text), ...} shapes that don't survive
// the move to wbs_node_id UUID FKs. Rewrite belongs to phase 4 once the
// node-picker UI lands.
//
// We keep the exported names so existing imports don't trigger module-not-found
// errors; the function bodies throw at runtime. v1 implementation preserved
// at /tmp/csvImport-v1.bak during the rebuild and on audit-fixes branch
// (commit 7e81b31).

import type { ActionPriority, ActionStatus } from "./types";

export type ProposedTask = {
  task: string;
  priority: ActionPriority;
  status: ActionStatus;
  startDate: string;
  dueDate: string;
  wbsNodeId: string | null;
  notes: string;
  labels: string[];
};

export type MappingKey =
  | "task" | "priority" | "status" | "startDate" | "dueDate"
  | "wbsNodeId" | "notes" | "labels";

export type ColumnMapping = Record<MappingKey, number>;

export type WBSRow = { programme: string; project: string; workPackage: string };

const STUB = "CSV import is being rewritten for the v2 wbs_nodes hierarchy. Disabled until phase 4 lands.";

export function parseCSV(_text: string): string[][] {
  throw new Error(STUB);
}

export function autoMapColumns(_headers: string[]): ColumnMapping {
  throw new Error(STUB);
}

export function rowsToTasks(): ProposedTask[] {
  throw new Error(STUB);
}

export const TEMPLATE_HEADERS: string[] = [];
export const TEMPLATE_SAMPLE_ROWS: string[][] = [];

export function downloadCSVTemplate(_opts?: unknown): void {
  throw new Error(STUB);
}

export async function downloadXLSXTemplate(_opts: unknown): Promise<void> {
  throw new Error(STUB);
}

export async function parseXLSX(_file: File): Promise<string[][]> {
  throw new Error(STUB);
}
