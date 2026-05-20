import { useMemo, useState } from "react";
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
  Briefcase,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Layers,
  Package,
  Plus,
  Settings,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { allowedChildTypes } from "@/lib/schemas";
import type { NodeType, WbsNode } from "@/lib/types";
import { NodeDialog } from "@/components/NodeDialog";

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

interface NodeCardProps {
  node: WbsNode;
  childrenByParent: Map<string | null, WbsNode[]>;
  depth: number;
  onEdit: (node: WbsNode) => void;
  onAddChild: (parent: WbsNode) => void;
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
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAddChild(node)}>
                <Plus className="h-3 w-3 mr-1" />
                Add {TYPE_LABEL[childTypes[0]].toLowerCase()}
              </Button>
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editNode, setEditNode] = useState<WbsNode | null>(null);
  const [defaultParent, setDefaultParent] = useState<string | null>(null);
  const [defaultType, setDefaultType] = useState<NodeType | undefined>(undefined);

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
              onAddChild={(parent) => openCreate(parent)}
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
    </div>
  );
}
