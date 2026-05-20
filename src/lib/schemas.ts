import { z } from "zod";
import type { NodeType } from "./types";

// Single source of truth for form validation. Each schema mirrors the v2
// DB column constraints and the store-side clamp in clampNotesField.
// Failures surface via toast in the dialog handlers so users see *why* the
// save was rejected.

const NOTES_MAX = 5000;
const SHORT_TEXT_MAX = 500;
const NAME_MAX = 200;
const TINY_TEXT_MAX = 100;

// ISO YYYY-MM-DD or empty
const dateString = z
  .string()
  .refine(
    (v) => v === "" || !Number.isNaN(new Date(v).getTime()),
    { message: "Must be a valid date" },
  );

const optionalUuid = z
  .string()
  .uuid()
  .nullable()
  .optional();

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const actionSchema = z.object({
  task: z
    .string()
    .trim()
    .min(1, { message: "Task is required" })
    .max(SHORT_TEXT_MAX, { message: `Task must be ${SHORT_TEXT_MAX} characters or fewer` }),
  wbsNodeId: optionalUuid,
  assignedTo: optionalUuid,
  startDate: dateString.default(""),
  dueDate: dateString.default(""),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  status: z.enum(["not_started", "in_progress", "complete", "blocked"]).default("not_started"),
  notes: z.string().max(NOTES_MAX, { message: `Notes must be ${NOTES_MAX} characters or fewer` }).default(""),
  labels: z.array(z.string().trim().max(TINY_TEXT_MAX)).default([]),
});

// ---------------------------------------------------------------------------
// Waiting items
// ---------------------------------------------------------------------------

export const waitingItemSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, { message: "Description is required" })
      .max(SHORT_TEXT_MAX, { message: `Description must be ${SHORT_TEXT_MAX} characters or fewer` }),
    wbsNodeId: optionalUuid,
    fromUserId: optionalUuid,
    fromWhomText: z.string().trim().max(TINY_TEXT_MAX).default(""),
    askedOn: dateString.default(""),
    dueBy: dateString.default(""),
    status: z.enum(["pending", "received", "overdue"]).default("pending"),
    notes: z.string().max(NOTES_MAX, { message: `Notes must be ${NOTES_MAX} characters or fewer` }).default(""),
  })
  .refine(
    (v) => Boolean(v.fromUserId) || (v.fromWhomText && v.fromWhomText.length > 0),
    { message: "Specify who you're waiting on (a user or a name)", path: ["fromWhomText"] },
  );

// ---------------------------------------------------------------------------
// WBS nodes
// ---------------------------------------------------------------------------

export const wbsNodeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(NAME_MAX, { message: `Name must be ${NAME_MAX} characters or fewer` }),
  description: z.string().max(NOTES_MAX).default(""),
  nodeType: z.enum(["portfolio", "programme", "project", "work_package"]),
  parentId: optionalUuid,
  position: z.number().int().nonnegative().default(0),

  // Project-only
  projectStatus: z.enum(["active", "on_hold", "complete"]).nullable().optional(),

  // Work-package-only
  leadUserId: optionalUuid,
  startDate: dateString.default(""),
  dueDate: dateString.default(""),
  ragStatus: z.enum(["green", "amber", "red"]).nullable().optional(),
  blockers: z.string().max(NOTES_MAX).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Organisations (bootstrap form)
// ---------------------------------------------------------------------------

export const organisationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Organisation name is required" })
    .max(NAME_MAX, { message: `Name must be ${NAME_MAX} characters or fewer` }),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,79}$/, {
      message: "Slug must be lowercase letters, digits, and hyphens",
    })
    .optional()
    .or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Inbox item updates
// ---------------------------------------------------------------------------

export const inboxItemSchema = z.object({
  task: z.string().trim().min(1).max(SHORT_TEXT_MAX),
  wbsNodeId: optionalUuid,
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  dueDate: dateString.default(""),
  notes: z.string().max(NOTES_MAX).default(""),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function firstZodError(error: z.ZodError): string {
  const first = error.issues[0];
  return first?.message ?? "Invalid form data";
}

// Hierarchy validity helper — given a parent node's type, returns the allowed
// child types. Matches the foundation-migration trigger (`enforce_wbs_parent`).
export function allowedChildTypes(parentType: NodeType | null): NodeType[] {
  if (parentType === null) return ["portfolio", "programme", "project", "work_package"];
  if (parentType === "portfolio") return ["programme", "project", "work_package"];
  if (parentType === "programme") return ["project", "work_package"];
  if (parentType === "project") return ["work_package"];
  return []; // work_package has no children
}
