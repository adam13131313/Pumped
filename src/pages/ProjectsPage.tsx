import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Project, WorkPackage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RAGBadge } from "@/components/RAGBadge";
import { WPDialog } from "@/components/WPDialog";
import { Plus, Pencil, Trash2, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";

function ProjectDialog({ open, onOpenChange, project, onSave, onDelete }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project?: Project | null;
  onSave: (p: Project) => void;
  onDelete?: (id: string) => void;
}) {
  const isEdit = !!project;
  const [form, setForm] = useState<Partial<Project>>(
    project ?? { name: "", description: "", status: "Active" }
  );

  const handleOpen = (o: boolean) => {
    if (o && project) setForm(project);
    else if (o) setForm({ name: "", description: "", status: "Active" });
    onOpenChange(o);
  };

  const handleSave = () => {
    if (!form.name?.trim()) return;
    onSave({
      id: project?.id ?? crypto.randomUUID(),
      name: form.name?.trim() ?? "",
      description: form.description?.trim() ?? "",
      status: form.status ?? "Active",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="pname">Project Name *</Label>
            <Input id="pname" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" maxLength={100} />
          </div>
          <div>
            <Label htmlFor="pdesc">Description</Label>
            <Input id="pdesc" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" maxLength={300} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Project["status"] })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
                <SelectItem value="Complete">Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          {isEdit && onDelete && (
            <Button variant="destructive" size="sm" onClick={() => { onDelete(project!.id); onOpenChange(false); }}>Delete</Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name?.trim()}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const statusColor: Record<Project["status"], string> = {
  Active: "bg-rag-green/15 text-rag-green border-rag-green/30",
  "On Hold": "bg-rag-amber/15 text-rag-amber border-rag-amber/30",
  Complete: "bg-muted text-muted-foreground border-border",
};

export default function ProjectsPage() {
  const { projects, workPackages, addProject, updateProject, deleteProject, addWorkPackage, updateWorkPackage, deleteWorkPackage } = useAppStore();

  const [projDialogOpen, setProjDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [wpDialogOpen, setWPDialogOpen] = useState(false);
  const [editWP, setEditWP] = useState<WorkPackage | null>(null);
  const [wpProjectName, setWpProjectName] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSaveProject = (p: Project) => {
    if (editProject) {
      // If name changed, update all WPs that reference this project
      if (editProject.name !== p.name) {
        workPackages
          .filter((wp) => wp.project === editProject.name)
          .forEach((wp) => updateWorkPackage(wp.id, { project: p.name }));
      }
      updateProject(p.id, p);
    } else {
      addProject(p);
    }
  };

  const handleSaveWP = (wp: WorkPackage) => {
    if (editWP) updateWorkPackage(wp.id, wp);
    else addWorkPackage({ ...wp, project: wpProjectName });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects & Work Packages</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure and manage your project structure</p>
        </div>
        <Button onClick={() => { setEditProject(null); setProjDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Project
        </Button>
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No projects yet. Create one to get started.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {projects.map((proj) => {
          const projWPs = workPackages.filter((wp) => wp.project === proj.name);
          const isOpen = expanded[proj.id] ?? true;

          return (
            <Card key={proj.id} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer select-none py-4"
                onClick={() => toggleExpand(proj.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <CardTitle className="text-base">{proj.name}</CardTitle>
                    <Badge variant="outline" className={statusColor[proj.status]}>{proj.status}</Badge>
                    <span className="text-xs text-muted-foreground">{projWPs.length} WP{projWPs.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditProject(proj); setProjDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProject(proj.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {proj.description && <p className="text-sm text-muted-foreground ml-7 mt-1">{proj.description}</p>}
              </CardHeader>

              {isOpen && (
                <CardContent className="pt-0 pb-4">
                  {projWPs.length === 0 ? (
                    <p className="text-sm text-muted-foreground ml-7 mb-3">No work packages yet.</p>
                  ) : (
                    <div className="ml-7 mb-3 border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 text-left">
                            <th className="px-3 py-2 font-medium">Work Package</th>
                            <th className="px-3 py-2 font-medium">Lead</th>
                            <th className="px-3 py-2 font-medium">Due</th>
                            <th className="px-3 py-2 font-medium">RAG</th>
                            <th className="px-3 py-2 font-medium">Blockers</th>
                            <th className="px-3 py-2 font-medium w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {projWPs.map((wp) => (
                            <tr key={wp.id} className="border-t hover:bg-muted/30">
                              <td className="px-3 py-2">{wp.workPackage}</td>
                              <td className="px-3 py-2 text-muted-foreground">{wp.wpLead || "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{wp.dueDate || "—"}</td>
                              <td className="px-3 py-2"><RAGBadge status={wp.ragStatus} /></td>
                              <td className="px-3 py-2 text-muted-foreground text-xs max-w-[200px] truncate">{wp.blockers || "—"}</td>
                              <td className="px-3 py-2">
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditWP(wp); setWpProjectName(proj.name); setWPDialogOpen(true); }}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteWorkPackage(wp.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="ml-7" onClick={() => { setEditWP(null); setWpProjectName(proj.name); setWPDialogOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Work Package
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <ProjectDialog
        open={projDialogOpen}
        onOpenChange={setProjDialogOpen}
        project={editProject}
        onSave={handleSaveProject}
        onDelete={deleteProject}
      />

      <WPDialog
        open={wpDialogOpen}
        onOpenChange={setWPDialogOpen}
        wp={editWP}
        onSave={handleSaveWP}
        onDelete={deleteWorkPackage}
      />
    </div>
  );
}
