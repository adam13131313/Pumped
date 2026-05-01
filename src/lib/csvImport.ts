import { Priority, TaskStatus } from "./types";

export type ProposedTask = {
  task: string;
  priority: Priority;
  status: TaskStatus;
  startDate: string;
  dueDate: string;
  project: string;
  workPackage: string;
  notes: string;
  labels: string[];
};

// Robust CSV parser supporting quoted fields, escaped quotes, and CRLF.
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/^\uFEFF/, "");

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
      if (c === "\r" && src[i + 1] === "\n") i++;
      const isComment = row.length === 1 && row[0].trimStart().startsWith("#");
      if (!isComment && (row.length > 1 || (row.length === 1 && row[0].trim() !== ""))) rows.push(row);
      row = []; i++; continue;
    }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    const isComment = row.length === 1 && row[0].trimStart().startsWith("#");
    if (!isComment && (row.length > 1 || (row.length === 1 && row[0].trim() !== ""))) rows.push(row);
  }
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[_\s\-]+/g, "").trim();

export type MappingKey = "task" | "priority" | "status" | "startDate" | "dueDate" | "project" | "workPackage" | "notes" | "labels";
export type ColumnMapping = Record<MappingKey, number>;

const KEY_ALIASES: Record<MappingKey, string[]> = {
  task: ["task", "title", "name", "action", "todo", "item", "summary", "subject", "description"],
  priority: ["priority", "importance", "urgency"],
  status: ["status", "state"],
  startDate: ["startdate", "start", "begin", "from"],
  dueDate: ["duedate", "due", "deadline", "date", "by", "duewhen", "to"],
  project: ["project", "projectname", "category", "workstream", "area"],
  workPackage: ["workpackage", "wp", "package", "phase", "epic"],
  notes: ["notes", "note", "details", "comments", "comment", "context", "info"],
  labels: ["labels", "label", "tags", "tag"],
};

export function autoMapColumns(headers: string[]): ColumnMapping {
  const used = new Set<number>();
  const result = {} as ColumnMapping;
  const keys: MappingKey[] = ["task", "priority", "status", "startDate", "dueDate", "project", "workPackage", "notes", "labels"];
  for (const key of keys) {
    const aliases = KEY_ALIASES[key];
    let found = -1;
    for (const alias of aliases) {
      const idx = headers.findIndex((h, i) => !used.has(i) && norm(h) === alias);
      if (idx !== -1) { found = idx; break; }
    }
    if (found === -1) {
      for (const alias of aliases) {
        const idx = headers.findIndex((h, i) => !used.has(i) && norm(h).includes(alias));
        if (idx !== -1) { found = idx; break; }
      }
    }
    if (found !== -1) used.add(found);
    result[key] = found;
  }
  return result;
}

const normalizePriority = (raw: string): Priority => {
  const v = raw.toLowerCase().trim();
  if (!v) return "Medium";
  if (/^(h|high|urgent|critical|p1|1|asap)/.test(v)) return "High";
  if (/^(l|low|p3|3|minor|nice)/.test(v)) return "Low";
  return "Medium";
};

const normalizeStatus = (raw: string): TaskStatus => {
  const v = raw.toLowerCase().trim();
  if (!v) return "Not Started";
  if (/(progress|doing|wip|started|active)/.test(v)) return "In Progress";
  if (/(complete|done|finished|closed)/.test(v)) return "Complete";
  if (/(block|stuck|hold)/.test(v)) return "Blocked";
  return "Not Started";
};

const normalizeDate = (raw: string): string => {
  const v = raw.trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    const aN = parseInt(a), bN = parseInt(b);
    let day = aN, month = bN;
    if (aN <= 12 && bN > 12) { month = aN; day = bN; }
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return "";
};

const matchExisting = (raw: string, options: string[]): string => {
  if (!raw) return "";
  const lc = raw.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lc);
  return exact ?? raw;
};

export function rowsToTasks(
  rows: string[][],
  mapping: ColumnMapping,
  hasHeader: boolean,
  existingProjects: string[],
  existingWorkPackages: string[] = []
): ProposedTask[] {
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const tasks: ProposedTask[] = [];

  for (const row of dataRows) {
    const get = (idx: number) => (idx >= 0 && idx < row.length ? (row[idx] ?? "").trim() : "");
    const taskText = get(mapping.task);
    if (!taskText) continue;

    const labelsRaw = get(mapping.labels);
    const labels = labelsRaw
      ? labelsRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
      : [];

    tasks.push({
      task: taskText,
      priority: normalizePriority(get(mapping.priority)),
      status: normalizeStatus(get(mapping.status)),
      startDate: normalizeDate(get(mapping.startDate)),
      dueDate: normalizeDate(get(mapping.dueDate)),
      project: matchExisting(get(mapping.project), existingProjects),
      workPackage: matchExisting(get(mapping.workPackage), existingWorkPackages),
      notes: get(mapping.notes),
      labels,
    });
  }
  return tasks;
}

// ---------- Template generation ----------

export const TEMPLATE_HEADERS = [
  "Task",
  "Priority",
  "Status",
  "Start Date",
  "Due Date",
  "Project",
  "Work Package",
  "Notes",
  "Labels",
];

export const TEMPLATE_SAMPLE_ROWS: string[][] = [
  ["Draft project kickoff agenda", "High", "Not Started", "", "", "", "", "Include stakeholders & objectives", "planning,kickoff"],
  ["Review supplier quotes", "Medium", "In Progress", "", "", "", "", "Compare top 3 vendors", "procurement"],
  ["Send weekly status update", "Low", "Not Started", "", "", "", "", "", "comms"],
];

export type WBSRow = { programme: string; project: string; workPackage: string };

const csvEscape = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);

export function downloadCSVTemplate(opts?: {
  projects?: string[];
  workPackages?: string[];
  wbs?: WBSRow[];
}) {
  const lines: string[] = [];
  // Reference block (commented with #) showing the user's current WBS so they
  // know exactly which Project / Work Package values are valid.
  const projects = opts?.projects ?? [];
  const wps = opts?.workPackages ?? [];
  const wbs = opts?.wbs ?? [];
  if (projects.length || wps.length || wbs.length) {
    lines.push("# === Your current setup (reference only — delete these lines before import) ===");
    if (wbs.length) {
      lines.push("# Programme | Project | Work Package");
      for (const r of wbs) {
        lines.push(`# ${r.programme || "(none)"} | ${r.project || "(none)"} | ${r.workPackage || "(none)"}`);
      }
    } else {
      if (projects.length) lines.push("# Projects: " + projects.join(", "));
      if (wps.length) lines.push("# Work Packages: " + wps.join(", "));
    }
    lines.push("# Priority values: High, Medium, Low");
    lines.push("# Status values: Not Started, In Progress, Complete, Blocked");
    lines.push("# Date format: YYYY-MM-DD");
    lines.push("#");
  }
  lines.push(TEMPLATE_HEADERS.join(","));
  for (const r of TEMPLATE_SAMPLE_ROWS) lines.push(r.map(csvEscape).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, "tasks-template.csv");
}

export async function downloadXLSXTemplate(opts: {
  projects: string[];
  workPackages: string[];
  wbs?: WBSRow[];
}) {
  // Dynamic import keeps bundle lean
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tasks");
  const reference = wb.addWorksheet("WBS Reference");
  const lookups = wb.addWorksheet("Lookups");
  lookups.state = "hidden";

  // Lookups
  const writeList = (col: string, header: string, values: string[]) => {
    lookups.getCell(`${col}1`).value = header;
    values.forEach((v, i) => { lookups.getCell(`${col}${i + 2}`).value = v; });
  };
  writeList("A", "Priority", ["High", "Medium", "Low"]);
  writeList("B", "Status", ["Not Started", "In Progress", "Complete", "Blocked"]);
  writeList("C", "Project", opts.projects.length ? opts.projects : [" "]);
  writeList("D", "WorkPackage", opts.workPackages.length ? opts.workPackages : [" "]);

  // WBS Reference sheet — visible to the user so they see their hierarchy.
  reference.columns = [
    { header: "Programme", key: "programme", width: 28 },
    { header: "Project", key: "project", width: 28 },
    { header: "Work Package", key: "workPackage", width: 32 },
  ];
  reference.getRow(1).font = { bold: true };
  reference.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  const wbs = opts.wbs ?? [];
  if (wbs.length) {
    for (const r of wbs) reference.addRow([r.programme || "(none)", r.project || "(none)", r.workPackage || "(none)"]);
  } else {
    // Fall back to flat lists if WBS not provided
    const max = Math.max(opts.projects.length, opts.workPackages.length, 1);
    for (let i = 0; i < max; i++) {
      reference.addRow(["", opts.projects[i] ?? "", opts.workPackages[i] ?? ""]);
    }
  }
  reference.addRow([]);
  reference.addRow(["Snapshot generated:", new Date().toISOString().slice(0, 10)]);
  reference.getRow(reference.rowCount).font = { italic: true, color: { argb: "FF6B7280" } };

  // Headers
  ws.columns = TEMPLATE_HEADERS.map((h) => ({ header: h, key: h, width: h === "Notes" ? 40 : h === "Task" ? 36 : 18 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" },
  };

  // Sample rows
  TEMPLATE_SAMPLE_ROWS.forEach((r) => ws.addRow(r));

  // Add empty rows for typing
  const TOTAL_ROWS = 200;
  for (let i = ws.rowCount + 1; i <= TOTAL_ROWS; i++) ws.addRow([]);

  const rangeRows = `2:${TOTAL_ROWS}`;
  // Apply data validations to columns 2 (Priority), 3 (Status), 6 (Project), 7 (Work Package)
  const setListValidation = (colLetter: string, listFormula: string) => {
    for (let r = 2; r <= TOTAL_ROWS; r++) {
      ws.getCell(`${colLetter}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [listFormula],
        showErrorMessage: true,
        errorTitle: "Invalid value",
        error: "Please pick from the dropdown",
      };
    }
  };
  setListValidation("B", `Lookups!$A$2:$A$4`);
  setListValidation("C", `Lookups!$B$2:$B$5`);
  const projEnd = Math.max(2, opts.projects.length + 1);
  const wpEnd = Math.max(2, opts.workPackages.length + 1);
  setListValidation("F", `Lookups!$C$2:$C$${projEnd}`);
  setListValidation("G", `Lookups!$D$2:$D$${wpEnd}`);

  // Date format hints
  for (let r = 2; r <= TOTAL_ROWS; r++) {
    ws.getCell(`D${r}`).numFmt = "yyyy-mm-dd";
    ws.getCell(`E${r}`).numFmt = "yyyy-mm-dd";
  }
  void rangeRows;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  triggerDownload(blob, "tasks-template.xlsx");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Read .xlsx into rows (string[][]), using the first worksheet.
export async function parseXLSX(file: File): Promise<string[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const buf = await file.arrayBuffer();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const arr: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      if (v == null) { arr.push(""); return; }
      if (v instanceof Date) {
        arr.push(`${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`);
        return;
      }
      if (typeof v === "object" && "text" in (v as any)) { arr.push(String((v as any).text)); return; }
      if (typeof v === "object" && "result" in (v as any)) { arr.push(String((v as any).result ?? "")); return; }
      arr.push(String(v));
    });
    // trim trailing empties
    while (arr.length && arr[arr.length - 1] === "") arr.pop();
    if (arr.length) rows.push(arr);
  });
  return rows;
}
