import { useMemo, useState } from "react";
import { Plus, X, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ReadinessBadge } from "@/components/ReadinessBadge";

import { useAppStore, actionReadiness, wouldCreateCycle } from "@/lib/store";
import type { Action, ActionDependency } from "@/lib/types";

// First action-level substrate UI. Two lists:
//   - "Blocked by"  — predecessors (deps where target = this action)
//   - "Blocking"    — successors (deps where source = this action)
// v1 surfaces FS+0 only. Type/lag controls deferred until calendars land.

interface TaskDependenciesProps {
  actionId?: string;
}

export function TaskDependencies({ actionId }: TaskDependenciesProps) {
  const currentOrg = useAppStore((s) => s.currentOrg);
  const actions = useAppStore((s) => s.actions);
  const deps = useAppStore((s) => s.actionDependencies);
  const addDep = useAppStore((s) => s.addActionDependency);
  const removeDep = useAppStore((s) => s.removeActionDependency);

  const [openBlocker, setOpenBlocker] = useState(false);
  const [openSuccessor, setOpenSuccessor] = useState(false);

  const incoming = useMemo(
    () => (actionId ? deps.filter((d) => d.targetActionId === actionId) : []),
    [deps, actionId],
  );
  const outgoing = useMemo(
    () => (actionId ? deps.filter((d) => d.sourceActionId === actionId) : []),
    [deps, actionId],
  );

  // For the blocker picker: any action except self, those already listed
  // incoming, and those that would create a cycle.
  const blockerCandidates = useMemo(() => {
    if (!actionId) return [];
    const existing = new Set(incoming.map((d) => d.sourceActionId));
    return actions.filter((a) => {
      if (a.id === actionId) return false;
      if (existing.has(a.id)) return false;
      // Would adding (candidate -> actionId) create a cycle? Pre-screen.
      if (wouldCreateCycle(deps, a.id, actionId)) return false;
      return true;
    });
  }, [actions, deps, incoming, actionId]);

  const successorCandidates = useMemo(() => {
    if (!actionId) return [];
    const existing = new Set(outgoing.map((d) => d.targetActionId));
    return actions.filter((a) => {
      if (a.id === actionId) return false;
      if (existing.has(a.id)) return false;
      if (wouldCreateCycle(deps, actionId, a.id)) return false;
      return true;
    });
  }, [actions, deps, outgoing, actionId]);

  // Hooks above this line. Bail-out below.
  if (!actionId || !currentOrg) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> Dependencies
        </Label>
        <p className="text-xs text-muted-foreground italic">
          Save the action first to add dependencies.
        </p>
      </div>
    );
  }

  const readiness = actionReadiness(actionId, actions, deps);
  const incomingBlockerCount = incoming.filter((d) => {
    const pred = actions.find((a) => a.id === d.sourceActionId);
    return pred && pred.status !== "complete" && pred.status !== "cancelled";
  }).length;
  const readinessTitle =
    readiness === "blocked" && incomingBlockerCount > 0
      ? `Blocked by ${incomingBlockerCount} action${incomingBlockerCount > 1 ? "s" : ""}`
      : undefined;

  const handleAdd = (mode: "blocker" | "successor", otherId: string) => {
    const source = mode === "blocker" ? otherId : actionId;
    const target = mode === "blocker" ? actionId : otherId;
    const result = addDep({
      id: crypto.randomUUID(),
      organisationId: currentOrg.id,
      sourceActionId: source,
      targetActionId: target,
      dependencyType: "fs",
      lagDays: 0,
      createdAt: new Date().toISOString(),
    });
    if (!result.ok) {
      if (result.reason === "cycle") {
        toast.error("That would create a circular dependency");
      } else {
        toast.error("An action can't depend on itself");
      }
      return;
    }
    if (mode === "blocker") setOpenBlocker(false);
    else setOpenSuccessor(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> Dependencies
        </Label>
        <ReadinessBadge readiness={readiness} title={readinessTitle} />
      </div>

      <DependencyList
        title="Blocked by"
        emptyHint="No blockers"
        rows={incoming}
        rowActionId={(d) => d.sourceActionId}
        actions={actions}
        onRemove={removeDep}
      />
      <Popover open={openBlocker} onOpenChange={setOpenBlocker}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" /> Add blocker
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <ActionSearch
            candidates={blockerCandidates}
            placeholder="Search actions to add as blocker…"
            emptyHint="No candidate actions"
            onPick={(id) => handleAdd("blocker", id)}
          />
        </PopoverContent>
      </Popover>

      <DependencyList
        title="Blocking"
        emptyHint="Not blocking anything"
        rows={outgoing}
        rowActionId={(d) => d.targetActionId}
        actions={actions}
        onRemove={removeDep}
      />
      <Popover open={openSuccessor} onOpenChange={setOpenSuccessor}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" /> Add successor
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <ActionSearch
            candidates={successorCandidates}
            placeholder="Search actions to mark as blocked…"
            emptyHint="No candidate actions"
            onPick={(id) => handleAdd("successor", id)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DependencyList — shared row renderer for the two sections
// ---------------------------------------------------------------------------

interface DependencyListProps {
  title: string;
  emptyHint: string;
  rows: ActionDependency[];
  rowActionId: (dep: ActionDependency) => string;
  actions: Action[];
  onRemove: (id: string) => void;
}

function DependencyList({
  title,
  emptyHint,
  rows,
  rowActionId,
  actions,
  onRemove,
}: DependencyListProps) {
  const actionsById = useMemo(() => {
    const m = new Map<string, Action>();
    for (const a of actions) m.set(a.id, a);
    return m;
  }, [actions]);

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">{emptyHint}</div>
      ) : (
        <ul className="space-y-1">
          {rows.map((d) => {
            const other = actionsById.get(rowActionId(d));
            const completed = other?.status === "complete" || other?.status === "cancelled";
            return (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-md border bg-card/50 px-2 py-1.5 text-sm"
              >
                <span
                  className={
                    "flex-1 min-w-0 truncate " +
                    (completed ? "text-muted-foreground line-through" : "")
                  }
                >
                  {other?.task ?? "(missing action)"}
                </span>
                {other && (
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                    {other.status.replace("_", " ")}
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(d.id)}
                  className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                  aria-label="Remove dependency"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionSearch — searchable popover content for the dep picker
// ---------------------------------------------------------------------------

interface ActionSearchProps {
  candidates: Action[];
  placeholder: string;
  emptyHint: string;
  onPick: (actionId: string) => void;
}

function ActionSearch({ candidates, placeholder, emptyHint, onPick }: ActionSearchProps) {
  return (
    <Command>
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>{emptyHint}</CommandEmpty>
        <CommandGroup>
          {candidates.map((a) => (
            <CommandItem
              key={a.id}
              value={`${a.task} ${a.id}`}
              onSelect={() => onPick(a.id)}
            >
              <span className="truncate">{a.task}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
