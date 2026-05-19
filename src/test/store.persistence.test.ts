import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock sonner so toasts don't crash and we can spy on errors.
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the supabase client. Each test can swap out insertResult.
const insertResult = { error: null as null | { message: string } };
const insertSpy = vi.fn(() => Promise.resolve(insertResult));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "test-user-id" } } }),
    },
    from: () => ({
      insert: insertSpy,
    }),
  },
}));

import { useAppStore } from "@/lib/store";
import type { Action } from "@/lib/types";

function buildAction(overrides: Partial<Action> = {}): Action {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    organisationId: "00000000-0000-0000-0000-000000000000",
    wbsNodeId: null,
    assignedTo: null,
    createdBy: null,
    task: "Test task",
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

describe("store.addAction persistence", () => {
  beforeEach(() => {
    insertResult.error = null;
    insertSpy.mockClear();
    useAppStore.setState({ actions: [] });
  });

  afterEach(() => {
    useAppStore.setState({ actions: [] });
  });

  it("keeps the action in state when the insert succeeds", async () => {
    const action = buildAction({ task: "Persisted task" });
    useAppStore.getState().addAction(action);

    expect(useAppStore.getState().actions).toHaveLength(1);

    await new Promise((r) => setTimeout(r, 0));

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().actions).toHaveLength(1);
    expect(useAppStore.getState().actions[0].task).toBe("Persisted task");
  });

  it("rolls back the optimistic update when the insert fails", async () => {
    insertResult.error = { message: "violates foreign key constraint" };

    const action = buildAction({ task: "Doomed task" });
    useAppStore.getState().addAction(action);

    expect(useAppStore.getState().actions).toHaveLength(1);

    // Two microtask flushes: one for getUser().then, one for insert().then
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(useAppStore.getState().actions).toHaveLength(0);
  });
});
