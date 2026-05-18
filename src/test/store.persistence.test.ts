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
  return {
    id: crypto.randomUUID(),
    task: "Test task",
    project: "",
    workPackage: "",
    startDate: "",
    dueDate: "",
    priority: "Medium",
    status: "Not Started",
    notes: "",
    labels: [],
    ...overrides,
  } as Action;
}

describe("store.addAction persistence", () => {
  beforeEach(() => {
    insertResult.error = null;
    insertSpy.mockClear();
    // Reset actions list
    useAppStore.setState({ actions: [] });
  });

  afterEach(() => {
    useAppStore.setState({ actions: [] });
  });

  it("keeps the action in state when the insert succeeds", async () => {
    const action = buildAction({ task: "Persisted task" });
    useAppStore.getState().addAction(action);

    // Optimistic update applies immediately.
    expect(useAppStore.getState().actions).toHaveLength(1);

    // Wait for the async persist promise to resolve.
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

    // Wait for the rejection + rollback.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(useAppStore.getState().actions).toHaveLength(0);
  });
});
