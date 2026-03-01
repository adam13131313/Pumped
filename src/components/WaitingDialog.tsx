import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WaitingItem, WaitingStatus } from "@/lib/types";

interface WaitingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: WaitingItem | null;
  onSave: (item: WaitingItem) => void;
  onDelete?: (id: string) => void;
  onTakeBack?: (id: string) => void;
}

const statuses: WaitingStatus[] = ["Pending", "Received", "Overdue"];

export function WaitingDialog({ open, onOpenChange, item, onSave, onDelete, onTakeBack }: WaitingDialogProps) {
  const isEdit = !!item;
  const [form, setForm] = useState<Partial<WaitingItem>>(
    item ?? { description: "", fromWhom: "", projectWP: "", askedOn: "", dueBy: "", status: "Pending", notes: "" }
  );

  const handleOpen = (o: boolean) => {
    if (o && item) setForm(item);
    else if (o) setForm({ description: "", fromWhom: "", projectWP: "", askedOn: "", dueBy: "", status: "Pending", notes: "" });
    onOpenChange(o);
  };

  const handleSave = () => {
    if (!form.description?.trim()) return;
    onSave({
      id: item?.id ?? crypto.randomUUID(),
      description: form.description?.trim() ?? "",
      fromWhom: form.fromWhom?.trim() ?? "",
      projectWP: form.projectWP?.trim() ?? "",
      askedOn: form.askedOn ?? "",
      dueBy: form.dueBy ?? "",
      status: form.status ?? "Pending",
      notes: form.notes?.trim() ?? "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Waiting Item" : "New Waiting Item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="desc">What I'm waiting for *</Label>
            <Textarea id="desc" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} maxLength={500} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="from">From whom</Label>
              <Input id="from" value={form.fromWhom ?? ""} onChange={(e) => setForm({ ...form, fromWhom: e.target.value })} className="mt-1" maxLength={100} />
            </div>
            <div>
              <Label htmlFor="proj">Project / WP</Label>
              <Input id="proj" value={form.projectWP ?? ""} onChange={(e) => setForm({ ...form, projectWP: e.target.value })} className="mt-1" maxLength={100} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="asked">Asked on</Label>
              <Input id="asked" type="date" value={form.askedOn ?? ""} onChange={(e) => setForm({ ...form, askedOn: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="dueBy">Due by</Label>
              <Input id="dueBy" type="date" value={form.dueBy ?? ""} onChange={(e) => setForm({ ...form, dueBy: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as WaitingStatus })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="wnotes">Notes</Label>
            <Textarea id="wnotes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" rows={2} maxLength={1000} />
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {isEdit && onDelete && (
              <Button variant="destructive" size="sm" onClick={() => { onDelete(item!.id); onOpenChange(false); }}>Delete</Button>
            )}
            {isEdit && onTakeBack && (
              <Button variant="outline" size="sm" onClick={() => { onTakeBack(item!.id); onOpenChange(false); }}>
                ← Take Back
              </Button>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.description?.trim()}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
