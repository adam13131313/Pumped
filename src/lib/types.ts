export type RAGStatus = "Green" | "Amber" | "Red";
export type TaskStatus = "Not Started" | "In Progress" | "Complete" | "Blocked";
export type Priority = "High" | "Medium" | "Low";
export type WaitingStatus = "Pending" | "Received" | "Overdue";
export type DependencyType = "FS" | "FF" | "SS" | "SF";

export interface Dependency {
  targetId: string; // the WP id this depends on
  type: DependencyType;
  lagDays?: number; // optional lag/lead time in days
}

export interface Programme {
  id: string;
  name: string;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  programmeId: string; // empty string = standalone (no programme)
  status: "Active" | "On Hold" | "Complete";
}

export interface WorkPackage {
  id: string;
  project: string;
  workPackage: string;
  wpLead: string;
  startDate: string;
  dueDate: string;
  ragStatus: RAGStatus;
  blockers: string;
  dependencies: Dependency[];
}

export interface Action {
  id: string;
  task: string;
  project: string;
  workPackage: string;
  startDate: string;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  notes: string;
  completedAt?: string;
  labels: string[];
}

export interface WaitingItem {
  id: string;
  description: string;
  fromWhom: string;
  projectWP: string;
  askedOn: string;
  dueBy: string;
  status: WaitingStatus;
  notes: string;
}

export interface InboxItem {
  id: string;
  task: string;
  priority: Priority;
  dueDate: string;
  project: string;
  notes: string;
  source: string; // e.g. "voice memo", "notes", "spreadsheet"
  createdAt: string;
}
