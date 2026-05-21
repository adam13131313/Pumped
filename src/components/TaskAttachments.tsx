import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Upload, FileIcon, Image as ImageIcon, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";

// v2 attachments. Polymorphic via three nullable FK columns: pass exactly one
// of actionId / waitingItemId / wbsNodeId. Storage path is keyed on the
// organisation_id as the first segment so the storage.objects RLS policies
// (defined in 20260520010000_pumped_v2_supplements.sql) can isolate access.

interface AttachmentRow {
  id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
}

interface TaskAttachmentsProps {
  actionId?: string;
  waitingItemId?: string;
  wbsNodeId?: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function TaskAttachments({ actionId, waitingItemId, wbsNodeId }: TaskAttachmentsProps) {
  const { user } = useAuth();
  const currentOrg = useAppStore((s) => s.currentOrg);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parentCol = actionId ? "action_id" : waitingItemId ? "waiting_item_id" : wbsNodeId ? "wbs_node_id" : null;
  const parentId = actionId ?? waitingItemId ?? wbsNodeId ?? null;
  const ready = !!parentCol && !!parentId && !!currentOrg;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("id, storage_path, original_filename, mime_type, size_bytes")
        .eq(parentCol!, parentId!);
      if (cancelled) return;
      if (error) {
        console.error("Failed to load attachments", error);
        return;
      }
      setAttachments(data ?? []);
    };
    load();
    return () => { cancelled = true; };
  }, [parentCol, parentId, ready]);

  const uploadFile = useCallback(async (file: File) => {
    if (!user || !currentOrg || !parentCol || !parentId) {
      toast.error("Save the item first before adding attachments");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File too large (max 10 MB)");
      return;
    }
    setUploading(true);
    try {
      // First path segment must be organisation_id to satisfy storage RLS.
      const ext = file.name.split(".").pop() || "bin";
      const path = `${currentOrg.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("attachments").upload(path, file);
      if (uploadErr) throw uploadErr;

      const insertRow = {
        organisation_id: currentOrg.id,
        action_id: actionId ?? null,
        waiting_item_id: waitingItemId ?? null,
        wbs_node_id: wbsNodeId ?? null,
        storage_path: path,
        original_filename: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        uploader_id: user.id,
      };
      const { error: dbErr } = await supabase.from("attachments").insert(insertRow);
      if (dbErr) throw dbErr;

      const { data } = await supabase
        .from("attachments")
        .select("id, storage_path, original_filename, mime_type, size_bytes")
        .eq(parentCol, parentId);
      if (data) setAttachments(data);
      toast.success("File attached");
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setUploading(false);
    }
  }, [user, currentOrg, parentCol, parentId, actionId, waitingItemId, wbsNodeId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(uploadFile);
  }, [uploadFile]);

  const handleDelete = async (att: AttachmentRow) => {
    await supabase.storage.from("attachments").remove([att.storage_path]);
    await supabase.from("attachments").delete().eq("id", att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    toast.success("Attachment removed");
  };

  const openSignedUrl = async (att: AttachmentRow) => {
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(att.storage_path, 60);
    if (error || !data) {
      toast.error("Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const isImage = (type: string) => type.startsWith("image/");

  return (
    <div className="mt-6 space-y-3 border-t pt-6">
      <Label className="flex items-center gap-1.5 text-sm font-semibold">
        <Paperclip className="h-4 w-4" />
        Attachments
      </Label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => ready && fileInputRef.current?.click()}
        className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 text-xs cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">
          {!ready ? "Save first to attach files" : uploading ? "Uploading…" : "Drop files here or click to browse"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          disabled={!ready || uploading}
          onChange={(e) => {
            Array.from(e.target.files || []).forEach(uploadFile);
            e.target.value = "";
          }}
        />
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
            >
              {isImage(att.mime_type) ? (
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); void openSignedUrl(att); }}
                className="hover:underline max-w-[160px] truncate text-left"
              >
                {att.original_filename}
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); void handleDelete(att); }}
                className="h-5 w-5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
