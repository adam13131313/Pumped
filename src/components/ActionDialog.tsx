import { useEffect, useState } from "react";
import { X, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { actionSchema, firstZodError } from "@/lib/schemas";
import type { Action, ActionPriority, ActionStatus } from "@/lib/types";
import { NodePicker } from "@/components/NodePicker";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskComments } from "@/components/TaskComments";
import { TaskLinks } from "@/components/TaskLinks";
import { DuplicateHint } from "@/components/DuplicateHint";

// v2 ActionDialog: replaces the v1 three-cascading-dropdown UI
// (Programme/Project/WorkPackage) with a single NodePicker bound to
// wbsNodeId. Status/priority are lowercase to match Postgres enums.

interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: Action | null;
  onSave: (action: Action) => void;
  onDelete?: (id: string) => void;
  onDelegate?: (id: string, params: { fromWhomText?: string | null }) => void;
}

const PRIORITY_LABEL: Record<ActionPriority, string> = {
  high: "High", medium: "Medium", low: "Low",
};
const STATUS_LABEL: Record<ActionStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  complete: "Complete",
  deferred: "Deferred",
  cancelled: "Cancelled",
};

const PRIORITIES: ActionPriority[] = ["high", "medium", "low"];
const STATUSES: ActionStatus[] = ["not_started", "in_progress", "blocked", "complete", "deferred", "cancelled"];

interface FormState {
  task: string;
  wbsNodeId: string | null;
  startDate: string;
  dueDate: string;
  priority: ActionPriority;
  status: ActionStatus;
  notes: string;
  labels: string[];
}

const emptyForm = (): FormState => ({
  task: "",
  wbsNodeId: null,
  startDate: "",
  dueDate: "",
  priority: "medium",
  status: "not_started",
  notes: "",
  labels: [],
});

export function ActionDialog({
  open, onOpenChange, action, onSave, onDelete, onDelegate,
}: ActionDialogProps) {
  const isEdit = !!action;
  const globalFilter = useAppStore((s) => s.globalFilter);
  const currentOrg = useAppStore((s) => s.currentOrg);
  const currentMembership = useAppStore((s) => s.currentMembership);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [labelInput, setLabelInput] = useState("");
  const [showDelegate, setShowDelegate] = useState(false);
  const [delegateTo, setDelegateTo] = useState("");

  useEffect(() => {
    if (!open) return;
    setShowDelegate(false);
    setDelegateTo("");
    if (action) {
      setForm({
        task: action.task,
        wbsNodeId: action.wbsNodeId,
        startDate: action.startDate ?? "",
        dueDate: action.dueDate ?? "",
        priority: action.priority,
        status: action.status,
        notes: action.notes,
        labels: action.labels ?? [],
      });
    } else {
      // New action: pre-populate wbsNodeId from the global filter if any.
      setForm({
        ...emptyForm(),
        wbsNodeId: !globalFilter.unassigned ? globalFilter.nodeId : null,
      });
    }
  }, [open, action, globalFilter]);

  const addLabel = () => {
    const label = labelInput.trim();
    if (label && !form.labels.includes(label)) {
      setForm({ ...form, labels: [...form.labels, label] });
    }
    setLabelInput("");
  };
  const removeLabel = (label: string) => {
    setForm({ ...form, labels: form.labels.filter((l) => l !== label) });
  };

  const handleSave = () => {
    const parsed = actionSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return;
    }
    if (!currentOrg) {
      toast.error("No active organisation");
      return;
    }
    const d = parsed.data;
    const now = new Date().toISOString();
    onSave({
      id: action?.id ?? crypto.randomUUID(),
      organisationId: currentOrg.id,
      wbsNodeId: d.wbsNodeId ?? null,
      assignedTo: action?.assignedTo ?? currentMembership?.userId ?? null,
      createdBy: action?.createdBy ?? currentMembership?.userId ?? null,
      task: d.task,
      priority: d.priority ?? "medium",
      status: d.status ?? "not_started",
      startDate: d.startDate ? d.startDate : null,
      dueDate: d.dueDate ? d.dueDate : null,
      completedAt: action?.completedAt ?? null,
      notes: d.notes ?? "",
      labels: d.labels ?? [],
      notStartedSince: action?.notStartedSince ?? null,
      archivedAt: action?.archivedAt ?? null,
      createdAt: action?.createdAt ?? now,
      updatedAt: now,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Action" : "New Action"}</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4 py-2">
          <div>
            <Label htmlFor="task">Task *</Label>
            <Textarea
              id="task"
              value={form.task}
              onChange={(e) => setForm({ ...form, task: e.target.value })}
              className="mt-1"
              rows={2}
              maxLength={500}
              autoFocus
            />
            <DuplicateHint query={form.task} excludeActionId={action?.id} />
          </div>

          <div>
            <Label htmlFor="action-node">Linked to</Label>
            <NodePicker
              id="action-node"
              value={form.wbsNodeId}
              onChange={(id) => setForm({ ...form, wbsNodeId: id })}
              includeNone
              noneLabel="(unassigned)"
              placeholder="Choose a portfolio, programme, project, or WP"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="due">Due date</Label>
              <Input
                id="due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as ActionPriority })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ActionStatus })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1"
              rows={2}
              maxLength={1000}
              placeholder="Add notes"
            />
          </div>

          <div>
            <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Labels</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {form.labels.map((label) => (
                <Badge key={label} variant="secondary" className="gap-1 pr-1">
                  {label}
                  <button type="button" onClick={() => removeLabel(label)} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5 mt-1.5">
              <Input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel(); } }}
                placeholder="Type a label and press Enter"
                className="h-8 text-sm"
                maxLength={30}
              />
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={addLabel} disabled={!labelInput.trim()}>
                Add
              </Button>
            </div>
          </div>

          {/* Always-rendered. Each child shows a "save this action first"
              placeholder when no actionId is available yet (new dialog). */}
          <TaskLinks actionId={action?.id} />
          <TaskAttachments actionId={action?.id} />
          <TaskComments actionId={action?.id} />
        </div>
        <DialogFooter className="flex flex-wrap justify-between gap-2">
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
              <Input
                placeholder="Delegated to (name)"
                value={delegateTo}
                onChange={(e) => setDelegateTo(e.target.value)}
                className="w-40"
              />
              <Button
                size="sm"
                disabled={!delegateTo.trim()}
                onClick={() => {
                  onDelegate!(action!.id, { fromWhomText: delegateTo.trim() });
                  onOpenChange(false);
                }}
              >
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDelegate(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.task.trim()}>Save</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
