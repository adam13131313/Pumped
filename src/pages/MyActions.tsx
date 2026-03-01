import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadges";
import { Action, TaskStatus } from "@/lib/types";
import { LayoutList, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColumns: TaskStatus[] = ["Not Started", "In Progress", "Blocked", "Complete"];

export default function MyActions() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const actions = useAppStore((s) => s.actions);
  const updateAction = useAppStore((s) => s.updateAction);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Actions</h2>
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

      {view === "list" ? (
        <ListView actions={actions} />
      ) : (
        <KanbanView actions={actions} onStatusChange={(id, status) => updateAction(id, { status })} />
      )}
    </div>
  );
}

function ListView({ actions }: { actions: Action[] }) {
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
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="max-w-md px-4 py-3">
                <p className="font-medium truncate">{a.task}</p>
                {a.workPackage && <p className="text-xs text-muted-foreground mt-0.5">{a.workPackage}</p>}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{a.project || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{a.dueDate || "—"}</td>
              <td className="px-4 py-3"><PriorityBadge priority={a.priority} /></td>
              <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KanbanView({ actions, onStatusChange }: { actions: Action[]; onStatusChange: (id: string, status: TaskStatus) => void }) {
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
            onDrop={() => {
              if (dragging) onStatusChange(dragging, col);
              setDragging(null);
            }}
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
