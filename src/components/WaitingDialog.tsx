import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WaitingItem, WaitingStatus } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { LinkRenderer } from "@/components/LinkRenderer";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskComments } from "@/components/TaskComments";

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
  const programmes = useAppStore((s) => s.programmes);
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);
  const globalFilter = useAppStore((s) => s.globalFilter);

  const emptyForm: Partial<WaitingItem> = { description: "", fromWhom: "", projectWP: "", askedOn: "", dueBy: "", status: "Pending", notes: "" };
  const [form, setForm] = useState<Partial<WaitingItem>>(item ?? emptyForm);
  const [selectedProgrammeId, setSelectedProgrammeId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedWPId, setSelectedWPId] = useState("");

  useEffect(() => {
    if (open) {
      if (item) {
        setForm(item);
        if (item.projectWP) {
          const parts = item.projectWP.split(" / ");
          const projName = parts[0]?.trim();
          const wpName = parts[1]?.trim();
          const proj = projects.find((p) => p.name === projName);
          const wp = wpName ? workPackages.find((w) => w.workPackage === wpName) : undefined;
          setSelectedProjectId(proj?.id ?? "");
          setSelectedProgrammeId(proj?.programmeId ?? "");
          setSelectedWPId(wp?.id ?? "");
        } else {
          setSelectedProgrammeId("");
          setSelectedProjectId("");
          setSelectedWPId("");
        }
      } else {
        // New item: pre-populate from global filter
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
        setSelectedWPId(prefillWPId);

        let projectWP = "";
        if (proj && wp) projectWP = `${proj.name} / ${wp.workPackage}`;
        else if (proj) projectWP = proj.name;

        setForm({ ...emptyForm, projectWP });
      }
    }
  }, [open, item]);

  const filteredProjects = useMemo(() => {
    if (!selectedProgrammeId) return projects;
    return projects.filter((p) => p.programmeId === selectedProgrammeId);
  }, [projects, selectedProgrammeId]);

  const filteredWPs = useMemo(() => {
    if (!selectedProjectId) return workPackages;
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (!proj) return workPackages;
    return workPackages.filter((wp) => wp.project === proj.name);
  }, [workPackages, selectedProjectId, projects]);

  // Build projectWP string from selections
  const buildProjectWP = (projId: string, wpId: string): string => {
    const proj = projects.find((p) => p.id === projId);
    const wp = workPackages.find((w) => w.id === wpId);
    if (proj && wp) return `${proj.name} / ${wp.workPackage}`;
    if (proj) return proj.name;
    return "";
  };

  const handleProgrammeChange = (val: string) => {
    const id = val === "__none__" ? "" : val;
    setSelectedProgrammeId(id);
    if (id) {
      const proj = projects.find((p) => p.id === selectedProjectId);
      if (proj && proj.programmeId !== id) {
        setSelectedProjectId("");
        setSelectedWPId("");
        setForm((f) => ({ ...f, projectWP: "" }));
      }
    }
  };

  const handleProjectChange = (val: string) => {
    if (val === "__none__") {
      setSelectedProjectId("");
      setSelectedWPId("");
      setForm((f) => ({ ...f, projectWP: "" }));
    } else {
      setSelectedProjectId(val);
      setSelectedWPId("");
      const proj = projects.find((p) => p.id === val);
      setForm((f) => ({ ...f, projectWP: proj?.name ?? "" }));
      if (proj?.programmeId && !selectedProgrammeId) {
        setSelectedProgrammeId(proj.programmeId);
      }
    }
  };

  const handleWPChange = (val: string) => {
    if (val === "__none__") {
      setSelectedWPId("");
      setForm((f) => ({ ...f, projectWP: buildProjectWP(selectedProjectId, "") }));
    } else {
      setSelectedWPId(val);
      const wp = workPackages.find((w) => w.id === val);
      if (wp) {
        const proj = projects.find((p) => p.name === wp.project);
        if (proj) {
          setSelectedProjectId(proj.id);
          if (proj.programmeId && !selectedProgrammeId) {
            setSelectedProgrammeId(proj.programmeId);
          }
        }
        setForm((f) => ({ ...f, projectWP: buildProjectWP(proj?.id ?? selectedProjectId, val) }));
      }
    }
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
      linkedProjectId: selectedProjectId || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Waiting Item" : "New Waiting Item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="desc">What I'm waiting for *</Label>
            <Textarea id="desc" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} maxLength={500} />
          </div>
          <div>
            <Label htmlFor="from">From whom</Label>
            <Input id="from" value={form.fromWhom ?? ""} onChange={(e) => setForm({ ...form, fromWhom: e.target.value })} className="mt-1" maxLength={100} />
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
            <Select value={selectedWPId || "__none__"} onValueChange={handleWPChange}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {filteredWPs.map((wp) => (
                  <SelectItem key={wp.id} value={wp.id}>{wp.workPackage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Textarea id="wnotes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" rows={2} maxLength={1000} placeholder="Add notes or paste links (Google Docs, Sheets, etc.)" />
            {form.notes && /(https?:\/\/[^\s]+)/.test(form.notes) && (
              <div className="mt-1.5 text-sm"><LinkRenderer text={form.notes} /></div>
            )}
          </div>
          <div>
            <Label>Attachments</Label>
            <div className="mt-1">
              <TaskAttachments itemId={isEdit ? item?.id : undefined} itemType="waiting_item" isNew={!isEdit} />
          </div>
          <TaskComments itemId={isEdit ? item?.id : undefined} itemType="waiting_item" />
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
