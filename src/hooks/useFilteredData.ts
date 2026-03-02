import { useMemo } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Returns actions, waitingItems, inboxItems, workPackages, and projects
 * filtered by the current global filter (programme / project / work package).
 */
export function useFilteredData() {
  const globalFilter = useAppStore((s) => s.globalFilter);
  const programmes = useAppStore((s) => s.programmes);
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);
  const actions = useAppStore((s) => s.actions);
  const waitingItems = useAppStore((s) => s.waitingItems);
  const inboxItems = useAppStore((s) => s.inboxItems);

  return useMemo(() => {
    const { programmeId, projectId, workPackageId } = globalFilter;
    const noFilter = !programmeId && !projectId && !workPackageId;

    if (noFilter) {
      return { projects, workPackages, actions, waitingItems, inboxItems };
    }

    // Determine which project names pass the filter
    let allowedProjectNames: Set<string>;

    if (projectId) {
      const proj = projects.find((p) => p.id === projectId);
      allowedProjectNames = new Set(proj ? [proj.name] : []);
    } else if (programmeId) {
      allowedProjectNames = new Set(
        projects.filter((p) => p.programmeId === programmeId).map((p) => p.name)
      );
    } else {
      allowedProjectNames = new Set(projects.map((p) => p.name));
    }

    // Determine which WP names pass the filter
    let allowedWPNames: Set<string> | null = null; // null = all WPs within allowed projects
    if (workPackageId) {
      const wp = workPackages.find((w) => w.id === workPackageId);
      allowedWPNames = new Set(wp ? [wp.workPackage] : []);
    }

    const filteredProjects = projects.filter((p) => allowedProjectNames.has(p.name));
    const filteredWPs = workPackages.filter(
      (wp) => allowedProjectNames.has(wp.project) && (!allowedWPNames || allowedWPNames.has(wp.workPackage))
    );

    const filteredActions = actions.filter((a) => {
      // Actions without a project pass only if no filter is active (already handled above)
      if (!a.project) return false;
      if (!allowedProjectNames.has(a.project)) return false;
      if (allowedWPNames && a.workPackage && !allowedWPNames.has(a.workPackage)) return false;
      if (allowedWPNames && !a.workPackage) return false;
      return true;
    });

    const filteredWaiting = waitingItems.filter((w) => {
      if (!w.projectWP) return false;
      // projectWP is stored as "ProjectName" or "ProjectName / WPName"
      const parts = w.projectWP.split(" / ");
      const projName = parts[0];
      if (!allowedProjectNames.has(projName)) return false;
      if (allowedWPNames) {
        const wpName = parts[1];
        if (!wpName || !allowedWPNames.has(wpName)) return false;
      }
      return true;
    });

    const filteredInbox = inboxItems.filter((i) => {
      if (!i.project) return false;
      return allowedProjectNames.has(i.project);
    });

    return {
      projects: filteredProjects,
      workPackages: filteredWPs,
      actions: filteredActions,
      waitingItems: filteredWaiting,
      inboxItems: filteredInbox,
    };
  }, [globalFilter, programmes, projects, workPackages, actions, waitingItems, inboxItems]);
}
