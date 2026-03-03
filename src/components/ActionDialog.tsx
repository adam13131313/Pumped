import { useState, useMemo, useEffect } from "react";
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
  const workPackages = useAppStore((s) => s.workPackages);
  const emptyForm: Partial<Action> = { task: "", project: "", workPackage: "", startDate: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "" };
  const [form, setForm] = useState<Partial<Action>>(action ?? emptyForm);

  useEffect(() => {
    if (open) {
      setForm(action ?? emptyForm);
      setShowDelegate(false);
      setDelegateTo("");
    }
  }, [open, action]);

  // Build WP options grouped by project
  const wpOptions = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    workPackages.forEach((wp) => {
      if (!grouped[wp.project]) grouped[wp.project] = [];
      grouped[wp.project].push(wp.workPackage);
    });
    return grouped;
  }, [workPackages]);

  // Derive project from selected WP
  const selectedProject = useMemo(() => {
    if (!form.workPackage) return form.project ?? "";
    const wp = workPackages.find((w) => w.workPackage === form.workPackage);
    return wp?.project ?? form.project ?? "";
  }, [form.workPackage, form.project, workPackages]);

  const handleOpen = (o: boolean) => {
    if (o && action) setForm(action);
    else if (o) setForm({ task: "", project: "", workPackage: "", startDate: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "" });
    setShowDelegate(false);
    setDelegateTo("");
    onOpenChange(o);
  };

  const handleSave = () => {
    if (!form.task?.trim()) return;
    onSave({
      id: action?.id ?? crypto.randomUUID(),
      task: form.task?.trim() ?? "",
      project: selectedProject,
      workPackage: form.workPackage?.trim() ?? "",
      startDate: form.startDate ?? "",
      dueDate: form.dueDate ?? "",
      priority: form.priority ?? "Medium",
      status: form.status ?? "Not Started",
      notes: form.notes?.trim() ?? "",
    });
    onOpenChange(false);
  };

  const handleWPChange = (val: string) => {
    if (val === "__none__") {
      setForm({ ...form, workPackage: "", project: "" });
    } else {
      const wp = workPackages.find((w) => w.workPackage === val);
      setForm({ ...form, workPackage: val, project: wp?.project ?? form.project ?? "" });
    }
  };

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
          <div>
            <Label>Work Package</Label>
            <Select value={form.workPackage || "__none__"} onValueChange={handleWPChange}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {Object.entries(wpOptions).map(([project, wps]) => (
                  <div key={project}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{project}</div>
                    {wps.map((wp) => (
                      <SelectItem key={wp} value={wp}>{wp}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {selectedProject && (
              <p className="text-xs text-muted-foreground mt-1">Project: {selectedProject}</p>
            )}
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
