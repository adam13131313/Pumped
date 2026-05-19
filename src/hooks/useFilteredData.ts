import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { Action, InboxItem, Project, WaitingItem, WorkPackage } from "@/lib/types";

/**
 * Returns actions, waitingItems, inboxItems, workPackages, and projects
 * filtered by the current global filter (programme / project / work package).
 *
 * Internally each entity has its own useMemo so a mutation that only changes
 * actions doesn't re-filter waiting items / inbox / WPs / projects.
 */

interface AllowedSets {
  noFilter: boolean;
  unassigned: boolean;
  allowedProjectNames: Set<string>;
  allowedWPNames: Set<string> | null;
}

function useAllowedSets(): AllowedSets {
  const globalFilter = useAppStore((s) => s.globalFilter);
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);

  return useMemo(() => {
    const { programmeId, projectId, workPackageId, unassigned } = globalFilter;
    const noFilter = !programmeId && !projectId && !workPackageId && !unassigned;

    if (noFilter || unassigned) {
      return {
        noFilter,
        unassigned: !!unassigned,
        allowedProjectNames: new Set<string>(),
        allowedWPNames: null,
      };
    }

    let allowedProjectNames: Set<string>;
    if (projectId) {
      const proj = projects.find((p) => p.id === projectId);
      allowedProjectNames = new Set(proj ? [proj.name] : []);
    } else if (programmeId) {
      allowedProjectNames = new Set(
        projects.filter((p) => p.programmeId === programmeId).map((p) => p.name),
      );
    } else {
      allowedProjectNames = new Set(projects.map((p) => p.name));
    }

    let allowedWPNames: Set<string> | null = null;
    if (workPackageId) {
      const wp = workPackages.find((w) => w.id === workPackageId);
      allowedWPNames = new Set(wp ? [wp.workPackage] : []);
    }

    return { noFilter: false, unassigned: false, allowedProjectNames, allowedWPNames };
  }, [globalFilter, projects, workPackages]);
}

export function useFilteredData() {
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);
  const actions = useAppStore((s) => s.actions);
  const waitingItems = useAppStore((s) => s.waitingItems);
  const inboxItems = useAppStore((s) => s.inboxItems);

  const allowed = useAllowedSets();

  const filteredProjects = useMemo<Project[]>(() => {
    if (allowed.noFilter) return projects;
    if (allowed.unassigned) return [];
    return projects.filter((p) => allowed.allowedProjectNames.has(p.name));
  }, [projects, allowed]);

  const filteredWorkPackages = useMemo<WorkPackage[]>(() => {
    if (allowed.noFilter) return workPackages;
    if (allowed.unassigned) return [];
    return workPackages.filter(
      (wp) =>
        allowed.allowedProjectNames.has(wp.project) &&
        (!allowed.allowedWPNames || allowed.allowedWPNames.has(wp.workPackage)),
    );
  }, [workPackages, allowed]);

  const filteredActions = useMemo<Action[]>(() => {
    if (allowed.noFilter) return actions;
    if (allowed.unassigned) return actions.filter((a) => !a.project && !a.workPackage);
    return actions.filter((a) => {
      if (!a.project) return false;
      if (!allowed.allowedProjectNames.has(a.project)) return false;
      if (allowed.allowedWPNames && a.workPackage && !allowed.allowedWPNames.has(a.workPackage)) return false;
      if (allowed.allowedWPNames && !a.workPackage) return false;
      return true;
    });
  }, [actions, allowed]);

  const filteredWaiting = useMemo<WaitingItem[]>(() => {
    if (allowed.noFilter) return waitingItems;
    if (allowed.unassigned) return waitingItems.filter((w) => !w.projectWP && !w.linkedProjectId);
    return waitingItems.filter((w) => {
      if (!w.projectWP) return false;
      const parts = w.projectWP.split(" / ");
      const projName = parts[0];
      if (!allowed.allowedProjectNames.has(projName)) return false;
      if (allowed.allowedWPNames) {
        const wpName = parts[1];
        if (!wpName || !allowed.allowedWPNames.has(wpName)) return false;
      }
      return true;
    });
  }, [waitingItems, allowed]);

  const filteredInbox = useMemo<InboxItem[]>(() => {
    if (allowed.noFilter) return inboxItems;
    if (allowed.unassigned) return inboxItems.filter((i) => !i.project);
    return inboxItems.filter((i) => i.project && allowed.allowedProjectNames.has(i.project));
  }, [inboxItems, allowed]);

  return {
    projects: filteredProjects,
    workPackages: filteredWorkPackages,
    actions: filteredActions,
    waitingItems: filteredWaiting,
    inboxItems: filteredInbox,
  };
}
