import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LinkRenderer } from "@/components/LinkRenderer";
import { MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// v2 comments. Polymorphic via three nullable FK columns: pass exactly one of
// actionId / waitingItemId / wbsNodeId. The `comments` table enforces the
// exactly-one CHECK constraint and ON DELETE CASCADE per branch.

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  edited: boolean;
  author_id: string | null;
}

interface TaskCommentsProps {
  actionId?: string;
  waitingItemId?: string;
  wbsNodeId?: string;
}

const MAX_LEN = 5000;

export function TaskComments({ actionId, waitingItemId, wbsNodeId }: TaskCommentsProps) {
  const { user } = useAuth();
  const currentOrg = useAppStore((s) => s.currentOrg);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const parentCol = actionId ? "action_id" : waitingItemId ? "waiting_item_id" : wbsNodeId ? "wbs_node_id" : null;
  const parentId = actionId ?? waitingItemId ?? wbsNodeId ?? null;
  const ready = !!parentCol && !!parentId && !!currentOrg;

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("comments")
      .select("id, content, created_at, edited, author_id")
      .eq(parentCol!, parentId!)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load comments", error);
          setComments([]);
        } else {
          setComments(data ?? []);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [parentCol, parentId, ready, user]);

  const handleAdd = useCallback(async () => {
    const trimmed = newComment.trim();
    if (!trimmed || !ready || !user || !currentOrg) return;
    if (trimmed.length > MAX_LEN) {
      toast.error(`Comment too long (max ${MAX_LEN} chars)`);
      return;
    }
    setSubmitting(true);
    const insertRow = {
      organisation_id: currentOrg.id,
      action_id: actionId ?? null,
      waiting_item_id: waitingItemId ?? null,
      wbs_node_id: wbsNodeId ?? null,
      parent_comment_id: null,
      author_id: user.id,
      content: trimmed,
    };
    const { data, error } = await supabase
      .from("comments")
      .insert(insertRow)
      .select("id, content, created_at, edited, author_id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("Could not post comment", { description: error?.message });
      return;
    }
    setComments((prev) => [...prev, data]);
    setNewComment("");
  }, [newComment, ready, user, currentOrg, actionId, waitingItemId, wbsNodeId]);

  if (!ready) {
    return (
      <p className="text-xs text-muted-foreground italic">Save this item first to add comments.</p>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" />
        Comments
      </Label>

      {comments.length > 0 && (
        <ScrollArea className="max-h-40 rounded-md border border-border bg-muted/30 p-2">
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(c.created_at), "dd MMM yyyy, HH:mm")}
                  {c.edited && <span className="ml-1 italic">(edited)</span>}
                </span>
                <div className="mt-0.5">
                  <LinkRenderer text={c.content} />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {!loading && comments.length === 0 && (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      )}

      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment or paste a link…"
          rows={1}
          maxLength={MAX_LEN}
          className="min-h-[36px] text-sm flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleAdd();
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleAdd()}
          disabled={!newComment.trim() || submitting}
          className="shrink-0 self-end"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
