import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { LayoutList, Columns3, Plus, Pencil, Target, Trash2, X, CheckSquare, Filter, Tag, Sparkles, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const statusColumns: TaskStatus[] = ["Not Started", "In Progress", "Blocked", "Complete"];
const priorities: Priority[] = ["High", "Medium", "Low"];

function matchesGlobalFilter(
  action: Action,
  globalFilter: ReturnType<typeof useAppStore.getState>["globalFilter"],
  projects: ReturnType<typeof useAppStore.getState>["projects"],
  workPackages: ReturnType<typeof useAppStore.getState>["workPackages"]
) {
  const { programmeId, projectId, workPackageId, unassigned } = globalFilter;
  if (!programmeId && !projectId && !workPackageId && !unassigned) return true;
  if (unassigned) return !action.project && !action.workPackage;

  if (projectId) {
    const project = projects.find((p) => p.id === projectId);
    if (!project || action.project !== project.name) return false;
  } else if (programmeId) {
    const projectNames = new Set(projects.filter((p) => p.programmeId === programmeId).map((p) => p.name));
    if (!projectNames.has(action.project)) return false;
  } else if (!action.project) {
    return false;
  }

  if (workPackageId) {
    const workPackage = workPackages.find((wp) => wp.id === workPackageId);
    if (!workPackage || action.workPackage !== workPackage.workPackage) return false;
  }

  return true;
}

export default function MyActions() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const { actions: allActions } = useFilteredData();
  const addAction = useAppStore((s) => s.addAction);
  const updateAction = useAppStore((s) => s.updateAction);
  const deleteAction = useAppStore((s) => s.deleteAction);
  const delegateAction = useAppStore((s) => s.delegateAction);
  const bulkUpdateActions = useAppStore((s) => s.bulkUpdateActions);
  const bulkDeleteActions = useAppStore((s) => s.bulkDeleteActions);
  const todayIds = useAppStore((s) => s.todayIds);
  const addToday = useAppStore((s) => s.addToday);
  const removeToday = useAppStore((s) => s.removeToday);
  const clearToday = useAppStore((s) => s.clearToday);
  const globalFilter = useAppStore((s) => s.globalFilter);
  const clearGlobalFilter = useAppStore((s) => s.clearGlobalFilter);
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Action | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [filterTask, setFilterTask] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [gatheredOnly, setGatheredOnly] = useState(false);
  const [dueTodayOnly, setDueTodayOnly] = useState(false);

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const actions = useMemo(() => {
    return allActions.filter((a) => {
      if (gatheredOnly && !todayIds.has(a.id)) return false;
      if (dueTodayOnly && a.dueDate !== todayStr) return false;
      if (filterTask && !a.task.toLowerCase().includes(filterTask.toLowerCase())) return false;
      if (filterPriority !== "all" && a.priority !== filterPriority) return false;
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      return true;
    });
  }, [allActions, filterTask, filterPriority, filterStatus, gatheredOnly, dueTodayOnly, todayIds, todayStr]);

  const dueTodayCount = useMemo(
    () => allActions.filter((a) => a.dueDate === todayStr).length,
    [allActions, todayStr]
  );

  const gatheredCount = useMemo(
    () => allActions.filter((a) => todayIds.has(a.id)).length,
    [allActions, todayIds]
  );

  const hasActiveFilters = filterTask || filterPriority !== "all" || filterStatus !== "all" || gatheredOnly || dueTodayOnly;

  const clearFilters = () => {
    setFilterTask("");
    setFilterPriority("all");
    setFilterStatus("all");
    setGatheredOnly(false);
    setDueTodayOnly(false);
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
    else {
      addAction(action);
      clearFilters();
      const hasGlobalFilter = globalFilter.programmeId || globalFilter.projectId || globalFilter.workPackageId || globalFilter.unassigned;
      if (hasGlobalFilter && !matchesGlobalFilter(action, globalFilter, projects, workPackages)) {
        clearGlobalFilter();
        toast.info("Cleared filters so your new action is visible");
      }
    }
    setEditing(null);
  };

  const handleEdit = (action: Action) => {
    setEditing(action);
    setDialogOpen(true);
  };

  // Auto-open dialog when navigated from command palette via ?open=<id>
  // Look up against the raw store (not filtered actions) so global filter
  // doesn't hide the target.
  const allActionsRaw = useAppStore((s) => s.actions);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    const target = allActionsRaw.find((a) => a.id === openId);
    if (target) {
      setEditing(target);
      setDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("open");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, allActionsRaw, setSearchParams]);

  // Kanban column ordering state
  const [columnOrder, setColumnOrder] = useState<Record<string, string[]>>({});

  const getOrderedActions = useCallback((status: TaskStatus, colActions: Action[]) => {
    const order = columnOrder[status];
    if (!order) return colActions;
    const ordered: Action[] = [];
    for (const id of order) {
      const a = colActions.find((x) => x.id === id);
      if (a) ordered.push(a);
    }
    // Append any new items not yet in order
    for (const a of colActions) {
      if (!order.includes(a.id)) ordered.push(a);
    }
    return ordered;
  }, [columnOrder]);

  const handleReorder = useCallback((status: TaskStatus, fromIndex: number, toIndex: number, colActions: Action[]) => {
    const ordered = getOrderedActions(status, colActions).map((a) => a.id);
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    setColumnOrder((prev) => ({ ...prev, [status]: ordered }));
  }, [getOrderedActions]);

  const handleStatusChange = useCallback((id: string, newStatus: TaskStatus, dropIndex?: number) => {
    updateAction(id, { status: newStatus });
    if (dropIndex !== undefined) {
      // Insert at specific position in the target column
      setColumnOrder((prev) => {
        const existing = prev[newStatus] || [];
        const filtered = existing.filter((x) => x !== id);
        filtered.splice(dropIndex, 0, id);
        // Also remove from old columns
        const updated = { ...prev, [newStatus]: filtered };
        for (const col of statusColumns) {
          if (col !== newStatus && updated[col]) {
            updated[col] = updated[col].filter((x) => x !== id);
          }
        }
        return updated;
      });
    }
  }, [updateAction]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">My Actions</h2>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button size="sm" className="h-8" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> New Action
          </Button>
          <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <LayoutList className="h-4 w-4" /> List
            </button>
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              )}
            >
              <Columns3 className="h-4 w-4" /> Kanban
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <button
            onClick={() => setGatheredOnly((v) => !v)}
            className={cn(
              "h-8 inline-flex items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              gatheredOnly
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground hover:bg-accent"
            )}
            title="Show only gathered tasks"
          >
            <Target className="h-3.5 w-3.5" />
            Gathered only
            <span className={cn(
              "ml-1 rounded-full px-1.5 text-[10px] font-semibold",
              gatheredOnly ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>{gatheredCount}</span>
          </button>
          <button
            onClick={() => setDueTodayOnly((v) => !v)}
            className={cn(
              "h-8 inline-flex items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              dueTodayOnly
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground hover:bg-accent"
            )}
            title="Show only tasks due today"
          >
            <Filter className="h-3.5 w-3.5" />
            Due today
            <span className={cn(
              "ml-1 rounded-full px-1.5 text-[10px] font-semibold",
              dueTodayOnly ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>{dueTodayCount}</span>
          </button>
          <Input
            placeholder="Search tasks..."
            value={filterTask}
            onChange={(e) => setFilterTask(e.target.value)}
            className="h-8 w-[220px] text-xs"
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
          {gatheredCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                clearToday();
                toast.success("Scattered all gathered tasks");
              }}
              title="Remove all tasks from gathered"
            >
              Scatter all
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{actions.length} of {allActions.length} shown</span>
        </div>

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
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
            const ids = [...selected];
            ids.forEach((id) => addToday(id));
            toast.success(`${ids.length} task(s) gathered`);
            clearSelection();
          }}>
            <Target className="mr-1 h-3.5 w-3.5" /> Gather
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
            const ids = [...selected];
            ids.forEach((id) => removeToday(id));
            toast.success(`${ids.length} task(s) scattered`);
            clearSelection();
          }}>
            <X className="mr-1 h-3.5 w-3.5" /> Scatter
          </Button>
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
        <ListView actions={actions} onEdit={handleEdit} selected={selected} onToggle={toggleSelect} onToggleAll={toggleAll} workPackages={workPackages} onApplyWP={(id, project, workPackage) => updateAction(id, { project, workPackage })} />
      ) : (
        <KanbanView
          actions={actions}
          onStatusChange={handleStatusChange}
          onEdit={handleEdit}
          selected={selected}
          onToggle={toggleSelect}
          getOrderedActions={getOrderedActions}
          onReorder={handleReorder}
        />
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

interface WPSuggestion {
  id: string;
  project: string;
  workPackage: string;
  confidence?: string;
  reason?: string;
}

function ListView({ actions, onEdit, selected, onToggle, onToggleAll, workPackages, onApplyWP }: { actions: Action[]; onEdit: (a: Action) => void; selected: Set<string>; onToggle: (id: string) => void; onToggleAll: () => void; workPackages: import("@/lib/types").WorkPackage[]; onApplyWP: (id: string, project: string, workPackage: string) => void }) {
  const todayIds = useAppStore((s) => s.todayIds);
  const addToday = useAppStore((s) => s.addToday);
  const removeToday = useAppStore((s) => s.removeToday);
  const allSelected = actions.length > 0 && selected.size === actions.length;

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, WPSuggestion | null>>({});

  const handleSuggest = async (a: Action) => {
    if (workPackages.length === 0) {
      toast.error("No Work Packages exist yet. Create one in the WBS Planner first.");
      return;
    }
    setLoadingId(a.id);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-work-package", {
        body: {
          task: a.task,
          notes: a.notes,
          currentProject: a.project,
          workPackages: workPackages.map((w) => ({ id: w.id, project: w.project, workPackage: w.workPackage })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.suggestion) {
        toast.info(data?.reason || "No confident match found.");
        setSuggestions((p) => ({ ...p, [a.id]: null }));
      } else {
        setSuggestions((p) => ({ ...p, [a.id]: { ...data.suggestion, confidence: data.confidence, reason: data.reason } }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suggestion failed");
    } finally {
      setLoadingId(null);
    }
  };

  const acceptSuggestion = (a: Action, s: WPSuggestion) => {
    onApplyWP(a.id, s.project, s.workPackage);
    setSuggestions((p) => { const next = { ...p }; delete next[a.id]; return next; });
    toast.success(`Assigned to "${s.workPackage}"`);
  };

  const rejectSuggestion = (id: string) => {
    setSuggestions((p) => { const next = { ...p }; delete next[id]; return next; });
  };

  return (
    <>
      {/* Desktop table view */}
      <div className="hidden sm:block overflow-hidden rounded-lg border bg-card">
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
              const unassigned = !a.workPackage;
              const suggestion = suggestions[a.id];
              const isLoading = loadingId === a.id;
              return (
                <tr key={a.id} className={cn(
                  "border-b last:border-0 hover:bg-muted/30 transition-colors group cursor-pointer",
                  isSelected && "bg-accent/40",
                  unassigned && !isSelected && "bg-amber-500/5 border-l-2 border-l-amber-500/60"
                )} onClick={() => onEdit(a)}>
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
                      <TooltipContent side="right">{gathered ? "Scatter (remove from gathered)" : "Gather"}</TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <p className="font-medium truncate">{a.task}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {a.workPackage ? (
                        <span className="text-xs text-muted-foreground">{a.workPackage}</span>
                      ) : (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-500">Unassigned WP</span>
                      )}
                      {(a.labels?.length ?? 0) > 0 && a.labels.map((l) => (
                        <Badge key={l} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">{l}</Badge>
                      ))}
                    </div>
                    {unassigned && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        {!suggestion && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 border-amber-500/40 hover:bg-amber-500/10"
                            onClick={() => handleSuggest(a)}
                            disabled={isLoading}
                          >
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            {isLoading ? "Thinking…" : "Suggest Work Package"}
                          </Button>
                        )}
                        {suggestion && (
                          <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2">
                            <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs">
                                <span className="text-muted-foreground">Suggested:</span>{" "}
                                <span className="font-medium">{suggestion.workPackage}</span>
                                <span className="text-muted-foreground"> · {suggestion.project}</span>
                                {suggestion.confidence && (
                                  <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">({suggestion.confidence})</span>
                                )}
                              </p>
                              {suggestion.reason && <p className="text-[11px] text-muted-foreground mt-0.5">{suggestion.reason}</p>}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button size="sm" variant="default" className="h-6 px-2 text-xs gap-1" onClick={() => acceptSuggestion(a, suggestion)}>
                                <Check className="h-3 w-3" /> Accept
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => rejectSuggestion(a.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {actions.map((a) => {
          const gathered = todayIds.has(a.id);
          const isSelected = selected.has(a.id);
          const unassigned = !a.workPackage;
          const suggestion = suggestions[a.id];
          const isLoading = loadingId === a.id;
          return (
            <div
              key={a.id}
              onClick={() => onEdit(a)}
              className={cn(
                "rounded-lg border bg-card p-3 transition-colors active:bg-muted/30 cursor-pointer",
                isSelected && "bg-accent/40 border-primary/30",
                unassigned && !isSelected && "border-l-2 border-l-amber-500/60 bg-amber-500/5"
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className="flex flex-col items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={isSelected} onCheckedChange={() => onToggle(a.id)} aria-label={`Select ${a.task}`} />
                  <button
                    onClick={() => gathered ? removeToday(a.id) : addToday(a.id)}
                    className={cn(
                      "h-6 w-6 flex items-center justify-center rounded-md transition-colors",
                      gathered ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    <Target className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-snug">{a.task}</p>
                  {a.workPackage ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{a.workPackage}</p>
                  ) : (
                    <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-500 mt-0.5">Unassigned WP</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <PriorityBadge priority={a.priority} />
                    <StatusBadge status={a.status} />
                    {(a.labels?.length ?? 0) > 0 && a.labels.map((l) => (
                      <Badge key={l} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">{l}</Badge>
                    ))}
                    {a.project && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{a.project}</span>}
                    {a.dueDate && <span className="text-[10px] text-muted-foreground font-mono">{a.dueDate}</span>}
                  </div>
                  {unassigned && (
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      {!suggestion && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5 border-amber-500/40"
                          onClick={() => handleSuggest(a)}
                          disabled={isLoading}
                        >
                          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          {isLoading ? "Thinking…" : "Suggest WP"}
                        </Button>
                      )}
                      {suggestion && (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1.5">
                          <p className="text-xs">
                            <span className="text-muted-foreground">Suggested:</span>{" "}
                            <span className="font-medium">{suggestion.workPackage}</span>
                          </p>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="default" className="h-6 px-2 text-xs gap-1 flex-1" onClick={() => acceptSuggestion(a, suggestion)}>
                              <Check className="h-3 w-3" /> Accept
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => rejectSuggestion(a.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function KanbanView({
  actions,
  onStatusChange,
  onEdit,
  selected,
  onToggle,
  getOrderedActions,
  onReorder,
}: {
  actions: Action[];
  onStatusChange: (id: string, status: TaskStatus, dropIndex?: number) => void;
  onEdit: (a: Action) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  getOrderedActions: (status: TaskStatus, colActions: Action[]) => Action[];
  onReorder: (status: TaskStatus, fromIndex: number, toIndex: number, colActions: Action[]) => void;
}) {
  const todayIds = useAppStore((s) => s.todayIds);
  const addToday = useAppStore((s) => s.addToday);
  const removeToday = useAppStore((s) => s.removeToday);

  const dragItemRef = useRef<{ id: string; sourceStatus: TaskStatus; sourceIndex: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: TaskStatus; index: number } | null>(null);

  const handleDragStart = (id: string, status: TaskStatus, index: number) => {
    dragItemRef.current = { id, sourceStatus: status, sourceIndex: index };
  };

  const handleDragOverCard = (e: React.DragEvent, status: TaskStatus, index: number) => {
    e.preventDefault();
    setDropTarget({ status, index });
  };

  const handleDragOverColumn = (e: React.DragEvent, status: TaskStatus, colLength: number) => {
    e.preventDefault();
    // Only set drop target to end if not already over a card
    if (!dropTarget || dropTarget.status !== status) {
      setDropTarget({ status, index: colLength });
    }
  };

  const handleDrop = (status: TaskStatus, colActions: Action[]) => {
    const drag = dragItemRef.current;
    if (!drag) return;

    const targetIndex = dropTarget?.status === status ? dropTarget.index : colActions.length;

    if (drag.sourceStatus === status) {
      // Reorder within same column
      if (drag.sourceIndex !== targetIndex) {
        onReorder(status, drag.sourceIndex, targetIndex > drag.sourceIndex ? targetIndex - 1 : targetIndex, colActions);
      }
    } else {
      // Move to different column
      onStatusChange(drag.id, status, targetIndex);
    }

    dragItemRef.current = null;
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    dragItemRef.current = null;
    setDropTarget(null);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {statusColumns.map((col) => {
        const rawColActions = actions.filter((a) => a.status === col);
        const colActions = getOrderedActions(col, rawColActions);
        return (
          <div
            key={col}
            className={cn(
              "rounded-lg border bg-muted/30 p-3",
              dropTarget?.status === col && "ring-2 ring-primary/30"
            )}
            onDragOver={(e) => handleDragOverColumn(e, col, colActions.length)}
            onDrop={() => handleDrop(col, colActions)}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{col}</h3>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {colActions.length}
              </span>
            </div>
            <div className="space-y-2">
              {colActions.map((a, idx) => {
                const gathered = todayIds.has(a.id);
                const isSelected = selected.has(a.id);
                const isDropBefore = dropTarget?.status === col && dropTarget.index === idx;
                return (
                  <div key={a.id}>
                    {isDropBefore && (
                      <div className="h-1 rounded-full bg-primary mb-2 transition-all" />
                    )}
                    <div
                      draggable
                      onDragStart={() => handleDragStart(a.id, col, idx)}
                      onDragOver={(e) => handleDragOverCard(e, col, idx)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onEdit(a)}
                      className={cn(
                        "cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
                        isSelected && "ring-2 ring-primary"
                      )}
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
                          {(a.labels?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {a.labels.map((l) => (
                                <Badge key={l} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">{l}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Drop indicator at end of column */}
              {dropTarget?.status === col && dropTarget.index === colActions.length && colActions.length > 0 && (
                <div className="h-1 rounded-full bg-primary transition-all" />
              )}
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