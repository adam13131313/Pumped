import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import { Action, WorkPackage } from "@/lib/types";
import { ActionDialog } from "@/components/ActionDialog";
import { WPDialog } from "@/components/WPDialog";
import { RAGBadge } from "@/components/RAGBadge";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Gauge } from "lucide-react";

const statusColor: Record<string, string> = {
  Active: "bg-rag-green/15 text-rag-green border-rag-green/30",
  "On Hold": "bg-rag-amber/15 text-rag-amber border-rag-amber/30",
  Complete: "bg-muted text-muted-foreground border-border",
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const store = useAppStore();

  const project = store.projects.find((p) => p.id === projectId);
  const programme = project?.programmeId ? store.programmes.find((p) => p.id === project.programmeId) : null;
  const projectWPs = store.workPackages.filter((wp) => wp.project === project?.name);
  const projectActions = store.actions.filter((a) => a.project === project?.name);
  const unassignedActions = projectActions.filter((a) => !a.workPackage);

  const [expandedWPs, setExpandedWPs] = useState<Record<string, boolean>>({});
  const toggleWP = (id: string) => setExpandedWPs((prev) => ({ ...prev, [id]: !prev[id] }));

  // Action dialog
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);

  // WP dialog
  const [wpDialogOpen, setWPDialogOpen] = useState(false);
  const [editingWP, setEditingWP] = useState<WorkPackage | null>(null);

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/projects")}><ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects</Button>
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const handleSaveAction = (action: Action) => {
    if (editingAction) store.updateAction(action.id, action);
    else store.addAction(action);
    setEditingAction(null);
  };

  const handleSaveWP = (wp: WorkPackage) => {
    if (editingWP) store.updateWorkPackage(wp.id, wp);
    else store.addWorkPackage({ ...wp, project: project.name });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Projects
        </Button>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant="outline" className={statusColor[project.status]}>{project.status}</Badge>
            </div>
            {programme && <p className="text-xs text-muted-foreground mt-1">Programme: {programme.name}</p>}
            {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditingWP(null); setWPDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Work Package
            </Button>
            <Button size="sm" onClick={() => { setEditingAction(null); setActionDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Action
            </Button>
          </div>
        </div>
      </div>

      {/* Work Packages with nested actions */}
      {projectWPs.map((wp) => {
        const wpActions = projectActions.filter((a) => a.workPackage === wp.workPackage);
        const isOpen = expandedWPs[wp.id] ?? true;

        return (
          <Card key={wp.id}>
            <CardHeader className="py-3 cursor-pointer select-none" onClick={() => toggleWP(wp.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <CardTitle className="text-sm">{wp.workPackage}</CardTitle>
                  <RAGBadge status={wp.ragStatus} />
                  {wp.wpLead && <span className="text-xs text-muted-foreground">Lead: {wp.wpLead}</span>}
                  {wp.dueDate && <span className="text-xs text-muted-foreground font-mono">Due: {wp.dueDate}</span>}
                  <Badge variant="secondary" className="text-xs">{wpActions.length} action{wpActions.length !== 1 ? "s" : ""}</Badge>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingWP(wp); setWPDialogOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => store.deleteWorkPackage(wp.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent className="pt-0 pb-3">
                {wpActions.length > 0 && (
                  <div className="border rounded-lg overflow-hidden mb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-left">
                          <th className="px-3 py-2 font-medium">Task</th>
                          <th className="px-3 py-2 font-medium w-28">Due</th>
                          <th className="px-3 py-2 font-medium w-24">Priority</th>
                          <th className="px-3 py-2 font-medium w-28">Status</th>
                          <th className="px-3 py-2 font-medium w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {wpActions.map((a) => (
                          <tr key={a.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => { setEditingAction(a); setActionDialogOpen(true); }}>
                            <td className="px-3 py-2">{a.task}</td>
                            <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{a.dueDate || "—"}</td>
                            <td className="px-3 py-2"><PriorityBadge priority={a.priority} /></td>
                            <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                            <td className="px-3 py-2">
                              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {wpActions.length === 0 && <p className="text-sm text-muted-foreground mb-3">No actions yet.</p>}
                <Button variant="outline" size="sm" onClick={() => { setEditingAction({ id: "", task: "", project: project.name, workPackage: wp.workPackage, startDate: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "", labels: [] }); setActionDialogOpen(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Action
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Unassigned actions */}
      {unassignedActions.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm text-muted-foreground">Unassigned Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-3 py-2 font-medium">Task</th>
                    <th className="px-3 py-2 font-medium w-28">Due</th>
                    <th className="px-3 py-2 font-medium w-24">Priority</th>
                    <th className="px-3 py-2 font-medium w-28">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedActions.map((a) => (
                    <tr key={a.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => { setEditingAction(a); setActionDialogOpen(true); }}>
                      <td className="px-3 py-2">{a.task}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{a.dueDate || "—"}</td>
                      <td className="px-3 py-2"><PriorityBadge priority={a.priority} /></td>
                      <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {projectWPs.length === 0 && unassignedActions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No work packages or actions yet. Add some to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ActionDialog
        open={actionDialogOpen}
        onOpenChange={setActionDialogOpen}
        action={editingAction}
        onSave={handleSaveAction}
        onDelete={(id) => { store.deleteAction(id); setEditingAction(null); }}
        onDelegate={(id, toWhom) => { store.delegateAction(id, toWhom); setEditingAction(null); }}
      />
      <WPDialog open={wpDialogOpen} onOpenChange={setWPDialogOpen} wp={editingWP} onSave={handleSaveWP} onDelete={store.deleteWorkPackage} />
    </div>
  );
}
