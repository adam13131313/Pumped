import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Upload, FileIcon, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
}

interface TaskAttachmentsProps {
  actionId: string | undefined; // undefined for new tasks
  isNewTask?: boolean;
}

export function TaskAttachments({ actionId, isNewTask }: TaskAttachmentsProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing attachments
  useEffect(() => {
    if (!actionId || isNewTask) return;
    supabase
      .from("task_attachments")
      .select("id, file_name, file_path, file_type, file_size")
      .eq("action_id", actionId)
      .then(({ data }) => {
        if (data) setAttachments(data);
      });
  }, [actionId, isNewTask]);

  const uploadFile = useCallback(async (file: File) => {
    if (!user || !actionId) {
      toast.error("Save the task first before adding attachments");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10 MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${actionId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("task-attachments")
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase.from("task_attachments").insert({
        action_id: actionId,
        user_id: user.id,
        file_name: file.name,
        file_path: path,
        file_type: file.type,
        file_size: file.size,
      });
      if (dbErr) throw dbErr;

      // Refresh list
      const { data } = await supabase
        .from("task_attachments")
        .select("id, file_name, file_path, file_type, file_size")
        .eq("action_id", actionId);
      if (data) setAttachments(data);
      toast.success("File attached");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [user, actionId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }, [uploadFile]);

  const handleDelete = async (att: Attachment) => {
    await supabase.storage.from("task-attachments").remove([att.file_path]);
    await supabase.from("task_attachments").delete().eq("id", att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    toast.success("Attachment removed");
  };

  const getPublicUrl = (path: string) =>
    supabase.storage.from("task-attachments").getPublicUrl(path).data.publicUrl;

  const isImage = (type: string) => type.startsWith("image/");

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
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
          {!actionId ? "Save task first to attach files" : uploading ? "Uploading…" : "Drop files here or click to browse"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          disabled={!actionId || uploading}
          onChange={(e) => {
            Array.from(e.target.files || []).forEach(uploadFile);
            e.target.value = "";
          }}
        />
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div key={att.id} className="group relative flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
              {isImage(att.file_type) ? (
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <a
                href={getPublicUrl(att.file_path)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:underline max-w-[120px] truncate"
              >
                {att.file_name}
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(att); }}
                className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
