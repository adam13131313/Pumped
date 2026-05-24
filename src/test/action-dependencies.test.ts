import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock sonner so toast.error doesn't blow up in test env.
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock supabase. addActionDependency fires an insert; we only need it to be a
// no-op Promise for these tests because we're not asserting on the network call
// — the cycle / self-edge checks happen *before* the insert.
const insertResult = { error: null as null | { message: string } };
const insertSpy = vi.fn(() => Promise.resolve(insertResult));
const deleteSpy = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: () => ({
      insert: insertSpy,
      delete: () => ({ eq: deleteSpy }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

import {
  useAppStore,
  wouldCreateCycle,
  actionReadiness,
  unblockedSuccessors,
  unblockedSuccessorsByMany,
} from "@/lib/store";
import type { Action, ActionDependency } from "@/lib/types";

const ORG = "00000000-0000-0000-0000-000000000000";

function buildAction(overrides: Partial<Action> = {}): Action {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    organisationId: ORG,
    wbsNodeId: null,
    assignedTo: null,
    createdBy: null,
    task: "Task",
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

function buildDep(sourceId: string, targetId: string, overrides: Partial<ActionDependency> = {}): ActionDependency {
  return {
    id: crypto.randomUUID(),
    organisationId: ORG,
    sourceActionId: sourceId,
    targetActionId: targetId,
    dependencyType: "fs",
    lagDays: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// wouldCreateCycle — pure function
// ---------------------------------------------------------------------------

describe("wouldCreateCycle", () => {
  it("flags a self-edge", () => {
    expect(wouldCreateCycle([], "a", "a")).toBe(true);
  });

  it("allows an edge into an empty graph", () => {
    expect(wouldCreateCycle([], "a", "b")).toBe(false);
  });

  it("allows acyclic chains", () => {
    // a -> b, b -> c.  Adding c -> d is fine.
    const deps = [buildDep("a", "b"), buildDep("b", "c")];
    expect(wouldCreateCycle(deps, "c", "d")).toBe(false);
  });

  it("rejects a direct back-edge", () => {
    // a -> b exists. Adding b -> a closes a 2-cycle.
    const deps = [buildDep("a", "b")];
    expect(wouldCreateCycle(deps, "b", "a")).toBe(true);
  });

  it("rejects a 3-node back-edge", () => {
    // a -> b -> c.  Adding c -> a would create a 3-cycle.
    const deps = [buildDep("a", "b"), buildDep("b", "c")];
    expect(wouldCreateCycle(deps, "c", "a")).toBe(true);
  });

  it("rejects via a deeper path", () => {
    // a -> b -> c -> d -> e.  Adding e -> a closes a 5-cycle.
    const deps = [
      buildDep("a", "b"),
      buildDep("b", "c"),
      buildDep("c", "d"),
      buildDep("d", "e"),
    ];
    expect(wouldCreateCycle(deps, "e", "a")).toBe(true);
  });

  it("allows diamond shapes (DAGs)", () => {
    // a -> b, a -> c, b -> d, c -> d. Diamond. Adding e -> a is fine.
    const deps = [
      buildDep("a", "b"),
      buildDep("a", "c"),
      buildDep("b", "d"),
      buildDep("c", "d"),
    ];
    expect(wouldCreateCycle(deps, "e", "a")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addActionDependency — store mutator wrapping the cycle check
// ---------------------------------------------------------------------------

describe("store.addActionDependency", () => {
  beforeEach(() => {
    insertResult.error = null;
    insertSpy.mockClear();
    useAppStore.setState({ actionDependencies: [] });
  });

  it("rejects self-dependencies without inserting", () => {
    const result = useAppStore.getState().addActionDependency(buildDep("a", "a"));
    expect(result).toEqual({ ok: false, reason: "self" });
    expect(useAppStore.getState().actionDependencies).toHaveLength(0);
  });

  it("accepts an acyclic add", () => {
    const result = useAppStore.getState().addActionDependency(buildDep("a", "b"));
    expect(result).toEqual({ ok: true });
    expect(useAppStore.getState().actionDependencies).toHaveLength(1);
  });

  it("rejects an add that would create a cycle", () => {
    useAppStore.getState().addActionDependency(buildDep("a", "b"));
    useAppStore.getState().addActionDependency(buildDep("b", "c"));
    const result = useAppStore.getState().addActionDependency(buildDep("c", "a"));
    expect(result).toEqual({ ok: false, reason: "cycle" });
    expect(useAppStore.getState().actionDependencies).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// actionReadiness — derived selector
// ---------------------------------------------------------------------------

describe("actionReadiness", () => {
  const TODAY = new Date("2026-05-23T12:00:00Z");

  it("returns 'ready' for an action with no deps and no future start", () => {
    const a = buildAction({ id: "a" });
    expect(actionReadiness("a", [a], [], TODAY)).toBe("ready");
  });

  it("returns 'future' when start_date is after today", () => {
    const a = buildAction({ id: "a", startDate: "2026-06-01" });
    expect(actionReadiness("a", [a], [], TODAY)).toBe("future");
  });

  it("returns 'ready' when start_date is in the past", () => {
    const a = buildAction({ id: "a", startDate: "2026-04-01" });
    expect(actionReadiness("a", [a], [], TODAY)).toBe("ready");
  });

  it("returns 'blocked' when an FS predecessor is incomplete", () => {
    const pred = buildAction({ id: "pred", status: "in_progress" });
    const succ = buildAction({ id: "succ" });
    const deps = [buildDep("pred", "succ")];
    expect(actionReadiness("succ", [pred, succ], deps, TODAY)).toBe("blocked");
  });

  it("returns 'ready' when the FS predecessor is complete", () => {
    const pred = buildAction({ id: "pred", status: "complete", completedAt: TODAY.toISOString() });
    const succ = buildAction({ id: "succ" });
    const deps = [buildDep("pred", "succ")];
    expect(actionReadiness("succ", [pred, succ], deps, TODAY)).toBe("ready");
  });

  it("treats a 'cancelled' predecessor as non-blocking", () => {
    // Pumped's action_status includes 'cancelled' as a terminal state. A
    // cancelled predecessor shouldn't keep a successor in 'blocked' forever.
    const pred = buildAction({ id: "pred", status: "cancelled" });
    const succ = buildAction({ id: "succ" });
    const deps = [buildDep("pred", "succ")];
    expect(actionReadiness("succ", [pred, succ], deps, TODAY)).toBe("ready");
  });

  it("ignores non-FS dep types in v1", () => {
    // SS / FF / SF stored but informational only until calendars land.
    const pred = buildAction({ id: "pred", status: "in_progress" });
    const succ = buildAction({ id: "succ" });
    const ssDep = buildDep("pred", "succ", { dependencyType: "ss" });
    expect(actionReadiness("succ", [pred, succ], [ssDep], TODAY)).toBe("ready");
  });

  it("blocks on any incomplete FS predecessor in a multi-pred case", () => {
    const p1 = buildAction({ id: "p1", status: "complete", completedAt: TODAY.toISOString() });
    const p2 = buildAction({ id: "p2", status: "not_started" });
    const succ = buildAction({ id: "succ" });
    const deps = [buildDep("p1", "succ"), buildDep("p2", "succ")];
    expect(actionReadiness("succ", [p1, p2, succ], deps, TODAY)).toBe("blocked");
  });

  it("becomes 'ready' once all FS predecessors are complete", () => {
    const completedAt = TODAY.toISOString();
    const p1 = buildAction({ id: "p1", status: "complete", completedAt });
    const p2 = buildAction({ id: "p2", status: "complete", completedAt });
    const succ = buildAction({ id: "succ" });
    const deps = [buildDep("p1", "succ"), buildDep("p2", "succ")];
    expect(actionReadiness("succ", [p1, p2, succ], deps, TODAY)).toBe("ready");
  });

  it("ignores orphan deps (missing predecessor)", () => {
    // If a predecessor action was deleted but the dep row lingers, the
    // selector shouldn't block — delete cascade handles cleanup at the DB
    // layer; this guards against transient in-memory inconsistency.
    const succ = buildAction({ id: "succ" });
    const deps = [buildDep("ghost", "succ")];
    expect(actionReadiness("succ", [succ], deps, TODAY)).toBe("ready");
  });
});

// ---------------------------------------------------------------------------
// unblockedSuccessors — the synthesis hook
// ---------------------------------------------------------------------------

describe("unblockedSuccessors", () => {
  it("returns [] when the action has no successors", () => {
    const a = buildAction({ id: "a", status: "in_progress" });
    const b = buildAction({ id: "b" });
    // Dep direction: a depends on b, not the other way around. So 'a' has no
    // successors via FS.
    const deps = [buildDep("b", "a")];
    expect(unblockedSuccessors("a", [a, b], deps)).toEqual([]);
  });

  it("returns a sole successor with no other preds", () => {
    const a = buildAction({ id: "a", status: "in_progress" });
    const b = buildAction({ id: "b" });
    const deps = [buildDep("a", "b")];
    expect(unblockedSuccessors("a", [a, b], deps)).toEqual(["b"]);
  });

  it("excludes a successor that has other incomplete preds", () => {
    const a = buildAction({ id: "a", status: "in_progress" });
    const other = buildAction({ id: "other", status: "not_started" });
    const succ = buildAction({ id: "succ" });
    const deps = [buildDep("a", "succ"), buildDep("other", "succ")];
    // Completing a wouldn't unblock succ — 'other' still blocks.
    expect(unblockedSuccessors("a", [a, other, succ], deps)).toEqual([]);
  });

  it("includes a successor when the OTHER preds are complete", () => {
    const a = buildAction({ id: "a", status: "in_progress" });
    const otherDone = buildAction({ id: "od", status: "complete", completedAt: "x" });
    const succ = buildAction({ id: "succ" });
    const deps = [buildDep("a", "succ"), buildDep("od", "succ")];
    expect(unblockedSuccessors("a", [a, otherDone, succ], deps)).toEqual(["succ"]);
  });

  it("treats a 'cancelled' other-pred as non-blocking", () => {
    const a = buildAction({ id: "a", status: "in_progress" });
    const otherCancelled = buildAction({ id: "oc", status: "cancelled" });
    const succ = buildAction({ id: "succ" });
    const deps = [buildDep("a", "succ"), buildDep("oc", "succ")];
    expect(unblockedSuccessors("a", [a, otherCancelled, succ], deps)).toEqual(["succ"]);
  });

  it("does not transitively unblock — only direct successors", () => {
    // A -> B -> C.  Completing A unblocks B. C remains blocked because B is
    // still not_started. UX rationale documented inline in the function.
    const a = buildAction({ id: "a", status: "in_progress" });
    const b = buildAction({ id: "b" });
    const c = buildAction({ id: "c" });
    const deps = [buildDep("a", "b"), buildDep("b", "c")];
    expect(unblockedSuccessors("a", [a, b, c], deps).sort()).toEqual(["b"]);
  });

  it("returns multiple successors when several are fan-out from this action", () => {
    const a = buildAction({ id: "a", status: "in_progress" });
    const x = buildAction({ id: "x" });
    const y = buildAction({ id: "y" });
    const z = buildAction({ id: "z" });
    const deps = [buildDep("a", "x"), buildDep("a", "y"), buildDep("a", "z")];
    expect(unblockedSuccessors("a", [a, x, y, z], deps).sort()).toEqual(["x", "y", "z"]);
  });

  it("ignores non-FS dep types", () => {
    // SS / FF / SF aren't part of the v1 readiness model — they shouldn't
    // appear in the synthesis output either.
    const a = buildAction({ id: "a", status: "in_progress" });
    const b = buildAction({ id: "b" });
    const ssDep = buildDep("a", "b", { dependencyType: "ss" });
    expect(unblockedSuccessors("a", [a, b], [ssDep])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// unblockedSuccessorsByMany — fan-in matters
// ---------------------------------------------------------------------------

describe("unblockedSuccessorsByMany", () => {
  it("returns [] for empty input", () => {
    expect(unblockedSuccessorsByMany([], [], [])).toEqual([]);
  });

  it("unblocks a fan-in successor when ALL transitioning preds are in the set", () => {
    // A → C, B → C. Both A and B in progress. Single-action calls would return
    // [] for each; bulk should return [C].
    const a = buildAction({ id: "a", status: "in_progress" });
    const b = buildAction({ id: "b", status: "in_progress" });
    const c = buildAction({ id: "c" });
    const deps = [buildDep("a", "c"), buildDep("b", "c")];
    expect(unblockedSuccessorsByMany(["a", "b"], [a, b, c], deps)).toEqual(["c"]);
  });

  it("does NOT unblock a fan-in successor when only one pred is in the bulk", () => {
    const a = buildAction({ id: "a", status: "in_progress" });
    const b = buildAction({ id: "b", status: "in_progress" });
    const c = buildAction({ id: "c" });
    const deps = [buildDep("a", "c"), buildDep("b", "c")];
    // Bulk-completing just A leaves B blocking C.
    expect(unblockedSuccessorsByMany(["a"], [a, b, c], deps)).toEqual([]);
  });

  it("does not double-count successors with multiple sources in the bulk", () => {
    // A → C, B → C — both A and B in bulk. C must appear once, not twice.
    const a = buildAction({ id: "a", status: "in_progress" });
    const b = buildAction({ id: "b", status: "in_progress" });
    const c = buildAction({ id: "c" });
    const deps = [buildDep("a", "c"), buildDep("b", "c")];
    const result = unblockedSuccessorsByMany(["a", "b"], [a, b, c], deps);
    expect(result.filter((id) => id === "c")).toHaveLength(1);
  });

  it("excludes transitioning actions from the result", () => {
    // A → B, B → C. Bulk = [A, B]. C should be reported as unblocked because
    // B is itself transitioning. But B (which IS in the bulk) must NOT appear
    // in the result — it's being closed, not opened.
    const a = buildAction({ id: "a", status: "in_progress" });
    const b = buildAction({ id: "b", status: "in_progress" });
    const c = buildAction({ id: "c" });
    const deps = [buildDep("a", "b"), buildDep("b", "c")];
    expect(unblockedSuccessorsByMany(["a", "b"], [a, b, c], deps)).toEqual(["c"]);
  });
});
