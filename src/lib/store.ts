import { create } from "zustand";
import { Action, Project, WaitingItem, WorkPackage } from "./types";
import { actions as initialActions, waitingItems as initialWaiting, workPackages as initialWP, projects as initialProjects } from "./data";

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

interface AppState {
  projects: Project[];
  workPackages: WorkPackage[];
  actions: Action[];
  waitingItems: WaitingItem[];
  sopItems: SOPItem[];
  addProject: (p: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addAction: (action: Action) => void;
  updateAction: (id: string, updates: Partial<Action>) => void;
  deleteAction: (id: string) => void;
  addWorkPackage: (wp: WorkPackage) => void;
  updateWorkPackage: (id: string, updates: Partial<WorkPackage>) => void;
  deleteWorkPackage: (id: string) => void;
  addWaitingItem: (item: WaitingItem) => void;
  updateWaitingItem: (id: string, updates: Partial<WaitingItem>) => void;
  deleteWaitingItem: (id: string) => void;
  updateSOPItem: (id: string, updates: Partial<SOPItem>) => void;
  addSOPItem: (item: SOPItem) => void;
  deleteSOPItem: (id: string) => void;
  delegateAction: (id: string, toWhom: string) => void;
  takeBackWaiting: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  projects: initialProjects,
  workPackages: initialWP,
  actions: initialActions,
  waitingItems: initialWaiting,
  sopItems: defaultSOP,

  addProject: (p) => set((s) => ({ projects: [...s.projects, p] })),
  updateProject: (id, updates) =>
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
  deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

  addAction: (action) => set((s) => ({ actions: [...s.actions, action] })),
  updateAction: (id, updates) =>
    set((s) => ({ actions: s.actions.map((a) => (a.id === id ? { ...a, ...updates } : a)) })),
  deleteAction: (id) => set((s) => ({ actions: s.actions.filter((a) => a.id !== id) })),

  addWorkPackage: (wp) => set((s) => ({ workPackages: [...s.workPackages, wp] })),
  updateWorkPackage: (id, updates) =>
    set((s) => ({ workPackages: s.workPackages.map((wp) => (wp.id === id ? { ...wp, ...updates } : wp)) })),
  deleteWorkPackage: (id) => set((s) => ({ workPackages: s.workPackages.filter((wp) => wp.id !== id) })),

  addWaitingItem: (item) => set((s) => ({ waitingItems: [...s.waitingItems, item] })),
  updateWaitingItem: (id, updates) =>
    set((s) => ({ waitingItems: s.waitingItems.map((w) => (w.id === id ? { ...w, ...updates } : w)) })),
  deleteWaitingItem: (id) => set((s) => ({ waitingItems: s.waitingItems.filter((w) => w.id !== id) })),

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
}));
