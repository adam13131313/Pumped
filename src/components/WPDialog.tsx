import { useState, useEffect } from "react";
import { format, parseISO, isValid } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { WorkPackage, RAGStatus, Dependency, DependencyType } from "@/lib/types";
import { LinkRenderer } from "@/components/LinkRenderer";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskComments } from "@/components/TaskComments";
import { useAppStore } from "@/lib/store";

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
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);
  const [form, setForm] = useState<Partial<WorkPackage>>(
    wp ?? { project: "", workPackage: "", wpLead: "", startDate: "", dueDate: "", ragStatus: "Green", blockers: "", dependencies: [] }
  );
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  useEffect(() => {
    if (open) {
      setForm(wp ?? { project: "", workPackage: "", wpLead: "", startDate: "", dueDate: "", ragStatus: "Green", blockers: "", dependencies: [] });
      setShowNewProject(false);
      setNewProjectName("");
    }
  }, [open, wp]);

  const handleOpen = (o: boolean) => {
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
              {showNewProject ? (
                <div className="flex gap-1 mt-1">
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="New project name"
                    maxLength={100}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (newProjectName.trim()) {
                        setForm({ ...form, project: newProjectName.trim() });
                      }
                      setShowNewProject(false);
                    }}
                  >
                    OK
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.project || "__none__"}
                  onValueChange={(v) => {
                    if (v === "__new__") {
                      setShowNewProject(true);
                      setNewProjectName("");
                    } else if (v === "__none__") {
                      setForm({ ...form, project: "" });
                    } else {
                      setForm({ ...form, project: v });
                    }
                  }}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                    <SelectItem value="__new__">+ Add new project</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label htmlFor="wpname">Work Package *</Label>
              <Input id="wpname" value={form.workPackage ?? ""} onChange={(e) => setForm({ ...form, workPackage: e.target.value })} className="mt-1" maxLength={100} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lead">WP Lead</Label>
              <Input id="lead" value={form.wpLead ?? ""} onChange={(e) => setForm({ ...form, wpLead: e.target.value })} className="mt-1" maxLength={100} />
            </div>
            <div>
              <Label>RAG Status</Label>
              <Select value={form.ragStatus} onValueChange={(v) => setForm({ ...form, ragStatus: v as RAGStatus })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ragStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal text-sm h-10", !form.startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{form.startDate ? format(parseISO(form.startDate), "d MMM yyyy") : "Pick date"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.startDate ? parseISO(form.startDate) : undefined}
                    onSelect={(d) => setForm({ ...form, startDate: d ? format(d, "yyyy-MM-dd") : "" })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal text-sm h-10", !form.dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{form.dueDate ? format(parseISO(form.dueDate), "d MMM yyyy") : "Pick date"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.dueDate ? parseISO(form.dueDate) : undefined}
                    onSelect={(d) => setForm({ ...form, dueDate: d ? format(d, "yyyy-MM-dd") : "" })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <Label htmlFor="blockers">Blockers / Notes</Label>
            <Textarea id="blockers" value={form.blockers ?? ""} onChange={(e) => setForm({ ...form, blockers: e.target.value })} className="mt-1" rows={2} maxLength={500} placeholder="Add notes or paste links (Google Docs, Sheets, etc.)" />
            {form.blockers && /(https?:\/\/[^\s]+)/.test(form.blockers) && (
              <div className="mt-1.5 text-sm"><LinkRenderer text={form.blockers} /></div>
            )}
          </div>
          <div>
            <Label>Attachments</Label>
            <div className="mt-1">
              <TaskAttachments itemId={isEdit ? wp?.id : undefined} itemType="work_package" isNew={!isEdit} />
            </div>
            <TaskComments itemId={isEdit ? wp?.id : undefined} itemType="work_package" />
          </div>
          {/* Dependencies section */}
          {(form.dependencies?.length ?? 0) > 0 && (
            <div>
              <Label>Dependencies</Label>
              <div className="mt-1 space-y-1">
                {form.dependencies!.map((dep, idx) => {
                  const targetWP = workPackages.find((w) => w.id === dep.targetId);
                  return (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
                      <span className="font-medium text-muted-foreground">{dep.type}</span>
                      <span className="truncate flex-1">{targetWP ? `${targetWP.project} – ${targetWP.workPackage}` : dep.targetId}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => {
                          const updated = form.dependencies!.filter((_, i) => i !== idx);
                          setForm({ ...form, dependencies: updated });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
