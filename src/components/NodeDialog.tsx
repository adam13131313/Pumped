import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { allowedChildTypes, firstZodError, wbsNodeSchema } from "@/lib/schemas";
import type {
  NodeType,
  ProjectStatus,
  RagStatus,
  WbsNode,
} from "@/lib/types";
import { NodePicker } from "@/components/NodePicker";

// Generic create / edit dialog for a wbs_node. The form surfaces type-specific
// fields based on the chosen node_type (project_status for projects;
// lead/dates/RAG/blockers for work_packages).

interface NodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Node being edited. Null = create flow. */
  node?: WbsNode | null;
  /** When creating, pre-set the parent. */
  defaultParentId?: string | null;
  /** When creating, pre-set the type. Otherwise the user picks from allowed types. */
  defaultNodeType?: NodeType;
}

interface FormState {
  name: string;
  description: string;
  nodeType: NodeType;
  parentId: string | null;
  projectStatus: ProjectStatus | null;
  leadUserId: string | null;
  startDate: string;
  dueDate: string;
  ragStatus: RagStatus | null;
  blockers: string;
}

const NODE_TYPE_LABEL: Record<NodeType, string> = {
  portfolio: "Portfolio",
  programme: "Programme",
  project: "Project",
  work_package: "Work Package",
};

export function NodeDialog({
  open,
  onOpenChange,
  node,
  defaultParentId = null,
  defaultNodeType,
}: NodeDialogProps) {
  const isEdit = !!node;
  const wbsNodes = useAppStore((s) => s.wbsNodes);
  const currentOrg = useAppStore((s) => s.currentOrg);
  const currentMembership = useAppStore((s) => s.currentMembership);
  const addWbsNode = useAppStore((s) => s.addWbsNode);
  const updateWbsNode = useAppStore((s) => s.updateWbsNode);
  const deleteWbsNode = useAppStore((s) => s.deleteWbsNode);

  // Resolve the parent's type so we can limit allowed child types correctly.
  const parentTypeFor = (parentId: string | null): NodeType | null => {
    if (!parentId) return null;
    return wbsNodes.find((n) => n.id === parentId)?.nodeType ?? null;
  };

  const initialState = (): FormState => {
    if (node) {
      return {
        name: node.name,
        description: node.description,
        nodeType: node.nodeType,
        parentId: node.parentId,
        projectStatus: node.projectStatus,
        leadUserId: node.leadUserId,
        startDate: node.startDate ?? "",
        dueDate: node.dueDate ?? "",
        ragStatus: node.ragStatus,
        blockers: node.blockers ?? "",
      };
    }
    // Determine a valid default type for create flow
    const parentType = parentTypeFor(defaultParentId);
    const allowed = allowedChildTypes(parentType);
    const chosen = defaultNodeType && allowed.includes(defaultNodeType)
      ? defaultNodeType
      : allowed[0] ?? "portfolio";
    return {
      name: "",
      description: "",
      nodeType: chosen,
      parentId: defaultParentId,
      projectStatus: chosen === "project" ? "active" : null,
      leadUserId: null,
      startDate: "",
      dueDate: "",
      ragStatus: chosen === "work_package" ? "green" : null,
      blockers: "",
    };
  };

  const [form, setForm] = useState<FormState>(initialState);

  // Reset state on open / when target node changes
  useEffect(() => {
    if (open) setForm(initialState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node?.id]);

  const parentType = parentTypeFor(form.parentId);
  const allowedTypesForParent = useMemo(
    () => allowedChildTypes(parentType),
    [parentType],
  );

  // When the user changes the parent, snap node_type to something the trigger
  // will accept. Also auto-set / clear type-scoped defaults.
  const setParent = (parentId: string | null) => {
    const newParentType = parentTypeFor(parentId);
    const allowed = allowedChildTypes(newParentType);
    let nextType = form.nodeType;
    if (!allowed.includes(nextType)) nextType = allowed[0] ?? nextType;
    setForm((f) => ({
      ...f,
      parentId,
      nodeType: nextType,
      projectStatus: nextType === "project" ? f.projectStatus ?? "active" : null,
      ragStatus: nextType === "work_package" ? f.ragStatus ?? "green" : null,
    }));
  };

  const setNodeType = (nodeType: NodeType) => {
    setForm((f) => ({
      ...f,
      nodeType,
      projectStatus: nodeType === "project" ? f.projectStatus ?? "active" : null,
      ragStatus: nodeType === "work_package" ? f.ragStatus ?? "green" : null,
      // Clear WP-only fields when leaving work_package
      leadUserId: nodeType === "work_package" ? f.leadUserId : null,
      startDate: nodeType === "work_package" ? f.startDate : "",
      dueDate: nodeType === "work_package" ? f.dueDate : "",
      blockers: nodeType === "work_package" ? f.blockers : "",
    }));
  };

  const handleSave = () => {
    const parsed = wbsNodeSchema.safeParse({
      name: form.name,
      description: form.description,
      nodeType: form.nodeType,
      parentId: form.parentId,
      position: node?.position ?? 0,
      projectStatus: form.nodeType === "project" ? form.projectStatus ?? "active" : null,
      leadUserId: form.nodeType === "work_package" ? form.leadUserId : null,
      startDate: form.nodeType === "work_package" ? form.startDate : "",
      dueDate: form.nodeType === "work_package" ? form.dueDate : "",
      ragStatus: form.nodeType === "work_package" ? form.ragStatus ?? "green" : null,
      blockers: form.nodeType === "work_package" ? (form.blockers || null) : null,
    });
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return;
    }
    if (!currentOrg) {
      toast.error("No active organisation");
      return;
    }
    const d = parsed.data;
    const now = new Date().toISOString();

    if (isEdit && node) {
      updateWbsNode(node.id, {
        name: d.name,
        description: d.description ?? "",
        nodeType: d.nodeType,
        parentId: d.parentId ?? null,
        projectStatus: d.projectStatus ?? null,
        leadUserId: d.leadUserId ?? null,
        startDate: d.startDate || null,
        dueDate: d.dueDate || null,
        ragStatus: d.ragStatus ?? null,
        blockers: d.blockers ?? null,
      });
    } else {
      addWbsNode({
        id: crypto.randomUUID(),
        organisationId: currentOrg.id,
        parentId: d.parentId ?? null,
        nodeType: d.nodeType,
        name: d.name,
        description: d.description ?? "",
        position: 0,
        archivedAt: null,
        projectStatus: d.projectStatus ?? null,
        leadUserId: d.leadUserId ?? null,
        startDate: d.startDate || null,
        dueDate: d.dueDate || null,
        ragStatus: d.ragStatus ?? null,
        blockers: d.blockers ?? null,
        createdBy: currentMembership?.userId ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!node) return;
    if (!confirm(`Delete "${node.name}"? This cascades to all descendants and any actions, waiting items, and inbox rows linked to them.`)) {
      return;
    }
    deleteWbsNode(node.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${NODE_TYPE_LABEL[form.nodeType]}` : `New ${NODE_TYPE_LABEL[form.nodeType]}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type + parent */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="node-type">Type</Label>
              <Select
                value={form.nodeType}
                onValueChange={(v) => setNodeType(v as NodeType)}
                disabled={isEdit /* don't allow type changes on existing nodes */}
              >
                <SelectTrigger id="node-type" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(isEdit ? [form.nodeType] : allowedTypesForParent).map((t) => (
                    <SelectItem key={t} value={t}>{NODE_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="node-parent">Parent</Label>
              <NodePicker
                id="node-parent"
                value={form.parentId}
                onChange={setParent}
                includeNone
                noneLabel="(root)"
                placeholder="Select a parent"
                className="mt-1"
              />
            </div>
          </div>

          {/* Name + description */}
          <div>
            <Label htmlFor="node-name">Name *</Label>
            <Input
              id="node-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1"
              maxLength={200}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="node-description">Description</Label>
            <Textarea
              id="node-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1"
              rows={2}
              maxLength={5000}
            />
          </div>

          {/* Project-only */}
          {form.nodeType === "project" && (
            <div>
              <Label htmlFor="project-status">Status</Label>
              <Select
                value={form.projectStatus ?? "active"}
                onValueChange={(v) => setForm({ ...form, projectStatus: v as ProjectStatus })}
              >
                <SelectTrigger id="project-status" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Work-package-only */}
          {form.nodeType === "work_package" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="wp-start">Start date</Label>
                  <Input
                    id="wp-start"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="wp-due">Due date</Label>
                  <Input
                    id="wp-due"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="wp-rag">RAG status</Label>
                <Select
                  value={form.ragStatus ?? "green"}
                  onValueChange={(v) => setForm({ ...form, ragStatus: v as RagStatus })}
                >
                  <SelectTrigger id="wp-rag" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">🟢 Green</SelectItem>
                    <SelectItem value="amber">🟡 Amber</SelectItem>
                    <SelectItem value="red">🔴 Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="wp-blockers">Blockers</Label>
                <Textarea
                  id="wp-blockers"
                  value={form.blockers}
                  onChange={(e) => setForm({ ...form, blockers: e.target.value })}
                  className="mt-1"
                  rows={2}
                  maxLength={5000}
                  placeholder="What's holding this up?"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isEdit && node && (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="mr-auto text-destructive">
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name.trim()}>
            {isEdit ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
