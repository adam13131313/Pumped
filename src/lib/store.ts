import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  Action,
  GatheredState,
  InboxItem,
  Membership,
  NodeType,
  Organisation,
  Profile,
  Routine,
  RoutineCompletion,
  SopItem,
  WaitingItem,
  WbsNode,
  WbsNodeDependency,
  WebhookSource,
} from "./types";
import type { Database, Json } from "@/integrations/supabase/types";

// ============================================================================
// Generic helpers
// ============================================================================

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

// Same NOTES_MAX cap the edge functions and Zod schemas enforce; defends
// programmatic paths (AI extraction, future imports) against unbounded blobs.
const NOTES_MAX_LENGTH = 5000;

function clampNotes<T extends { notes?: string }>(patch: T): T {
  if (typeof patch.notes !== "string" || patch.notes.length <= NOTES_MAX_LENGTH) return patch;
  console.warn(`[store] notes truncated from ${patch.notes.length} to ${NOTES_MAX_LENGTH} chars`);
  return { ...patch, notes: patch.notes.slice(0, NOTES_MAX_LENGTH) };
}

// Maps Partial<T> patches into a snake_case DB update payload. Field maps live
// at module scope so single + bulk variants cannot drift.
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

// ============================================================================
// Field maps (snake_case translation, shared between single + bulk)
// ============================================================================

const wbsNodeFields: FieldMap<WbsNode> = {
  parentId: "parent_id",
  nodeType: "node_type",
  name: "name",
  description: "description",
  position: "position",
  archivedAt: "archived_at",
  projectStatus: "project_status",
  leadUserId: "lead_user_id",
  startDate: "start_date",
  dueDate: "due_date",
  ragStatus: "rag_status",
  blockers: "blockers",
};

const actionFields: FieldMap<Action> = {
  wbsNodeId: "wbs_node_id",
  assignedTo: "assigned_to",
  task: "task",
  priority: "priority",
  status: "status",
  startDate: "start_date",
  dueDate: "due_date",
  completedAt: "completed_at",
  notes: "notes",
  labels: "labels",
  archivedAt: "archived_at",
};

const waitingFields: FieldMap<WaitingItem> = {
  wbsNodeId: "wbs_node_id",
  fromUserId: "from_user_id",
  fromWhomText: "from_whom_text",
  description: "description",
  askedOn: "asked_on",
  dueBy: "due_by",
  status: "status",
  notes: "notes",
};

const inboxFields: FieldMap<InboxItem> = {
  sourceId: "source_id",
  wbsNodeId: "wbs_node_id",
  task: "task",
  priority: "priority",
  dueDate: "due_date",
  notes: "notes",
  externalId: "external_id",
  externalUrl: "external_url",
};

const routineFields: FieldMap<Routine> = {
  name: "name",
  description: "description",
  timeOfDay: "time_of_day",
  frequencyType: "frequency_type",
  frequencyConfig: "frequency_config",
  archivedAt: "archived_at",
};

const sopFields: FieldMap<SopItem> = {
  triggerWhen: "trigger_when",
  instruction: "instruction",
  position: "position",
};

const webhookSourceFields: FieldMap<WebhookSource> = {
  name: "name",
  slug: "slug",
  description: "description",
  lastReceivedAt: "last_received_at",
};

// ============================================================================
// Row → domain mappers (one per table)
// ============================================================================

type Rows = Database["public"]["Tables"];

const mapOrganisation = (r: Rows["organisations"]["Row"]): Organisation => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapMembership = (r: Rows["memberships"]["Row"]): Membership => ({
  id: r.id,
  organisationId: r.organisation_id,
  userId: r.user_id,
  role: r.role,
  unitId: r.unit_id,
  invitedBy: r.invited_by,
  invitedAt: r.invited_at,
  joinedAt: r.joined_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapProfile = (r: Rows["profiles"]["Row"]): Profile => ({
  id: r.id,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  preferences: (r.preferences ?? {}) as Record<string, unknown>,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapWbsNode = (r: Rows["wbs_nodes"]["Row"]): WbsNode => ({
  id: r.id,
  organisationId: r.organisation_id,
  parentId: r.parent_id,
  nodeType: r.node_type,
  name: r.name,
  description: r.description,
  position: r.position,
  archivedAt: r.archived_at,
  projectStatus: r.project_status,
  leadUserId: r.lead_user_id,
  startDate: r.start_date,
  dueDate: r.due_date,
  ragStatus: r.rag_status,
  blockers: r.blockers,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapWbsDependency = (r: Rows["wbs_node_dependencies"]["Row"]): WbsNodeDependency => ({
  id: r.id,
  organisationId: r.organisation_id,
  sourceNodeId: r.source_node_id,
  targetNodeId: r.target_node_id,
  dependencyType: r.dependency_type,
  lagDays: r.lag_days,
  createdAt: r.created_at,
});

const mapAction = (r: Rows["actions"]["Row"]): Action => ({
  id: r.id,
  organisationId: r.organisation_id,
  wbsNodeId: r.wbs_node_id,
  assignedTo: r.assigned_to,
  createdBy: r.created_by,
  task: r.task,
  priority: r.priority,
  status: r.status,
  startDate: r.start_date,
  dueDate: r.due_date,
  completedAt: r.completed_at,
  notes: r.notes,
  labels: r.labels ?? [],
  notStartedSince: r.not_started_since,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapWaiting = (r: Rows["waiting_items"]["Row"]): WaitingItem => ({
  id: r.id,
  organisationId: r.organisation_id,
  wbsNodeId: r.wbs_node_id,
  fromUserId: r.from_user_id,
  fromWhomText: r.from_whom_text,
  description: r.description,
  askedOn: r.asked_on,
  dueBy: r.due_by,
  status: r.status,
  notes: r.notes,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapInbox = (r: Rows["inbox_items"]["Row"]): InboxItem => ({
  id: r.id,
  organisationId: r.organisation_id,
  sourceId: r.source_id,
  wbsNodeId: r.wbs_node_id,
  promotedToActionId: r.promoted_to_action_id,
  task: r.task,
  priority: r.priority,
  dueDate: r.due_date,
  notes: r.notes,
  externalId: r.external_id,
  externalUrl: r.external_url,
  promotedAt: r.promoted_at,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapRoutine = (r: Rows["routines"]["Row"]): Routine => ({
  id: r.id,
  organisationId: r.organisation_id,
  ownerUserId: r.owner_user_id,
  name: r.name,
  description: r.description,
  timeOfDay: r.time_of_day,
  frequencyType: r.frequency_type,
  frequencyConfig: (r.frequency_config ?? {}) as Record<string, unknown>,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapRoutineCompletion = (r: Rows["routine_completions"]["Row"]): RoutineCompletion => ({
  id: r.id,
  organisationId: r.organisation_id,
  routineId: r.routine_id,
  userId: r.user_id,
  completedDate: r.completed_date,
  createdAt: r.created_at,
});

const mapSop = (r: Rows["sop_items"]["Row"]): SopItem => ({
  id: r.id,
  organisationId: r.organisation_id,
  ownerUserId: r.owner_user_id,
  triggerWhen: r.trigger_when,
  instruction: r.instruction,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapGathered = (r: Rows["gathered_state"]["Row"]): GatheredState => ({
  id: r.id,
  userId: r.user_id,
  organisationId: r.organisation_id,
  taskIds: r.task_ids ?? [],
  orderIds: r.order_ids ?? [],
  schedule: (r.schedule ?? {}) as Record<string, number>,
  durations: (r.durations ?? {}) as Record<string, number>,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapWebhookSource = (r: Rows["webhook_sources"]["Row"]): WebhookSource => ({
  id: r.id,
  organisationId: r.organisation_id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  lastReceivedAt: r.last_received_at,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// ============================================================================
// Global filter shape
// ============================================================================

export interface GlobalFilter {
  // Either a specific node, or 'unassigned' (rows with no wbs_node_id).
  nodeId: string | null;
  unassigned: boolean;
}

const defaultGlobalFilter: GlobalFilter = { nodeId: null, unassigned: false };

// ============================================================================
// Store state
// ============================================================================

interface AppState {
  // Auth + tenancy
  dataLoaded: boolean;
  currentOrg: Organisation | null;
  currentMembership: Membership | null;
  profile: Profile | null;
  needsOrgBootstrap: boolean;

  // Domain
  wbsNodes: WbsNode[];
  wbsDependencies: WbsNodeDependency[];
  actions: Action[];
  waitingItems: WaitingItem[];
  inboxItems: InboxItem[];
  routines: Routine[];
  routineCompletions: RoutineCompletion[];
  sopItems: SopItem[];
  webhookSources: WebhookSource[];
  gathered: GatheredState | null;

  globalFilter: GlobalFilter;
  setGlobalFilter: (filter: GlobalFilter) => void;
  clearGlobalFilter: () => void;

  // Lifecycle
  loadAllData: () => Promise<void>;
  bootstrapOrganisation: (name: string) => Promise<Organisation>;
  resetTenancy: () => void;

  // WBS
  addWbsNode: (node: WbsNode) => void;
  updateWbsNode: (id: string, updates: Partial<WbsNode>) => void;
  deleteWbsNode: (id: string) => void;

  // Actions
  addAction: (action: Action) => void;
  updateAction: (id: string, updates: Partial<Action>) => void;
  deleteAction: (id: string) => void;
  bulkUpdateActions: (ids: string[], updates: Partial<Action>) => void;
  bulkDeleteActions: (ids: string[]) => void;

  // Waiting
  addWaitingItem: (item: WaitingItem) => void;
  updateWaitingItem: (id: string, updates: Partial<WaitingItem>) => void;
  deleteWaitingItem: (id: string) => void;
  delegateAction: (actionId: string, params: { fromUserId?: string | null; fromWhomText?: string | null }) => void;
  takeBackWaiting: (id: string) => void;

  // Inbox
  addInboxItem: (item: InboxItem) => void;
  addInboxItems: (items: InboxItem[]) => void;
  updateInboxItem: (id: string, updates: Partial<InboxItem>) => void;
  bulkUpdateInboxItems: (ids: string[], updates: Partial<InboxItem>) => void;
  deleteInboxItem: (id: string) => void;
  bulkDeleteInboxItems: (ids: string[]) => void;
  promoteInboxToActions: (ids: string[]) => void;
  bulkAddActions: (actions: Action[]) => void;

  // Routines + SOP
  addRoutine: (r: Routine) => void;
  updateRoutine: (id: string, updates: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  addRoutineCompletion: (rc: RoutineCompletion) => void;
  deleteRoutineCompletion: (id: string) => void;
  addSopItem: (item: SopItem) => void;
  updateSopItem: (id: string, updates: Partial<SopItem>) => void;
  deleteSopItem: (id: string) => void;

  // Webhook sources (Integrations)
  addWebhookSource: (source: WebhookSource) => void;
  updateWebhookSource: (id: string, updates: Partial<WebhookSource>) => void;
  deleteWebhookSource: (id: string) => void;

  // Profile
  updateProfile: (updates: Partial<Profile>) => void;

  // Gathered ("Today")
  setGatheredTasks: (taskIds: string[], orderIds: string[]) => void;
  scheduleGatheredTask: (taskId: string, slot: number) => void;
  setGatheredTaskDuration: (taskId: string, duration: number) => void;
  unscheduleGatheredTask: (taskId: string) => void;
  clearGathered: () => void;

  // Today convenience — derived from `gathered.taskIds`. Pages use this
  // shape because "gather a single task" is the common interaction.
  todayIds: Set<string>;
  addToday: (id: string) => void;
  removeToday: (id: string) => void;
  clearToday: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useAppStore = create<AppState>()((set, get) => ({
  dataLoaded: false,
  currentOrg: null,
  currentMembership: null,
  profile: null,
  needsOrgBootstrap: false,

  wbsNodes: [],
  wbsDependencies: [],
  actions: [],
  waitingItems: [],
  inboxItems: [],
  routines: [],
  routineCompletions: [],
  sopItems: [],
  webhookSources: [],
  gathered: null,

  globalFilter: defaultGlobalFilter,
  setGlobalFilter: (filter) => set({ globalFilter: filter }),
  clearGlobalFilter: () => set({ globalFilter: defaultGlobalFilter }),

  resetTenancy: () => set({
    dataLoaded: false,
    currentOrg: null,
    currentMembership: null,
    profile: null,
    needsOrgBootstrap: false,
    wbsNodes: [],
    wbsDependencies: [],
    actions: [],
    waitingItems: [],
    inboxItems: [],
    routines: [],
    routineCompletions: [],
    sopItems: [],
    webhookSources: [],
    gathered: null,
    todayIds: new Set(),
    globalFilter: defaultGlobalFilter,
  }),

  // --------------------------------------------------------------------------
  // Load + bootstrap
  // --------------------------------------------------------------------------

  loadAllData: async () => {
    const uid = await getUserId();

    // 1. Find this user's organisation. v2 launch assumption: one org per user.
    const { data: memberRows, error: memberErr } = await supabase
      .from("memberships")
      .select("*")
      .eq("user_id", uid)
      .limit(1);

    if (memberErr) {
      notifySaveError("Failed to load membership", memberErr);
      set({ dataLoaded: true, needsOrgBootstrap: false });
      return;
    }

    if (!memberRows || memberRows.length === 0) {
      // No org yet — route to bootstrap.
      set({ dataLoaded: true, needsOrgBootstrap: true });
      return;
    }

    const membership = mapMembership(memberRows[0]);

    // 2. Load org + profile in parallel.
    const [{ data: orgRow }, { data: profileRow }] = await Promise.all([
      supabase.from("organisations").select("*").eq("id", membership.organisationId).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    ]);

    const org = orgRow ? mapOrganisation(orgRow) : null;
    const profile = profileRow ? mapProfile(profileRow) : null;

    if (!org) {
      // Membership references a missing org — treat as needs bootstrap.
      set({ dataLoaded: true, needsOrgBootstrap: true });
      return;
    }

    // 3. Load all org-scoped domain data.
    const orgId = org.id;
    const ROW_LIMIT = 10000;

    const [
      { data: wbsRows },
      { data: depRows },
      { data: actionRows },
      { data: waitingRows },
      { data: inboxRows },
      { data: routineRows },
      { data: completionRows },
      { data: sopRows },
      { data: sourceRows },
      { data: gatheredRow },
    ] = await Promise.all([
      supabase.from("wbs_nodes").select("*").eq("organisation_id", orgId).is("archived_at", null),
      supabase.from("wbs_node_dependencies").select("*").eq("organisation_id", orgId),
      supabase.from("actions")
        .select("*").eq("organisation_id", orgId).is("archived_at", null)
        .order("created_at", { ascending: false }).limit(ROW_LIMIT),
      supabase.from("waiting_items")
        .select("*").eq("organisation_id", orgId)
        .order("created_at", { ascending: false }).limit(ROW_LIMIT),
      supabase.from("inbox_items")
        .select("*").eq("organisation_id", orgId).is("promoted_to_action_id", null)
        .order("created_at", { ascending: false }).limit(ROW_LIMIT),
      supabase.from("routines").select("*").eq("organisation_id", orgId).eq("owner_user_id", uid),
      supabase.from("routine_completions").select("*").eq("organisation_id", orgId).eq("user_id", uid),
      supabase.from("sop_items").select("*").eq("organisation_id", orgId).eq("owner_user_id", uid),
      supabase.from("webhook_sources").select("*").eq("organisation_id", orgId),
      supabase.from("gathered_state").select("*").eq("organisation_id", orgId).eq("user_id", uid).maybeSingle(),
    ]);

    set({
      dataLoaded: true,
      needsOrgBootstrap: false,
      currentOrg: org,
      currentMembership: membership,
      profile,
      wbsNodes: (wbsRows ?? []).map(mapWbsNode),
      wbsDependencies: (depRows ?? []).map(mapWbsDependency),
      actions: (actionRows ?? []).map(mapAction),
      waitingItems: (waitingRows ?? []).map(mapWaiting),
      inboxItems: (inboxRows ?? []).map(mapInbox),
      routines: (routineRows ?? []).map(mapRoutine),
      routineCompletions: (completionRows ?? []).map(mapRoutineCompletion),
      sopItems: (sopRows ?? []).map(mapSop),
      webhookSources: (sourceRows ?? []).map(mapWebhookSource),
      gathered: gatheredRow ? mapGathered(gatheredRow) : null,
      todayIds: new Set(gatheredRow ? mapGathered(gatheredRow).taskIds : []),
    });
  },

  bootstrapOrganisation: async (name) => {
    const uid = await getUserId();
    const { data, error } = await supabase
      .from("organisations")
      .insert({ name, created_by: uid })
      .select("*")
      .single();
    if (error) throw error;
    // bootstrap_owner_membership trigger creates the owner row server-side.
    // Re-run loadAllData to pick up the new membership and seed everything.
    await get().loadAllData();
    return mapOrganisation(data);
  },

  // --------------------------------------------------------------------------
  // WBS nodes
  // --------------------------------------------------------------------------

  addWbsNode: (node) => {
    set((s) => ({ wbsNodes: [...s.wbsNodes, node] }));
    runWrite(
      "WBS node could not be saved",
      supabase.from("wbs_nodes").insert({
        id: node.id,
        organisation_id: node.organisationId,
        parent_id: node.parentId,
        node_type: node.nodeType,
        name: node.name,
        description: node.description,
        position: node.position,
        project_status: node.projectStatus,
        lead_user_id: node.leadUserId,
        start_date: node.startDate,
        due_date: node.dueDate,
        rag_status: node.ragStatus,
        blockers: node.blockers,
        created_by: node.createdBy,
      }),
      () => set((s) => ({ wbsNodes: s.wbsNodes.filter((n) => n.id !== node.id) })),
    );
  },
  updateWbsNode: (id, updates) => {
    set((s) => ({ wbsNodes: s.wbsNodes.map((n) => (n.id === id ? { ...n, ...updates } : n)) }));
    runWrite(
      "WBS node update could not be saved",
      supabase.from("wbs_nodes").update(buildDbUpdate(updates, wbsNodeFields)).eq("id", id),
    );
  },
  deleteWbsNode: (id) => {
    const before = get().wbsNodes.find((n) => n.id === id);
    set((s) => ({ wbsNodes: s.wbsNodes.filter((n) => n.id !== id) }));
    // FK ON DELETE CASCADE handles dependent rows on the server. Local
    // reconciliation: refetch on rollback, or trust the next loadAllData.
    runWrite(
      "WBS node could not be deleted",
      supabase.from("wbs_nodes").delete().eq("id", id),
      before ? () => set((s) => ({ wbsNodes: [...s.wbsNodes, before] })) : undefined,
    );
  },

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  addAction: (action) => {
    const safe = clampNotes(action);
    set((s) => ({ actions: [...s.actions, safe] }));
    void (async () => {
      const { error } = await supabase.from("actions").insert({
        id: safe.id,
        organisation_id: safe.organisationId,
        wbs_node_id: safe.wbsNodeId,
        assigned_to: safe.assignedTo,
        created_by: safe.createdBy,
        task: safe.task,
        priority: safe.priority,
        status: safe.status,
        start_date: safe.startDate,
        due_date: safe.dueDate,
        notes: safe.notes,
        labels: safe.labels,
      });
      if (error) {
        set((s) => ({ actions: s.actions.filter((a) => a.id !== safe.id) }));
        notifySaveError("Action could not be saved", error);
      }
    })();
  },
  updateAction: (id, updates) => {
    const safe = clampNotes(updates);
    set((s) => ({ actions: s.actions.map((a) => (a.id === id ? { ...a, ...safe } : a)) }));
    runWrite(
      "Action update could not be saved",
      supabase.from("actions").update(buildDbUpdate(safe, actionFields)).eq("id", id),
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
    const safe = clampNotes(updates);
    set((s) => ({ actions: s.actions.map((a) => (ids.includes(a.id) ? { ...a, ...safe } : a)) }));
    runWrite(
      "Bulk action update could not be saved",
      supabase.from("actions").update(buildDbUpdate(safe, actionFields)).in("id", ids),
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

  // --------------------------------------------------------------------------
  // Waiting items
  // --------------------------------------------------------------------------

  addWaitingItem: (item) => {
    const safe = clampNotes(item);
    set((s) => ({ waitingItems: [...s.waitingItems, safe] }));
    runWrite(
      "Waiting item could not be saved",
      supabase.from("waiting_items").insert({
        id: safe.id,
        organisation_id: safe.organisationId,
        wbs_node_id: safe.wbsNodeId,
        from_user_id: safe.fromUserId,
        from_whom_text: safe.fromWhomText,
        description: safe.description,
        asked_on: safe.askedOn,
        due_by: safe.dueBy,
        status: safe.status,
        notes: safe.notes,
        created_by: safe.createdBy,
      }),
      () => set((s) => ({ waitingItems: s.waitingItems.filter((w) => w.id !== safe.id) })),
    );
  },
  updateWaitingItem: (id, updates) => {
    const safe = clampNotes(updates);
    set((s) => ({ waitingItems: s.waitingItems.map((w) => (w.id === id ? { ...w, ...safe } : w)) }));
    runWrite(
      "Waiting item update could not be saved",
      supabase.from("waiting_items").update(buildDbUpdate(safe, waitingFields)).eq("id", id),
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

  delegateAction: (actionId, params) => {
    const s = get();
    const action = s.actions.find((a) => a.id === actionId);
    const org = s.currentOrg;
    if (!action || !org) return;
    const newWaiting: WaitingItem = {
      id: crypto.randomUUID(),
      organisationId: org.id,
      wbsNodeId: action.wbsNodeId,
      fromUserId: params.fromUserId ?? null,
      fromWhomText: params.fromWhomText ?? null,
      description: action.task,
      askedOn: new Date().toISOString().slice(0, 10),
      dueBy: action.dueDate,
      status: "pending",
      notes: action.notes,
      createdBy: s.currentMembership?.userId ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({
      actions: s.actions.filter((a) => a.id !== actionId),
      waitingItems: [...s.waitingItems, newWaiting],
    });
    runWrite(
      "Delegation (action delete) could not be saved",
      supabase.from("actions").delete().eq("id", actionId),
      () => set((state) => ({ actions: [...state.actions, action] })),
    );
    runWrite(
      "Delegation (waiting insert) could not be saved",
      supabase.from("waiting_items").insert({
        id: newWaiting.id,
        organisation_id: newWaiting.organisationId,
        wbs_node_id: newWaiting.wbsNodeId,
        from_user_id: newWaiting.fromUserId,
        from_whom_text: newWaiting.fromWhomText,
        description: newWaiting.description,
        asked_on: newWaiting.askedOn,
        due_by: newWaiting.dueBy,
        status: newWaiting.status,
        notes: newWaiting.notes,
        created_by: newWaiting.createdBy,
      }),
      () => set((state) => ({ waitingItems: state.waitingItems.filter((w) => w.id !== newWaiting.id) })),
    );
  },

  takeBackWaiting: (id) => {
    const s = get();
    const item = s.waitingItems.find((w) => w.id === id);
    const org = s.currentOrg;
    if (!item || !org) return;
    const newAction: Action = {
      id: crypto.randomUUID(),
      organisationId: org.id,
      wbsNodeId: item.wbsNodeId,
      assignedTo: s.currentMembership?.userId ?? null,
      createdBy: s.currentMembership?.userId ?? null,
      task: item.description,
      priority: "medium",
      status: "not_started",
      startDate: null,
      dueDate: item.dueBy,
      completedAt: null,
      notes: item.notes,
      labels: [],
      notStartedSince: null,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
    void (async () => {
      const { error } = await supabase.from("actions").insert({
        id: newAction.id,
        organisation_id: newAction.organisationId,
        wbs_node_id: newAction.wbsNodeId,
        assigned_to: newAction.assignedTo,
        created_by: newAction.createdBy,
        task: newAction.task,
        priority: newAction.priority,
        status: newAction.status,
        due_date: newAction.dueDate,
        notes: newAction.notes,
        labels: newAction.labels,
      });
      if (error) {
        set((state) => ({ actions: state.actions.filter((a) => a.id !== newAction.id) }));
        notifySaveError("Take-back (action insert) could not be saved", error);
      }
    })();
  },

  // --------------------------------------------------------------------------
  // Inbox items
  // --------------------------------------------------------------------------

  addInboxItem: (item) => {
    const safe = clampNotes(item);
    set((s) => ({ inboxItems: [...s.inboxItems, safe] }));
    runWrite(
      "Inbox item could not be saved",
      supabase.from("inbox_items").insert({
        id: safe.id,
        organisation_id: safe.organisationId,
        source_id: safe.sourceId,
        wbs_node_id: safe.wbsNodeId,
        task: safe.task,
        priority: safe.priority,
        due_date: safe.dueDate,
        notes: safe.notes,
        external_id: safe.externalId,
        external_url: safe.externalUrl,
        created_by: safe.createdBy,
      }),
      () => set((s) => ({ inboxItems: s.inboxItems.filter((i) => i.id !== safe.id) })),
    );
  },
  addInboxItems: (items) => {
    const safeItems = items.map(clampNotes);
    set((s) => ({ inboxItems: [...s.inboxItems, ...safeItems] }));
    const newIds = safeItems.map((i) => i.id);
    runWrite(
      "Inbox items could not be saved",
      supabase.from("inbox_items").insert(safeItems.map((i) => ({
        id: i.id,
        organisation_id: i.organisationId,
        source_id: i.sourceId,
        wbs_node_id: i.wbsNodeId,
        task: i.task,
        priority: i.priority,
        due_date: i.dueDate,
        notes: i.notes,
        external_id: i.externalId,
        external_url: i.externalUrl,
        created_by: i.createdBy,
      }))),
      () => set((s) => ({ inboxItems: s.inboxItems.filter((i) => !newIds.includes(i.id)) })),
    );
  },
  updateInboxItem: (id, updates) => {
    const safe = clampNotes(updates);
    set((s) => ({ inboxItems: s.inboxItems.map((i) => (i.id === id ? { ...i, ...safe } : i)) }));
    runWrite(
      "Inbox update could not be saved",
      supabase.from("inbox_items").update(buildDbUpdate(safe, inboxFields)).eq("id", id),
    );
  },
  bulkUpdateInboxItems: (ids, updates) => {
    const safe = clampNotes(updates);
    set((s) => ({ inboxItems: s.inboxItems.map((i) => (ids.includes(i.id) ? { ...i, ...safe } : i)) }));
    runWrite(
      "Bulk inbox update could not be saved",
      supabase.from("inbox_items").update(buildDbUpdate(safe, inboxFields)).in("id", ids),
    );
  },
  deleteInboxItem: (id) => {
    const before = get().inboxItems.find((i) => i.id === id);
    set((s) => ({ inboxItems: s.inboxItems.filter((i) => i.id !== id) }));
    // The DB BEFORE DELETE trigger writes a 'deleted' inbox_item_event with
    // the snapshot — no app-side event-log call needed any more.
    runWrite(
      "Inbox item could not be deleted",
      supabase.from("inbox_items").delete().eq("id", id),
      before ? () => set((s) => ({ inboxItems: [...s.inboxItems, before] })) : undefined,
    );
  },
  bulkDeleteInboxItems: (ids) => {
    const before = get().inboxItems.filter((i) => ids.includes(i.id));
    set((s) => ({ inboxItems: s.inboxItems.filter((i) => !ids.includes(i.id)) }));
    runWrite(
      "Bulk inbox delete could not be saved",
      supabase.from("inbox_items").delete().in("id", ids),
      before.length > 0 ? () => set((s) => ({ inboxItems: [...s.inboxItems, ...before] })) : undefined,
    );
  },
  promoteInboxToActions: (ids) => {
    const s = get();
    const org = s.currentOrg;
    if (!org) return;
    const toPromote = s.inboxItems.filter((i) => ids.includes(i.id));
    const now = new Date().toISOString();
    const newActions: Action[] = toPromote.map((i) => ({
      id: crypto.randomUUID(),
      organisationId: org.id,
      wbsNodeId: i.wbsNodeId,
      assignedTo: s.currentMembership?.userId ?? null,
      createdBy: s.currentMembership?.userId ?? null,
      task: i.task,
      priority: i.priority,
      status: "not_started",
      startDate: null,
      dueDate: i.dueDate,
      completedAt: null,
      notes: i.notes,
      labels: [],
      notStartedSince: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }));
    const promotedMap = new Map(toPromote.map((i, idx) => [i.id, newActions[idx].id]));
    set({
      inboxItems: s.inboxItems.map((i) =>
        promotedMap.has(i.id)
          ? { ...i, promotedToActionId: promotedMap.get(i.id)!, promotedAt: now }
          : i,
      ),
      actions: [...s.actions, ...newActions],
    });

    void (async () => {
      const { error } = await supabase.from("actions").insert(newActions.map((a) => ({
        id: a.id,
        organisation_id: a.organisationId,
        wbs_node_id: a.wbsNodeId,
        assigned_to: a.assignedTo,
        created_by: a.createdBy,
        task: a.task,
        priority: a.priority,
        status: a.status,
        due_date: a.dueDate,
        notes: a.notes,
        labels: a.labels,
      })));
      if (error) {
        set((state) => ({
          actions: state.actions.filter((a) => !newActions.some((na) => na.id === a.id)),
          inboxItems: state.inboxItems.map((i) =>
            promotedMap.has(i.id) ? { ...i, promotedToActionId: null, promotedAt: null } : i,
          ),
        }));
        notifySaveError("Promoted actions could not be saved", error);
        return;
      }
      // Mark inbox items as promoted (filtered out of working set on next load).
      for (const [inboxId, actionId] of promotedMap.entries()) {
        await supabase
          .from("inbox_items")
          .update({ promoted_to_action_id: actionId, promoted_at: now })
          .eq("id", inboxId);
      }
    })();
  },
  bulkAddActions: (actions) => {
    const safe = actions.map(clampNotes);
    set((s) => ({ actions: [...s.actions, ...safe] }));
    const newIds = safe.map((a) => a.id);
    void (async () => {
      const { error } = await supabase.from("actions").insert(safe.map((a) => ({
        id: a.id,
        organisation_id: a.organisationId,
        wbs_node_id: a.wbsNodeId,
        assigned_to: a.assignedTo,
        created_by: a.createdBy,
        task: a.task,
        priority: a.priority,
        status: a.status,
        due_date: a.dueDate,
        notes: a.notes,
        labels: a.labels,
      })));
      if (error) {
        set((state) => ({ actions: state.actions.filter((a) => !newIds.includes(a.id)) }));
        notifySaveError("Actions could not be saved", error);
      }
    })();
  },

  // --------------------------------------------------------------------------
  // Routines + SOPs
  // --------------------------------------------------------------------------

  addRoutine: (r) => {
    set((s) => ({ routines: [...s.routines, r] }));
    runWrite(
      "Routine could not be saved",
      supabase.from("routines").insert({
        id: r.id,
        organisation_id: r.organisationId,
        owner_user_id: r.ownerUserId,
        name: r.name,
        description: r.description,
        time_of_day: r.timeOfDay,
        frequency_type: r.frequencyType,
        frequency_config: r.frequencyConfig as Json,
      }),
      () => set((s) => ({ routines: s.routines.filter((x) => x.id !== r.id) })),
    );
  },
  updateRoutine: (id, updates) => {
    set((s) => ({ routines: s.routines.map((r) => (r.id === id ? { ...r, ...updates } : r)) }));
    runWrite(
      "Routine update could not be saved",
      supabase.from("routines").update(buildDbUpdate(updates, routineFields)).eq("id", id),
    );
  },
  deleteRoutine: (id) => {
    const before = get().routines.find((r) => r.id === id);
    set((s) => ({ routines: s.routines.filter((r) => r.id !== id) }));
    runWrite(
      "Routine could not be deleted",
      supabase.from("routines").delete().eq("id", id),
      before ? () => set((s) => ({ routines: [...s.routines, before] })) : undefined,
    );
  },
  addRoutineCompletion: (rc) => {
    set((s) => ({ routineCompletions: [...s.routineCompletions, rc] }));
    runWrite(
      "Routine completion could not be saved",
      supabase.from("routine_completions").insert({
        id: rc.id,
        organisation_id: rc.organisationId,
        routine_id: rc.routineId,
        user_id: rc.userId,
        completed_date: rc.completedDate,
      }),
      () => set((s) => ({ routineCompletions: s.routineCompletions.filter((x) => x.id !== rc.id) })),
    );
  },
  deleteRoutineCompletion: (id) => {
    const before = get().routineCompletions.find((rc) => rc.id === id);
    set((s) => ({ routineCompletions: s.routineCompletions.filter((rc) => rc.id !== id) }));
    runWrite(
      "Routine completion could not be removed",
      supabase.from("routine_completions").delete().eq("id", id),
      before ? () => set((s) => ({ routineCompletions: [...s.routineCompletions, before] })) : undefined,
    );
  },
  addSopItem: (item) => {
    set((s) => ({ sopItems: [...s.sopItems, item] }));
    runWrite(
      "SOP item could not be saved",
      supabase.from("sop_items").insert({
        id: item.id,
        organisation_id: item.organisationId,
        owner_user_id: item.ownerUserId,
        trigger_when: item.triggerWhen,
        instruction: item.instruction,
        position: item.position,
      }),
      () => set((s) => ({ sopItems: s.sopItems.filter((x) => x.id !== item.id) })),
    );
  },
  updateSopItem: (id, updates) => {
    set((s) => ({ sopItems: s.sopItems.map((x) => (x.id === id ? { ...x, ...updates } : x)) }));
    runWrite(
      "SOP item update could not be saved",
      supabase.from("sop_items").update(buildDbUpdate(updates, sopFields)).eq("id", id),
    );
  },
  deleteSopItem: (id) => {
    const before = get().sopItems.find((x) => x.id === id);
    set((s) => ({ sopItems: s.sopItems.filter((x) => x.id !== id) }));
    runWrite(
      "SOP item could not be deleted",
      supabase.from("sop_items").delete().eq("id", id),
      before ? () => set((s) => ({ sopItems: [...s.sopItems, before] })) : undefined,
    );
  },

  // --------------------------------------------------------------------------
  // Webhook sources (Integrations)
  // --------------------------------------------------------------------------

  addWebhookSource: (source) => {
    set((s) => ({ webhookSources: [...s.webhookSources, source] }));
    runWrite(
      "Webhook source could not be saved",
      supabase.from("webhook_sources").insert({
        id: source.id,
        organisation_id: source.organisationId,
        name: source.name,
        slug: source.slug,
        description: source.description,
        created_by: source.createdBy,
      }),
      () => set((s) => ({ webhookSources: s.webhookSources.filter((x) => x.id !== source.id) })),
    );
  },
  updateWebhookSource: (id, updates) => {
    set((s) => ({
      webhookSources: s.webhookSources.map((x) => (x.id === id ? { ...x, ...updates } : x)),
    }));
    runWrite(
      "Webhook source update could not be saved",
      supabase.from("webhook_sources").update(buildDbUpdate(updates, webhookSourceFields)).eq("id", id),
    );
  },
  deleteWebhookSource: (id) => {
    const before = get().webhookSources.find((x) => x.id === id);
    set((s) => ({ webhookSources: s.webhookSources.filter((x) => x.id !== id) }));
    runWrite(
      "Webhook source could not be deleted",
      supabase.from("webhook_sources").delete().eq("id", id),
      before ? () => set((s) => ({ webhookSources: [...s.webhookSources, before] })) : undefined,
    );
  },

  // --------------------------------------------------------------------------
  // Profile
  // --------------------------------------------------------------------------

  updateProfile: (updates) => {
    set((s) => (s.profile ? { profile: { ...s.profile, ...updates } } : {}));
    const profile = get().profile;
    if (!profile) return;
    const dbUpdate: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdate.display_name = updates.displayName;
    if (updates.avatarUrl !== undefined) dbUpdate.avatar_url = updates.avatarUrl;
    if (updates.preferences !== undefined) dbUpdate.preferences = updates.preferences;
    if (Object.keys(dbUpdate).length === 0) return;
    runWrite(
      "Profile update could not be saved",
      supabase.from("profiles").update(dbUpdate).eq("id", profile.id),
    );
  },

  // --------------------------------------------------------------------------
  // Gathered ("Today")
  // --------------------------------------------------------------------------

  setGatheredTasks: (taskIds, orderIds) => {
    upsertGathered(set, get, { taskIds, orderIds });
  },
  scheduleGatheredTask: (taskId, slot) => {
    const current = get().gathered?.schedule ?? {};
    upsertGathered(set, get, { schedule: { ...current, [taskId]: slot } });
  },
  setGatheredTaskDuration: (taskId, duration) => {
    const current = get().gathered?.durations ?? {};
    upsertGathered(set, get, { durations: { ...current, [taskId]: duration } });
  },
  unscheduleGatheredTask: (taskId) => {
    const sched = { ...(get().gathered?.schedule ?? {}) };
    const dur = { ...(get().gathered?.durations ?? {}) };
    delete sched[taskId];
    delete dur[taskId];
    upsertGathered(set, get, { schedule: sched, durations: dur });
  },
  clearGathered: () => {
    upsertGathered(set, get, { taskIds: [], orderIds: [], schedule: {}, durations: {} });
  },

  // Today convenience — kept in lockstep with `gathered.taskIds` via
  // upsertGathered. Reads stay cheap (a Set ref); writes go through the
  // debounced persistence path so the UI feels instant.
  todayIds: new Set<string>(),
  addToday: (id) => {
    const g = get().gathered;
    const existing = g?.taskIds ?? [];
    if (existing.includes(id)) return;
    const taskIds = [...existing, id];
    const orderIds = [...(g?.orderIds ?? []), id];
    upsertGathered(set, get, { taskIds, orderIds });
  },
  removeToday: (id) => {
    const g = get().gathered;
    if (!g) return;
    const taskIds = g.taskIds.filter((x) => x !== id);
    const orderIds = g.orderIds.filter((x) => x !== id);
    const schedule = { ...g.schedule }; delete schedule[id];
    const durations = { ...g.durations }; delete durations[id];
    upsertGathered(set, get, { taskIds, orderIds, schedule, durations });
  },
  clearToday: () => {
    upsertGathered(set, get, { taskIds: [], orderIds: [], schedule: {}, durations: {} });
  },
}));

// ============================================================================
// Gathered-state helper (debounced upsert preserved from v1)
// ============================================================================

type GatheredPatch = {
  taskIds?: string[];
  orderIds?: string[];
  schedule?: Record<string, number>;
  durations?: Record<string, number>;
};

let gatheredSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingGatheredPatch: { userId: string; organisationId: string; payload: GatheredState } | null = null;

function upsertGathered(
  set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
  patch: GatheredPatch,
) {
  const state = get();
  const org = state.currentOrg;
  const userId = state.currentMembership?.userId;
  if (!org || !userId) return;

  const merged: GatheredState = state.gathered
    ? { ...state.gathered, ...patch, updatedAt: new Date().toISOString() }
    : {
        id: crypto.randomUUID(),
        userId,
        organisationId: org.id,
        taskIds: patch.taskIds ?? [],
        orderIds: patch.orderIds ?? [],
        schedule: patch.schedule ?? {},
        durations: patch.durations ?? {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
  set({ gathered: merged, todayIds: new Set(merged.taskIds) });
  pendingGatheredPatch = { userId, organisationId: org.id, payload: merged };

  if (gatheredSaveTimer) clearTimeout(gatheredSaveTimer);
  gatheredSaveTimer = setTimeout(() => {
    gatheredSaveTimer = null;
    const p = pendingGatheredPatch;
    pendingGatheredPatch = null;
    if (p) void writeGatheredNow(p);
  }, 400);
}

async function writeGatheredNow(p: { userId: string; organisationId: string; payload: GatheredState }) {
  try {
    await supabase.from("gathered_state").upsert({
      user_id: p.userId,
      organisation_id: p.organisationId,
      task_ids: p.payload.taskIds,
      order_ids: p.payload.orderIds,
      schedule: p.payload.schedule,
      durations: p.payload.durations,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,organisation_id" });
  } catch (e) {
    console.error("[gathered] save failed", e);
  }
}

function flushPendingGathered() {
  if (!pendingGatheredPatch) return;
  if (gatheredSaveTimer) {
    clearTimeout(gatheredSaveTimer);
    gatheredSaveTimer = null;
  }
  const p = pendingGatheredPatch;
  pendingGatheredPatch = null;
  void writeGatheredNow(p);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPendingGathered);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingGathered();
  });
}

// ============================================================================
// Derived selectors — bridges so v1-style pages keep compiling during the
// page-by-page rewrite in phases 3–4. Delete once consumers use wbsNodes
// directly.
// ============================================================================

export function selectByType(nodes: WbsNode[], type: NodeType): WbsNode[] {
  return nodes.filter((n) => n.nodeType === type);
}

export function selectChildren(nodes: WbsNode[], parentId: string | null): WbsNode[] {
  return nodes.filter((n) => n.parentId === parentId);
}
