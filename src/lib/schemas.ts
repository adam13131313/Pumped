import { z } from "zod";

// Single source of truth for form validation. Each schema mirrors the DB
// column constraints and the store-side clamp in clampNotesField. Used by
// ActionDialog and WaitingDialog on submit; failures surface via toast so
// users see *why* the save was rejected instead of the previous silent
// no-op when description/task was empty.

const NOTES_MAX = 5000;
const SHORT_TEXT_MAX = 500;
const TINY_TEXT_MAX = 100;

// Accept "" (no date) or a YYYY-MM-DD / ISO date string that Date() can parse.
const dateString = z
  .string()
  .refine(
    (v) => v === "" || !Number.isNaN(new Date(v).getTime()),
    { message: "Must be a valid date" },
  );

export const actionSchema = z.object({
  task: z
    .string()
    .trim()
    .min(1, { message: "Task is required" })
    .max(SHORT_TEXT_MAX, { message: `Task must be ${SHORT_TEXT_MAX} characters or fewer` }),
  project: z.string().trim().max(SHORT_TEXT_MAX).default(""),
  workPackage: z.string().trim().max(SHORT_TEXT_MAX).default(""),
  startDate: dateString.default(""),
  dueDate: dateString.default(""),
  priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
  status: z.enum(["Not Started", "In Progress", "Complete", "Blocked"]).default("Not Started"),
  notes: z.string().max(NOTES_MAX, { message: `Notes must be ${NOTES_MAX} characters or fewer` }).default(""),
  labels: z.array(z.string().trim().max(TINY_TEXT_MAX)).default([]),
});

export type ActionFormInput = z.input<typeof actionSchema>;
export type ActionFormOutput = z.output<typeof actionSchema>;

export const waitingItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { message: "Description is required" })
    .max(SHORT_TEXT_MAX, { message: `Description must be ${SHORT_TEXT_MAX} characters or fewer` }),
  fromWhom: z.string().trim().max(TINY_TEXT_MAX).default(""),
  projectWP: z.string().trim().max(SHORT_TEXT_MAX).default(""),
  askedOn: dateString.default(""),
  dueBy: dateString.default(""),
  status: z.enum(["Pending", "Received", "Overdue"]).default("Pending"),
  notes: z.string().max(NOTES_MAX, { message: `Notes must be ${NOTES_MAX} characters or fewer` }).default(""),
  linkedProjectId: z.string().uuid().optional(),
});

export type WaitingItemFormInput = z.input<typeof waitingItemSchema>;
export type WaitingItemFormOutput = z.output<typeof waitingItemSchema>;

// Extracts the first error message from a SafeParseError, suitable for a
// toast. Returns null on success.
export function firstZodError(error: z.ZodError): string {
  const first = error.issues[0];
  return first?.message ?? "Invalid form data";
}
