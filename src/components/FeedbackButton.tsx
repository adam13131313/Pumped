import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type FeedbackType = "bug" | "feature" | "other";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feature");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setType("feature");
      setTitle("");
      setDesc("");
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      toast({ title: "Add a short title", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const prefix =
        type === "bug" ? "[Bug] " : type === "other" ? "[Feedback] " : "";
      const { data, error } = await supabase.functions.invoke(
        "kb-suggest-feature",
        {
          body: {
            title: `${prefix}${title.trim()}`,
            description: desc.trim() || title.trim(),
          },
        }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Sent!",
        description: data?.github_issue_url
          ? "Created a GitHub issue for the team."
          : "Saved — the team will review it.",
      });
      setOpen(false);
    } catch (e) {
      toast({
        title: "Could not send",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Send feedback"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Send feedback</TooltipContent>
      </Tooltip>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Report a bug, suggest a feature, or share a thought. Submissions
            create a GitHub issue for the team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fb-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
              <SelectTrigger id="fb-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feature">Feature request</SelectItem>
                <SelectItem value="bug">Bug report</SelectItem>
                <SelectItem value="other">Other feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-title">Title</Label>
            <Input
              id="fb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-desc">Details (optional)</Label>
            <Textarea
              id="fb-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Steps to reproduce, expected behaviour, or context…"
              rows={5}
              maxLength={5000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !title.trim()}>
            {submitting ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
