import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Download,
  FileDown,
  FolderTree,
  Layers,
  Package,
  Plus,
  Settings,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { allowedChildTypes } from "@/lib/schemas";
import type { NodeType, WbsNode } from "@/lib/types";
import { NodeDialog } from "@/components/NodeDialog";
import { downloadWbsCsv } from "@/lib/exportWBS";
import {
  applyWbsCsv,
  downloadCSVTemplate,
  previewWbsCsv,
  type ErrorGroup,
  type WbsCsvPreview,
} from "@/lib/csvImport";

// Replaces ProjectsPage. A single recursive tree across all four node types:
// Portfolio › Programme › Project › Work Package. Each card collapses, shows
// child counts, and offers an "Add child" button limited to legal child types.

const TYPE_LABEL: Record<NodeType, string> = {
  portfolio: "Portfolio",
  programme: "Programme",
  project: "Project",
  work_package: "Work Package",
};

const TYPE_ICON: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  portfolio: Briefcase,
  programme: Layers,
  project: FolderTree,
  work_package: Package,
};

const TYPE_BADGE: Record<NodeType, string> = {
  portfolio: "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30",
  programme: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30",
  project: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  work_package: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",
};

const RAG_BADGE: Record<string, string> = {
  green: "bg-green-500/10 text-green-600 border-green-500/30",
  amber: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  red: "bg-red-500/10 text-red-600 border-red-500/30",
};

// -----------------------------------------------------------------------------
// Undo-last-import: persistence + fallback-window query
// -----------------------------------------------------------------------------

const UNDO_BATCH_STORAGE_KEY = "pumped:wbs-last-import-batch";
const FALLBACK_WINDOW_HOURS = 2;

interface UndoBatch {
  importedAt: string;
  fileName: string;
  orgId: string;
  wbsIds: string[];
  actionIds: string[];
}

function readUndoBatch(orgId: string | undefined): UndoBatch | null {
  if (!orgId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UNDO_BATCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UndoBatch;
    if (parsed.orgId !== orgId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeUndoBatch(batch: UndoBatch): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UNDO_BATCH_STORAGE_KEY, JSON.stringify(batch));
}

function clearUndoBatch(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(UNDO_BATCH_STORAGE_KEY);
}

interface RecentCandidate {
  wbsIds: string[];
  actionIds: string[];
}

async function fetchRecentCandidates(
  orgId: string,
  createdBy: string | null,
  hours: number,
): Promise<RecentCandidate> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const wbsQuery = supabase
    .from("wbs_nodes")
    .select("id")
    .eq("organisation_id", orgId)
    .gte("created_at", cutoff);
  const actQuery = supabase
    .from("actions")
    .select("id")
    .eq("organisation_id", orgId)
    .gte("created_at", cutoff)
    .is("archived_at", null);

  const [{ data: wbsRows }, { data: actRows }] = await Promise.all([
    createdBy ? wbsQuery.eq("created_by", createdBy) : wbsQuery,
    createdBy ? actQuery.eq("created_by", createdBy) : actQuery,
  ]);

  return {
    wbsIds: (wbsRows ?? []).map((r) => r.id as string),
    actionIds: (actRows ?? []).map((r) => r.id as string),
  };
}

// -----------------------------------------------------------------------------
// Import-preview helpers
// -----------------------------------------------------------------------------

function totalCount(groups: ErrorGroup[]): number {
  return groups.reduce((s, g) => s + g.count, 0);
}

function GroupedList({
  title,
  groups,
  tone,
}: {
  title: string;
  groups: ErrorGroup[];
  tone: "error" | "warning";
}) {
  const colour = tone === "error" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300";
  return (
    <div>
      <div className="font-medium mb-1">{title}</div>
      <ul className="text-xs space-y-1 max-h-40 overflow-y-auto pl-2">
        {groups.map((g, i) => (
          <li key={i} className="leading-relaxed">
            <span className={`font-medium ${colour}`}>{g.count}×</span>{" "}
            <span className="text-foreground">{g.message}</span>
            {g.rows.length > 0 && (
              <div className="text-muted-foreground text-[10px] mt-0.5">
                Rows: {g.rows.slice(0, 12).join(", ")}
                {g.count > 12 && ` … (+${g.count - 12} more)`}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewList({
  title,
  items,
  overflow,
}: {
  title: string;
  items: { key: string; label: React.ReactNode }[];
  overflow: number;
}) {
  return (
    <div>
      <div className="font-medium mb-1">{title}</div>
      <ul className="text-xs text-muted-foreground space-y-0.5 max-h-40 overflow-y-auto pl-2">
        {items.map((it) => (
          <li key={it.key}>{it.label}</li>
        ))}
        {overflow > 0 && <li className="italic">…and {overflow} more</li>}
      </ul>
    </div>
  );
}

interface NodeCardProps {
  node: WbsNode;
  childrenByParent: Map<string | null, WbsNode[]>;
  depth: number;
  onEdit: (node: WbsNode) => void;
  onAddChild: (parent: WbsNode, type: NodeType) => void;
}

function NodeCard({ node, childrenByParent, depth, onEdit, onAddChild }: NodeCardProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const navigate = useNavigate();
  const children = childrenByParent.get(node.id) ?? [];
  const Icon = TYPE_ICON[node.nodeType];
  const childTypes = allowedChildTypes(node.nodeType);
  const canHaveChildren = childTypes.length > 0;

  return (
    <Card className={depth === 0 ? "border-border" : "border-border/60 bg-card/60"}>
      <CardHeader className="cursor-pointer select-none py-3" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {canHaveChildren && children.length > 0 ? (
              expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              <span className="h-4 w-4 flex-shrink-0" />
            )}
            <Icon className="h-4 w-4 text-primary flex-shrink-0" />
            <CardTitle
              className="text-sm font-medium truncate cursor-pointer hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/wbs/${node.id}`);
              }}
            >
              {node.name}
            </CardTitle>
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${TYPE_BADGE[node.nodeType]}`}>
              {TYPE_LABEL[node.nodeType]}
            </Badge>
            {node.ragStatus && (
              <Badge variant="outline" className={`text-[10px] uppercase ${RAG_BADGE[node.ragStatus]}`}>
                {node.ragStatus}
              </Badge>
            )}
            {node.projectStatus && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {node.projectStatus.replace("_", " ")}
              </Badge>
            )}
            {canHaveChildren && (
              <Badge variant="secondary" className="text-[10px]">
                {children.length} child{children.length === 1 ? "" : "ren"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {canHaveChildren && (
              childTypes.length === 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onAddChild(node, childTypes[0])}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add {TYPE_LABEL[childTypes[0]].toLowerCase()}
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Add child
                      <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {childTypes.map((t) => {
                      const ChildIcon = TYPE_ICON[t];
                      return (
                        <DropdownMenuItem key={t} onClick={() => onAddChild(node, t)}>
                          <ChildIcon className="h-3.5 w-3.5 mr-2 text-primary" />
                          {t === "portfolio" && node.nodeType === "portfolio"
                            ? "Sub-portfolio"
                            : TYPE_LABEL[t]}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onEdit(node)}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {node.description && (
          <p className="text-xs text-muted-foreground mt-1 ml-6 line-clamp-2">{node.description}</p>
        )}
      </CardHeader>
      {expanded && children.length > 0 && (
        <CardContent className="pl-6 pt-0 pb-3 space-y-2">
          {children.map((child) => (
            <NodeCard
              key={child.id}
              node={child}
              childrenByParent={childrenByParent}
              depth={depth + 1}
              onEdit={onEdit}
              onAddChild={onAddChild}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default function WbsPage() {
  const wbsNodes = useAppStore((s) => s.wbsNodes);
  const currentOrg = useAppStore((s) => s.currentOrg);
  const profile = useAppStore((s) => s.profile);
  const addWbsNode = useAppStore((s) => s.addWbsNode);
  const updateWbsNode = useAppStore((s) => s.updateWbsNode);
  const bulkAddActions = useAppStore((s) => s.bulkAddActions);
  const bulkDeleteImported = useAppStore((s) => s.bulkDeleteImported);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editNode, setEditNode] = useState<WbsNode | null>(null);
  const [defaultParent, setDefaultParent] = useState<string | null>(null);
  const [defaultType, setDefaultType] = useState<NodeType | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<WbsCsvPreview | null>(null);
  const [importFilename, setImportFilename] = useState<string>("");
  const [importing, setImporting] = useState(false);

  // Undo state — either a tracked batch from localStorage, or a fallback
  // search for anything this user created in the recent window.
  const [undoBatch, setUndoBatch] = useState<UndoBatch | null>(null);
  const [undoDialogOpen, setUndoDialogOpen] = useState(false);
  const [undoCandidate, setUndoCandidate] = useState<{
    source: "batch" | "window";
    wbsIds: string[];
    actionIds: string[];
    label: string;
  } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoSearching, setUndoSearching] = useState(false);

  useEffect(() => {
    setUndoBatch(readUndoBatch(currentOrg?.id));
  }, [currentOrg?.id]);

  const { roots, childrenByParent } = useMemo(() => {
    const visible = wbsNodes.filter((n) => !n.archivedAt);
    const childrenByParent = new Map<string | null, WbsNode[]>();
    for (const n of visible) {
      const list = childrenByParent.get(n.parentId) ?? [];
      list.push(n);
      childrenByParent.set(n.parentId, list);
    }
    for (const [, list] of childrenByParent) {
      list.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return a.name.localeCompare(b.name);
      });
    }
    return { roots: childrenByParent.get(null) ?? [], childrenByParent };
  }, [wbsNodes]);

  const openCreate = (parent: WbsNode | null, type?: NodeType) => {
    setEditNode(null);
    setDefaultParent(parent?.id ?? null);
    setDefaultType(type);
    setDialogOpen(true);
  };
  const openEdit = (node: WbsNode) => {
    setEditNode(node);
    setDefaultParent(node.parentId);
    setDefaultType(node.nodeType);
    setDialogOpen(true);
  };

  const handleExportCsv = () => {
    if (wbsNodes.filter((n) => !n.archivedAt).length === 0) {
      toast.info("Nothing to export — create at least one node first.");
      return;
    }
    downloadWbsCsv(wbsNodes);
    toast.success("Downloaded pumped-wbs.csv");
  };

  const handleImportFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so picking the same file again still fires
    if (!file) return;
    try {
      const text = await file.text();
      const preview = previewWbsCsv(text, wbsNodes);
      setImportFilename(file.name);
      setImportPreview(preview);
    } catch (err) {
      toast.error("Could not read CSV", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleApplyImport = () => {
    if (!importPreview || !currentOrg) return;
    setImporting(true);
    try {
      const result = applyWbsCsv(importPreview, {
        organisationId: currentOrg.id,
        createdBy: profile?.id ?? null,
        existingNodes: wbsNodes,
        addWbsNode,
        updateWbsNode,
        bulkAddActions,
      });
      const parts: string[] = [];
      if (result.wbsCreated) parts.push(`${result.wbsCreated} WBS node(s) created`);
      if (result.wbsUpdated) parts.push(`${result.wbsUpdated} updated`);
      if (result.actionsCreated) parts.push(`${result.actionsCreated} action(s) created`);
      toast.success(`Import applied: ${parts.join(", ") || "nothing to do"}`);
      if (result.errors.length) {
        console.warn("[WBS import] errors:", result.errors);
      }

      // Record this batch so the user can undo it.
      if (result.createdWbsIds.length > 0 || result.createdActionIds.length > 0) {
        const batch: UndoBatch = {
          importedAt: new Date().toISOString(),
          fileName: importFilename,
          orgId: currentOrg.id,
          wbsIds: result.createdWbsIds,
          actionIds: result.createdActionIds,
        };
        writeUndoBatch(batch);
        setUndoBatch(batch);
      }

      setImportPreview(null);
      setImportFilename("");
    } finally {
      setImporting(false);
    }
  };

  const openUndoDialog = async () => {
    if (!currentOrg) return;
    if (undoBatch) {
      setUndoCandidate({
        source: "batch",
        wbsIds: undoBatch.wbsIds,
        actionIds: undoBatch.actionIds,
        label: `Tracked import "${undoBatch.fileName}" (${new Date(undoBatch.importedAt).toLocaleString()})`,
      });
      setUndoDialogOpen(true);
      return;
    }
    // Fallback: search the recent window.
    setUndoSearching(true);
    try {
      const candidates = await fetchRecentCandidates(
        currentOrg.id,
        profile?.id ?? null,
        FALLBACK_WINDOW_HOURS,
      );
      setUndoCandidate({
        source: "window",
        wbsIds: candidates.wbsIds,
        actionIds: candidates.actionIds,
        label: `All WBS nodes and actions you created in the last ${FALLBACK_WINDOW_HOURS} hours`,
      });
      setUndoDialogOpen(true);
    } catch (e) {
      toast.error("Could not load recent items", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setUndoSearching(false);
    }
  };

  const handleConfirmUndo = async () => {
    if (!undoCandidate) return;
    setUndoBusy(true);
    try {
      const result = await bulkDeleteImported(undoCandidate.wbsIds, undoCandidate.actionIds);
      toast.success(
        `Undo complete: ${result.wbsDeleted} WBS node(s) + ${result.actionsDeleted} action(s) deleted`,
      );
      if (undoCandidate.source === "batch") {
        clearUndoBatch();
        setUndoBatch(null);
      }
      setUndoDialogOpen(false);
      setUndoCandidate(null);
    } finally {
      setUndoBusy(false);
    }
  };

  const hasUndoAvailable = !!undoBatch;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Work Breakdown</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Portfolios, programmes, projects, and work packages — your entire hierarchy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSVTemplate()}>
            <FileDown className="h-4 w-4 mr-1.5" />
            Template
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1.5" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openUndoDialog}
            disabled={undoSearching}
            title={
              hasUndoAvailable
                ? "Undo the most recent CSV import"
                : `No tracked import — searches for items you created in the last ${FALLBACK_WINDOW_HOURS} hours`
            }
          >
            <Undo2 className="h-4 w-4 mr-1.5" />
            {undoSearching ? "Searching…" : hasUndoAvailable ? "Undo last import" : "Undo recent import"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFilePicked}
          />
          <Button variant="outline" size="sm" onClick={() => openCreate(null, "portfolio")}>
            <Briefcase className="h-4 w-4 mr-1.5" />
            New Portfolio
          </Button>
          <Button variant="outline" size="sm" onClick={() => openCreate(null, "programme")}>
            <Layers className="h-4 w-4 mr-1.5" />
            New Programme
          </Button>
          <Button size="sm" onClick={() => openCreate(null, "project")}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Project
          </Button>
        </div>
      </div>

      {roots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No WBS nodes yet. Create your first Portfolio, Programme, or Project to begin.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {roots.map((root) => (
            <NodeCard
              key={root.id}
              node={root}
              childrenByParent={childrenByParent}
              depth={0}
              onEdit={openEdit}
              onAddChild={(parent, type) => openCreate(parent, type)}
            />
          ))}
        </div>
      )}

      <NodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        node={editNode}
        defaultParentId={defaultParent}
        defaultNodeType={defaultType}
      />

      <Dialog
        open={undoDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUndoDialogOpen(false);
            setUndoCandidate(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Undo import</DialogTitle>
            <DialogDescription>
              {undoCandidate?.label}
            </DialogDescription>
          </DialogHeader>
          {undoCandidate && (
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30">
                  {undoCandidate.wbsIds.length} WBS node(s) to delete
                </Badge>
                <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30">
                  {undoCandidate.actionIds.length} action(s) to delete
                </Badge>
              </div>
              {undoCandidate.source === "window" && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  ⚠ This is the fallback path. It deletes everything <strong>you</strong> created in the last {FALLBACK_WINDOW_HOURS} hours — including any WBS nodes you added through the UI during that window. Deleting a WBS node also cascades to its descendant nodes. Review the counts above before confirming.
                </p>
              )}
              {undoCandidate.source === "batch" && (
                <p className="text-xs text-muted-foreground">
                  Deletes exactly what the last CSV import created. Hard delete — there is no second-level undo.
                </p>
              )}
              {undoCandidate.wbsIds.length === 0 && undoCandidate.actionIds.length === 0 && (
                <p className="italic text-muted-foreground">Nothing to delete.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUndoDialogOpen(false); setUndoCandidate(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmUndo}
              disabled={
                undoBusy ||
                !undoCandidate ||
                (undoCandidate.wbsIds.length === 0 && undoCandidate.actionIds.length === 0)
              }
            >
              {undoBusy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importPreview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setImportPreview(null);
            setImportFilename("");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import preview — {importFilename}</DialogTitle>
            <DialogDescription>
              Review what will change. Nothing is written until you confirm.
            </DialogDescription>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-4 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  {importPreview.wbsToCreate.length} WBS to create
                </Badge>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
                  {importPreview.wbsToUpdate.length} WBS to update
                </Badge>
                <Badge variant="outline" className="bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30">
                  {importPreview.actionsToCreate.length} action(s) to create
                </Badge>
                {totalCount(importPreview.warnings) > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                    {totalCount(importPreview.warnings)} warning(s)
                  </Badge>
                )}
                {totalCount(importPreview.errors) > 0 && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30">
                    {totalCount(importPreview.errors)} error(s)
                  </Badge>
                )}
              </div>

              {importPreview.errors.length > 0 && (
                <GroupedList
                  title="Errors (these rows will be skipped)"
                  groups={importPreview.errors}
                  tone="error"
                />
              )}

              {importPreview.warnings.length > 0 && (
                <GroupedList
                  title="Warnings (silently handled)"
                  groups={importPreview.warnings}
                  tone="warning"
                />
              )}

              {importPreview.wbsToCreate.length > 0 && (
                <PreviewList
                  title="New WBS nodes"
                  items={importPreview.wbsToCreate.slice(0, 30).map((r) => ({
                    key: `c-${r.rowNumber}`,
                    label: <><span className="font-mono">{r.nodeType}</span> &middot; {r.path}</>,
                  }))}
                  overflow={Math.max(0, importPreview.wbsToCreate.length - 30)}
                />
              )}

              {importPreview.wbsToUpdate.length > 0 && (
                <PreviewList
                  title="WBS updates"
                  items={importPreview.wbsToUpdate.slice(0, 30).map((u) => ({
                    key: `u-${u.row.rowNumber}`,
                    label: (
                      <>
                        {u.row.path} &middot;{" "}
                        <span className="text-foreground/70">{Object.keys(u.changes).join(", ")}</span>
                      </>
                    ),
                  }))}
                  overflow={Math.max(0, importPreview.wbsToUpdate.length - 30)}
                />
              )}

              {importPreview.actionsToCreate.length > 0 && (
                <PreviewList
                  title="New actions"
                  items={importPreview.actionsToCreate.slice(0, 30).map((a) => ({
                    key: `a-${a.rowNumber}`,
                    label: (
                      <>
                        <span className="text-foreground/70">{a.parentPath} &raquo;</span> {a.task}
                      </>
                    ),
                  }))}
                  overflow={Math.max(0, importPreview.actionsToCreate.length - 30)}
                />
              )}

              {importPreview.wbsToCreate.length === 0 &&
                importPreview.wbsToUpdate.length === 0 &&
                importPreview.actionsToCreate.length === 0 && (
                  <div className="text-muted-foreground italic">No changes to apply.</div>
                )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportPreview(null);
                setImportFilename("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyImport}
              disabled={
                importing ||
                !importPreview ||
                importPreview.wbsToCreate.length +
                  importPreview.wbsToUpdate.length +
                  importPreview.actionsToCreate.length ===
                  0
              }
            >
              {importing
                ? "Applying…"
                : `Apply (${
                    (importPreview?.wbsToCreate.length ?? 0) +
                    (importPreview?.wbsToUpdate.length ?? 0) +
                    (importPreview?.actionsToCreate.length ?? 0)
                  })`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
