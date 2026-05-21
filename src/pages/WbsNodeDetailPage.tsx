import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronRight,
  Edit3,
  Gauge,
  Plus,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { allowedChildTypes } from "@/lib/schemas";
import type { NodeType, WbsNode } from "@/lib/types";
import { NodeDialog } from "@/components/NodeDialog";
import { nodePath } from "@/components/NodePicker";
import { StatusPicker } from "@/components/StatusPicker";

const TYPE_LABEL: Record<NodeType, string> = {
  portfolio: "Portfolio",
  programme: "Programme",
  project: "Project",
  work_package: "Work Package",
};

function subtreeIds(nodes: WbsNode[], rootId: string): Set<string> {
  const byParent = new Map<string | null, WbsNode[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  const result = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const kid of byParent.get(id) ?? []) {
      if (!result.has(kid.id)) {
        result.add(kid.id);
        stack.push(kid.id);
      }
    }
  }
  return result;
}

export default function WbsNodeDetailPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const wbsNodes = useAppStore((s) => s.wbsNodes);
  const actions = useAppStore((s) => s.actions);
  const waitingItems = useAppStore((s) => s.waitingItems);
  const setGlobalFilter = useAppStore((s) => s.setGlobalFilter);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editNode, setEditNode] = useState<WbsNode | null>(null);
  const [defaultParent, setDefaultParent] = useState<string | null>(null);

  const node = useMemo(() => wbsNodes.find((n) => n.id === nodeId) ?? null, [wbsNodes, nodeId]);

  if (!node) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/wbs")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to WBS
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Node not found. It may have been deleted.
          </CardContent>
        </Card>
      </div>
    );
  }

  const path = nodePath(wbsNodes, node.id);
  const subtree = subtreeIds(wbsNodes, node.id);
  const children = wbsNodes
    .filter((n) => n.parentId === node.id && !n.archivedAt)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  const linkedActions = actions.filter((a) => a.wbsNodeId && subtree.has(a.wbsNodeId));
  const linkedWaiting = waitingItems.filter((w) => w.wbsNodeId && subtree.has(w.wbsNodeId));

  const childTypes = allowedChildTypes(node.nodeType);
  const canHaveChildren = childTypes.length > 0;

  const openCreate = (type?: NodeType) => {
    setEditNode(null);
    setDefaultParent(node.id);
    setDialogOpen(true);
    void type; // type defaulting handled inside NodeDialog
  };
  const openEdit = (n: WbsNode) => {
    setEditNode(n);
    setDefaultParent(n.parentId);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb + back */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate("/wbs")} className="h-7 px-2 -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            WBS
          </Button>
          {path.slice(0, -1).map((n) => (
            <span key={n.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button
                className="hover:underline truncate max-w-[200px]"
                onClick={() => navigate(`/wbs/${n.id}`)}
              >
                {n.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setGlobalFilter({ nodeId: node.id, unassigned: false });
              navigate("/dashboard");
            }}
          >
            <Gauge className="h-3.5 w-3.5 mr-1" />
            Dashboard for this {TYPE_LABEL[node.nodeType].toLowerCase()}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openEdit(node)}>
            <Edit3 className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
        </div>
      </div>

      {/* Node header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">{node.name}</h1>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {TYPE_LABEL[node.nodeType]}
          </Badge>
          {node.ragStatus && (
            <Badge variant="outline" className="text-[10px] uppercase">{node.ragStatus}</Badge>
          )}
          {node.projectStatus && (
            <Badge variant="outline" className="text-[10px] capitalize">
              {node.projectStatus.replace("_", " ")}
            </Badge>
          )}
        </div>
        {node.description && (
          <p className="text-sm text-muted-foreground">{node.description}</p>
        )}
        {node.nodeType === "work_package" && (node.startDate || node.dueDate) && (
          <p className="text-xs text-muted-foreground">
            {node.startDate ? `Starts ${node.startDate}` : ""}
            {node.startDate && node.dueDate ? " · " : ""}
            {node.dueDate ? `Due ${node.dueDate}` : ""}
          </p>
        )}
        {node.blockers && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            <strong>Blockers:</strong> {node.blockers}
          </p>
        )}
      </div>

      {/* Children */}
      {canHaveChildren && (
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {children.length} child{children.length === 1 ? "" : "ren"}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openCreate()}>
                <Plus className="h-3 w-3 mr-1" />
                Add child
              </Button>
            </div>
          </CardHeader>
          {children.length > 0 && (
            <CardContent className="pt-0 pb-3 space-y-1">
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/wbs/${c.id}`)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-muted/60 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="truncate">{c.name}</span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider flex-shrink-0">
                    {TYPE_LABEL[c.nodeType]}
                  </Badge>
                </button>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Linked actions + waiting (read-only summary; full edit lives in My Actions / Waiting For) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Actions in this subtree ({linkedActions.length})
            </CardTitle>
          </CardHeader>
          {linkedActions.length > 0 && (
            <CardContent className="pt-0 pb-3 space-y-1">
              {linkedActions.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate flex-1 min-w-0">{a.task}</span>
                  <StatusPicker action={a} size="sm" />
                </div>
              ))}
              {linkedActions.length > 10 && (
                <p className="text-xs text-muted-foreground pt-1">+ {linkedActions.length - 10} more</p>
              )}
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Waiting on others ({linkedWaiting.length})
            </CardTitle>
          </CardHeader>
          {linkedWaiting.length > 0 && (
            <CardContent className="pt-0 pb-3 space-y-1">
              {linkedWaiting.slice(0, 10).map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{w.description}</span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider flex-shrink-0">
                    {w.status}
                  </Badge>
                </div>
              ))}
              {linkedWaiting.length > 10 && (
                <p className="text-xs text-muted-foreground pt-1">+ {linkedWaiting.length - 10} more</p>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      <NodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        node={editNode}
        defaultParentId={defaultParent}
      />
    </div>
  );
}
