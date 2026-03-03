import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useFilteredData } from "@/hooks/useFilteredData";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadges";
import { Action, TaskStatus, Priority } from "@/lib/types";
import { ActionDialog } from "@/components/ActionDialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LayoutList, Columns3, Plus, Pencil, Target, Trash2, X, CheckSquare, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusColumns: TaskStatus[] = ["Not Started", "In Progress", "Blocked", "Complete"];
const priorities: Priority[] = ["High", "Medium", "Low"];

export default function MyActions() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const { actions: allActions } = useFilteredData();
  const addAction = useAppStore((s) => s.addAction);
  const updateAction = useAppStore((s) => s.updateAction);
  const deleteAction = useAppStore((s) => s.deleteAction);
  const delegateAction = useAppStore((s) => s.delegateAction);
  const bulkUpdateActions = useAppStore((s) => s.bulkUpdateActions);
  const bulkDeleteActions = useAppStore((s) => s.bulkDeleteActions);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Action | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [filterTask, setFilterTask] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const actions = useMemo(() => {
    return allActions.filter((a) => {
      if (filterTask && !a.task.toLowerCase().includes(filterTask.toLowerCase())) return false;
      if (filterProject && !a.project.toLowerCase().includes(filterProject.toLowerCase())) return false;
      if (filterPriority !== "all" && a.priority !== filterPriority) return false;
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      return true;
    });
  }, [allActions, filterTask, filterProject, filterPriority, filterStatus]);

  const hasActiveFilters = filterTask || filterProject || filterPriority !== "all" || filterStatus !== "all";

  const clearFilters = () => {
    setFilterTask("");
    setFilterProject("");
    setFilterPriority("all");
    setFilterStatus("all");
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === actions.length) setSelected(new Set());
    else setSelected(new Set(actions.map((a) => a.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkStatusChange = (status: TaskStatus) => {
    bulkUpdateActions([...selected], { status });
    toast.success(`${selected.size} task(s) updated to "${status}"`);
    clearSelection();
  };

  const handleBulkPriorityChange = (priority: Priority) => {
    bulkUpdateActions([...selected], { priority });
    toast.success(`${selected.size} task(s) updated to "${priority}" priority`);
    clearSelection();
  };

  const handleBulkDelete = () => {
    const count = selected.size;
    bulkDeleteActions([...selected]);
    toast.success(`${count} task(s) deleted`);
    clearSelection();
  };

  const handleSave = (action: Action) => {
    if (editing) updateAction(action.id, action);
    else addAction(action);
    setEditing(null);
  };

  const handleEdit = (action: Action) => {
    setEditing(action);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Actions</h2>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant={showFilters ? "secondary" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="mr-1.5 h-4 w-4" /> Filters
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> New Action
          </Button>
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <LayoutList className="h-4 w-4" /> List
            </button>
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <Columns3 className="h-4 w-4" /> Kanban
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <Input
            placeholder="Filter by task..."
            value={filterTask}
            onChange={(e) => setFilterTask(e.target.value)}
            className="h-8 w-[180px] text-xs"
          />
          <Input
            placeholder="Filter by project..."
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="h-8 w-[160px] text-xs"
          />
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusColumns.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearFilters}>
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{actions.length} of {allActions.length} shown</span>
        </div>
      )}

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-accent/50 p-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{selected.size} selected</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <Select onValueChange={(v) => handleBulkStatusChange(v as TaskStatus)}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Set status" />
            </SelectTrigger>
            <SelectContent>
              {statusColumns.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => handleBulkPriorityChange(v as Priority)}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="Set priority" />
            </SelectTrigger>
            <SelectContent>
              {priorities.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleBulkDelete}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearSelection}>
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      )}

      {allActions.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          No actions yet. Click "New Action" to create your first task.
        </div>
      ) : actions.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          No actions match your filters.
        </div>
      ) : view === "list" ? (
        <ListView actions={actions} onEdit={handleEdit} selected={selected} onToggle={toggleSelect} onToggleAll={toggleAll} />
      ) : (
        <KanbanView actions={actions} onStatusChange={(id, status) => updateAction(id, { status })} onEdit={handleEdit} selected={selected} onToggle={toggleSelect} />
      )}

      <ActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={editing}
        onSave={handleSave}
        onDelete={(id) => { deleteAction(id); setEditing(null); }}
        onDelegate={(id, toWhom) => { delegateAction(id, toWhom); setEditing(null); }}
      />
    </div>
  );
}

function ListView({ actions, onEdit, selected, onToggle, onToggleAll }: { actions: Action[]; onEdit: (a: Action) => void; selected: Set<string>; onToggle: (id: string) => void; onToggleAll: () => void }) {
  const todayIds = useAppStore((s) => s.todayIds);
  const addToday = useAppStore((s) => s.addToday);
  const removeToday = useAppStore((s) => s.removeToday);
  const allSelected = actions.length > 0 && selected.size === actions.length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="w-10 px-2 py-2.5">
              <Checkbox checked={allSelected} onCheckedChange={onToggleAll} aria-label="Select all" />
            </th>
            <th className="w-10" />
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Task</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Project</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Due</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Priority</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => {
            const gathered = todayIds.has(a.id);
            const isSelected = selected.has(a.id);
            return (
              <tr key={a.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors group cursor-pointer", isSelected && "bg-accent/40")} onClick={() => onEdit(a)}>
                <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={isSelected} onCheckedChange={() => onToggle(a.id)} aria-label={`Select ${a.task}`} />
                </td>
                <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => gathered ? removeToday(a.id) : addToday(a.id)}
                        className={cn(
                          "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
                          gathered ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Target className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{gathered ? "Remove from today" : "Gather for today"}</TooltipContent>
                  </Tooltip>
                </td>
                <td className="max-w-md px-4 py-3">
                  <p className="font-medium truncate">{a.task}</p>
                  {a.workPackage && <p className="text-xs text-muted-foreground mt-0.5">{a.workPackage}</p>}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{a.project || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{a.dueDate || "—"}</td>
                <td className="px-4 py-3"><PriorityBadge priority={a.priority} /></td>
                <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                <td className="px-2 py-3">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KanbanView({ actions, onStatusChange, onEdit, selected, onToggle }: { actions: Action[]; onStatusChange: (id: string, status: TaskStatus) => void; onEdit: (a: Action) => void; selected: Set<string>; onToggle: (id: string) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const todayIds = useAppStore((s) => s.todayIds);
  const addToday = useAppStore((s) => s.addToday);
  const removeToday = useAppStore((s) => s.removeToday);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {statusColumns.map((col) => {
        const colActions = actions.filter((a) => a.status === col);
        return (
          <div
            key={col}
            className="rounded-lg border bg-muted/30 p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragging) onStatusChange(dragging, col); setDragging(null); }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{col}</h3>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {colActions.length}
              </span>
            </div>
            <div className="space-y-2">
              {colActions.map((a) => {
                const gathered = todayIds.has(a.id);
                const isSelected = selected.has(a.id);
                return (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={() => setDragging(a.id)}
                    onClick={() => onEdit(a)}
                    className={cn("cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing", isSelected && "ring-2 ring-primary")}
                  >
                    <div className="flex items-start gap-2">
                      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => onToggle(a.id)} aria-label={`Select ${a.task}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-medium leading-snug flex-1">{a.task}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); gathered ? removeToday(a.id) : addToday(a.id); }}
                            className={cn(
                              "h-6 w-6 flex-shrink-0 flex items-center justify-center rounded transition-colors",
                              gathered ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <Target className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <PriorityBadge priority={a.priority} />
                          {a.dueDate && <span className="text-xs text-muted-foreground font-mono">{a.dueDate}</span>}
                        </div>
                        {a.project && <p className="mt-1 text-xs text-muted-foreground">{a.project}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {colActions.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">Drop tasks here</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
