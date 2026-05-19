import { create } from "zustand";
import { Action, InboxItem, Programme, Project, WaitingItem, WorkPackage } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SOPItem {
  id: string;
  when: string;
  instruction: string;
}

const defaultSOP: SOPItem[] = [
  { id: "s1", when: "Daily (2 min)", instruction: "Open My Actions. Pick your top 3 for the day — just 3. Work those first." },
  { id: "s2", when: "After every meeting", instruction: "Paste meeting notes into AI using the Task Extractor prompt. Review the output. Add your actions to My Actions. Add others' commitments to Waiting For." },
  { id: "s3", when: "After every email thread", instruction: "Use the Email Thread Task Extractor prompt. Takes 90 seconds. Saves you forgetting things." },
  { id: "s4", when: "Monday (30 min)", instruction: "Weekly Review:\n1. Process any outstanding notes/emails\n2. Update Waiting For — send any nudges\n3. Update Dashboard RAG statuses\n4. Set your Top 3 for the week\n5. Check for anything overdue" },
  { id: "s5", when: "Wednesday (20 min)", instruction: "Follow-up sweep: Open Waiting For. Look at anything due this week or overdue. Send short nudge messages." },
  { id: "s6", when: "RAG Status Guide", instruction: "Green = on track, no issues\nAmber = some risk or delay, being managed\nRed = off track, needs escalation or intervention\n\nUpdate weekly from WP leads' status updates." },
  { id: "s7", when: "Waiting For Rule", instruction: "Every time you ask someone to do something, log it in Waiting For immediately. This is how you stop chasing from memory." },
  { id: "s8", when: "Delegation Rule", instruction: "When delegating a WP or task: always specify WHAT, by WHEN, and what DONE looks like. A clear ask = fewer follow-up conversations." },
];

export interface GlobalFilter {
  programmeId: string;
  projectId: string;
  workPackageId: string;
  unassigned?: boolean;
}

interface AppState {
  // Loading state
  dataLoaded: boolean;

  todayIds: Set<string>;
  todayOrder: string[]; // ordered list of gathered task ids
  addToday: (id: string) => void;
  removeToday: (id: string) => void;
  clearToday: () => void;
  reorderToday: (orderedIds: string[]) => void;
  scheduleMap: Record<string, number>; // taskId -> slot index
  durationMap: Record<string, number>; // taskId -> duration in slots
  scheduleTask: (id: string, slot: number) => void;
  setTaskDuration: (id: string, duration: number) => void;
  unscheduleTask: (id: string) => void;
  clearSchedule: () => void;
  globalFilter: GlobalFilter;
  setGlobalFilter: (filter: GlobalFilter) => void;
  clearGlobalFilter: () => void;
  programmes: Programme[];
  projects: Project[];
  workPackages: WorkPackage[];
  actions: Action[];
  waitingItems: WaitingItem[];
  inboxItems: InboxItem[];
  sopItems: SOPItem[];

  // Data loading
  loadAllData: () => Promise<void>;

  addProgramme: (p: Programme) => void;
  updateProgramme: (id: string, updates: Partial<Programme>) => void;
  deleteProgramme: (id: string) => void;
  addProject: (p: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addAction: (action: Action) => void;
  updateAction: (id: string, updates: Partial<Action>) => void;
  deleteAction: (id: string) => void;
  bulkUpdateActions: (ids: string[], updates: Partial<Action>) => void;
  bulkDeleteActions: (ids: string[]) => void;
  addWorkPackage: (wp: WorkPackage) => void;
  updateWorkPackage: (id: string, updates: Partial<WorkPackage>) => void;
  deleteWorkPackage: (id: string) => void;
  addWaitingItem: (item: WaitingItem) => void;
  updateWaitingItem: (id: string, updates: Partial<WaitingItem>) => void;
  deleteWaitingItem: (id: string) => void;
  addInboxItem: (item: InboxItem) => void;
  addInboxItems: (items: InboxItem[]) => void;
  updateInboxItem: (id: string, updates: Partial<InboxItem>) => void;
  bulkUpdateInboxItems: (ids: string[], updates: Partial<InboxItem>) => void;
  deleteInboxItem: (id: string) => void;
  bulkDeleteInboxItems: (ids: string[]) => void;
  promoteInboxToActions: (ids: string[]) => void;
  bulkAddActions: (actions: Action[]) => void;
  updateSOPItem: (id: string, updates: Partial<SOPItem>) => void;
  addSOPItem: (item: SOPItem) => void;
  deleteSOPItem: (id: string) => void;
  delegateAction: (id: string, toWhom: string) => void;
  takeBackWaiting: (id: string) => void;
}

const defaultGlobalFilter: GlobalFilter = { programmeId: "", projectId: "", workPackageId: "", unassigned: false };

// --- Generic helpers ---------------------------------------------------------

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

function notifySaveError(message: string, error: unknown) {
  const description = error instanceof Error ? error.message : "Please refresh and try again.";
  console.error(message, error);
  toast.error(message, { description });
}

// Maps a Partial<T> domain patch into a snake-case DB update payload, dropping
// any field not present in `fieldMap`. Replaces the 8+ duplicated `dbUpdates: any`
// blocks that previously had to be kept in sync by hand — that drift was the
// source of `bulkUpdateActions` silently failing to forward `labels`/`completed_at`.
type FieldMap<T> = { [K in keyof T]?: string };

function buildDbUpdate<T extends object>(
  updates: Partial<T>,
  fieldMap: FieldMap<T>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(updates) as Array<keyof T>) {
    const dbKey = fieldMap[key];
    if (dbKey && updates[key] !== undefined) {
      out[dbKey] = updates[key] as unknown;
    }
  }
  return out;
}

// Field maps shared between single and bulk variants so they cannot drift.
const programmeFields: FieldMap<Programme> = {
  name: "name",
  description: "description",
};
const projectFields: FieldMap<Project> = {
  name: "name",
  description: "description",
  programmeId: "programme_id",
  status: "status",
};
const workPackageFields: FieldMap<WorkPackage> = {
  project: "project",
  workPackage: "work_package",
  wpLead: "wp_lead",
  startDate: "start_date",
  dueDate: "due_date",
  ragStatus: "rag_status",
  blockers: "blockers",
  dependencies: "dependencies",
};
const actionFields: FieldMap<Action & { completedAt?: string | null }> = {
  task: "task",
  project: "project",
  workPackage: "work_package",
  startDate: "start_date",
  dueDate: "due_date",
  priority: "priority",
  status: "status",
  notes: "notes",
  labels: "labels",
  completedAt: "completed_at",
};
const waitingFields: FieldMap<WaitingItem> = {
  description: "description",
  fromWhom: "from_whom",
  projectWP: "project_wp",
  askedOn: "asked_on",
  dueBy: "due_by",
  status: "status",
  notes: "notes",
  linkedProjectId: "linked_project_id",
};
const inboxFields: FieldMap<InboxItem> = {
  task: "task",
  priority: "priority",
  dueDate: "due_date",
  project: "project",
  notes: "notes",
  source: "source",
};
const sopFields: FieldMap<SOPItem> = {
  when: "trigger_when",
  instruction: "instruction",
};

// Awaits a Supabase query, surfaces failures via toast, and invokes the optional
// rollback. Mutators stay synchronous (they don't await this) so call sites read
// unchanged — but errors no longer vanish into a swallowed `.then()`.
type SbResult = { error: { message?: string } | null };

function runWrite(
  label: string,
  query: PromiseLike<SbResult>,
  rollback?: () => void,
): void {
  Promise.resolve(query).then(
    ({ error }) => {
      if (error) {
        rollback?.();
        notifySaveError(label, error);
      }
    },
    (error) => {
      rollback?.();
      notifySaveError(label, error);
    },
  );
}

// As runWrite, but the query depends on the current user id.
function runWriteWithUid(
  label: string,
  build: (uid: string) => PromiseLike<SbResult>,
  rollback?: () => void,
): void {
  getUserId().then(
    (uid) => runWrite(label, build(uid), rollback),
    (error) => {
      rollback?.();
      notifySaveError(label, error);
    },
  );
}

// Project/WP rename + delete cascade helpers ---------------------------------
//
// Until project/WP linkage moves from name strings to UUID FKs (separate
// migration), every action/waiting/inbox row that references a project or
// work package by NAME has to be kept in sync by application code. Without
// this, renaming a project orphans every dependent row (it disappears from
// filtered views) and deleting one leaves dangling string references.
//
// `set` and `get` are accepted as parameters so these can live in module
// scope alongside the other supabase helpers.

type StoreSet = (
  partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>),
) => void;

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

function propagateProjectRename(oldName: string, newName: string, set: StoreSet) {
  set((s) => ({
    workPackages: s.workPackages.map((wp) => wp.project === oldName ? { ...wp, project: newName } : wp),
    actions: s.actions.map((a) => a.project === oldName ? { ...a, project: newName } : a),
    inboxItems: s.inboxItems.map((i) => i.project === oldName ? { ...i, project: newName } : i),
    waitingItems: s.waitingItems.map((w) => {
      if (!w.projectWP) return w;
      const parts = w.projectWP.split(" / ");
      if (parts[0] !== oldName) return w;
      return { ...w, projectWP: [newName, ...parts.slice(1)].join(" / ") };
    }),
  }));

  runWrite("Project rename propagation (work packages)", supabase.from("work_packages").update({ project: newName }).eq("project", oldName));
  runWrite("Project rename propagation (actions)", supabase.from("actions").update({ project: newName }).eq("project", oldName));
  runWrite("Project rename propagation (inbox)", supabase.from("inbox_items").update({ project: newName }).eq("project", oldName));
  runWrite("Project rename propagation (waiting)", supabase.from("waiting_items").update({ project_wp: newName }).eq("project_wp", oldName));

  // waiting_items with "oldName / WPName" suffix — needs a per-row rewrite
  // because the JS client can't express UPDATE SET col = REPLACE(col, ...).
  void (async () => {
    const { data: matches, error } = await supabase
      .from("waiting_items")
      .select("id, project_wp")
      .like("project_wp", `${escapeLike(oldName)} / %`);
    if (error) {
      notifySaveError("Waiting item rename propagation failed", error);
      return;
    }
    if (!matches || matches.length === 0) return;
    await Promise.all(matches.map((m: { id: string; project_wp: string }) => {
      const newProjectWP = newName + m.project_wp.slice(oldName.length);
      return supabase.from("waiting_items").update({ project_wp: newProjectWP }).eq("id", m.id);
    }));
  })();
}

function cascadeProjectDelete(projectName: string, set: StoreSet) {
  set((s) => ({
    workPackages: s.workPackages.filter((wp) => wp.project !== projectName),
    actions: s.actions.map((a) => a.project === projectName ? { ...a, project: "", workPackage: "" } : a),
    inboxItems: s.inboxItems.map((i) => i.project === projectName ? { ...i, project: "" } : i),
    waitingItems: s.waitingItems.map((w) => {
      if (!w.projectWP) return w;
      const parts = w.projectWP.split(" / ");
      return parts[0] === projectName ? { ...w, projectWP: "" } : w;
    }),
  }));

  runWrite("Project cascade (delete WPs)", supabase.from("work_packages").delete().eq("project", projectName));
  runWrite("Project cascade (clear actions)", supabase.from("actions").update({ project: "", work_package: "" }).eq("project", projectName));
  runWrite("Project cascade (clear inbox)", supabase.from("inbox_items").update({ project: "" }).eq("project", projectName));
  runWrite("Project cascade (clear waiting exact)", supabase.from("waiting_items").update({ project_wp: "" }).eq("project_wp", projectName));

  void (async () => {
    const { data: matches, error } = await supabase
      .from("waiting_items")
      .select("id")
      .like("project_wp", `${escapeLike(projectName)} / %`);
    if (error) {
      notifySaveError("Waiting items cascade failed", error);
      return;
    }
    if (!matches || matches.length === 0) return;
    const ids = matches.map((m: { id: string }) => m.id);
    await supabase.from("waiting_items").update({ project_wp: "" }).in("id", ids);
  })();
}

function propagateWPRename(projectName: string, oldWP: string, newWP: string, set: StoreSet) {
  set((s) => ({
    actions: s.actions.map((a) => a.project === projectName && a.workPackage === oldWP ? { ...a, workPackage: newWP } : a),
    waitingItems: s.waitingItems.map((w) => {
      if (!w.projectWP) return w;
      const parts = w.projectWP.split(" / ");
      if (parts[0] === projectName && parts[1] === oldWP) {
        return { ...w, projectWP: `${projectName} / ${newWP}` };
      }
      return w;
    }),
  }));

  runWrite(
    "WP rename propagation (actions)",
    supabase.from("actions").update({ work_package: newWP }).eq("project", projectName).eq("work_package", oldWP),
  );
  runWrite(
    "WP rename propagation (waiting)",
    supabase.from("waiting_items").update({ project_wp: `${projectName} / ${newWP}` }).eq("project_wp", `${projectName} / ${oldWP}`),
  );
}

function cascadeWPDelete(projectName: string, wpName: string, set: StoreSet) {
  set((s) => ({
    actions: s.actions.map((a) => a.project === projectName && a.workPackage === wpName ? { ...a, workPackage: "" } : a),
    waitingItems: s.waitingItems.map((w) => {
      if (!w.projectWP) return w;
      const parts = w.projectWP.split(" / ");
      if (parts[0] === projectName && parts[1] === wpName) {
        return { ...w, projectWP: projectName };
      }
      return w;
    }),
  }));

  runWrite(
    "WP cascade (clear actions)",
    supabase.from("actions").update({ work_package: "" }).eq("project", projectName).eq("work_package", wpName),
  );
  runWrite(
    "WP cascade (waiting)",
    supabase.from("waiting_items").update({ project_wp: projectName }).eq("project_wp", `${projectName} / ${wpName}`),
  );
}

async function persistAction(action: Action) {
  const uid = await getUserId();
  const { error } = await supabase.from("actions").insert({
    id: action.id,
    user_id: uid,
    task: action.task,
    project: action.project,
    work_package: action.workPackage,
    start_date: action.startDate,
    due_date: action.dueDate,
    priority: action.priority,
    status: action.status,
    notes: action.notes,
    labels: action.labels || [],
  });
  if (error) throw error;
}

// --- Gathered ("Today") state -----------------------------------------------

// Persist gathered tasks across sessions (no daily reset). Migrate from old per-day key if present.
const GATHERED_KEY = "pumped-gathered";
const LEGACY_TODAY_KEY = `p3m-today-${new Date().toISOString().slice(0, 10)}`;

let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingGatheredPayload: {
  ids: string[];
  schedule: Record<string, number>;
  durations: Record<string, number>;
  order: string[];
} | null = null;

async function writeGatheredNow(payload: {
  ids: string[];
  schedule: Record<string, number>;
  durations: Record<string, number>;
  order: string[];
}) {
  try {
    const uid = await getUserId();
    if (!uid) return;
    await supabase.from("gathered_state").upsert({
      user_id: uid,
      ids: payload.ids as any,
      schedule: payload.schedule as any,
      durations: payload.durations as any,
      order_ids: payload.order as any,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[gathered] cloud save failed", e);
  }
}

function persistGatheredToCloud(payload: {
  ids: string[];
  schedule: Record<string, number>;
  durations: Record<string, number>;
  order: string[];
}) {
  pendingGatheredPayload = payload;
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    cloudSaveTimer = null;
    const p = pendingGatheredPayload;
    pendingGatheredPayload = null;
    if (p) void writeGatheredNow(p);
  }, 400);
}

// Flush any pending gathered-state save synchronously. Hooked to pagehide /
// visibilitychange below so a debounced write isn't lost when the user closes
// the tab or navigates away within the 400ms window. localStorage already has
// the value — this is what makes cross-device sync survive a fast close.
function flushPendingGathered() {
  if (!pendingGatheredPayload) return;
  if (cloudSaveTimer) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }
  const p = pendingGatheredPayload;
  pendingGatheredPayload = null;
  void writeGatheredNow(p);
}

if (typeof window !== "undefined") {
  // pagehide fires reliably on iOS Safari (where beforeunload doesn't);
  // visibilitychange covers tab switches and PWA backgrounding.
  window.addEventListener("pagehide", flushPendingGathered);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingGathered();
  });
}

function saveTodayState(todayIds: Set<string>, scheduleMap: Record<string, number>, durationMap: Record<string, number>, todayOrder: string[]) {
  const payload = {
    ids: Array.from(todayIds),
    schedule: scheduleMap,
    durations: durationMap,
    order: todayOrder,
  };
  try {
    localStorage.setItem(GATHERED_KEY, JSON.stringify(payload));
  } catch {}
  persistGatheredToCloud(payload);
}

function loadTodayState(): { todayIds: Set<string>; scheduleMap: Record<string, number>; durationMap: Record<string, number>; todayOrder: string[] } {
  try {
    let raw = localStorage.getItem(GATHERED_KEY);
    if (!raw) {
      // One-time migration from legacy per-day key
      raw = localStorage.getItem(LEGACY_TODAY_KEY);
      if (raw) localStorage.setItem(GATHERED_KEY, raw);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        todayIds: new Set<string>(parsed.ids || []),
        scheduleMap: parsed.schedule || {},
        durationMap: parsed.durations || {},
        todayOrder: parsed.order || parsed.ids || [],
      };
    }
  } catch {}
  return { todayIds: new Set(), scheduleMap: {}, durationMap: {}, todayOrder: [] };
}

const initialToday = loadTodayState();

export const useAppStore = create<AppState>()((set, get) => ({
  dataLoaded: false,

  todayIds: initialToday.todayIds,
  todayOrder: initialToday.todayOrder,
  addToday: (id) => set((s) => {
    const n = new Set(s.todayIds); n.add(id);
    const order = [...s.todayOrder, id];
    saveTodayState(n, s.scheduleMap, s.durationMap, order);
    return { todayIds: n, todayOrder: order };
  }),
  removeToday: (id) => set((s) => {
    const n = new Set(s.todayIds); n.delete(id);
    const sm = { ...s.scheduleMap }; delete sm[id];
    const dm = { ...s.durationMap }; delete dm[id];
    const order = s.todayOrder.filter((i) => i !== id);
    saveTodayState(n, sm, dm, order);
    return { todayIds: n, scheduleMap: sm, durationMap: dm, todayOrder: order };
  }),
  clearToday: () => {
    saveTodayState(new Set(), {}, {}, []);
    return set({ todayIds: new Set(), scheduleMap: {}, durationMap: {}, todayOrder: [] });
  },
  reorderToday: (orderedIds) => set((s) => {
    saveTodayState(s.todayIds, s.scheduleMap, s.durationMap, orderedIds);
    return { todayOrder: orderedIds };
  }),
  scheduleMap: initialToday.scheduleMap,
  durationMap: initialToday.durationMap,
  scheduleTask: (id, slot) => set((s) => {
    const sm = { ...s.scheduleMap, [id]: slot };
    saveTodayState(s.todayIds, sm, s.durationMap, s.todayOrder);
    return { scheduleMap: sm };
  }),
  setTaskDuration: (id, duration) => set((s) => {
    const dm = { ...s.durationMap, [id]: duration };
    saveTodayState(s.todayIds, s.scheduleMap, dm, s.todayOrder);
    return { durationMap: dm };
  }),
  unscheduleTask: (id) => set((s) => {
    const m = { ...s.scheduleMap }; delete m[id];
    const d = { ...s.durationMap }; delete d[id];
    saveTodayState(s.todayIds, m, d, s.todayOrder);
    return { scheduleMap: m, durationMap: d };
  }),
  clearSchedule: () => {
    const s = get();
    saveTodayState(s.todayIds, {}, {}, s.todayOrder);
    return set({ scheduleMap: {}, durationMap: {} });
  },

  globalFilter: defaultGlobalFilter,
  setGlobalFilter: (filter) => set({ globalFilter: filter }),
  clearGlobalFilter: () => set({ globalFilter: defaultGlobalFilter }),

  programmes: [],
  projects: [],
  workPackages: [],
  actions: [],
  waitingItems: [],
  inboxItems: [],
  sopItems: [],

  loadAllData: async () => {
    // completed_at backfill + auto-archive of Complete actions >24h old run
    // server-side via the maintenance-archive-completed edge function (pg_cron).
    // They used to run inline here; that added 2-7s of cold-start latency on
    // large tenants and scaled with row count.

    // Hard limit on the per-table fetch so a runaway dataset can't blow up
    // the initial payload. Ordering by created_at DESC means the newest rows
    // are always present — if the user is over the limit, the oldest rows
    // are what get clipped. A real paginated load is the proper long-term
    // fix; until then, a console warning fires below when a table hits the
    // limit so we can see who's getting close.
    const ROW_LIMIT = 10000;

    const [
      { data: programmes },
      { data: projects },
      { data: workPackages },
      { data: actions, count: actionsCount },
      { data: waitingItems, count: waitingCount },
      { data: inboxItems, count: inboxCount },
      { data: sopItems },
    ] = await Promise.all([
      supabase.from("programmes").select("*"),
      supabase.from("projects").select("*"),
      supabase.from("work_packages").select("*"),
      supabase.from("actions")
        .select("*", { count: "estimated" })
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      supabase.from("waiting_items")
        .select("*", { count: "estimated" })
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      supabase.from("inbox_items")
        .select("*", { count: "estimated" })
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT),
      supabase.from("sop_items").select("*"),
    ]);

    for (const [name, loaded, total] of [
      ["actions", actions?.length ?? 0, actionsCount ?? 0],
      ["waiting_items", waitingItems?.length ?? 0, waitingCount ?? 0],
      ["inbox_items", inboxItems?.length ?? 0, inboxCount ?? 0],
    ] as const) {
      if (loaded >= ROW_LIMIT && total > loaded) {
        console.warn(`[store] ${name}: loaded ${loaded} of ~${total} rows (limit hit). Older rows are not visible until pagination ships.`);
      }
    }

    const mapProgramme = (r: any): Programme => ({ id: r.id, name: r.name, description: r.description });
    const mapProject = (r: any): Project => ({ id: r.id, name: r.name, description: r.description, programmeId: r.programme_id, status: r.status });
    const mapWP = (r: any): WorkPackage => ({ id: r.id, project: r.project, workPackage: r.work_package, wpLead: r.wp_lead, startDate: r.start_date, dueDate: r.due_date, ragStatus: r.rag_status, blockers: r.blockers, dependencies: r.dependencies || [] });
    const mapAction = (r: any): Action => ({ id: r.id, task: r.task, project: r.project, workPackage: r.work_package, startDate: r.start_date, dueDate: r.due_date, priority: r.priority, status: r.status, notes: r.notes, completedAt: r.completed_at || undefined, labels: r.labels || [] });
    const mapWaiting = (r: any): WaitingItem => ({ id: r.id, description: r.description, fromWhom: r.from_whom, projectWP: r.project_wp, askedOn: r.asked_on, dueBy: r.due_by, status: r.status, notes: r.notes, linkedProjectId: r.linked_project_id || undefined });
    const mapInbox = (r: any): InboxItem => ({ id: r.id, task: r.task, priority: r.priority, dueDate: r.due_date, project: r.project, notes: r.notes, source: r.source, createdAt: r.created_at });
    const mapSOP = (r: any): SOPItem => ({ id: r.id, when: r.trigger_when, instruction: r.instruction });

    // Hydrate gathered state from cloud (overrides localStorage so it syncs across devices)
    try {
      const { data: gathered } = await supabase
        .from("gathered_state")
        .select("*")
        .maybeSingle();
      if (gathered) {
        const ids: string[] = Array.isArray(gathered.ids) ? gathered.ids as any : [];
        const schedule = (gathered.schedule || {}) as Record<string, number>;
        const durations = (gathered.durations || {}) as Record<string, number>;
        const order: string[] = Array.isArray(gathered.order_ids) ? gathered.order_ids as any : ids;
        try {
          localStorage.setItem(GATHERED_KEY, JSON.stringify({ ids, schedule, durations, order }));
        } catch {}
        set({
          todayIds: new Set(ids),
          scheduleMap: schedule,
          durationMap: durations,
          todayOrder: order,
        });
      } else {
        // No cloud row yet — push current local state up so it syncs going forward
        const s = get();
        if (s.todayIds.size > 0) {
          persistGatheredToCloud({
            ids: Array.from(s.todayIds),
            schedule: s.scheduleMap,
            durations: s.durationMap,
            order: s.todayOrder,
          });
        }
      }
    } catch (e) {
      console.error("[gathered] cloud load failed", e);
    }

    const mappedSOP = (sopItems || []).map(mapSOP);

    // If user has no SOP items yet, seed with defaults
    if (mappedSOP.length === 0) {
      const userId = await getUserId();
      const sopRows = defaultSOP.map((s) => ({ user_id: userId, trigger_when: s.when, instruction: s.instruction }));
      const { data: inserted } = await supabase.from("sop_items").insert(sopRows).select();
      set({
        dataLoaded: true,
        programmes: (programmes || []).map(mapProgramme),
        projects: (projects || []).map(mapProject),
        workPackages: (workPackages || []).map(mapWP),
        actions: (actions || []).map(mapAction),
        waitingItems: (waitingItems || []).map(mapWaiting),
        inboxItems: (inboxItems || []).map(mapInbox),
        sopItems: (inserted || []).map(mapSOP),
      });
    } else {
      set({
        dataLoaded: true,
        programmes: (programmes || []).map(mapProgramme),
        projects: (projects || []).map(mapProject),
        workPackages: (workPackages || []).map(mapWP),
        actions: (actions || []).map(mapAction),
        waitingItems: (waitingItems || []).map(mapWaiting),
        inboxItems: (inboxItems || []).map(mapInbox),
        sopItems: mappedSOP,
      });
    }
  },

  // --- Programmes ---
  addProgramme: (p) => {
    set((s) => ({ programmes: [...s.programmes, p] }));
    runWriteWithUid(
      "Programme could not be saved",
      (uid) => supabase.from("programmes").insert({ id: p.id, user_id: uid, name: p.name, description: p.description }),
      () => set((s) => ({ programmes: s.programmes.filter((x) => x.id !== p.id) })),
    );
  },
  updateProgramme: (id, updates) => {
    set((s) => ({ programmes: s.programmes.map((p) => (p.id === id ? { ...p, ...updates } : p)) }));
    runWrite(
      "Programme update could not be saved",
      supabase.from("programmes").update(buildDbUpdate(updates, programmeFields)).eq("id", id),
    );
  },
  deleteProgramme: (id) => {
    const before = get().programmes.find((p) => p.id === id);
    const affectedProjects = get().projects.filter((p) => p.programmeId === id);
    set((s) => ({
      programmes: s.programmes.filter((p) => p.id !== id),
      projects: s.projects.map((p) => p.programmeId === id ? { ...p, programmeId: "" } : p),
    }));
    runWrite(
      "Programme could not be deleted",
      supabase.from("programmes").delete().eq("id", id),
      before
        ? () => set((s) => ({
            programmes: [...s.programmes, before],
            projects: s.projects.map((p) => affectedProjects.some((ap) => ap.id === p.id) ? { ...p, programmeId: id } : p),
          }))
        : undefined,
    );
    if (affectedProjects.length > 0) {
      runWrite(
        "Project unlink could not be saved",
        supabase.from("projects").update({ programme_id: "" }).eq("programme_id", id),
      );
    }
  },

  // --- Projects ---
  addProject: (p) => {
    set((s) => ({ projects: [...s.projects, p] }));
    runWriteWithUid(
      "Project could not be saved",
      (uid) => supabase.from("projects").insert({ id: p.id, user_id: uid, name: p.name, description: p.description, programme_id: p.programmeId, status: p.status }),
      () => set((s) => ({ projects: s.projects.filter((x) => x.id !== p.id) })),
    );
  },
  updateProject: (id, updates) => {
    const before = get().projects.find((p) => p.id === id);
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)) }));
    runWrite(
      "Project update could not be saved",
      supabase.from("projects").update(buildDbUpdate(updates, projectFields)).eq("id", id),
    );
    if (updates.name !== undefined && before && updates.name !== before.name) {
      propagateProjectRename(before.name, updates.name, set);
    }
  },
  deleteProject: (id) => {
    const before = get().projects.find((p) => p.id === id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
    runWrite(
      "Project could not be deleted",
      supabase.from("projects").delete().eq("id", id),
      before ? () => set((s) => ({ projects: [...s.projects, before] })) : undefined,
    );
    if (before) {
      cascadeProjectDelete(before.name, set);
    }
  },

  // --- Actions ---
  addAction: (action) => {
    set((s) => ({ actions: [...s.actions, action] }));
    persistAction(action).catch((error) => {
      set((s) => ({ actions: s.actions.filter((a) => a.id !== action.id) }));
      notifySaveError("Action could not be saved", error);
    });
  },
  updateAction: (id, updates) => {
    // Track completed_at when status changes to Complete
    const currentAction = get().actions.find((a) => a.id === id);
    const patch: Partial<Action> & { completedAt?: string | null } = { ...updates };
    if (updates.status === "Complete" && currentAction?.status !== "Complete") {
      patch.completedAt = new Date().toISOString();
    } else if (updates.status && updates.status !== "Complete") {
      patch.completedAt = null;
    }
    set((s) => ({ actions: s.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
    runWrite(
      "Action update could not be saved",
      supabase.from("actions").update(buildDbUpdate(patch, actionFields)).eq("id", id),
    );
  },
  deleteAction: (id) => {
    const before = get().actions.find((a) => a.id === id);
    set((s) => ({ actions: s.actions.filter((a) => a.id !== id) }));
    runWrite(
      "Action could not be deleted",
      supabase.from("actions").delete().eq("id", id),
      before ? () => set((s) => ({ actions: [...s.actions, before] })) : undefined,
    );
  },
  bulkUpdateActions: (ids, updates) => {
    set((s) => ({ actions: s.actions.map((a) => (ids.includes(a.id) ? { ...a, ...updates } : a)) }));
    runWrite(
      "Bulk action update could not be saved",
      supabase.from("actions").update(buildDbUpdate(updates, actionFields)).in("id", ids),
    );
  },
  bulkDeleteActions: (ids) => {
    const before = get().actions.filter((a) => ids.includes(a.id));
    set((s) => ({ actions: s.actions.filter((a) => !ids.includes(a.id)) }));
    runWrite(
      "Bulk action delete could not be saved",
      supabase.from("actions").delete().in("id", ids),
      before.length > 0 ? () => set((s) => ({ actions: [...s.actions, ...before] })) : undefined,
    );
  },

  // --- Work Packages ---
  addWorkPackage: (wp) => {
    set((s) => ({ workPackages: [...s.workPackages, wp] }));
    runWriteWithUid(
      "Work package could not be saved",
      (uid) => supabase.from("work_packages").insert({
        id: wp.id,
        user_id: uid,
        project: wp.project,
        work_package: wp.workPackage,
        wp_lead: wp.wpLead,
        start_date: wp.startDate,
        due_date: wp.dueDate,
        rag_status: wp.ragStatus,
        blockers: wp.blockers,
        dependencies: wp.dependencies as any,
      }),
      () => set((s) => ({ workPackages: s.workPackages.filter((x) => x.id !== wp.id) })),
    );
  },
  updateWorkPackage: (id, updates) => {
    const before = get().workPackages.find((wp) => wp.id === id);
    set((s) => ({ workPackages: s.workPackages.map((wp) => (wp.id === id ? { ...wp, ...updates } : wp)) }));
    runWrite(
      "Work package update could not be saved",
      supabase.from("work_packages").update(buildDbUpdate(updates, workPackageFields)).eq("id", id),
    );
    if (
      updates.workPackage !== undefined &&
      before &&
      updates.workPackage !== before.workPackage
    ) {
      // Use the (possibly new) project as the scope, so a simultaneous WP-name
      // and project change still resolves to the right row set.
      const projectScope = updates.project ?? before.project;
      propagateWPRename(projectScope, before.workPackage, updates.workPackage, set);
    }
  },
  deleteWorkPackage: (id) => {
    const before = get().workPackages.find((wp) => wp.id === id);
    set((s) => ({ workPackages: s.workPackages.filter((wp) => wp.id !== id) }));
    runWrite(
      "Work package could not be deleted",
      supabase.from("work_packages").delete().eq("id", id),
      before ? () => set((s) => ({ workPackages: [...s.workPackages, before] })) : undefined,
    );
    if (before) {
      cascadeWPDelete(before.project, before.workPackage, set);
    }
  },

  // --- Waiting Items ---
  addWaitingItem: (item) => {
    set((s) => ({ waitingItems: [...s.waitingItems, item] }));
    runWriteWithUid(
      "Waiting item could not be saved",
      (uid) => supabase.from("waiting_items").insert({
        id: item.id,
        user_id: uid,
        description: item.description,
        from_whom: item.fromWhom,
        project_wp: item.projectWP,
        asked_on: item.askedOn,
        due_by: item.dueBy,
        status: item.status,
        notes: item.notes,
        linked_project_id: item.linkedProjectId || null,
      } as any),
      () => set((s) => ({ waitingItems: s.waitingItems.filter((x) => x.id !== item.id) })),
    );
  },
  updateWaitingItem: (id, updates) => {
    set((s) => ({ waitingItems: s.waitingItems.map((w) => (w.id === id ? { ...w, ...updates } : w)) }));
    // linked_project_id needs the empty-string-to-null coercion preserved
    const dbUpdate = buildDbUpdate(updates, waitingFields);
    if ("linked_project_id" in dbUpdate && !dbUpdate.linked_project_id) {
      dbUpdate.linked_project_id = null;
    }
    runWrite(
      "Waiting item update could not be saved",
      supabase.from("waiting_items").update(dbUpdate).eq("id", id),
    );
  },
  deleteWaitingItem: (id) => {
    const before = get().waitingItems.find((w) => w.id === id);
    set((s) => ({ waitingItems: s.waitingItems.filter((w) => w.id !== id) }));
    runWrite(
      "Waiting item could not be deleted",
      supabase.from("waiting_items").delete().eq("id", id),
      before ? () => set((s) => ({ waitingItems: [...s.waitingItems, before] })) : undefined,
    );
  },

  // --- Inbox Items ---
  addInboxItem: (item) => {
    set((s) => ({ inboxItems: [...s.inboxItems, item] }));
    runWriteWithUid(
      "Inbox item could not be saved",
      (uid) => supabase.from("inbox_items").insert({
        id: item.id,
        user_id: uid,
        task: item.task,
        priority: item.priority,
        due_date: item.dueDate,
        project: item.project,
        notes: item.notes,
        source: item.source,
      }),
      () => set((s) => ({ inboxItems: s.inboxItems.filter((x) => x.id !== item.id) })),
    );
  },
  addInboxItems: (items) => {
    set((s) => ({ inboxItems: [...s.inboxItems, ...items] }));
    const newIds = items.map((i) => i.id);
    runWriteWithUid(
      "Inbox items could not be saved",
      (uid) => supabase.from("inbox_items").insert(items.map((i) => ({
        id: i.id,
        user_id: uid,
        task: i.task,
        priority: i.priority,
        due_date: i.dueDate,
        project: i.project,
        notes: i.notes,
        source: i.source,
      }))),
      () => set((s) => ({ inboxItems: s.inboxItems.filter((x) => !newIds.includes(x.id)) })),
    );
  },
  updateInboxItem: (id, updates) => {
    set((s) => ({ inboxItems: s.inboxItems.map((i) => (i.id === id ? { ...i, ...updates } : i)) }));
    runWrite(
      "Inbox update could not be saved",
      supabase.from("inbox_items").update(buildDbUpdate(updates, inboxFields)).eq("id", id),
    );
  },
  bulkUpdateInboxItems: (ids, updates) => {
    set((s) => ({ inboxItems: s.inboxItems.map((i) => (ids.includes(i.id) ? { ...i, ...updates } : i)) }));
    runWrite(
      "Bulk inbox update could not be saved",
      supabase.from("inbox_items").update(buildDbUpdate(updates, inboxFields)).in("id", ids),
    );
  },
  deleteInboxItem: (id) => {
    const before = get().inboxItems.find((i) => i.id === id);
    set((s) => ({ inboxItems: s.inboxItems.filter((i) => i.id !== id) }));
    runWrite(
      "Inbox item could not be deleted",
      supabase.from("inbox_items").delete().eq("id", id),
      before ? () => set((s) => ({ inboxItems: [...s.inboxItems, before] })) : undefined,
    );
    if (before) {
      runWriteWithUid(
        "Inbox event log failed",
        (uid) => supabase.from("inbox_item_events").insert({
          inbox_item_id: id,
          event: "deleted",
          user_id: uid,
          source: before.source || "",
          created_at_snapshot: before.createdAt,
        } as any),
      );
    }
  },
  bulkDeleteInboxItems: (ids) => {
    const before = get().inboxItems.filter((i) => ids.includes(i.id));
    set((s) => ({ inboxItems: s.inboxItems.filter((i) => !ids.includes(i.id)) }));
    runWrite(
      "Bulk inbox delete could not be saved",
      supabase.from("inbox_items").delete().in("id", ids),
      before.length > 0 ? () => set((s) => ({ inboxItems: [...s.inboxItems, ...before] })) : undefined,
    );
    if (before.length > 0) {
      runWriteWithUid(
        "Inbox event log failed",
        (uid) => supabase.from("inbox_item_events").insert(
          before.map((i) => ({
            inbox_item_id: i.id,
            event: "deleted" as const,
            user_id: uid,
            source: i.source || "",
            created_at_snapshot: i.createdAt,
          })) as any,
        ),
      );
    }
  },
  promoteInboxToActions: (ids) => {
    const s = get();
    const toPromote = s.inboxItems.filter((i) => ids.includes(i.id));
    const newActions: Action[] = toPromote.map((i) => ({
      id: crypto.randomUUID(),
      task: i.task,
      project: i.project,
      workPackage: "",
      startDate: "",
      dueDate: i.dueDate,
      priority: i.priority,
      status: "Not Started" as const,
      notes: i.notes,
      labels: [],
    }));
    set({
      inboxItems: s.inboxItems.filter((i) => !ids.includes(i.id)),
      actions: [...s.actions, ...newActions],
    });
    // Two writes: delete the inbox rows, then insert the new actions. If the
    // action insert fails we roll back both local state and (best-effort) the
    // inbox delete by reinserting the rows.
    runWrite(
      "Inbox cleanup could not be saved",
      supabase.from("inbox_items").delete().in("id", ids),
    );
    getUserId().then(async (uid) => {
      const rows = newActions.map((a) => ({ id: a.id, user_id: uid, task: a.task, project: a.project, work_package: a.workPackage, start_date: a.startDate, due_date: a.dueDate, priority: a.priority, status: a.status, notes: a.notes }));
      const { error } = await supabase.from("actions").insert(rows);
      if (error) throw error;
      // Log inbox promotion events
      if (toPromote.length) {
        const eventRows = toPromote.map((i) => ({ inbox_item_id: i.id, event: "promoted" as const, user_id: uid, source: i.source || "", created_at_snapshot: i.createdAt }));
        supabase.from("inbox_item_events").insert(eventRows as any).then(({ error: evErr }) => {
          if (evErr) console.error("inbox promotion event log failed", evErr);
        });
      }
    }).catch((error) => {
      set((state) => ({ actions: state.actions.filter((a) => !newActions.some((na) => na.id === a.id)) }));
      notifySaveError("Promoted actions could not be saved", error);
    });
  },

  bulkAddActions: (actions) => {
    set((s) => ({ actions: [...s.actions, ...actions] }));
    getUserId().then(async (uid) => {
      const rows = actions.map((a) => ({
        id: a.id, user_id: uid, task: a.task, project: a.project,
        work_package: a.workPackage, start_date: a.startDate, due_date: a.dueDate,
        priority: a.priority, status: a.status, notes: a.notes, labels: a.labels ?? [],
      }));
      const { error } = await supabase.from("actions").insert(rows);
      if (error) throw error;
    }).catch((error) => {
      set((state) => ({ actions: state.actions.filter((a) => !actions.some((na) => na.id === a.id)) }));
      notifySaveError("Actions could not be saved", error);
    });
  },
  updateSOPItem: (id, updates) => {
    set((s) => ({ sopItems: s.sopItems.map((item) => (item.id === id ? { ...item, ...updates } : item)) }));
    runWrite(
      "SOP update could not be saved",
      supabase.from("sop_items").update(buildDbUpdate(updates, sopFields)).eq("id", id),
    );
  },
  addSOPItem: (item) => {
    set((s) => ({ sopItems: [...s.sopItems, item] }));
    runWriteWithUid(
      "SOP item could not be saved",
      (uid) => supabase.from("sop_items").insert({ id: item.id, user_id: uid, trigger_when: item.when, instruction: item.instruction }),
      () => set((s) => ({ sopItems: s.sopItems.filter((x) => x.id !== item.id) })),
    );
  },
  deleteSOPItem: (id) => {
    const before = get().sopItems.find((item) => item.id === id);
    set((s) => ({ sopItems: s.sopItems.filter((item) => item.id !== id) }));
    runWrite(
      "SOP item could not be deleted",
      supabase.from("sop_items").delete().eq("id", id),
      before ? () => set((s) => ({ sopItems: [...s.sopItems, before] })) : undefined,
    );
  },

  // --- Cross-entity operations ---
  delegateAction: (id, toWhom) => {
    const s = get();
    const action = s.actions.find((a) => a.id === id);
    if (!action) return;
    const newWaiting: WaitingItem = {
      id: crypto.randomUUID(),
      description: action.task,
      fromWhom: toWhom,
      projectWP: [action.project, action.workPackage].filter(Boolean).join(" / "),
      askedOn: new Date().toISOString().split("T")[0],
      dueBy: action.dueDate,
      status: "Pending",
      notes: action.notes,
    };
    set({
      actions: s.actions.filter((a) => a.id !== id),
      waitingItems: [...s.waitingItems, newWaiting],
    });
    runWrite(
      "Delegation (action delete) could not be saved",
      supabase.from("actions").delete().eq("id", id),
      () => set((state) => ({ actions: [...state.actions, action] })),
    );
    runWriteWithUid(
      "Delegation (waiting insert) could not be saved",
      (uid) => supabase.from("waiting_items").insert({
        id: newWaiting.id,
        user_id: uid,
        description: newWaiting.description,
        from_whom: newWaiting.fromWhom,
        project_wp: newWaiting.projectWP,
        asked_on: newWaiting.askedOn,
        due_by: newWaiting.dueBy,
        status: newWaiting.status,
        notes: newWaiting.notes,
      }),
      () => set((state) => ({ waitingItems: state.waitingItems.filter((w) => w.id !== newWaiting.id) })),
    );
  },

  takeBackWaiting: (id) => {
    const s = get();
    const item = s.waitingItems.find((w) => w.id === id);
    if (!item) return;
    const newAction: Action = {
      id: crypto.randomUUID(),
      task: item.description,
      project: item.projectWP.split(" / ")[0] ?? "",
      workPackage: item.projectWP.split(" / ")[1] ?? "",
      startDate: "",
      dueDate: item.dueBy,
      priority: "Medium",
      status: "Not Started",
      notes: item.notes,
      labels: [],
    };
    set({
      waitingItems: s.waitingItems.filter((w) => w.id !== id),
      actions: [...s.actions, newAction],
    });
    runWrite(
      "Take-back (waiting delete) could not be saved",
      supabase.from("waiting_items").delete().eq("id", id),
      () => set((state) => ({ waitingItems: [...state.waitingItems, item] })),
    );
    persistAction(newAction).catch((error) => {
      set((state) => ({ actions: state.actions.filter((a) => a.id !== newAction.id) }));
      notifySaveError("Action could not be saved", error);
    });
  },
}));
