import { Priority } from "./types";

export type ProposedTask = {
  task: string;
  priority: Priority;
  dueDate: string;
  project: string;
  notes: string;
};

// Robust CSV parser supporting quoted fields, escaped quotes, and CRLF.
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/^\uFEFF/, ""); // strip BOM

  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\n" || c === "\r") {
      row.push(field); field = "";
      // skip CRLF pair
      if (c === "\r" && src[i + 1] === "\n") i++;
      // skip empty trailing rows
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) rows.push(row);
      row = []; i++; continue;
    }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) rows.push(row);
  }
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[_\s\-]+/g, "").trim();

export type ColumnMapping = {
  task: number;
  priority: number;
  dueDate: number;
  project: number;
  notes: number;
};

const TASK_KEYS = ["task", "title", "name", "action", "todo", "item", "summary", "subject", "description"];
const PRIORITY_KEYS = ["priority", "importance", "urgency"];
const DUE_KEYS = ["duedate", "due", "deadline", "date", "by", "duewhen"];
const PROJECT_KEYS = ["project", "projectname", "category", "workstream", "area"];
const NOTES_KEYS = ["notes", "note", "details", "comments", "comment", "context", "info"];

export function autoMapColumns(headers: string[]): ColumnMapping {
  const findIdx = (keys: string[], skip: number[] = []) => {
    for (const key of keys) {
      const idx = headers.findIndex((h, i) => !skip.includes(i) && norm(h) === key);
      if (idx !== -1) return idx;
    }
    // fallback: contains
    for (const key of keys) {
      const idx = headers.findIndex((h, i) => !skip.includes(i) && norm(h).includes(key));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const task = findIdx(TASK_KEYS);
  const priority = findIdx(PRIORITY_KEYS, [task].filter(i => i >= 0));
  const dueDate = findIdx(DUE_KEYS, [task, priority].filter(i => i >= 0));
  const project = findIdx(PROJECT_KEYS, [task, priority, dueDate].filter(i => i >= 0));
  const notes = findIdx(NOTES_KEYS, [task, priority, dueDate, project].filter(i => i >= 0));

  return { task, priority, dueDate, project, notes };
}

const normalizePriority = (raw: string): Priority => {
  const v = raw.toLowerCase().trim();
  if (!v) return "Medium";
  if (/^(h|high|urgent|critical|p1|1|asap)/.test(v)) return "High";
  if (/^(l|low|p3|3|minor|nice)/.test(v)) return "Low";
  return "Medium";
};

const normalizeDate = (raw: string): string => {
  const v = raw.trim();
  if (!v) return "";
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  // DD/MM/YYYY or MM/DD/YYYY or D-M-YYYY
  const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    // Heuristic: if first part > 12, it must be DD/MM
    const aN = parseInt(a), bN = parseInt(b);
    let day = aN, month = bN;
    if (aN <= 12 && bN > 12) { month = aN; day = bN; }
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  // Try Date.parse fallback
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return "";
};

export function rowsToTasks(
  rows: string[][],
  mapping: ColumnMapping,
  hasHeader: boolean,
  existingProjects: string[]
): ProposedTask[] {
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const projectsLower = existingProjects.map(p => p.toLowerCase());
  const tasks: ProposedTask[] = [];

  for (const row of dataRows) {
    const get = (idx: number) => (idx >= 0 && idx < row.length ? (row[idx] ?? "").trim() : "");
    const taskText = get(mapping.task);
    if (!taskText) continue;

    const projectRaw = get(mapping.project);
    let project = "";
    if (projectRaw) {
      const matchIdx = projectsLower.indexOf(projectRaw.toLowerCase());
      project = matchIdx >= 0 ? existingProjects[matchIdx] : projectRaw;
    }

    tasks.push({
      task: taskText,
      priority: normalizePriority(get(mapping.priority)),
      dueDate: normalizeDate(get(mapping.dueDate)),
      project,
      notes: get(mapping.notes),
    });
  }
  return tasks;
}
