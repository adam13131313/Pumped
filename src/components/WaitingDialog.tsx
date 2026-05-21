import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { firstZodError, waitingItemSchema } from "@/lib/schemas";
import type { WaitingItem, WaitingStatus } from "@/lib/types";
import { NodePicker } from "@/components/NodePicker";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskComments } from "@/components/TaskComments";
import { TaskLinks } from "@/components/TaskLinks";

interface WaitingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: WaitingItem | null;
  onSave: (item: WaitingItem) => void;
  onDelete?: (id: string) => void;
  onTakeBack?: (id: string) => void;
}

const STATUS_LABEL: Record<WaitingStatus, string> = {
  pending: "Pending",
  received: "Received",
  overdue: "Overdue",
};
const STATUSES: WaitingStatus[] = ["pending", "received", "overdue"];

interface FormState {
  description: string;
  wbsNodeId: string | null;
  fromWhomText: string;
  askedOn: string;
  dueBy: string;
  status: WaitingStatus;
  notes: string;
}

const emptyForm = (): FormState => ({
  description: "",
  wbsNodeId: null,
  fromWhomText: "",
  askedOn: new Date().toISOString().slice(0, 10),
  dueBy: "",
  status: "pending",
  notes: "",
});

export function WaitingDialog({
  open, onOpenChange, item, onSave, onDelete, onTakeBack,
}: WaitingDialogProps) {
  const isEdit = !!item;
  const globalFilter = useAppStore((s) => s.globalFilter);
  const currentOrg = useAppStore((s) => s.currentOrg);
  const currentMembership = useAppStore((s) => s.currentMembership);

  const [form, setForm] = useState<FormState>(emptyForm());

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        description: item.description,
        wbsNodeId: item.wbsNodeId,
        fromWhomText: item.fromWhomText ?? "",
        askedOn: item.askedOn ?? "",
        dueBy: item.dueBy ?? "",
        status: item.status,
        notes: item.notes,
      });
    } else {
      setForm({
        ...emptyForm(),
        wbsNodeId: !globalFilter.unassigned ? globalFilter.nodeId : null,
      });
    }
  }, [open, item, globalFilter]);

  const handleSave = () => {
    const parsed = waitingItemSchema.safeParse(form);
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
      id: item?.id ?? crypto.randomUUID(),
      organisationId: currentOrg.id,
      wbsNodeId: d.wbsNodeId ?? null,
      fromUserId: item?.fromUserId ?? null,
      fromWhomText: d.fromWhomText && d.fromWhomText.length > 0 ? d.fromWhomText : null,
      description: d.description,
      askedOn: d.askedOn ? d.askedOn : null,
      dueBy: d.dueBy ? d.dueBy : null,
      status: d.status ?? "pending",
      notes: d.notes ?? "",
      createdBy: item?.createdBy ?? currentMembership?.userId ?? null,
      createdAt: item?.createdAt ?? now,
      updatedAt: now,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Waiting Item" : "New Waiting Item"}</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4 py-2">
          <div>
            <Label htmlFor="desc">What I'm waiting for *</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1"
              rows={2}
              maxLength={500}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="from">From whom</Label>
            <Input
              id="from"
              value={form.fromWhomText}
              onChange={(e) => setForm({ ...form, fromWhomText: e.target.value })}
              className="mt-1"
              maxLength={100}
              placeholder="Person or team name"
            />
          </div>
          <div>
            <Label htmlFor="waiting-node">Linked to</Label>
            <NodePicker
              id="waiting-node"
              value={form.wbsNodeId}
              onChange={(id) => setForm({ ...form, wbsNodeId: id })}
              includeNone
              noneLabel="(unassigned)"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="asked">Asked on</Label>
              <Input
                id="asked"
                type="date"
                value={form.askedOn}
                onChange={(e) => setForm({ ...form, askedOn: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="dueBy">Due by</Label>
              <Input
                id="dueBy"
                type="date"
                value={form.dueBy}
                onChange={(e) => setForm({ ...form, dueBy: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as WaitingStatus })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="wnotes">Notes</Label>
            <Textarea
              id="wnotes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1"
              rows={2}
              maxLength={1000}
              placeholder="Add notes"
            />
          </div>

          {/* Always-rendered. Each child shows a "save this item first"
              placeholder when no waitingItemId is available yet. */}
          <TaskLinks waitingItemId={item?.id} />
          <TaskAttachments waitingItemId={item?.id} />
          <TaskComments waitingItemId={item?.id} />
        </div>
        <DialogFooter className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            {isEdit && onDelete && (
              <Button variant="destructive" size="sm" onClick={() => { onDelete(item!.id); onOpenChange(false); }}>
                Delete
              </Button>
            )}
            {isEdit && onTakeBack && (
              <Button variant="outline" size="sm" onClick={() => { onTakeBack(item!.id); onOpenChange(false); }}>
                Take back →
              </Button>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.description.trim()}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
