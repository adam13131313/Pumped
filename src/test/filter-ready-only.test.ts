import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

import { useAppStore } from "@/lib/store";
import { useFilteredData } from "@/hooks/useFilteredData";
import type { Action, ActionDependency } from "@/lib/types";

const ORG = "00000000-0000-0000-0000-000000000000";

function makeAction(id: string, overrides: Partial<Action> = {}): Action {
  const now = new Date().toISOString();
  return {
    id,
    organisationId: ORG,
    wbsNodeId: null,
    assignedTo: null,
    createdBy: null,
    task: `Task ${id}`,
    priority: "medium",
    status: "not_started",
    startDate: null,
    dueDate: null,
    completedAt: null,
    notes: "",
    labels: [],
    notStartedSince: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeDep(sourceId: string, targetId: string): ActionDependency {
  return {
    id: `dep-${sourceId}-${targetId}`,
    organisationId: ORG,
    sourceActionId: sourceId,
    targetActionId: targetId,
    dependencyType: "fs",
    lagDays: 0,
    createdAt: new Date().toISOString(),
  };
}

describe("useFilteredData — readyOnly", () => {
  beforeEach(() => {
    // Reset filter + domain state.
    useAppStore.setState({
      actions: [],
      actionDependencies: [],
      wbsNodes: [],
      waitingItems: [],
      inboxItems: [],
      globalFilter: { nodeId: null, unassigned: false, readyOnly: false },
    });
  });

  it("passes all actions through when readyOnly is off (default)", () => {
    useAppStore.setState({
      actions: [
        makeAction("a"),
        makeAction("b"),
        makeAction("c"),
      ],
    });
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.actions).toHaveLength(3);
  });

  it("hides blocked actions when readyOnly is on", () => {
    const pred = makeAction("pred", { status: "in_progress" });
    const blocked = makeAction("blocked");
    const ready = makeAction("ready");
    useAppStore.setState({
      actions: [pred, blocked, ready],
      actionDependencies: [makeDep("pred", "blocked")],
      globalFilter: { nodeId: null, unassigned: false, readyOnly: true },
    });
    const { result } = renderHook(() => useFilteredData());
    const ids = result.current.actions.map((a) => a.id).sort();
    // 'blocked' is hidden because 'pred' is incomplete. 'pred' and 'ready'
    // both remain (they have no incomplete predecessors).
    expect(ids).toEqual(["pred", "ready"]);
  });

  it("hides future-start actions when readyOnly is on", () => {
    const future = "2099-01-01";
    useAppStore.setState({
      actions: [
        makeAction("today"),
        makeAction("later", { startDate: future }),
      ],
      globalFilter: { nodeId: null, unassigned: false, readyOnly: true },
    });
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.actions.map((a) => a.id)).toEqual(["today"]);
  });

  it("composes with node-scope filter", () => {
    // Two WBS nodes; one action under each; one ready, one blocked.
    useAppStore.setState({
      wbsNodes: [
        {
          id: "n1", organisationId: ORG, parentId: null, nodeType: "project",
          name: "Project A", description: "", position: 0, archivedAt: null,
          projectStatus: "active", leadUserId: null, startDate: null, dueDate: null,
          ragStatus: null, blockers: null, createdBy: null,
          createdAt: "", updatedAt: "",
        },
        {
          id: "n2", organisationId: ORG, parentId: null, nodeType: "project",
          name: "Project B", description: "", position: 1, archivedAt: null,
          projectStatus: "active", leadUserId: null, startDate: null, dueDate: null,
          ragStatus: null, blockers: null, createdBy: null,
          createdAt: "", updatedAt: "",
        },
      ],
      actions: [
        makeAction("a1", { wbsNodeId: "n1" }),
        makeAction("a2", { wbsNodeId: "n2" }), // out of scope
      ],
      globalFilter: { nodeId: "n1", unassigned: false, readyOnly: true },
    });
    const { result } = renderHook(() => useFilteredData());
    expect(result.current.actions.map((a) => a.id)).toEqual(["a1"]);
  });

  it("setGlobalFilter merges partial updates instead of replacing", () => {
    useAppStore.setState({
      globalFilter: { nodeId: "n1", unassigned: false, readyOnly: false },
    });
    useAppStore.getState().setGlobalFilter({ readyOnly: true });
    const f = useAppStore.getState().globalFilter;
    // readyOnly flipped, nodeId preserved.
    expect(f).toEqual({ nodeId: "n1", unassigned: false, readyOnly: true });
  });
});
