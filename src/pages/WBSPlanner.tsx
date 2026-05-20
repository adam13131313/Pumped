import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/lib/store";
import type { Action, ActionPriority, NodeType, WbsNode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Check, ChevronRight, FileText, Loader2, Plus, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import { allowedChildTypes } from "@/lib/schemas";

// v2 WBS Planner. Calls the generate-wbs edge function (returns flat
// {nodes[], actions[]}), lets the user edit the tree inline, then walks
// nodes parents-before-children to insert wbs_nodes + a final bulk action
// insert keyed by nodeRef→nodeId.

interface ProposedNode {
  ref: string;
  parentRef: string | null;
  nodeType: NodeType;
  name: string;
  description: string;
  lead?: string;
  dueDate?: string;
}

interface ProposedAction {
  nodeRef: string;
  task: string;
  priority: ActionPriority;
  dueDate: string;
}

interface ProposedWbs {
  nodes: ProposedNode[];
  actions: ProposedAction[];
}

const NODE_TYPE_LABEL: Record<NodeType, string> = {
  portfolio: "Portfolio",
  programme: "Programme",
  project: "Project",
  work_package: "Work Package",
};

const PRIORITY_LABEL: Record<ActionPriority, string> = {
  high: "High", medium: "Medium", low: "Low",
};

function isImageFile(file: File) { return file.type.startsWith("image/"); }

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(`[Could not read file: ${file.name}]`);
    reader.readAsText(file);
  });
}
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

const normalize = (raw: unknown): ProposedWbs => {
  const r = (raw ?? {}) as { nodes?: unknown; actions?: unknown };
  const nodes: ProposedNode[] = Array.isArray(r.nodes)
    ? (r.nodes as Array<Record<string, unknown>>).map((n) => ({
        ref: String(n.ref ?? crypto.randomUUID()),
        parentRef: typeof n.parentRef === "string" ? n.parentRef : null,
        nodeType: (n.nodeType as NodeType) ?? "project",
        name: String(n.name ?? "Untitled"),
        description: String(n.description ?? ""),
        lead: typeof n.lead === "string" ? n.lead : "",
        dueDate: typeof n.dueDate === "string" ? n.dueDate : "",
      }))
    : [];
  const actions: ProposedAction[] = Array.isArray(r.actions)
    ? (r.actions as Array<Record<string, unknown>>).map((a) => {
        const rawPri = String(a.priority ?? "medium").toLowerCase();
        const priority: ActionPriority = rawPri === "high" || rawPri === "low" ? rawPri : "medium";
        return {
          nodeRef: String(a.nodeRef ?? ""),
          task: String(a.task ?? ""),
          priority,
          dueDate: typeof a.dueDate === "string" ? a.dueDate : "",
        };
      })
    : [];
  return { nodes, actions };
};

// Sort nodes so every parent appears before its children. Throws if a cycle
// is detected, which generate-wbs should never produce but we still defend.
function topoSort(nodes: ProposedNode[]): ProposedNode[] {
  const byRef = new Map(nodes.map((n) => [n.ref, n]));
  const visited = new Set<string>();
  const ordered: ProposedNode[] = [];
  const visit = (n: ProposedNode, stack: Set<string>) => {
    if (visited.has(n.ref)) return;
    if (stack.has(n.ref)) throw new Error(`Cycle detected at ref ${n.ref}`);
    stack.add(n.ref);
    if (n.parentRef && byRef.has(n.parentRef)) {
      visit(byRef.get(n.parentRef)!, stack);
    }
    stack.delete(n.ref);
    visited.add(n.ref);
    ordered.push(n);
  };
  for (const n of nodes) visit(n, new Set());
  return ordered;
}

export default function WBSPlanner() {
  const navigate = useNavigate();
  const currentOrg = useAppStore((s) => s.currentOrg);
  const currentMembership = useAppStore((s) => s.currentMembership);
  const addWbsNode = useAppStore((s) => s.addWbsNode);
  const bulkAddActions = useAppStore((s) => s.bulkAddActions);

  const [files, setFiles] = useState<File[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [iterating, setIterating] = useState(false);
  const [iteratePrompt, setIteratePrompt] = useState("");
  const [wbs, setWbs] = useState<ProposedWbs | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleFileAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...next]);
    e.target.value = "";
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
  };

  const buildBody = async (extras: { iteratePrompt?: string } = {}) => {
    const imageFiles = files.filter(isImageFile);
    const textFiles = files.filter((f) => !isImageFile(f));
    const documentTexts = await Promise.all(textFiles.map(async (f) => `--- ${f.name} ---\n${await readFileAsText(f)}`));
    const images = await Promise.all(imageFiles.map(async (f) => ({ name: f.name, dataUrl: await readFileAsDataUrl(f) })));
    return {
      documentTexts,
      images,
      additionalContext: additionalContext.trim(),
      currentWbs: extras.iteratePrompt ? wbs : null,
      iteratePrompt: extras.iteratePrompt ?? null,
    };
  };

  const handleGenerate = async () => {
    if (files.length === 0 && !additionalContext.trim()) {
      toast.error("Upload a document or describe the project first");
      return;
    }
    setLoading(true);
    setWbs(null);
    setAccepted(false);
    try {
      const { data, error } = await supabase.functions.invoke("generate-wbs", {
        body: await buildBody(),
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const next = normalize(data);
      if (next.nodes.length === 0) {
        toast.error("AI returned an empty WBS — try adding more detail in 'Additional context'.");
        return;
      }
      setWbs(next);
      toast.success(`Generated ${next.nodes.length} nodes and ${next.actions.length} actions`);
    } catch (e) {
      toast.error("Generation failed", { description: e instanceof Error ? e.message : "Unknown" });
    } finally {
      setLoading(false);
    }
  };

  const handleIterate = async () => {
    if (!iteratePrompt.trim() || !wbs) return;
    setIterating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-wbs", {
        body: await buildBody({ iteratePrompt: iteratePrompt.trim() }),
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWbs(normalize(data));
      setIteratePrompt("");
      toast.success("Refined");
    } catch (e) {
      toast.error("Refinement failed", { description: e instanceof Error ? e.message : "Unknown" });
    } finally {
      setIterating(false);
    }
  };

  // ---- inline edit helpers ----
  const patchNode = (ref: string, patch: Partial<ProposedNode>) =>
    setWbs((prev) => prev ? { ...prev, nodes: prev.nodes.map((n) => n.ref === ref ? { ...n, ...patch } : n) } : prev);

  const removeNode = (ref: string) =>
    setWbs((prev) => {
      if (!prev) return prev;
      // Remove the node and everything that descends from it.
      const descendants = new Set<string>();
      const stack = [ref];
      while (stack.length) {
        const r = stack.pop()!;
        descendants.add(r);
        for (const n of prev.nodes) if (n.parentRef === r) stack.push(n.ref);
      }
      return {
        nodes: prev.nodes.filter((n) => !descendants.has(n.ref)),
        actions: prev.actions.filter((a) => !descendants.has(a.nodeRef)),
      };
    });

  const addChildNode = (parent: ProposedNode) => {
    const allowed = allowedChildTypes(parent.nodeType);
    if (allowed.length === 0) return;
    const childType = allowed[0];
    setWbs((prev) => prev ? {
      ...prev,
      nodes: [...prev.nodes, {
        ref: `tmp-${crypto.randomUUID()}`,
        parentRef: parent.ref,
        nodeType: childType,
        name: `New ${NODE_TYPE_LABEL[childType]}`,
        description: "",
      }],
    } : prev);
  };

  const addRootNode = () => {
    setWbs((prev) => prev ? {
      ...prev,
      nodes: [...prev.nodes, {
        ref: `tmp-${crypto.randomUUID()}`,
        parentRef: null,
        nodeType: "programme",
        name: "New Programme",
        description: "",
      }],
    } : { nodes: [{
      ref: `tmp-${crypto.randomUUID()}`,
      parentRef: null,
      nodeType: "programme",
      name: "New Programme",
      description: "",
    }], actions: [] });
  };

  const patchAction = (idx: number, patch: Partial<ProposedAction>) =>
    setWbs((prev) => prev ? { ...prev, actions: prev.actions.map((a, i) => i === idx ? { ...a, ...patch } : a) } : prev);

  const removeAction = (idx: number) =>
    setWbs((prev) => prev ? { ...prev, actions: prev.actions.filter((_, i) => i !== idx) } : prev);

  const addActionForNode = (nodeRef: string) =>
    setWbs((prev) => prev ? {
      ...prev,
      actions: [...prev.actions, { nodeRef, task: "New task", priority: "medium", dueDate: "" }],
    } : prev);

  // ---- accept & import ----
  const handleAccept = () => {
    if (!wbs || !currentOrg || !currentMembership) {
      toast.error("Nothing to import");
      return;
    }
    try {
      const ordered = topoSort(wbs.nodes);
      const refToId = new Map<string, string>();
      const now = new Date().toISOString();
      const userId = currentMembership.userId;
      const orgId = currentOrg.id;

      // Position per (parent_ref + type) so siblings of the same kind get a
      // sensible numeric order in the new tree.
      const positionCounter = new Map<string, number>();
      const positionKey = (parentRef: string | null, nodeType: NodeType) => `${parentRef ?? "root"}|${nodeType}`;

      for (const n of ordered) {
        const id = crypto.randomUUID();
        refToId.set(n.ref, id);
        const parentId = n.parentRef ? refToId.get(n.parentRef) ?? null : null;
        const key = positionKey(n.parentRef, n.nodeType);
        const position = positionCounter.get(key) ?? 0;
        positionCounter.set(key, position + 1);
        const node: WbsNode = {
          id,
          organisationId: orgId,
          parentId,
          nodeType: n.nodeType,
          name: n.name.trim() || `Untitled ${NODE_TYPE_LABEL[n.nodeType]}`,
          description: n.description ?? "",
          position,
          archivedAt: null,
          projectStatus: n.nodeType === "project" ? "active" : null,
          leadUserId: null,
          startDate: null,
          dueDate: n.nodeType === "work_package" && n.dueDate ? n.dueDate : null,
          ragStatus: n.nodeType === "work_package" ? "green" : null,
          blockers: null,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        };
        addWbsNode(node);
      }

      const newActions: Action[] = wbs.actions
        .map((a) => {
          const nodeId = refToId.get(a.nodeRef);
          if (!nodeId) return null;
          const act: Action = {
            id: crypto.randomUUID(),
            organisationId: orgId,
            wbsNodeId: nodeId,
            assignedTo: userId,
            createdBy: userId,
            task: a.task.trim() || "Untitled task",
            priority: a.priority,
            status: "not_started",
            startDate: null,
            dueDate: a.dueDate || null,
            completedAt: null,
            notes: "",
            labels: [],
            notStartedSince: null,
            archivedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          return act;
        })
        .filter((x): x is Action => x !== null);

      if (newActions.length > 0) bulkAddActions(newActions);

      setAccepted(true);
      toast.success(`Imported ${ordered.length} nodes and ${newActions.length} actions`);
    } catch (e) {
      toast.error("Import failed", { description: e instanceof Error ? e.message : "Unknown" });
    }
  };

  const handleReset = () => {
    setWbs(null);
    setAccepted(false);
    setFiles([]);
    setAdditionalContext("");
    setIteratePrompt("");
  };

  const childrenOf = (ref: string | null) =>
    wbs ? wbs.nodes.filter((n) => n.parentRef === ref) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">WBS Planner</h1>
            <p className="text-sm text-muted-foreground">Generate a Programme → Project → Work Package → Action tree from briefs and notes.</p>
          </div>
        </div>
        {wbs && !accepted && (
          <Button variant="outline" onClick={handleReset}>Start over</Button>
        )}
      </div>

      {!wbs && !accepted && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Source material</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
            >
              <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">Drag in docs (TXT, MD, CSV) or images.</p>
              <label className="inline-flex">
                <input type="file" multiple className="hidden" onChange={handleFileAdd} />
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>Choose files</span>
                </Button>
              </label>
            </div>

            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {f.name}
                    <button onClick={() => removeFile(idx)} aria-label="Remove file" className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-sm font-medium" htmlFor="ctx">Additional context</label>
              <Textarea
                id="ctx"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="What's the goal? Any constraints, deadlines, or naming preferences?"
                rows={4}
                className="mt-1"
              />
            </div>

            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="mr-2 h-4 w-4" />Generate WBS</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {wbs && !accepted && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Proposed WBS</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={addRootNode}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add programme
                  </Button>
                  <Button size="sm" onClick={handleAccept}>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Accept & Create
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {childrenOf(null).length === 0 ? (
                <p className="text-sm text-muted-foreground">No nodes yet — click "Add programme" to start.</p>
              ) : (
                childrenOf(null).map((n) => (
                  <NodeTree
                    key={n.ref}
                    node={n}
                    wbs={wbs}
                    onPatch={patchNode}
                    onRemove={removeNode}
                    onAddChild={addChildNode}
                    onPatchAction={patchAction}
                    onRemoveAction={removeAction}
                    onAddAction={addActionForNode}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Refine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={iteratePrompt}
                onChange={(e) => setIteratePrompt(e.target.value)}
                placeholder="e.g. 'Split the marketing work package into copy vs. design' or 'Tighten dates around Q3 launch'"
                rows={3}
              />
              <Button onClick={handleIterate} disabled={!iteratePrompt.trim() || iterating}>
                {iterating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Refining…</> : <><Sparkles className="mr-2 h-4 w-4" />Refine</>}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {accepted && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Check className="h-10 w-10 mx-auto text-rag-green" />
            <p className="font-medium">Imported into your work breakdown.</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleReset}>Plan another</Button>
              <Button onClick={() => navigate("/wbs")}>Open Work Breakdown</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NodeTree({
  node, wbs, onPatch, onRemove, onAddChild,
  onPatchAction, onRemoveAction, onAddAction,
}: {
  node: ProposedNode;
  wbs: ProposedWbs;
  onPatch: (ref: string, patch: Partial<ProposedNode>) => void;
  onRemove: (ref: string) => void;
  onAddChild: (n: ProposedNode) => void;
  onPatchAction: (idx: number, patch: Partial<ProposedAction>) => void;
  onRemoveAction: (idx: number) => void;
  onAddAction: (nodeRef: string) => void;
}) {
  const children = wbs.nodes.filter((n) => n.parentRef === node.ref);
  const allowedChildren = allowedChildTypes(node.nodeType);
  const actions = wbs.actions
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.nodeRef === node.ref);

  const palette: Record<NodeType, string> = {
    portfolio: "border-purple-300/50 bg-purple-50/40 dark:bg-purple-950/20",
    programme: "border-blue-300/50 bg-blue-50/40 dark:bg-blue-950/20",
    project: "border-emerald-300/50 bg-emerald-50/40 dark:bg-emerald-950/20",
    work_package: "border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/20",
  };

  return (
    <div className={`rounded-lg border ${palette[node.nodeType]} p-3 space-y-2`}>
      <div className="flex items-start gap-2">
        <Badge variant="outline" className="font-mono text-[10px] mt-1">{NODE_TYPE_LABEL[node.nodeType]}</Badge>
        <div className="flex-1 space-y-1">
          <Input
            value={node.name}
            onChange={(e) => onPatch(node.ref, { name: e.target.value })}
            className="h-8 text-sm font-medium"
            maxLength={200}
          />
          <Textarea
            value={node.description}
            onChange={(e) => onPatch(node.ref, { description: e.target.value })}
            placeholder="Description"
            rows={1}
            className="text-xs"
            maxLength={1000}
          />
          {node.nodeType === "work_package" && (
            <div className="flex gap-2">
              <Input
                type="date"
                value={node.dueDate ?? ""}
                onChange={(e) => onPatch(node.ref, { dueDate: e.target.value })}
                className="h-7 text-xs w-40"
              />
            </div>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => onRemove(node.ref)} aria-label="Remove node" className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {actions.length > 0 && (
        <div className="ml-6 space-y-1.5">
          {actions.map(({ a, i }) => (
            <div key={i} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <Input
                value={a.task}
                onChange={(e) => onPatchAction(i, { task: e.target.value })}
                className="h-7 text-xs flex-1"
                maxLength={500}
              />
              <Select value={a.priority} onValueChange={(v) => onPatchAction(i, { priority: v as ActionPriority })}>
                <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{PRIORITY_LABEL.high}</SelectItem>
                  <SelectItem value="medium">{PRIORITY_LABEL.medium}</SelectItem>
                  <SelectItem value="low">{PRIORITY_LABEL.low}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={a.dueDate}
                onChange={(e) => onPatchAction(i, { dueDate: e.target.value })}
                className="h-7 w-36 text-xs"
              />
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onRemoveAction(i)} aria-label="Remove action">
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="ml-6 flex flex-wrap gap-2">
        {node.nodeType === "work_package" && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onAddAction(node.ref)}>
            <Plus className="mr-1 h-3 w-3" /> Add action
          </Button>
        )}
        {allowedChildren.length > 0 && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onAddChild(node)}>
            <Plus className="mr-1 h-3 w-3" /> Add {NODE_TYPE_LABEL[allowedChildren[0]].toLowerCase()}
          </Button>
        )}
      </div>

      {children.length > 0 && (
        <div className="ml-6 space-y-2">
          {children.map((child) => (
            <NodeTree
              key={child.ref}
              node={child}
              wbs={wbs}
              onPatch={onPatch}
              onRemove={onRemove}
              onAddChild={onAddChild}
              onPatchAction={onPatchAction}
              onRemoveAction={onRemoveAction}
              onAddAction={onAddAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
