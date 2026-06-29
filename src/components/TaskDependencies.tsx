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
import type { Action, ActionDependency, WbsNode } from "@/lib/types";

// Compute the set of WBS node ids the picker should consider "in scope" for
// a given anchor action. Walks up from the anchor's WBS node to the nearest
// project ancestor (falling back to programme / portfolio / wherever the
// climb runs out) and returns that node plus every descendant. Used so the
// picker doesn't surface every action in the org when you're trying to add
// a blocker within one project.
//
// Returns null when no anchor node exists (e.g. the action is unassigned).
// Callers treat null as "no scope filter possible — show all".
function getScopeNodeIds(wbsNodes: WbsNode[], anchorNodeId: string | null): Set<string> | null {
  if (!anchorNodeId) return null;
  const byId = new Map(wbsNodes.map((n) => [n.id, n]));

  let scopeRoot = byId.get(anchorNodeId);
  if (!scopeRoot) return null;
  // Climb until we land on a project (preferred) or run out of parents.
  while (scopeRoot.nodeType !== "project" && scopeRoot.parentId) {
    const parent = byId.get(scopeRoot.parentId);
    if (!parent) break;
    scopeRoot = parent;
  }

  const childrenByParent = new Map<string | null, WbsNode[]>();
  for (const n of wbsNodes) {
    const list = childrenByParent.get(n.parentId) ?? [];
    list.push(n);
    childrenByParent.set(n.parentId, list);
  }

  const result = new Set<string>([scopeRoot.id]);
  const queue: string[] = [scopeRoot.id];
  while (queue.length > 0) {
    const id = queue.pop()!;
    const children = childrenByParent.get(id) ?? [];
    for (const c of children) {
      if (!result.has(c.id)) {
        result.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return result;
}

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
  const wbsNodes = useAppStore((s) => s.wbsNodes);
  const deps = useAppStore((s) => s.actionDependencies);
  const addDep = useAppStore((s) => s.addActionDependency);
  const removeDep = useAppStore((s) => s.removeActionDependency);

  const [openBlocker, setOpenBlocker] = useState(false);
  const [openSuccessor, setOpenSuccessor] = useState(false);
  // Default: scope candidates to the current project's subtree. Toggle to
  // show every candidate org-wide when the user needs a cross-project link.
  const [showAllScope, setShowAllScope] = useState(false);

  const incoming = useMemo(
    () => (actionId ? deps.filter((d) => d.targetActionId === actionId) : []),
    [deps, actionId],
  );
  const outgoing = useMemo(
    () => (actionId ? deps.filter((d) => d.sourceActionId === actionId) : []),
    [deps, actionId],
  );

  const anchor = useMemo(
    () => (actionId ? actions.find((a) => a.id === actionId) : undefined),
    [actions, actionId],
  );
  const scopeNodeIds = useMemo(
    () => (showAllScope ? null : getScopeNodeIds(wbsNodes, anchor?.wbsNodeId ?? null)),
    [wbsNodes, anchor?.wbsNodeId, showAllScope],
  );

  // For the blocker picker: any action except self, those already listed
  // incoming, those that would create a cycle, and (when scope is active)
  // only actions whose wbs_node sits inside the anchor's project subtree.
  const blockerCandidates = useMemo(() => {
    if (!actionId) return [];
    const existing = new Set(incoming.map((d) => d.sourceActionId));
    return actions.filter((a) => {
      if (a.id === actionId) return false;
      if (existing.has(a.id)) return false;
      if (wouldCreateCycle(deps, a.id, actionId)) return false;
      if (scopeNodeIds && (!a.wbsNodeId || !scopeNodeIds.has(a.wbsNodeId))) return false;
      return true;
    });
  }, [actions, deps, incoming, actionId, scopeNodeIds]);

  const successorCandidates = useMemo(() => {
    if (!actionId) return [];
    const existing = new Set(outgoing.map((d) => d.targetActionId));
    return actions.filter((a) => {
      if (a.id === actionId) return false;
      if (existing.has(a.id)) return false;
      if (wouldCreateCycle(deps, actionId, a.id)) return false;
      if (scopeNodeIds && (!a.wbsNodeId || !scopeNodeIds.has(a.wbsNodeId))) return false;
      return true;
    });
  }, [actions, deps, outgoing, actionId, scopeNodeIds]);

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
            emptyHint={
              scopeNodeIds
                ? "No actions in this project. Toggle Show all to widen scope."
                : "No candidate actions"
            }
            onPick={(id) => handleAdd("blocker", id)}
            showAllScope={showAllScope}
            onToggleShowAll={() => setShowAllScope((v) => !v)}
            scopeActive={scopeNodeIds !== null}
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
            emptyHint={
              scopeNodeIds
                ? "No actions in this project. Toggle Show all to widen scope."
                : "No candidate actions"
            }
            onPick={(id) => handleAdd("successor", id)}
            showAllScope={showAllScope}
            onToggleShowAll={() => setShowAllScope((v) => !v)}
            scopeActive={scopeNodeIds !== null}
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
  showAllScope?: boolean;
  onToggleShowAll?: () => void;
  scopeActive?: boolean;
}

function ActionSearch({
  candidates,
  placeholder,
  emptyHint,
  onPick,
  showAllScope,
  onToggleShowAll,
  scopeActive,
}: ActionSearchProps) {
  return (
    <Command>
      <CommandInput placeholder={placeholder} />
      {/* Explicit max-height + overflow so the mouse wheel scrolls the list.
          shadcn's defaults are usually enough but a few real users have
          reported the scroll getting swallowed inside Radix popovers. */}
      <CommandList className="max-h-72 overflow-y-auto overscroll-contain">
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
      {scopeActive && onToggleShowAll && (
        <div className="border-t px-2 py-1.5 text-xs flex items-center justify-between bg-muted/30">
          <span className="text-muted-foreground">
            {showAllScope ? "All actions" : "This project only"}
          </span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onToggleShowAll}>
            {showAllScope ? "Limit to project" : "Show all"}
          </Button>
        </div>
      )}
    </Command>
  );
}
