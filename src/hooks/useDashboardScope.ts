import { useMemo } from "react";
import { useAppStore } from "@/lib/store";

export type ScopeLevel = "global" | "programme" | "project" | "wp" | "unassigned";

export interface DashboardScope {
  level: ScopeLevel;
  programmeId?: string;
  projectId?: string;
  workPackageId?: string;
  programmeName?: string;
  projectName?: string;
  workPackageName?: string;
  // Predicates / filtered slices
  projectNameSet: Set<string>;
  workPackageNameSet: Set<string> | null;  // null = all WPs in projectNameSet
  projectIdSet: Set<string>;
  workPackageIdSet: Set<string>;
  // Counts for the banner
  counts: { programmes: number; projects: number; workPackages: number; actions: number };
  label: string;
  subLabel: string;
}

export function useDashboardScope(): DashboardScope {
  const globalFilter = useAppStore((s) => s.globalFilter);
  const programmes = useAppStore((s) => s.programmes);
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);
  const actions = useAppStore((s) => s.actions);

  return useMemo(() => {
    const { programmeId, projectId, workPackageId, unassigned } = globalFilter;

    if (unassigned) {
      const ua = actions.filter((a) => !a.project && !a.workPackage).length;
      return {
        level: "unassigned",
        projectNameSet: new Set(),
        workPackageNameSet: new Set(),
        projectIdSet: new Set(),
        workPackageIdSet: new Set(),
        counts: { programmes: 0, projects: 0, workPackages: 0, actions: ua },
        label: "Unassigned",
        subLabel: "Showing tasks not linked to any programme, project, or work package",
      };
    }

    if (workPackageId) {
      const wp = workPackages.find((w) => w.id === workPackageId);
      const proj = wp ? projects.find((p) => p.name === wp.project) : null;
      const acts = wp ? actions.filter((a) => a.workPackage === wp.workPackage && a.project === wp.project).length : 0;
      return {
        level: "wp",
        programmeId: proj?.programmeId,
        projectId: proj?.id,
        workPackageId,
        programmeName: proj?.programmeId ? programmes.find((p) => p.id === proj.programmeId)?.name : undefined,
        projectName: proj?.name,
        workPackageName: wp?.workPackage,
        projectNameSet: new Set(proj ? [proj.name] : []),
        workPackageNameSet: new Set(wp ? [wp.workPackage] : []),
        projectIdSet: new Set(proj ? [proj.id] : []),
        workPackageIdSet: new Set(wp ? [wp.id] : []),
        counts: { programmes: 0, projects: 0, workPackages: 1, actions: acts },
        label: wp?.workPackage ?? "Work Package",
        subLabel: `Scoped to ${wp?.workPackage ?? "WP"} — ${acts} actions`,
      };
    }

    if (projectId) {
      const proj = projects.find((p) => p.id === projectId);
      const wps = proj ? workPackages.filter((w) => w.project === proj.name) : [];
      const acts = proj ? actions.filter((a) => a.project === proj.name).length : 0;
      return {
        level: "project",
        programmeId: proj?.programmeId,
        projectId,
        programmeName: proj?.programmeId ? programmes.find((p) => p.id === proj.programmeId)?.name : undefined,
        projectName: proj?.name,
        projectNameSet: new Set(proj ? [proj.name] : []),
        workPackageNameSet: null,
        projectIdSet: new Set(proj ? [proj.id] : []),
        workPackageIdSet: new Set(wps.map((w) => w.id)),
        counts: { programmes: 0, projects: 1, workPackages: wps.length, actions: acts },
        label: proj?.name ?? "Project",
        subLabel: `Scoped to ${proj?.name ?? "Project"} — ${wps.length} work packages, ${acts} actions`,
      };
    }

    if (programmeId) {
      const prog = programmes.find((p) => p.id === programmeId);
      const projs = projects.filter((p) => p.programmeId === programmeId);
      const projNames = new Set(projs.map((p) => p.name));
      const wps = workPackages.filter((wp) => projNames.has(wp.project));
      const acts = actions.filter((a) => projNames.has(a.project)).length;
      return {
        level: "programme",
        programmeId,
        programmeName: prog?.name,
        projectNameSet: projNames,
        workPackageNameSet: null,
        projectIdSet: new Set(projs.map((p) => p.id)),
        workPackageIdSet: new Set(wps.map((w) => w.id)),
        counts: { programmes: 1, projects: projs.length, workPackages: wps.length, actions: acts },
        label: prog?.name ?? "Programme",
        subLabel: `Scoped to ${prog?.name ?? "Programme"} — ${projs.length} projects, ${wps.length} work packages`,
      };
    }

    // Global
    return {
      level: "global",
      projectNameSet: new Set(projects.map((p) => p.name)),
      workPackageNameSet: null,
      projectIdSet: new Set(projects.map((p) => p.id)),
      workPackageIdSet: new Set(workPackages.map((w) => w.id)),
      counts: { programmes: programmes.length, projects: projects.length, workPackages: workPackages.length, actions: actions.length },
      label: "Pumped Pulse",
      subLabel: "Showing all programmes, projects, and work packages",
    };
  }, [globalFilter, programmes, projects, workPackages, actions]);
}

// Helpers for filtering raw collections by scope
export function actionInScope(a: { project: string; workPackage: string }, scope: DashboardScope): boolean {
  if (scope.level === "global") return true;
  if (scope.level === "unassigned") return !a.project && !a.workPackage;
  if (!scope.projectNameSet.has(a.project)) return false;
  if (scope.workPackageNameSet && !scope.workPackageNameSet.has(a.workPackage)) return false;
  return true;
}

export function waitingInScope(w: { projectWP: string; linkedProjectId?: string }, scope: DashboardScope, projectsById: Map<string, { name: string }>): boolean {
  if (scope.level === "global") return true;
  if (scope.level === "unassigned") return !w.projectWP && !w.linkedProjectId;
  // Resolve project name preferring linkedProjectId
  let projName = "";
  let wpName = "";
  if (w.linkedProjectId) {
    projName = projectsById.get(w.linkedProjectId)?.name ?? "";
  }
  if (w.projectWP) {
    const parts = w.projectWP.split(" / ");
    if (!projName) projName = parts[0] ?? "";
    wpName = parts[1] ?? "";
  }
  if (!projName) return false;
  if (!scope.projectNameSet.has(projName)) return false;
  if (scope.workPackageNameSet && wpName && !scope.workPackageNameSet.has(wpName)) return false;
  if (scope.workPackageNameSet && !wpName) return false;
  return true;
}

export function inboxInScope(i: { project: string }, scope: DashboardScope): boolean {
  if (scope.level === "global") return true;
  if (scope.level === "unassigned") return !i.project;
  return scope.projectNameSet.has(i.project);
}

export function wpInScope(wp: { id: string; project: string; workPackage: string }, scope: DashboardScope): boolean {
  if (scope.level === "global") return true;
  if (scope.level === "unassigned") return false;
  if (!scope.projectNameSet.has(wp.project)) return false;
  if (scope.workPackageNameSet && !scope.workPackageNameSet.has(wp.workPackage)) return false;
  return true;
}
