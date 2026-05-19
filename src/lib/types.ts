// Domain types — thin, app-shaped wrappers over the generated Database types.
//
// We deliberately don't re-export `Database["public"]["Tables"]["X"]["Row"]`
// directly: those carry snake_case + `string | null` shapes designed for raw
// Supabase responses. The app prefers camelCase + narrower optionality so
// consumers don't have to write `task ?? ""` everywhere. Mappers in store.ts
// handle the boundary translation.

import type { Database } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Enums (lowercase, matching Postgres enums)
// ---------------------------------------------------------------------------

export type NodeType        = Database["public"]["Enums"]["node_type"];        // 'portfolio' | 'programme' | 'project' | 'work_package'
export type ActionPriority  = Database["public"]["Enums"]["action_priority"];  // 'high' | 'medium' | 'low'
export type ActionStatus    = Database["public"]["Enums"]["action_status"];    // 'not_started' | 'in_progress' | 'complete' | 'blocked'
export type RagStatus       = Database["public"]["Enums"]["rag_status"];       // 'green' | 'amber' | 'red'
export type WaitingStatus   = Database["public"]["Enums"]["waiting_status"];   // 'pending' | 'received' | 'overdue'
export type ProjectStatus   = Database["public"]["Enums"]["project_status"];   // 'active' | 'on_hold' | 'complete'
export type DependencyType  = Database["public"]["Enums"]["dependency_type"];  // 'fs' | 'ff' | 'ss' | 'sf'
export type MembershipRole  = Database["public"]["Enums"]["membership_role"];  // 'owner' | 'admin' | 'member'
export type RoutineTimeOfDay = Database["public"]["Enums"]["routine_time_of_day"];
export type RoutineFrequency = Database["public"]["Enums"]["routine_frequency"];

// ---------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------

export interface Organisation {
  id: string;
  name: string;
  slug: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganisationUnit {
  id: string;
  organisationId: string;
  parentUnitId: string | null;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  organisationId: string;
  userId: string;
  role: MembershipRole;
  unitId: string | null;
  invitedBy: string | null;
  invitedAt: string | null;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// WBS hierarchy — one type for all node kinds
// ---------------------------------------------------------------------------

export interface WbsNode {
  id: string;
  organisationId: string;
  parentId: string | null;
  nodeType: NodeType;
  name: string;
  description: string;
  position: number;
  archivedAt: string | null;

  // Project-only — populated when nodeType === 'project'
  projectStatus: ProjectStatus | null;

  // Work-package-only — populated when nodeType === 'work_package'
  leadUserId: string | null;
  startDate: string | null;
  dueDate: string | null;
  ragStatus: RagStatus | null;
  blockers: string | null;

  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WbsNodeDependency {
  id: string;
  organisationId: string;
  sourceNodeId: string;
  targetNodeId: string;
  dependencyType: DependencyType;
  lagDays: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Actions / Waiting / Inbox — all FK to wbs_nodes by UUID
// ---------------------------------------------------------------------------

export interface Action {
  id: string;
  organisationId: string;
  wbsNodeId: string | null;
  assignedTo: string | null;
  createdBy: string | null;

  task: string;
  priority: ActionPriority;
  status: ActionStatus;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  notes: string;
  labels: string[];

  notStartedSince: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WaitingItem {
  id: string;
  organisationId: string;
  wbsNodeId: string | null;

  // Either a known user (FK) or a free-text "from whom" name. The DB CHECK
  // requires at least one.
  fromUserId: string | null;
  fromWhomText: string | null;

  description: string;
  askedOn: string | null;
  dueBy: string | null;
  status: WaitingStatus;
  notes: string;

  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxItem {
  id: string;
  organisationId: string;
  sourceId: string | null;
  wbsNodeId: string | null;
  promotedToActionId: string | null;

  task: string;
  priority: ActionPriority;
  dueDate: string | null;
  notes: string;
  externalId: string | null;
  externalUrl: string | null;

  promotedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Routines + SOPs (personal, org-scoped)
// ---------------------------------------------------------------------------

export interface Routine {
  id: string;
  organisationId: string;
  ownerUserId: string;
  name: string;
  description: string;
  timeOfDay: RoutineTimeOfDay;
  frequencyType: RoutineFrequency;
  frequencyConfig: Record<string, unknown>;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineCompletion {
  id: string;
  organisationId: string;
  routineId: string;
  userId: string;
  completedDate: string;
  createdAt: string;
}

export interface SopItem {
  id: string;
  organisationId: string;
  ownerUserId: string;
  triggerWhen: string;
  instruction: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Today / Gathered (one row per (user, org))
// ---------------------------------------------------------------------------

export interface GatheredState {
  id: string;
  userId: string;
  organisationId: string;
  taskIds: string[];
  orderIds: string[];
  schedule: Record<string, number>;
  durations: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export interface WebhookSource {
  id: string;
  organisationId: string;
  name: string;
  slug: string;
  description: string;
  lastReceivedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationToken {
  id: string;
  organisationId: string;
  sourceId: string;
  tokenHash: string;
  tokenPrefix: string;
  revokedAt: string | null;
  revokedBy: string | null;
  createdBy: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Engagement / Knowledge / Feedback
// ---------------------------------------------------------------------------

export interface KbChatMessage {
  id: string;
  organisationId: string;
  userId: string;
  role: Database["public"]["Enums"]["kb_chat_role"];
  content: string;
  createdAt: string;
}

export interface FeatureSuggestion {
  id: string;
  organisationId: string;
  userId: string | null;
  title: string;
  description: string;
  githubIssueUrl: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Polymorphic attachments / comments (one FK column populated, others NULL)
// ---------------------------------------------------------------------------

export type DomainEntityKind = "action" | "waiting_item" | "wbs_node";

export interface Attachment {
  id: string;
  organisationId: string;
  actionId: string | null;
  waitingItemId: string | null;
  wbsNodeId: string | null;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploaderId: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  organisationId: string;
  actionId: string | null;
  waitingItemId: string | null;
  wbsNodeId: string | null;
  parentCommentId: string | null;
  authorId: string | null;
  content: string;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
}
