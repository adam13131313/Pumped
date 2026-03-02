import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Action, InboxItem, Programme, Project, WaitingItem, WorkPackage } from "./types";
import { actions as initialActions, waitingItems as initialWaiting, workPackages as initialWP, projects as initialProjects, programmes as initialProgrammes } from "./data";

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
  todayIds: Set<string>;
  addToday: (id: string) => void;
  removeToday: (id: string) => void;
  clearToday: () => void;
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
  updateSOPItem: (id: string, updates: Partial<SOPItem>) => void;
  addSOPItem: (item: SOPItem) => void;
  deleteSOPItem: (id: string) => void;
  delegateAction: (id: string, toWhom: string) => void;
  takeBackWaiting: (id: string) => void;
}

const defaultGlobalFilter: GlobalFilter = { programmeId: "", projectId: "", workPackageId: "" };

export const useAppStore = create<AppState>()(persist((set) => ({
  todayIds: new Set<string>(),
  addToday: (id) => set((s) => { const n = new Set(s.todayIds); n.add(id); return { todayIds: n }; }),
  removeToday: (id) => set((s) => { const n = new Set(s.todayIds); n.delete(id); return { todayIds: n }; }),
  clearToday: () => set({ todayIds: new Set() }),

  globalFilter: defaultGlobalFilter,
  setGlobalFilter: (filter) => set({ globalFilter: filter }),
  clearGlobalFilter: () => set({ globalFilter: defaultGlobalFilter }),

  programmes: initialProgrammes,
  projects: initialProjects,
  workPackages: initialWP,
  actions: initialActions,
  waitingItems: initialWaiting,
  inboxItems: [],
  sopItems: defaultSOP,

  addProgramme: (p) => set((s) => ({ programmes: [...s.programmes, p] })),
  updateProgramme: (id, updates) =>
    set((s) => ({ programmes: s.programmes.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
  deleteProgramme: (id) => set((s) => ({
    programmes: s.programmes.filter((p) => p.id !== id),
    projects: s.projects.map((p) => p.programmeId === id ? { ...p, programmeId: "" } : p),
  })),

  addProject: (p) => set((s) => ({ projects: [...s.projects, p] })),
  updateProject: (id, updates) =>
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
  deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

  addAction: (action) => set((s) => ({ actions: [...s.actions, action] })),
  updateAction: (id, updates) =>
    set((s) => ({ actions: s.actions.map((a) => (a.id === id ? { ...a, ...updates } : a)) })),
  deleteAction: (id) => set((s) => ({ actions: s.actions.filter((a) => a.id !== id) })),
  bulkUpdateActions: (ids, updates) =>
    set((s) => ({ actions: s.actions.map((a) => (ids.includes(a.id) ? { ...a, ...updates } : a)) })),
  bulkDeleteActions: (ids) =>
    set((s) => ({ actions: s.actions.filter((a) => !ids.includes(a.id)) })),

  addWorkPackage: (wp) => set((s) => ({ workPackages: [...s.workPackages, wp] })),
  updateWorkPackage: (id, updates) =>
    set((s) => ({ workPackages: s.workPackages.map((wp) => (wp.id === id ? { ...wp, ...updates } : wp)) })),
  deleteWorkPackage: (id) => set((s) => ({ workPackages: s.workPackages.filter((wp) => wp.id !== id) })),

  addWaitingItem: (item) => set((s) => ({ waitingItems: [...s.waitingItems, item] })),
  updateWaitingItem: (id, updates) =>
    set((s) => ({ waitingItems: s.waitingItems.map((w) => (w.id === id ? { ...w, ...updates } : w)) })),
  deleteWaitingItem: (id) => set((s) => ({ waitingItems: s.waitingItems.filter((w) => w.id !== id) })),

  addInboxItem: (item) => set((s) => ({ inboxItems: [...s.inboxItems, item] })),
  addInboxItems: (items) => set((s) => ({ inboxItems: [...s.inboxItems, ...items] })),
  updateInboxItem: (id, updates) =>
    set((s) => ({ inboxItems: s.inboxItems.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),
  deleteInboxItem: (id) => set((s) => ({ inboxItems: s.inboxItems.filter((i) => i.id !== id) })),
  bulkDeleteInboxItems: (ids) =>
    set((s) => ({ inboxItems: s.inboxItems.filter((i) => !ids.includes(i.id)) })),
  promoteInboxToActions: (ids) =>
    set((s) => {
      const toPromote = s.inboxItems.filter((i) => ids.includes(i.id));
      const newActions: Action[] = toPromote.map((i) => ({
        id: crypto.randomUUID(),
        task: i.task,
        project: i.project,
        workPackage: "",
        dueDate: i.dueDate,
        priority: i.priority,
        status: "Not Started" as const,
        notes: i.notes,
      }));
      return {
        inboxItems: s.inboxItems.filter((i) => !ids.includes(i.id)),
        actions: [...s.actions, ...newActions],
      };
    }),

  updateSOPItem: (id, updates) =>
    set((s) => ({ sopItems: s.sopItems.map((item) => (item.id === id ? { ...item, ...updates } : item)) })),
  addSOPItem: (item) => set((s) => ({ sopItems: [...s.sopItems, item] })),
  deleteSOPItem: (id) => set((s) => ({ sopItems: s.sopItems.filter((item) => item.id !== id) })),

  delegateAction: (id, toWhom) =>
    set((s) => {
      const action = s.actions.find((a) => a.id === id);
      if (!action) return s;
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
      return {
        actions: s.actions.filter((a) => a.id !== id),
        waitingItems: [...s.waitingItems, newWaiting],
      };
    }),

  takeBackWaiting: (id) =>
    set((s) => {
      const item = s.waitingItems.find((w) => w.id === id);
      if (!item) return s;
      const newAction: Action = {
        id: crypto.randomUUID(),
        task: item.description,
        project: item.projectWP.split(" / ")[0] ?? "",
        workPackage: item.projectWP.split(" / ")[1] ?? "",
        dueDate: item.dueBy,
        priority: "Medium",
        status: "Not Started",
        notes: item.notes,
      };
      return {
        waitingItems: s.waitingItems.filter((w) => w.id !== id),
        actions: [...s.actions, newAction],
      };
    }),
}), {
  name: "app-store",
  partialize: (state) => ({
    programmes: state.programmes,
    projects: state.projects,
    workPackages: state.workPackages,
    actions: state.actions,
    waitingItems: state.waitingItems,
    inboxItems: state.inboxItems,
    sopItems: state.sopItems,
  }),
}));
