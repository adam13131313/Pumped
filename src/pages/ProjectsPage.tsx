import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Programme, Project, WorkPackage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RAGBadge } from "@/components/RAGBadge";
import { WPDialog } from "@/components/WPDialog";
import { Plus, Pencil, Trash2, FolderOpen, ChevronDown, ChevronRight, Layers, ExternalLink, Download } from "lucide-react";
import { exportWBStoCSV } from "@/lib/exportWBS";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/* ── Programme Dialog ── */
function ProgrammeDialog({ open, onOpenChange, programme, onSave, onDelete }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  programme?: Programme | null;
  onSave: (p: Programme) => void;
  onDelete?: (id: string) => void;
}) {
  const isEdit = !!programme;
  const [form, setForm] = useState<Partial<Programme>>(programme ?? { name: "", description: "" });

  const handleOpen = (o: boolean) => {
    if (o && programme) setForm(programme);
    else if (o) setForm({ name: "", description: "" });
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Programme" : "New Programme"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="progname">Programme Name *</Label>
            <Input id="progname" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" maxLength={100} />
          </div>
          <div>
            <Label htmlFor="progdesc">Description</Label>
            <Input id="progdesc" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" maxLength={300} />
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          {isEdit && onDelete && (
            <Button variant="destructive" size="sm" onClick={() => { onDelete(programme!.id); onOpenChange(false); }}>Delete</Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => { if (!form.name?.trim()) return; onSave({ id: programme?.id ?? crypto.randomUUID(), name: form.name!.trim(), description: form.description?.trim() ?? "" }); onOpenChange(false); }} disabled={!form.name?.trim()}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Project Dialog ── */
function ProjectDialog({ open, onOpenChange, project, programmes, onSave, onDelete }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project?: Project | null;
  programmes: Programme[];
  onSave: (p: Project) => void;
  onDelete?: (id: string) => void;
}) {
  const isEdit = !!project;
  const [form, setForm] = useState<Partial<Project>>(project ?? { name: "", description: "", programmeId: "", status: "Active" });

  const handleOpen = (o: boolean) => {
    if (o && project) setForm(project);
    else if (o) setForm({ name: "", description: "", programmeId: "", status: "Active" });
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
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
            <Label>Programme</Label>
            <Select value={form.programmeId ?? ""} onValueChange={(v) => setForm({ ...form, programmeId: v === "__none__" ? "" : v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Standalone (no programme)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Standalone (no programme)</SelectItem>
                {programmes.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
            <Button onClick={() => {
              if (!form.name?.trim()) return;
              onSave({ id: project?.id ?? crypto.randomUUID(), name: form.name!.trim(), description: form.description?.trim() ?? "", programmeId: form.programmeId ?? "", status: form.status ?? "Active" });
              onOpenChange(false);
            }} disabled={!form.name?.trim()}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Shared constants ── */
const statusColor: Record<Project["status"], string> = {
  Active: "bg-rag-green/15 text-rag-green border-rag-green/30",
  "On Hold": "bg-rag-amber/15 text-rag-amber border-rag-amber/30",
  Complete: "bg-muted text-muted-foreground border-border",
};

/* ── Project Card (reused in programme groups & standalone) ── */
function ProjectCard({ proj, workPackages, onEditProject, onDeleteProject, onEditWP, onAddWP, onDeleteWP, expanded, toggleExpand, onOpen }: {
  proj: Project;
  workPackages: WorkPackage[];
  onEditProject: (p: Project) => void;
  onDeleteProject: (id: string) => void;
  onEditWP: (wp: WorkPackage, projName: string) => void;
  onAddWP: (projName: string) => void;
  onDeleteWP: (id: string) => void;
  expanded: boolean;
  toggleExpand: () => void;
  onOpen: () => void;
}) {
  const projWPs = workPackages.filter((wp) => wp.project === proj.name);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none" onClick={toggleExpand}>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="font-medium text-sm">{proj.name}</span>
          <Badge variant="outline" className={statusColor[proj.status]}>{proj.status}</Badge>
          <span className="text-xs text-muted-foreground">{projWPs.length} WP{projWPs.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpen}><ExternalLink className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditProject(proj)}><Pencil className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteProject(proj.id)}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      {proj.description && <p className="text-xs text-muted-foreground px-4 pb-2 -mt-1 ml-7">{proj.description}</p>}

      {expanded && (
        <div className="px-4 pb-3">
          {projWPs.length > 0 && (
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
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditWP(wp, proj.name)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteWP(wp.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {projWPs.length === 0 && <p className="text-sm text-muted-foreground ml-7 mb-3">No work packages yet.</p>}
          <Button variant="outline" size="sm" className="ml-7" onClick={() => onAddWP(proj.name)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Work Package
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function ProjectsPage() {
  const navigate = useNavigate();
  const store = useAppStore();
  const { programmes, projects, workPackages, actions } = store;

  const [progDialogOpen, setProgDialogOpen] = useState(false);
  const [editProgramme, setEditProgramme] = useState<Programme | null>(null);
  const [projDialogOpen, setProjDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [wpDialogOpen, setWPDialogOpen] = useState(false);
  const [editWP, setEditWP] = useState<WorkPackage | null>(null);
  const [wpProjectName, setWpProjectName] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const standaloneProjects = projects.filter((p) => !p.programmeId);

  const handleSaveProgramme = (p: Programme) => {
    if (editProgramme) store.updateProgramme(p.id, p);
    else store.addProgramme(p);
  };

  const handleSaveProject = (p: Project) => {
    // Rename propagation to dependent WPs/actions/waiting/inbox rows lives in
    // store.updateProject (cf. propagateProjectRename) so every caller benefits,
    // not just this page.
    if (editProject) store.updateProject(p.id, p);
    else store.addProject(p);
  };

  const handleSaveWP = (wp: WorkPackage) => {
    if (editWP) store.updateWorkPackage(wp.id, wp);
    else store.addWorkPackage({ ...wp, project: wpProjectName });
  };

  const openEditProject = (p: Project) => { setEditProject(p); setProjDialogOpen(true); };
  const openEditWP = (wp: WorkPackage, projName: string) => { setEditWP(wp); setWpProjectName(projName); setWPDialogOpen(true); };
  const openAddWP = (projName: string) => { setEditWP(null); setWpProjectName(projName); setWPDialogOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programmes, Projects & Work Packages</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure your programme hierarchy</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            exportWBStoCSV(programmes, projects, workPackages, actions);
            toast.success("WBS exported as CSV");
          }}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => { setEditProgramme(null); setProgDialogOpen(true); }}>
            <Layers className="h-4 w-4 mr-2" /> New Programme
          </Button>
          <Button onClick={() => { setEditProject(null); setProjDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Project
          </Button>
        </div>
      </div>

      {/* Programme groups */}
      {programmes.map((prog) => {
        const progProjects = projects.filter((p) => p.programmeId === prog.id);
        const isOpen = expanded[prog.id] ?? true;

        return (
          <Card key={prog.id}>
            <CardHeader className="cursor-pointer select-none py-4" onClick={() => toggleExpand(prog.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-primary" />}
                  <Layers className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{prog.name}</CardTitle>
                  <Badge variant="secondary">{progProjects.length} project{progProjects.length !== 1 ? "s" : ""}</Badge>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditProgramme(prog); setProgDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => store.deleteProgramme(prog.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {prog.description && <p className="text-sm text-muted-foreground ml-9 mt-1">{prog.description}</p>}
            </CardHeader>
            {isOpen && (
              <CardContent className="pt-0 pb-4 space-y-2 ml-4">
                {progProjects.length === 0 && <p className="text-sm text-muted-foreground ml-5">No projects in this programme yet.</p>}
                {progProjects.map((proj) => (
                  <ProjectCard
                    key={proj.id}
                    proj={proj}
                    workPackages={workPackages}
                    onEditProject={openEditProject}
                    onDeleteProject={store.deleteProject}
                    onEditWP={openEditWP}
                    onAddWP={openAddWP}
                    onDeleteWP={store.deleteWorkPackage}
                    expanded={expanded[proj.id] ?? true}
                    toggleExpand={() => toggleExpand(proj.id)}
                    onOpen={() => navigate(`/projects/${proj.id}`)}
                  />
                ))}
                <Button variant="outline" size="sm" className="ml-5" onClick={() => { setEditProject({ id: "", name: "", description: "", programmeId: prog.id, status: "Active" } as any); setEditProject(null); setProjDialogOpen(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Project to Programme
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Standalone projects */}
      {standaloneProjects.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Standalone Projects</h2>
          {standaloneProjects.map((proj) => (
            <ProjectCard
              key={proj.id}
              proj={proj}
              workPackages={workPackages}
              onEditProject={openEditProject}
              onDeleteProject={store.deleteProject}
              onEditWP={openEditWP}
              onAddWP={openAddWP}
              onDeleteWP={store.deleteWorkPackage}
              expanded={expanded[proj.id] ?? true}
              toggleExpand={() => toggleExpand(proj.id)}
              onOpen={() => navigate(`/projects/${proj.id}`)}
            />
          ))}
        </div>
      )}

      {programmes.length === 0 && standaloneProjects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No programmes or projects yet. Create one to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ProgrammeDialog open={progDialogOpen} onOpenChange={setProgDialogOpen} programme={editProgramme} onSave={handleSaveProgramme} onDelete={store.deleteProgramme} />
      <ProjectDialog open={projDialogOpen} onOpenChange={setProjDialogOpen} project={editProject} programmes={programmes} onSave={handleSaveProject} onDelete={store.deleteProject} />
      <WPDialog open={wpDialogOpen} onOpenChange={setWPDialogOpen} wp={editWP} onSave={handleSaveWP} onDelete={store.deleteWorkPackage} />
    </div>
  );
}
