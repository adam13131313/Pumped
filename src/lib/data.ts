import { WorkPackage, Action, WaitingItem, Project, Programme } from "./types";

export const programmes: Programme[] = [
  { id: "prog1", name: "Digital Transformation", description: "Enterprise digital modernisation programme" },
];

export const projects: Project[] = [
  { id: "proj1", name: "Website Redesign", description: "Redesign the corporate website for improved UX", programmeId: "prog1", status: "Active" },
  { id: "proj2", name: "CRM Migration", description: "Migrate legacy CRM to a modern cloud platform", programmeId: "prog1", status: "Active" },
  { id: "proj3", name: "Office Relocation", description: "Coordinate the move to new headquarters", programmeId: "", status: "Active" },
];

export const workPackages: WorkPackage[] = [
  { id: "wp1", project: "Website Redesign", workPackage: "WP1: UX Research", wpLead: "Alex J.", dueDate: "2026-03-20", ragStatus: "Green", blockers: "" },
  { id: "wp2", project: "Website Redesign", workPackage: "WP2: Visual Design", wpLead: "Morgan T.", dueDate: "2026-04-10", ragStatus: "Amber", blockers: "Awaiting brand guidelines" },
  { id: "wp3", project: "CRM Migration", workPackage: "WP1: Data Audit", wpLead: "Sam P.", dueDate: "2026-03-15", ragStatus: "Green", blockers: "" },
  { id: "wp4", project: "CRM Migration", workPackage: "WP2: System Integration", wpLead: "Jordan K.", dueDate: "2026-05-01", ragStatus: "Red", blockers: "API compatibility issue" },
  { id: "wp5", project: "Office Relocation", workPackage: "WP1: Vendor Selection", wpLead: "Chris L.", dueDate: "2026-03-25", ragStatus: "Green", blockers: "" },
];

export const actions: Action[] = [
  { id: "a1", task: "Draft wireframes for homepage redesign", project: "Website Redesign", workPackage: "WP1: UX Research", dueDate: "2026-03-10", priority: "High", status: "In Progress", notes: "" },
  { id: "a2", task: "Review vendor shortlist for CRM platform", project: "CRM Migration", workPackage: "WP1: Data Audit", dueDate: "2026-03-12", priority: "High", status: "Not Started", notes: "" },
  { id: "a3", task: "Confirm floor plan with facilities team", project: "Office Relocation", workPackage: "WP1: Vendor Selection", dueDate: "2026-03-18", priority: "Medium", status: "Not Started", notes: "" },
  { id: "a4", task: "Prepare stakeholder update presentation", project: "", workPackage: "", dueDate: "2026-03-14", priority: "Medium", status: "Not Started", notes: "" },
  { id: "a5", task: "Schedule team retrospective for Q1", project: "", workPackage: "", dueDate: "2026-03-20", priority: "Low", status: "Not Started", notes: "" },
];

export const waitingItems: WaitingItem[] = [
  { id: "w1", description: "Brand guidelines document from marketing", fromWhom: "Marketing Team", projectWP: "Website Redesign", askedOn: "2026-02-28", dueBy: "2026-03-08", status: "Pending", notes: "" },
  { id: "w2", description: "API documentation from vendor", fromWhom: "Vendor Support", projectWP: "CRM Migration", askedOn: "2026-03-01", dueBy: "2026-03-10", status: "Pending", notes: "" },
];
