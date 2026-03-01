import { create } from "zustand";
import { Action, WaitingItem, WorkPackage } from "./types";
import { actions as initialActions, waitingItems as initialWaiting, workPackages as initialWP } from "./data";

interface AppState {
  workPackages: WorkPackage[];
  actions: Action[];
  waitingItems: WaitingItem[];
  updateAction: (id: string, updates: Partial<Action>) => void;
  updateWorkPackage: (id: string, updates: Partial<WorkPackage>) => void;
  updateWaitingItem: (id: string, updates: Partial<WaitingItem>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  workPackages: initialWP,
  actions: initialActions,
  waitingItems: initialWaiting,
  updateAction: (id, updates) =>
    set((s) => ({
      actions: s.actions.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  updateWorkPackage: (id, updates) =>
    set((s) => ({
      workPackages: s.workPackages.map((wp) => (wp.id === id ? { ...wp, ...updates } : wp)),
    })),
  updateWaitingItem: (id, updates) =>
    set((s) => ({
      waitingItems: s.waitingItems.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    })),
}));
