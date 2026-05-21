import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ExternalLink, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { shortUrl } from "@/lib/urlDisplay";

// Task-linked documents. Polymorphic via three nullable FK columns — pass
// exactly one of actionId / waitingItemId / wbsNodeId. Renders each link
// as a card (label, full URL underneath, edit + remove buttons) so it
// reads cleanly alongside attachments and comments.

interface LinkRow {
  id: string;
  url: string;
  label: string;
  created_at: string;
}

interface TaskLinksProps {
  actionId?: string;
  waitingItemId?: string;
  wbsNodeId?: string;
}

const MAX_URL = 2000;
const MAX_LABEL = 200;

function normaliseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function TaskLinks({ actionId, waitingItemId, wbsNodeId }: TaskLinksProps) {
  const { user } = useAuth();
  const currentOrg = useAppStore((s) => s.currentOrg);

  const parentCol = actionId ? "action_id" : waitingItemId ? "waiting_item_id" : wbsNodeId ? "wbs_node_id" : null;
  const parentId = actionId ?? waitingItemId ?? wbsNodeId ?? null;
  const ready = !!parentCol && !!parentId && !!currentOrg;

  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editLabel, setEditLabel] = useState("");

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("task_links")
      .select("id, url, label, created_at")
      .eq(parentCol!, parentId!)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load task_links", error);
      setLinks([]);
    } else {
      setLinks((data ?? []) as LinkRow[]);
    }
    setLoading(false);
  }, [parentCol, parentId, ready]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    if (!ready || !user || !currentOrg) return;
    const url = normaliseUrl(newUrl);
    const label = newLabel.trim();
    if (!label) {
      toast.error("Give the link a name so you can find it later");
      return;
    }
    if (!url || !isValidUrl(url)) {
      toast.error("Enter a valid http(s) URL");
      return;
    }
    if (url.length > MAX_URL) {
      toast.error(`URL too long (max ${MAX_URL} chars)`);
      return;
    }
    if (label.length > MAX_LABEL) {
      toast.error(`Label too long (max ${MAX_LABEL} chars)`);
      return;
    }
    setSubmitting(true);
    const insertRow = {
      organisation_id: currentOrg.id,
      action_id: actionId ?? null,
      waiting_item_id: waitingItemId ?? null,
      wbs_node_id: wbsNodeId ?? null,
      url,
      label,
      position: links.length,
      created_by: user.id,
    };
    const { data, error } = await supabase
      .from("task_links")
      .insert(insertRow)
      .select("id, url, label, created_at")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("Could not save link", { description: error?.message });
      return;
    }
    setLinks((prev) => [...prev, data as LinkRow]);
    setNewUrl("");
    setNewLabel("");
    setShowAdd(false);
  };

  const startEdit = (link: LinkRow) => {
    setEditingId(link.id);
    setEditUrl(link.url);
    setEditLabel(link.label);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditUrl("");
    setEditLabel("");
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    const url = normaliseUrl(editUrl);
    const label = editLabel.trim();
    if (!label) {
      toast.error("Give the link a name so you can find it later");
      return;
    }
    if (!url || !isValidUrl(url)) {
      toast.error("Enter a valid http(s) URL");
      return;
    }
    if (url.length > MAX_URL || label.length > MAX_LABEL) {
      toast.error("Too long");
      return;
    }
    const prev = links;
    setLinks((p) => p.map((l) => (l.id === editingId ? { ...l, url, label } : l)));
    cancelEdit();
    const { error } = await supabase
      .from("task_links")
      .update({ url, label })
      .eq("id", editingId);
    if (error) {
      setLinks(prev);
      toast.error("Could not save link", { description: error.message });
    }
  };

  const handleDelete = async (link: LinkRow) => {
    const prev = links;
    setLinks((p) => p.filter((l) => l.id !== link.id));
    const { error } = await supabase.from("task_links").delete().eq("id", link.id);
    if (error) {
      setLinks(prev);
      toast.error("Could not remove link", { description: error.message });
      return;
    }
    toast.success("Link removed");
  };

  if (!ready) {
    return (
      <p className="text-xs text-muted-foreground italic">Save this item first to add documents.</p>
    );
  }

  return (
    <div className="mt-6 space-y-3 border-t pt-6">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-sm font-semibold">
          <Link2 className="h-4 w-4" />
          Documents
        </Label>
        {!showAdd && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add link
          </Button>
        )}
      </div>

      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((link) => {
            const isEditing = editingId === link.id;
            if (isEditing) {
              return (
                <li key={link.id} className="rounded-lg border border-primary/40 bg-card p-3 space-y-2">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="Name *"
                    maxLength={MAX_LABEL}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="https://…"
                    maxLength={MAX_URL}
                    className="h-8 text-sm font-mono"
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7"
                      onClick={() => void handleEditSave()}
                      disabled={!editLabel.trim() || !editUrl.trim()}
                    >
                      <Check className="mr-1 h-3 w-3" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={cancelEdit}>
                      <X className="mr-1 h-3 w-3" /> Cancel
                    </Button>
                  </div>
                </li>
              );
            }
            // Label is required on add/edit from now on, but legacy rows
            // created before that constraint may have an empty label —
            // fall back to a shortened URL so they're not unidentifiable.
            const heading = link.label || shortUrl(link.url, 60);
            return (
              <li key={link.id} className="group flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-accent/30 transition-colors">
                <Link2 className="h-4 w-4 text-primary mt-1 shrink-0" />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 block"
                  title={link.url}
                >
                  <div className="flex items-center gap-1.5 text-base font-semibold leading-snug hover:underline">
                    <span className="truncate">{heading}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                  <div className="mt-1 truncate text-xs font-mono text-muted-foreground/80">
                    {link.url}
                  </div>
                </a>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); startEdit(link); }}
                    aria-label="Edit link"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); void handleDelete(link); }}
                    aria-label="Remove link"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && links.length === 0 && !showAdd && (
        <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
          No documents linked yet. Add Google Drive, SharePoint, Dropbox or any other URL.
        </p>
      )}

      {showAdd && (
        <div className="rounded-lg border border-primary/40 bg-card p-3 space-y-2">
          <div className="space-y-1">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Name * (e.g. 'Design spec', 'Q3 budget sheet')"
              maxLength={MAX_LABEL}
              className="h-8 text-sm"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground px-0.5">
              A short, recognisable name. Required so you can spot it in lists.
            </p>
          </div>
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
            maxLength={MAX_URL}
            className="h-8 text-sm font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newLabel.trim() && newUrl.trim()) {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-7"
              onClick={() => void handleAdd()}
              disabled={!newLabel.trim() || !newUrl.trim() || submitting}
            >
              <Check className="mr-1 h-3 w-3" /> Add
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setShowAdd(false); setNewUrl(""); setNewLabel(""); }}>
              <X className="mr-1 h-3 w-3" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
