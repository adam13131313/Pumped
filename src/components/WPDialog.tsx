import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkPackage, RAGStatus } from "@/lib/types";

interface WPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wp?: WorkPackage | null;
  onSave: (wp: WorkPackage) => void;
  onDelete?: (id: string) => void;
}

const ragStatuses: RAGStatus[] = ["Green", "Amber", "Red"];

export function WPDialog({ open, onOpenChange, wp, onSave, onDelete }: WPDialogProps) {
  const isEdit = !!wp;
  const [form, setForm] = useState<Partial<WorkPackage>>(
    wp ?? { project: "", workPackage: "", wpLead: "", startDate: "", dueDate: "", ragStatus: "Green", blockers: "", dependencies: [] }
  );

  const handleOpen = (o: boolean) => {
    if (o && wp) setForm(wp);
    else if (o) setForm({ project: "", workPackage: "", wpLead: "", startDate: "", dueDate: "", ragStatus: "Green", blockers: "", dependencies: [] });
    onOpenChange(o);
  };

  const handleSave = () => {
    if (!form.project?.trim() || !form.workPackage?.trim()) return;
    onSave({
      id: wp?.id ?? crypto.randomUUID(),
      project: form.project?.trim() ?? "",
      workPackage: form.workPackage?.trim() ?? "",
      wpLead: form.wpLead?.trim() ?? "",
      startDate: form.startDate ?? "",
      dueDate: form.dueDate ?? "",
      ragStatus: form.ragStatus ?? "Green",
      blockers: form.blockers?.trim() ?? "",
      dependencies: form.dependencies ?? [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Work Package" : "New Work Package"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proj">Project *</Label>
              <Input id="proj" value={form.project ?? ""} onChange={(e) => setForm({ ...form, project: e.target.value })} className="mt-1" maxLength={100} />
            </div>
            <div>
              <Label htmlFor="wpname">Work Package *</Label>
              <Input id="wpname" value={form.workPackage ?? ""} onChange={(e) => setForm({ ...form, workPackage: e.target.value })} className="mt-1" maxLength={100} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label htmlFor="lead">WP Lead</Label>
              <Input id="lead" value={form.wpLead ?? ""} onChange={(e) => setForm({ ...form, wpLead: e.target.value })} className="mt-1" maxLength={100} />
            </div>
            <div>
              <Label htmlFor="wpstart">Start Date</Label>
              <Input id="wpstart" type="date" value={form.startDate ?? ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="wpdue">Due Date</Label>
              <Input id="wpdue" type="date" value={form.dueDate ?? ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>RAG Status</Label>
              <Select value={form.ragStatus} onValueChange={(v) => setForm({ ...form, ragStatus: v as RAGStatus })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ragStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="blockers">Blockers / Notes</Label>
            <Input id="blockers" value={form.blockers ?? ""} onChange={(e) => setForm({ ...form, blockers: e.target.value })} className="mt-1" maxLength={500} />
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          {isEdit && onDelete && (
            <Button variant="destructive" size="sm" onClick={() => { onDelete(wp!.id); onOpenChange(false); }}>Delete</Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.project?.trim() || !form.workPackage?.trim()}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
