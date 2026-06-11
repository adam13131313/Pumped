#!/usr/bin/env node
/**
 * Pumped MCP server — local-only spike.
 *
 * Exposes Pumped's commitment graph (actions, waiting items, WBS nodes)
 * to Claude Desktop and other MCP clients so the user's existing Claude-chat
 * workflows (meeting reconciliation, bulk import, ad-hoc queries) can
 * read and write Pumped directly.
 *
 * Auth model: SERVICE ROLE key from env, bypassing RLS. All operations
 * are manually scoped to PUMPED_ORGANISATION_ID. This is appropriate for
 * a single-user local spike. A real product MCP server would use per-user
 * OAuth + scoped tokens.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config + client
// ---------------------------------------------------------------------------

const SUPABASE_URL = required("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const PUMPED_USER_ID = required("PUMPED_USER_ID");
const PUMPED_ORG_ID = required("PUMPED_ORGANISATION_ID");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[pumped-mcp] missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function err(message: string, detail?: unknown) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message, detail }, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "pumped", version: "0.1.0" });

// ---------------------------------------------------------------------------
// WBS tools
// ---------------------------------------------------------------------------

const nodeTypeSchema = z.enum(["portfolio", "programme", "project", "work_package"]);

server.tool(
  "list_wbs_nodes",
  "List the WBS hierarchy (portfolios, programmes, projects, work packages). Use this before creating commitments to find the right parent node, or before creating new nodes to see what already exists. Returns flat list with parent_id for tree reconstruction.",
  {
    nodeType: nodeTypeSchema.optional().describe("Filter to one type only"),
    includeArchived: z.boolean().default(false),
  },
  async ({ nodeType, includeArchived }) => {
    let q = supabase
      .from("wbs_nodes")
      .select("id, parent_id, node_type, name, description, position, project_status, lead_user_id, start_date, due_date, rag_status, blockers, archived_at, created_at")
      .eq("organisation_id", PUMPED_ORG_ID)
      .order("position", { ascending: true });
    if (nodeType) q = q.eq("node_type", nodeType);
    if (!includeArchived) q = q.is("archived_at", null);
    const { data, error } = await q;
    if (error) return err("Failed to list WBS nodes", error.message);
    return ok({ count: data?.length ?? 0, nodes: data ?? [] });
  },
);

server.tool(
  "create_wbs_node",
  "Create a new WBS node. node_type must reflect the level: portfolio (top), programme (under portfolio), project (under programme), work_package (under project). parent_id is required for everything except portfolio. Work-package-only fields (lead_user_id, start_date, due_date, rag_status) only apply when node_type is 'work_package'. project_status only applies when node_type is 'project'.",
  {
    name: z.string().min(1).max(200),
    nodeType: nodeTypeSchema,
    parentId: z.string().uuid().nullable().optional(),
    description: z.string().max(5000).optional(),
    position: z.number().int().optional(),
    projectStatus: z.enum(["active", "on_hold", "complete"]).optional(),
    startDate: z.string().optional().describe("YYYY-MM-DD, work_package only"),
    dueDate: z.string().optional().describe("YYYY-MM-DD, work_package only"),
    ragStatus: z.enum(["green", "amber", "red"]).optional().describe("work_package only"),
    blockers: z.string().max(5000).optional().describe("work_package only"),
  },
  async (input) => {
    if (input.nodeType !== "portfolio" && !input.parentId) {
      return err("parentId is required for non-portfolio nodes");
    }
    const row: Record<string, unknown> = {
      organisation_id: PUMPED_ORG_ID,
      parent_id: input.parentId ?? null,
      node_type: input.nodeType,
      name: input.name,
      description: input.description ?? "",
      position: input.position ?? 0,
      created_by: PUMPED_USER_ID,
    };
    if (input.nodeType === "project" && input.projectStatus) {
      row.project_status = input.projectStatus;
    }
    if (input.nodeType === "work_package") {
      if (input.startDate) row.start_date = input.startDate;
      if (input.dueDate) row.due_date = input.dueDate;
      if (input.ragStatus) row.rag_status = input.ragStatus;
      if (input.blockers) row.blockers = input.blockers;
    }
    const { data, error } = await supabase.from("wbs_nodes").insert(row).select().single();
    if (error) return err("Failed to create WBS node", error.message);
    return ok(data);
  },
);

// ---------------------------------------------------------------------------
// Commitment tools (actions + waiting items)
// ---------------------------------------------------------------------------

const commitmentTypeSchema = z.enum(["action", "waiting"]);

server.tool(
  "list_commitments",
  "List commitments — actions (things to do) and/or waiting items (things owed to me). Use this BEFORE creating new commitments (to avoid duplicates) and during meeting reconciliation (to find existing items that may have status changes). Filter by type, status, WBS node, or assignee.",
  {
    type: commitmentTypeSchema.optional().describe("'action' for actions only, 'waiting' for waiting items only, omit for both"),
    actionStatus: z.enum(["not_started", "in_progress", "complete", "blocked", "cancelled", "deferred"]).optional(),
    waitingStatus: z.enum(["pending", "received", "overdue"]).optional(),
    wbsNodeId: z.string().uuid().optional(),
    assignedTo: z.string().uuid().nullable().optional().describe("Filter actions by assignee. Pass null for unassigned, omit for any."),
    includeArchived: z.boolean().default(false),
    limit: z.number().int().min(1).max(500).default(200),
  },
  async (input) => {
    const result: { actions?: unknown[]; waiting?: unknown[] } = {};

    if (!input.type || input.type === "action") {
      let q = supabase
        .from("actions")
        .select("id, wbs_node_id, assigned_to, task, priority, status, start_date, due_date, completed_at, notes, labels, created_at, updated_at, archived_at")
        .eq("organisation_id", PUMPED_ORG_ID)
        .order("created_at", { ascending: false })
        .limit(input.limit);
      if (input.actionStatus) q = q.eq("status", input.actionStatus);
      if (input.wbsNodeId) q = q.eq("wbs_node_id", input.wbsNodeId);
      if (input.assignedTo === null) q = q.is("assigned_to", null);
      else if (input.assignedTo) q = q.eq("assigned_to", input.assignedTo);
      if (!input.includeArchived) q = q.is("archived_at", null);
      const { data, error } = await q;
      if (error) return err("Failed to list actions", error.message);
      result.actions = data ?? [];
    }

    if (!input.type || input.type === "waiting") {
      let q = supabase
        .from("waiting_items")
        .select("id, wbs_node_id, from_user_id, from_whom_text, description, asked_on, due_by, status, notes, created_at, updated_at")
        .eq("organisation_id", PUMPED_ORG_ID)
        .order("created_at", { ascending: false })
        .limit(input.limit);
      if (input.waitingStatus) q = q.eq("status", input.waitingStatus);
      if (input.wbsNodeId) q = q.eq("wbs_node_id", input.wbsNodeId);
      const { data, error } = await q;
      if (error) return err("Failed to list waiting items", error.message);
      result.waiting = data ?? [];
    }

    return ok(result);
  },
);

server.tool(
  "get_commitment",
  "Get the full details of one commitment by id. Use after list_commitments to inspect a specific candidate for update or closure.",
  {
    id: z.string().uuid(),
    type: commitmentTypeSchema,
  },
  async ({ id, type }) => {
    const table = type === "action" ? "actions" : "waiting_items";
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("organisation_id", PUMPED_ORG_ID)
      .maybeSingle();
    if (error) return err(`Failed to get ${type}`, error.message);
    if (!data) return err(`${type} not found`, { id });
    return ok(data);
  },
);

server.tool(
  "create_commitment",
  "Create a new commitment. type='action' for something to do (the user holds it), type='waiting' for something owed to the user by someone else. For actions, pass `task` as the title. For waiting items, pass `description` as the title and either fromUserId or fromWhomText to indicate who owes it.",
  {
    type: commitmentTypeSchema,
    task: z.string().max(500).optional().describe("Action: required, the title starting with a verb"),
    description: z.string().max(500).optional().describe("Waiting: required, the title"),
    wbsNodeId: z.string().uuid().nullable().optional(),

    // Action fields
    priority: z.enum(["high", "medium", "low"]).optional(),
    actionStatus: z.enum(["not_started", "in_progress", "complete", "blocked", "cancelled", "deferred"]).optional(),
    assignedTo: z.string().uuid().nullable().optional().describe("Action: defaults to current user if omitted"),
    startDate: z.string().optional().describe("YYYY-MM-DD"),
    dueDate: z.string().optional().describe("YYYY-MM-DD (for action; for waiting use dueBy)"),
    notes: z.string().max(5000).optional(),
    labels: z.array(z.string()).optional(),

    // Waiting-item fields
    fromUserId: z.string().uuid().nullable().optional(),
    fromWhomText: z.string().max(200).optional(),
    askedOn: z.string().optional().describe("YYYY-MM-DD"),
    dueBy: z.string().optional().describe("YYYY-MM-DD"),
    waitingStatus: z.enum(["pending", "received", "overdue"]).optional(),
  },
  async (input) => {
    if (input.type === "action") {
      if (!input.task) return err("`task` is required for type='action'");
      const row: Record<string, unknown> = {
        organisation_id: PUMPED_ORG_ID,
        wbs_node_id: input.wbsNodeId ?? null,
        assigned_to: input.assignedTo === undefined ? PUMPED_USER_ID : input.assignedTo,
        created_by: PUMPED_USER_ID,
        task: input.task,
        priority: input.priority ?? "medium",
        status: input.actionStatus ?? "not_started",
        start_date: input.startDate ?? null,
        due_date: input.dueDate ?? null,
        notes: input.notes ?? "",
        labels: input.labels ?? [],
      };
      const { data, error } = await supabase.from("actions").insert(row).select().single();
      if (error) return err("Failed to create action", error.message);
      return ok({ type: "action", ...data });
    }

    if (!input.description) return err("`description` is required for type='waiting'");
    if (!input.fromUserId && !input.fromWhomText) {
      return err("`fromUserId` or `fromWhomText` is required for type='waiting'");
    }
    const row: Record<string, unknown> = {
      organisation_id: PUMPED_ORG_ID,
      wbs_node_id: input.wbsNodeId ?? null,
      from_user_id: input.fromUserId ?? null,
      from_whom_text: input.fromWhomText ?? null,
      description: input.description,
      asked_on: input.askedOn ?? null,
      due_by: input.dueBy ?? null,
      status: input.waitingStatus ?? "pending",
      notes: input.notes ?? "",
      created_by: PUMPED_USER_ID,
    };
    const { data, error } = await supabase.from("waiting_items").insert(row).select().single();
    if (error) return err("Failed to create waiting item", error.message);
    return ok({ type: "waiting", ...data });
  },
);

server.tool(
  "update_commitment",
  "Patch an existing commitment. Pass only the fields you want to change. For actions, setting actionStatus='complete' will also set completed_at automatically.",
  {
    id: z.string().uuid(),
    type: commitmentTypeSchema,

    task: z.string().max(500).optional(),
    description: z.string().max(500).optional(),
    wbsNodeId: z.string().uuid().nullable().optional(),

    priority: z.enum(["high", "medium", "low"]).optional(),
    actionStatus: z.enum(["not_started", "in_progress", "complete", "blocked", "cancelled", "deferred"]).optional(),
    assignedTo: z.string().uuid().nullable().optional(),
    startDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    notes: z.string().max(5000).optional(),
    labels: z.array(z.string()).optional(),

    fromUserId: z.string().uuid().nullable().optional(),
    fromWhomText: z.string().max(200).nullable().optional(),
    askedOn: z.string().nullable().optional(),
    dueBy: z.string().nullable().optional(),
    waitingStatus: z.enum(["pending", "received", "overdue"]).optional(),
  },
  async (input) => {
    const patch: Record<string, unknown> = {};

    if (input.type === "action") {
      if (input.task !== undefined) patch.task = input.task;
      if (input.priority !== undefined) patch.priority = input.priority;
      if (input.actionStatus !== undefined) {
        patch.status = input.actionStatus;
        if (input.actionStatus === "complete") patch.completed_at = new Date().toISOString();
        else patch.completed_at = null;
      }
      if (input.assignedTo !== undefined) patch.assigned_to = input.assignedTo;
      if (input.startDate !== undefined) patch.start_date = input.startDate;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      if (input.notes !== undefined) patch.notes = input.notes;
      if (input.labels !== undefined) patch.labels = input.labels;
      if (input.wbsNodeId !== undefined) patch.wbs_node_id = input.wbsNodeId;

      if (Object.keys(patch).length === 0) return err("No fields to update");
      const { data, error } = await supabase
        .from("actions")
        .update(patch)
        .eq("id", input.id)
        .eq("organisation_id", PUMPED_ORG_ID)
        .select()
        .single();
      if (error) return err("Failed to update action", error.message);
      return ok({ type: "action", ...data });
    }

    if (input.description !== undefined) patch.description = input.description;
    if (input.fromUserId !== undefined) patch.from_user_id = input.fromUserId;
    if (input.fromWhomText !== undefined) patch.from_whom_text = input.fromWhomText;
    if (input.askedOn !== undefined) patch.asked_on = input.askedOn;
    if (input.dueBy !== undefined) patch.due_by = input.dueBy;
    if (input.waitingStatus !== undefined) patch.status = input.waitingStatus;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.wbsNodeId !== undefined) patch.wbs_node_id = input.wbsNodeId;

    if (Object.keys(patch).length === 0) return err("No fields to update");
    const { data, error } = await supabase
      .from("waiting_items")
      .update(patch)
      .eq("id", input.id)
      .eq("organisation_id", PUMPED_ORG_ID)
      .select()
      .single();
    if (error) return err("Failed to update waiting item", error.message);
    return ok({ type: "waiting", ...data });
  },
);

server.tool(
  "close_commitment",
  "Convenience wrapper to close a commitment. For actions, sets status='complete' and completed_at=now. For waiting items, sets status='received'. Equivalent to update_commitment with the right status.",
  {
    id: z.string().uuid(),
    type: commitmentTypeSchema,
    note: z.string().max(5000).optional().describe("Optional closure note appended to notes field"),
  },
  async ({ id, type, note }) => {
    const patch: Record<string, unknown> =
      type === "action"
        ? { status: "complete", completed_at: new Date().toISOString() }
        : { status: "received" };

    if (note) {
      const { data: existing } = await supabase
        .from(type === "action" ? "actions" : "waiting_items")
        .select("notes")
        .eq("id", id)
        .eq("organisation_id", PUMPED_ORG_ID)
        .maybeSingle();
      const prev = (existing as { notes?: string } | null)?.notes ?? "";
      patch.notes = prev ? `${prev}\n\n[closed] ${note}` : `[closed] ${note}`;
    }

    const table = type === "action" ? "actions" : "waiting_items";
    const { data, error } = await supabase
      .from(table)
      .update(patch)
      .eq("id", id)
      .eq("organisation_id", PUMPED_ORG_ID)
      .select()
      .single();
    if (error) return err(`Failed to close ${type}`, error.message);
    return ok({ type, ...data });
  },
);

// ---------------------------------------------------------------------------
// Connect transport
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("[pumped-mcp] connected via stdio");
