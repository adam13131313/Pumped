import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LinkRenderer } from "@/components/LinkRenderer";
import { MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Comment {
  id: string;
  content: string;
  created_at: string;
}

interface TaskCommentsProps {
  itemId?: string;
  itemType: "action" | "waiting_item" | "work_package";
}

export function TaskComments({ itemId, itemType }: TaskCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId || !user) return;
    setLoading(true);
    supabase
      .from("task_comments")
      .select("id, content, created_at")
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setComments(data ?? []);
        setLoading(false);
      });
  }, [itemId, user, itemType]);

  const handleAdd = async () => {
    if (!newComment.trim() || !itemId || !user) return;
    const { data, error } = await supabase
      .from("task_comments")
      .insert({ user_id: user.id, item_id: itemId, item_type: itemType, content: newComment.trim() })
      .select("id, content, created_at")
      .single();
    if (!error && data) {
      setComments((prev) => [...prev, data]);
      setNewComment("");
    }
  };

  if (!itemId) {
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
          className="min-h-[36px] text-sm flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newComment.trim()} className="shrink-0 self-end">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
