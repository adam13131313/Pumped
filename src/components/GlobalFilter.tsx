import { useAppStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

export function GlobalFilter() {
  const programmes = useAppStore((s) => s.programmes);
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);
  const globalFilter = useAppStore((s) => s.globalFilter);
  const setGlobalFilter = useAppStore((s) => s.setGlobalFilter);
  const clearGlobalFilter = useAppStore((s) => s.clearGlobalFilter);

  const hasFilter = globalFilter.programmeId || globalFilter.projectId || globalFilter.workPackageId;

  // Filter projects based on selected programme
  const filteredProjects = globalFilter.programmeId
    ? projects.filter((p) => p.programmeId === globalFilter.programmeId)
    : projects;

  // Filter WPs based on selected project
  const selectedProject = globalFilter.projectId
    ? projects.find((p) => p.id === globalFilter.projectId)
    : null;
  const filteredWPs = selectedProject
    ? workPackages.filter((wp) => wp.project === selectedProject.name)
    : globalFilter.programmeId
      ? workPackages.filter((wp) => {
          const proj = filteredProjects.find((p) => p.name === wp.project);
          return !!proj;
        })
      : workPackages;

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
      <Select
        value={globalFilter.programmeId || "__all__"}
        onValueChange={(v) => setGlobalFilter({
          programmeId: v === "__all__" ? "" : v,
          projectId: "",
          workPackageId: "",
        })}
      >
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue placeholder="All Programmes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Programmes</SelectItem>
          {programmes.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={globalFilter.projectId || "__all__"}
        onValueChange={(v) => setGlobalFilter({
          ...globalFilter,
          projectId: v === "__all__" ? "" : v,
          workPackageId: "",
        })}
      >
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue placeholder="All Projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Projects</SelectItem>
          {filteredProjects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={globalFilter.workPackageId || "__all__"}
        onValueChange={(v) => setGlobalFilter({
          ...globalFilter,
          workPackageId: v === "__all__" ? "" : v,
        })}
      >
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue placeholder="All Work Packages" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Work Packages</SelectItem>
          {filteredWPs.map((wp) => (
            <SelectItem key={wp.id} value={wp.id}>{wp.workPackage}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilter && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearGlobalFilter}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
