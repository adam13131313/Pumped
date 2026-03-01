import { WorkPackage, Action, WaitingItem, Project, Programme } from "./types";

export const programmes: Programme[] = [
  { id: "prog1", name: "P3M Standards Programme", description: "Standards development and framework programme" },
];

export const projects: Project[] = [
  { id: "proj1", name: "Project Alpha", description: "Discovery and stakeholder engagement programme", programmeId: "", status: "Active" },
  { id: "proj2", name: "Project Beta", description: "Planning, implementation and reporting", programmeId: "", status: "Active" },
  { id: "proj3", name: "Ongoing Ops", description: "Governance and compliance operations", programmeId: "", status: "Active" },
  { id: "proj4", name: "Project 1: P3M SDF", description: "P3M standards development framework", programmeId: "prog1", status: "Active" },
  { id: "proj5", name: "Project 4: Infrastructure", description: "Infrastructure management", programmeId: "prog1", status: "Active" },
  { id: "proj6", name: "Team management", description: "People management and HR", programmeId: "", status: "Active" },
];

export const workPackages: WorkPackage[] = [
  { id: "wp1", project: "Project Alpha", workPackage: "WP1: Discovery & Research", wpLead: "Sarah K.", dueDate: "2026-03-15", ragStatus: "Green", blockers: "" },
  { id: "wp2", project: "Project Alpha", workPackage: "WP2: Stakeholder Engagement", wpLead: "Tom R.", dueDate: "2026-03-31", ragStatus: "Amber", blockers: "Waiting on legal sign-off" },
  { id: "wp3", project: "Project Alpha", workPackage: "WP3: Deliverable Production", wpLead: "Sarah K.", dueDate: "2026-04-30", ragStatus: "Green", blockers: "" },
  { id: "wp4", project: "Project Beta", workPackage: "WP1: Planning & Scoping", wpLead: "James L.", dueDate: "2026-02-28", ragStatus: "Red", blockers: "Resource constraint — escalate" },
  { id: "wp5", project: "Project Beta", workPackage: "WP2: Implementation", wpLead: "Priya M.", dueDate: "2026-05-15", ragStatus: "Green", blockers: "" },
  { id: "wp6", project: "Project Beta", workPackage: "WP3: Reporting", wpLead: "Tom R.", dueDate: "2026-05-31", ragStatus: "Green", blockers: "" },
  { id: "wp7", project: "Ongoing Ops", workPackage: "WP1: Governance & Compliance", wpLead: "James L.", dueDate: "Ongoing", ragStatus: "Amber", blockers: "Monthly report overdue" },
];

export const actions: Action[] = [
  { id: "a1", task: "Add to the Opportunity Acceptance Guidance - system development notes, internal P3M version, KPIs", project: "Project 1: P3M SDF", workPackage: "WP:010 Guidance", dueDate: "2026-02-19", priority: "High", status: "In Progress", notes: "" },
  { id: "a2", task: "Capability team guidance documentation", project: "Project 1: P3M SDF", workPackage: "WP: 009", dueDate: "2026-02-19", priority: "High", status: "In Progress", notes: "" },
  { id: "a3", task: "Technical Standard comments to Gordon after my team reviews today", project: "Project 1: P3M SDF", workPackage: "WP:002 - Policy and Standard development", dueDate: "2026-02-19", priority: "High", status: "Not Started", notes: "" },
  { id: "a4", task: "ToR for my support role on the infrastructure management work", project: "Project 4: Infrastructure", workPackage: "04.01 Policy and Standard", dueDate: "2026-02-24", priority: "High", status: "Not Started", notes: "" },
  { id: "a5", task: "Review Million's 2025 self assessment PER", project: "Team management", workPackage: "NA", dueDate: "2026-02-23", priority: "High", status: "Not Started", notes: "" },
  { id: "a6", task: "Complete the P3M work breakdown structure, work plan, and resource allocation model", project: "", workPackage: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "" },
  { id: "a7", task: "Review Alfredo's Work Packages and Ad Hoc Work Overview document", project: "", workPackage: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "" },
  { id: "a8", task: "Review Alfredo's infrastructure analysis in detail", project: "", workPackage: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "" },
  { id: "a9", task: "Define and formalise Alfredo's areas of responsibility", project: "", workPackage: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "" },
  { id: "a10", task: "Prepare a structured responsibility and work allocation model for Alfredo", project: "", workPackage: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "" },
  { id: "a11", task: "Review Carlos' document on processes and governance structuring", project: "", workPackage: "", dueDate: "", priority: "Low", status: "Not Started", notes: "" },
  { id: "a12", task: "Oren's email re. PPP and uploading content", project: "", workPackage: "", dueDate: "", priority: "Low", status: "Not Started", notes: "" },
];

export const waitingItems: WaitingItem[] = [
  { id: "w1", description: "Model the key HR processes relevant to opportunity development and mobilisation", fromWhom: "Alfredo", projectWP: "Project 1", askedOn: "2026-02-20", dueBy: "2026-02-27", status: "Pending", notes: "" },
  { id: "w2", description: "Determine solution to keeping people updated - whether we use a requirements tracker or not", fromWhom: "", projectWP: "", askedOn: "", dueBy: "", status: "Pending", notes: "" },
];
