import { create } from "zustand";
import { Action, InboxItem, Programme, Project, WaitingItem, WorkPackage } from "./types";
import { supabase } from "@/integrations/supabase/client";

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

const defaultGlobalFilter: GlobalFilter = { programmeId: "", projectId: "", workPackageId: "" };

// Helper to get current user id
async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// Persist today's focus data to localStorage (keyed by date so it resets daily)
const TODAY_KEY = () => `p3m-today-${new Date().toISOString().slice(0, 10)}`;

function saveTodayState(todayIds: Set<string>, scheduleMap: Record<string, number>, durationMap: Record<string, number>, todayOrder: string[]) {
  try {
    localStorage.setItem(TODAY_KEY(), JSON.stringify({
      ids: Array.from(todayIds),
      schedule: scheduleMap,
      durations: durationMap,
      order: todayOrder,
    }));
  } catch {}
}

function loadTodayState(): { todayIds: Set<string>; scheduleMap: Record<string, number>; durationMap: Record<string, number>; todayOrder: string[] } {
  try {
    const raw = localStorage.getItem(TODAY_KEY());
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
    // Backfill completed_at for any Complete tasks missing it, then archive
    await supabase.from("actions")
      .update({ completed_at: new Date().toISOString() } as any)
      .eq("status", "Complete")
      .is("completed_at", null);

    // Auto-archive actions completed more than 24 hours ago
    const archiveCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("actions")
      .update({ archived: true } as any)
      .eq("archived", false)
      .eq("status", "Complete")
      .not("completed_at", "is", null)
      .lt("completed_at", archiveCutoff);

    const [
      { data: programmes },
      { data: projects },
      { data: workPackages },
      { data: actions },
      { data: waitingItems },
      { data: inboxItems },
      { data: sopItems },
    ] = await Promise.all([
      supabase.from("programmes").select("*"),
      supabase.from("projects").select("*"),
      supabase.from("work_packages").select("*"),
      supabase.from("actions").select("*").eq("archived", false),
      supabase.from("waiting_items").select("*"),
      supabase.from("inbox_items").select("*"),
      supabase.from("sop_items").select("*"),
    ]);

    const mapProgramme = (r: any): Programme => ({ id: r.id, name: r.name, description: r.description });
    const mapProject = (r: any): Project => ({ id: r.id, name: r.name, description: r.description, programmeId: r.programme_id, status: r.status });
    const mapWP = (r: any): WorkPackage => ({ id: r.id, project: r.project, workPackage: r.work_package, wpLead: r.wp_lead, startDate: r.start_date, dueDate: r.due_date, ragStatus: r.rag_status, blockers: r.blockers, dependencies: r.dependencies || [] });
    const mapAction = (r: any): Action => ({ id: r.id, task: r.task, project: r.project, workPackage: r.work_package, startDate: r.start_date, dueDate: r.due_date, priority: r.priority, status: r.status, notes: r.notes, completedAt: r.completed_at || undefined, labels: r.labels || [] });
    const mapWaiting = (r: any): WaitingItem => ({ id: r.id, description: r.description, fromWhom: r.from_whom, projectWP: r.project_wp, askedOn: r.asked_on, dueBy: r.due_by, status: r.status, notes: r.notes });
    const mapInbox = (r: any): InboxItem => ({ id: r.id, task: r.task, priority: r.priority, dueDate: r.due_date, project: r.project, notes: r.notes, source: r.source, createdAt: r.created_at });
    const mapSOP = (r: any): SOPItem => ({ id: r.id, when: r.trigger_when, instruction: r.instruction });

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
    getUserId().then((uid) => supabase.from("programmes").insert({ id: p.id, user_id: uid, name: p.name, description: p.description }).then());
  },
  updateProgramme: (id, updates) => {
    set((s) => ({ programmes: s.programmes.map((p) => (p.id === id ? { ...p, ...updates } : p)) }));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    supabase.from("programmes").update(dbUpdates).eq("id", id).then();
  },
  deleteProgramme: (id) => {
    set((s) => ({
      programmes: s.programmes.filter((p) => p.id !== id),
      projects: s.projects.map((p) => p.programmeId === id ? { ...p, programmeId: "" } : p),
    }));
    supabase.from("programmes").delete().eq("id", id).then();
    supabase.from("projects").update({ programme_id: "" }).eq("programme_id", id).then();
  },

  // --- Projects ---
  addProject: (p) => {
    set((s) => ({ projects: [...s.projects, p] }));
    getUserId().then((uid) => supabase.from("projects").insert({ id: p.id, user_id: uid, name: p.name, description: p.description, programme_id: p.programmeId, status: p.status }).then());
  },
  updateProject: (id, updates) => {
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)) }));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.programmeId !== undefined) dbUpdates.programme_id = updates.programmeId;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    supabase.from("projects").update(dbUpdates).eq("id", id).then();
  },
  deleteProject: (id) => {
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
    supabase.from("projects").delete().eq("id", id).then();
  },

  // --- Actions ---
  addAction: (action) => {
    set((s) => ({ actions: [...s.actions, action] }));
    getUserId().then((uid) => supabase.from("actions").insert({ id: action.id, user_id: uid, task: action.task, project: action.project, work_package: action.workPackage, start_date: action.startDate, due_date: action.dueDate, priority: action.priority, status: action.status, notes: action.notes, labels: action.labels || [] }).then());
  },
  updateAction: (id, updates) => {
    // Track completed_at when status changes to Complete
    const currentAction = get().actions.find((a) => a.id === id);
    if (updates.status === "Complete" && currentAction?.status !== "Complete") {
      (updates as any).completedAt = new Date().toISOString();
    } else if (updates.status && updates.status !== "Complete") {
      (updates as any).completedAt = null;
    }
    set((s) => ({ actions: s.actions.map((a) => (a.id === id ? { ...a, ...updates } : a)) }));
    const dbUpdates: any = {};
    if (updates.task !== undefined) dbUpdates.task = updates.task;
    if (updates.project !== undefined) dbUpdates.project = updates.project;
    if (updates.workPackage !== undefined) dbUpdates.work_package = updates.workPackage;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.labels !== undefined) dbUpdates.labels = updates.labels;
    if ((updates as any).completedAt !== undefined) dbUpdates.completed_at = (updates as any).completedAt;
    supabase.from("actions").update(dbUpdates).eq("id", id).then();
  },
  deleteAction: (id) => {
    set((s) => ({ actions: s.actions.filter((a) => a.id !== id) }));
    supabase.from("actions").delete().eq("id", id).then();
  },
  bulkUpdateActions: (ids, updates) => {
    set((s) => ({ actions: s.actions.map((a) => (ids.includes(a.id) ? { ...a, ...updates } : a)) }));
    const dbUpdates: any = {};
    if (updates.task !== undefined) dbUpdates.task = updates.task;
    if (updates.project !== undefined) dbUpdates.project = updates.project;
    if (updates.workPackage !== undefined) dbUpdates.work_package = updates.workPackage;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    ids.forEach((id) => supabase.from("actions").update(dbUpdates).eq("id", id).then());
  },
  bulkDeleteActions: (ids) => {
    set((s) => ({ actions: s.actions.filter((a) => !ids.includes(a.id)) }));
    supabase.from("actions").delete().in("id", ids).then();
  },

  // --- Work Packages ---
  addWorkPackage: (wp) => {
    set((s) => ({ workPackages: [...s.workPackages, wp] }));
    getUserId().then((uid) => supabase.from("work_packages").insert({ id: wp.id, user_id: uid, project: wp.project, work_package: wp.workPackage, wp_lead: wp.wpLead, start_date: wp.startDate, due_date: wp.dueDate, rag_status: wp.ragStatus, blockers: wp.blockers, dependencies: wp.dependencies as any }).then());
  },
  updateWorkPackage: (id, updates) => {
    set((s) => ({ workPackages: s.workPackages.map((wp) => (wp.id === id ? { ...wp, ...updates } : wp)) }));
    const dbUpdates: any = {};
    if (updates.project !== undefined) dbUpdates.project = updates.project;
    if (updates.workPackage !== undefined) dbUpdates.work_package = updates.workPackage;
    if (updates.wpLead !== undefined) dbUpdates.wp_lead = updates.wpLead;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.ragStatus !== undefined) dbUpdates.rag_status = updates.ragStatus;
    if (updates.blockers !== undefined) dbUpdates.blockers = updates.blockers;
    if (updates.dependencies !== undefined) dbUpdates.dependencies = updates.dependencies;
    supabase.from("work_packages").update(dbUpdates).eq("id", id).then();
  },
  deleteWorkPackage: (id) => {
    set((s) => ({ workPackages: s.workPackages.filter((wp) => wp.id !== id) }));
    supabase.from("work_packages").delete().eq("id", id).then();
  },

  // --- Waiting Items ---
  addWaitingItem: (item) => {
    set((s) => ({ waitingItems: [...s.waitingItems, item] }));
    getUserId().then((uid) => supabase.from("waiting_items").insert({ id: item.id, user_id: uid, description: item.description, from_whom: item.fromWhom, project_wp: item.projectWP, asked_on: item.askedOn, due_by: item.dueBy, status: item.status, notes: item.notes }).then());
  },
  updateWaitingItem: (id, updates) => {
    set((s) => ({ waitingItems: s.waitingItems.map((w) => (w.id === id ? { ...w, ...updates } : w)) }));
    const dbUpdates: any = {};
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.fromWhom !== undefined) dbUpdates.from_whom = updates.fromWhom;
    if (updates.projectWP !== undefined) dbUpdates.project_wp = updates.projectWP;
    if (updates.askedOn !== undefined) dbUpdates.asked_on = updates.askedOn;
    if (updates.dueBy !== undefined) dbUpdates.due_by = updates.dueBy;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    supabase.from("waiting_items").update(dbUpdates).eq("id", id).then();
  },
  deleteWaitingItem: (id) => {
    set((s) => ({ waitingItems: s.waitingItems.filter((w) => w.id !== id) }));
    supabase.from("waiting_items").delete().eq("id", id).then();
  },

  // --- Inbox Items ---
  addInboxItem: (item) => {
    set((s) => ({ inboxItems: [...s.inboxItems, item] }));
    getUserId().then((uid) => supabase.from("inbox_items").insert({ id: item.id, user_id: uid, task: item.task, priority: item.priority, due_date: item.dueDate, project: item.project, notes: item.notes, source: item.source }).then());
  },
  addInboxItems: (items) => {
    set((s) => ({ inboxItems: [...s.inboxItems, ...items] }));
    getUserId().then((uid) => {
      const rows = items.map((i) => ({ id: i.id, user_id: uid, task: i.task, priority: i.priority, due_date: i.dueDate, project: i.project, notes: i.notes, source: i.source }));
      supabase.from("inbox_items").insert(rows).then();
    });
  },
  updateInboxItem: (id, updates) => {
    set((s) => ({ inboxItems: s.inboxItems.map((i) => (i.id === id ? { ...i, ...updates } : i)) }));
    const dbUpdates: any = {};
    if (updates.task !== undefined) dbUpdates.task = updates.task;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.project !== undefined) dbUpdates.project = updates.project;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.source !== undefined) dbUpdates.source = updates.source;
    supabase.from("inbox_items").update(dbUpdates).eq("id", id).then();
  },
  deleteInboxItem: (id) => {
    set((s) => ({ inboxItems: s.inboxItems.filter((i) => i.id !== id) }));
    supabase.from("inbox_items").delete().eq("id", id).then();
  },
  bulkDeleteInboxItems: (ids) => {
    set((s) => ({ inboxItems: s.inboxItems.filter((i) => !ids.includes(i.id)) }));
    supabase.from("inbox_items").delete().in("id", ids).then();
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
    // Persist both operations
    supabase.from("inbox_items").delete().in("id", ids).then();
    getUserId().then((uid) => {
      const rows = newActions.map((a) => ({ id: a.id, user_id: uid, task: a.task, project: a.project, work_package: a.workPackage, start_date: a.startDate, due_date: a.dueDate, priority: a.priority, status: a.status, notes: a.notes }));
      supabase.from("actions").insert(rows).then();
    });
  },

  // --- SOP Items ---
  updateSOPItem: (id, updates) => {
    set((s) => ({ sopItems: s.sopItems.map((item) => (item.id === id ? { ...item, ...updates } : item)) }));
    const dbUpdates: any = {};
    if (updates.when !== undefined) dbUpdates.trigger_when = updates.when;
    if (updates.instruction !== undefined) dbUpdates.instruction = updates.instruction;
    supabase.from("sop_items").update(dbUpdates).eq("id", id).then();
  },
  addSOPItem: (item) => {
    set((s) => ({ sopItems: [...s.sopItems, item] }));
    getUserId().then((uid) => supabase.from("sop_items").insert({ id: item.id, user_id: uid, trigger_when: item.when, instruction: item.instruction }).then());
  },
  deleteSOPItem: (id) => {
    set((s) => ({ sopItems: s.sopItems.filter((item) => item.id !== id) }));
    supabase.from("sop_items").delete().eq("id", id).then();
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
    supabase.from("actions").delete().eq("id", id).then();
    getUserId().then((uid) => supabase.from("waiting_items").insert({ id: newWaiting.id, user_id: uid, description: newWaiting.description, from_whom: newWaiting.fromWhom, project_wp: newWaiting.projectWP, asked_on: newWaiting.askedOn, due_by: newWaiting.dueBy, status: newWaiting.status, notes: newWaiting.notes }).then());
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
    supabase.from("waiting_items").delete().eq("id", id).then();
    getUserId().then((uid) => supabase.from("actions").insert({ id: newAction.id, user_id: uid, task: newAction.task, project: newAction.project, work_package: newAction.workPackage, start_date: newAction.startDate, due_date: newAction.dueDate, priority: newAction.priority, status: newAction.status, notes: newAction.notes }).then());
  },
}));
