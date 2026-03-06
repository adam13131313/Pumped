import { Programme, Project, WorkPackage, Action } from "./types";

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function exportWBStoCSV(
  programmes: Programme[],
  projects: Project[],
  workPackages: WorkPackage[],
  actions: Action[]
) {
  const headers = [
    "Programme",
    "Project",
    "Project Status",
    "Work Package",
    "WP Lead",
    "WP Start Date",
    "WP Due Date",
    "WP RAG Status",
    "WP Blockers",
    "Action",
    "Action Priority",
    "Action Status",
    "Action Start Date",
    "Action Due Date",
    "Action Notes",
  ];

  const rows: string[][] = [];

  const progMap = new Map(programmes.map((p) => [p.id, p.name]));

  // Group projects: programme projects first, then standalone
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.programmeId && !b.programmeId) return -1;
    if (!a.programmeId && b.programmeId) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const proj of sortedProjects) {
    const progName = proj.programmeId ? (progMap.get(proj.programmeId) ?? "") : "";
    const projWPs = workPackages.filter((wp) => wp.project === proj.name);

    if (projWPs.length === 0) {
      // Project with no WPs — still include it
      const projActions = actions.filter(
        (a) => a.project === proj.name && !a.workPackage
      );
      if (projActions.length === 0) {
        rows.push([progName, proj.name, proj.status, "", "", "", "", "", "", "", "", "", "", "", ""]);
      } else {
        for (const act of projActions) {
          rows.push([
            progName, proj.name, proj.status,
            "", "", "", "", "", "",
            act.task, act.priority, act.status, act.startDate, act.dueDate, act.notes,
          ]);
        }
      }
    } else {
      for (const wp of projWPs) {
        const wpActions = actions.filter(
          (a) => a.project === proj.name && a.workPackage === wp.workPackage
        );
        if (wpActions.length === 0) {
          rows.push([
            progName, proj.name, proj.status,
            wp.workPackage, wp.wpLead, wp.startDate, wp.dueDate, wp.ragStatus, wp.blockers,
            "", "", "", "", "", "",
          ]);
        } else {
          for (const act of wpActions) {
            rows.push([
              progName, proj.name, proj.status,
              wp.workPackage, wp.wpLead, wp.startDate, wp.dueDate, wp.ragStatus, wp.blockers,
              act.task, act.priority, act.status, act.startDate, act.dueDate, act.notes,
            ]);
          }
        }
      }
    }
  }

  // Actions not tied to any project
  const orphanActions = actions.filter((a) => !a.project);
  for (const act of orphanActions) {
    rows.push([
      "", "", "",
      "", "", "", "", "", "",
      act.task, act.priority, act.status, act.startDate, act.dueDate, act.notes,
    ]);
  }

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wbs-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
