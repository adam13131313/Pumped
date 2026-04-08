import { useState, useMemo, useEffect } from "react";
import { X, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Action, Priority, TaskStatus } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { LinkRenderer } from "@/components/LinkRenderer";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskComments } from "@/components/TaskComments";
import { Badge } from "@/components/ui/badge";

interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: Action | null;
  onSave: (action: Action) => void;
  onDelete?: (id: string) => void;
  onDelegate?: (id: string, toWhom: string) => void;
}

const priorities: Priority[] = ["High", "Medium", "Low"];
const statuses: TaskStatus[] = ["Not Started", "In Progress", "Blocked", "Complete"];

export function ActionDialog({ open, onOpenChange, action, onSave, onDelete, onDelegate }: ActionDialogProps) {
  const isEdit = !!action;
  const [showDelegate, setShowDelegate] = useState(false);
  const [delegateTo, setDelegateTo] = useState("");
  const programmes = useAppStore((s) => s.programmes);
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);
  const globalFilter = useAppStore((s) => s.globalFilter);

  const emptyForm: Partial<Action> = { task: "", project: "", workPackage: "", startDate: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "", labels: [] };
  const [labelInput, setLabelInput] = useState("");
  const [form, setForm] = useState<Partial<Action>>(action ?? emptyForm);
  const [selectedProgrammeId, setSelectedProgrammeId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  // Derive initial programme/project IDs from the action or global filter
  useEffect(() => {
    if (open) {
      setShowDelegate(false);
      setDelegateTo("");

      if (action) {
        setForm(action);
        const proj = projects.find((p) => p.name === action.project);
        if (proj) {
          setSelectedProjectId(proj.id);
          setSelectedProgrammeId(proj.programmeId || "");
        } else {
          setSelectedProjectId("");
          setSelectedProgrammeId("");
        }
      } else {
        // New task: pre-populate from global filter
        let prefillProjectId = globalFilter.projectId || "";
        const prefillWPId = globalFilter.workPackageId || "";

        // If WP is selected, derive project from it
        const wp = prefillWPId ? workPackages.find((w) => w.id === prefillWPId) : null;
        if (wp && !prefillProjectId) {
          const derivedProj = projects.find((p) => p.name === wp.project);
          if (derivedProj) prefillProjectId = derivedProj.id;
        }

        const proj = prefillProjectId ? projects.find((p) => p.id === prefillProjectId) : null;

        // Derive programme from project if not explicitly set
        const prefillProgrammeId = globalFilter.programmeId || proj?.programmeId || "";

        setSelectedProgrammeId(prefillProgrammeId);
        setSelectedProjectId(prefillProjectId);
        setForm({
          ...emptyForm,
          project: proj?.name ?? "",
          workPackage: wp?.workPackage ?? "",
        });
      }
    }
  }, [open, action]);

  // Filtered projects based on selected programme
  const filteredProjects = useMemo(() => {
    if (!selectedProgrammeId) return projects;
    return projects.filter((p) => p.programmeId === selectedProgrammeId);
  }, [projects, selectedProgrammeId]);

  // Filtered work packages based on selected project
  const filteredWPs = useMemo(() => {
    if (!selectedProjectId) return workPackages;
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (!proj) return workPackages;
    return workPackages.filter((wp) => wp.project === proj.name);
  }, [workPackages, selectedProjectId, projects]);

  const handleProgrammeChange = (val: string) => {
    const id = val === "__none__" ? "" : val;
    setSelectedProgrammeId(id);
    // Reset project & WP if they don't belong to the new programme
    if (id) {
      const proj = projects.find((p) => p.id === selectedProjectId);
      if (proj && proj.programmeId !== id) {
        setSelectedProjectId("");
        setForm((f) => ({ ...f, project: "", workPackage: "" }));
      }
    }
  };

  const handleProjectChange = (val: string) => {
    if (val === "__none__") {
      setSelectedProjectId("");
      setForm((f) => ({ ...f, project: "", workPackage: "" }));
    } else {
      const proj = projects.find((p) => p.id === val);
      setSelectedProjectId(val);
      setForm((f) => ({ ...f, project: proj?.name ?? "", workPackage: "" }));
      // Auto-set programme if not set
      if (proj?.programmeId && !selectedProgrammeId) {
        setSelectedProgrammeId(proj.programmeId);
      }
    }
  };

  const handleWPChange = (val: string) => {
    if (val === "__none__") {
      setForm((f) => ({ ...f, workPackage: "" }));
    } else {
      const wp = workPackages.find((w) => w.id === val);
      if (wp) {
        setForm((f) => ({ ...f, workPackage: wp.workPackage, project: wp.project }));
        // Auto-set project selection
        const proj = projects.find((p) => p.name === wp.project);
        if (proj) {
          setSelectedProjectId(proj.id);
          if (proj.programmeId && !selectedProgrammeId) {
            setSelectedProgrammeId(proj.programmeId);
          }
        }
      }
    }
  };

  const handleOpen = (o: boolean) => {
    if (o && action) setForm(action);
    else if (o) setForm(emptyForm);
    setShowDelegate(false);
    setDelegateTo("");
    onOpenChange(o);
  };

  const handleSave = () => {
    if (!form.task?.trim()) return;
    onSave({
      id: action?.id ?? crypto.randomUUID(),
      task: form.task?.trim() ?? "",
      project: form.project?.trim() ?? "",
      workPackage: form.workPackage?.trim() ?? "",
      startDate: form.startDate ?? "",
      dueDate: form.dueDate ?? "",
      priority: form.priority ?? "Medium",
      status: form.status ?? "Not Started",
      notes: form.notes?.trim() ?? "",
      labels: form.labels ?? [],
    });
    onOpenChange(false);
  };

  const addLabel = () => {
    const label = labelInput.trim();
    if (label && !(form.labels ?? []).includes(label)) {
      setForm({ ...form, labels: [...(form.labels ?? []), label] });
    }
    setLabelInput("");
  };

  const removeLabel = (label: string) => {
    setForm({ ...form, labels: (form.labels ?? []).filter((l) => l !== label) });
  };

  // Find current WP id for the select value
  const currentWPId = useMemo(() => {
    if (!form.workPackage) return "__none__";
    const wp = workPackages.find((w) => w.workPackage === form.workPackage);
    return wp?.id ?? "__none__";
  }, [form.workPackage, workPackages]);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Action" : "New Action"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="task">Task *</Label>
            <Textarea id="task" value={form.task ?? ""} onChange={(e) => setForm({ ...form, task: e.target.value })} className="mt-1" rows={2} maxLength={500} />
          </div>

          {/* Hierarchy selectors */}
          {programmes.length > 0 && (
            <div>
              <Label>Programme</Label>
              <Select value={selectedProgrammeId || "__none__"} onValueChange={handleProgrammeChange}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All programmes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {programmes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Project</Label>
            <Select value={selectedProjectId || "__none__"} onValueChange={handleProjectChange}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {filteredProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Work Package</Label>
            <Select value={currentWPId} onValueChange={handleWPChange}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {filteredWPs.map((wp) => (
                  <SelectItem key={wp.id} value={wp.id}>{wp.workPackage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Start Date</Label>
              <Input id="start" type="date" value={form.startDate ?? ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="due">Due Date</Label>
              <Input id="due" type="date" value={form.dueDate ?? ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" rows={2} maxLength={1000} placeholder="Add notes or paste links (Google Docs, Sheets, etc.)" />
            {form.notes && /(https?:\/\/[^\s]+)/.test(form.notes) && (
              <div className="mt-1.5 text-sm"><LinkRenderer text={form.notes} /></div>
            )}
          </div>
          <div>
            <Label>Attachments</Label>
            <div className="mt-1">
              <TaskAttachments itemId={isEdit ? action?.id : undefined} itemType="action" isNew={!isEdit} />
          </div>
          <TaskComments itemId={isEdit ? action?.id : undefined} itemType="action" />
        </div>
        </div>
        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {isEdit && onDelete && (
              <Button variant="destructive" size="sm" onClick={() => { onDelete(action!.id); onOpenChange(false); }}>
                Delete
              </Button>
            )}
            {isEdit && onDelegate && !showDelegate && (
              <Button variant="outline" size="sm" onClick={() => setShowDelegate(true)}>
                Delegate →
              </Button>
            )}
          </div>
          {showDelegate ? (
            <div className="flex gap-2 items-center ml-auto">
              <Input placeholder="Assigned to…" value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)} className="w-40" />
              <Button size="sm" disabled={!delegateTo.trim()} onClick={() => { onDelegate!(action!.id, delegateTo.trim()); onOpenChange(false); }}>
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDelegate(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.task?.trim()}>Save</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
