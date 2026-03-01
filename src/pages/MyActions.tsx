import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadges";
import { Action, TaskStatus } from "@/lib/types";
import { ActionDialog } from "@/components/ActionDialog";
import { Button } from "@/components/ui/button";
import { LayoutList, Columns3, Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColumns: TaskStatus[] = ["Not Started", "In Progress", "Blocked", "Complete"];

export default function MyActions() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const actions = useAppStore((s) => s.actions);
  const addAction = useAppStore((s) => s.addAction);
  const updateAction = useAppStore((s) => s.updateAction);
  const deleteAction = useAppStore((s) => s.deleteAction);
  const delegateAction = useAppStore((s) => s.delegateAction);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Action | null>(null);

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

      {actions.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          No actions yet. Click "New Action" to create your first task.
        </div>
      ) : view === "list" ? (
        <ListView actions={actions} onEdit={handleEdit} />
      ) : (
        <KanbanView actions={actions} onStatusChange={(id, status) => updateAction(id, { status })} onEdit={handleEdit} />
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

function ListView({ actions, onEdit }: { actions: Action[]; onEdit: (a: Action) => void }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Task</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Project</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Due</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Priority</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => onEdit(a)}>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KanbanView({ actions, onStatusChange, onEdit }: { actions: Action[]; onStatusChange: (id: string, status: TaskStatus) => void; onEdit: (a: Action) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);

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
              {colActions.map((a) => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={() => setDragging(a.id)}
                  onClick={() => onEdit(a)}
                  className="cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                >
                  <p className="text-sm font-medium leading-snug">{a.task}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <PriorityBadge priority={a.priority} />
                    {a.dueDate && <span className="text-xs text-muted-foreground font-mono">{a.dueDate}</span>}
                  </div>
                  {a.project && <p className="mt-1 text-xs text-muted-foreground">{a.project}</p>}
                </div>
              ))}
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
