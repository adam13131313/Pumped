import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Action, Priority, TaskStatus } from "@/lib/types";

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
  const [form, setForm] = useState<Partial<Action>>(
    action ?? { task: "", project: "", workPackage: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "" }
  );

  const handleOpen = (o: boolean) => {
    if (o && action) setForm(action);
    else if (o) setForm({ task: "", project: "", workPackage: "", dueDate: "", priority: "Medium", status: "Not Started", notes: "" });
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
      dueDate: form.dueDate ?? "",
      priority: form.priority ?? "Medium",
      status: form.status ?? "Not Started",
      notes: form.notes?.trim() ?? "",
    });
    onOpenChange(false);
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="project">Project</Label>
              <Input id="project" value={form.project ?? ""} onChange={(e) => setForm({ ...form, project: e.target.value })} className="mt-1" maxLength={100} />
            </div>
            <div>
              <Label htmlFor="wp">Work Package</Label>
              <Input id="wp" value={form.workPackage ?? ""} onChange={(e) => setForm({ ...form, workPackage: e.target.value })} className="mt-1" maxLength={100} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="due">Due Date</Label>
              <Input id="due" type="date" value={form.dueDate ?? ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1" />
            </div>
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
            <Textarea id="notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" rows={2} maxLength={1000} />
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
