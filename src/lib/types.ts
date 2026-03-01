export type RAGStatus = "Green" | "Amber" | "Red";
export type TaskStatus = "Not Started" | "In Progress" | "Complete" | "Blocked";
export type Priority = "High" | "Medium" | "Low";
export type WaitingStatus = "Pending" | "Received" | "Overdue";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "Active" | "On Hold" | "Complete";
}

export interface WorkPackage {
  id: string;
  project: string;
  workPackage: string;
  wpLead: string;
  dueDate: string;
  ragStatus: RAGStatus;
  blockers: string;
}

export interface Action {
  id: string;
  task: string;
  project: string;
  workPackage: string;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  notes: string;
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
