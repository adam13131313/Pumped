import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  BookOpen, CheckSquare, Clock, FolderKanban, LayoutDashboard, Sparkles,
  FileText, Inbox, Search, Filter, Paperclip, Smartphone, Send, Bot, User, Lightbulb, Loader2, Trash2, Plug,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const sections = [
  { id: "dashboard", icon: LayoutDashboard, title: "Dashboard", content: `The Dashboard is your daily command centre. It shows today's focus items — the actions and waiting items you've flagged for immediate attention.\n\n**How to use it:**\n- Each morning, open the Dashboard and review your "Today" items.\n- Pick your top 3 priorities and work those first.\n- Items marked for today are pulled from My Actions and Waiting For.` },
  { id: "actions", icon: CheckSquare, title: "My Actions", content: `My Actions is your personal task list — everything you need to do, all in one place.\n\n**Key features:**\n- Add new actions with a title, project, work package, due date, and priority.\n- Update status: Not Started → In Progress → Complete.\n- Delegate an action to someone else — it moves automatically to Waiting For.\n- Filter by project or priority to focus on what matters.` },
  { id: "waiting", icon: Clock, title: "Waiting For", content: `Waiting For tracks everything you've asked others to deliver. Never chase from memory again.\n\n**Best practices:**\n- Every time you ask someone to do something, log it here immediately.\n- Include who you're waiting on, what for, and when it's due.\n- Review this list on Mondays and Wednesdays to send follow-ups.\n- If something comes back incomplete, use "Take Back" to move it to your own actions.` },
  { id: "projects", icon: FolderKanban, title: "Projects & Work Packages", content: `Projects organise your work into logical groups. Each project can contain multiple Work Packages (WPs) — smaller deliverables with their own leads, due dates, and RAG statuses.\n\n**RAG statuses:**\n- 🟢 **Green** — On track, no issues.\n- 🟡 **Amber** — Some risk or delay, being managed.\n- 🔴 **Red** — Off track, needs escalation.\n\nProjects can also be grouped under a Programme for portfolio-level visibility.\n\n**Export:** Use the "Export CSV" button on the Projects page to download the entire WBS hierarchy as a spreadsheet (Programme → Project → Work Package → Action).` },
  { id: "inbox", icon: Inbox, title: "Rapid Capture (Inbox)", content: `Rapid Capture is your quick-entry inbox for capturing tasks from any source — meeting notes, emails, voice memos, or raw text.\n\n**AI-powered extraction:**\n- Paste or type raw text into the capture box and click "Extract Tasks".\n- The AI analyses the text and suggests structured tasks with project assignments, priorities, and due dates.\n- Tasks are matched to your existing projects from the WBS — the AI will never invent project names.\n\n**Inbox management:**\n- Review extracted tasks in the inbox list.\n- Use the project dropdown to assign or reassign tasks to the correct project.\n- **Bulk edit** — select multiple items and batch-update priority or project.\n- **Promote to Actions** — move selected inbox items to My Actions in one click.\n- **Bulk delete** — remove multiple items at once.` },
  { id: "planner", icon: Sparkles, title: "WBS Planner", content: `The WBS (Work Breakdown Structure) Planner uses AI to generate a full project hierarchy from documents, images, or free text. Iteratively refine, edit inline, then Accept & Create to import everything.` },
  { id: "sop", icon: FileText, title: "SOP (Standard Operating Procedures)", content: `Editable operating rhythm — daily check-in, post-meeting capture, weekly review (Mon), follow-up sweep (Wed), RAG guidance, delegation rules.` },
  { id: "duplicates", icon: Search, title: "Duplicate Prevention & Global Search (⌘K)", content: `Inline amber hint while you type warns of similar tasks. Press ⌘K / Ctrl+K to search across actions, inbox, waiting, WPs, and projects.` },
  { id: "filter", icon: Filter, title: "Global Filter", content: `Header dropdowns filter Programme/Project/WP across the whole app. Persists across navigation.` },
  { id: "attachments", icon: Paperclip, title: "Task Attachments & Comments", content: `Auto-detect URLs, upload files up to 10MB (save task first), add threaded comments.` },
  { id: "mobile", icon: Smartphone, title: "Mobile", content: `Bottom nav, slide-out menu, mobile-friendly forms, voice transcription in Rapid Capture.` },
  { id: "integrations", icon: Plug, title: "Integrations (Webhook Sources, Zapier, Native)", content: `The Integrations page lets you push tasks into your Pumped inbox from any other app — your CRM, recruiter tool, project tracker, Zapier flow, or a custom script.\n\n**How it works:**\n- Each external app is a "Source" with its own name, slug, and bearer token.\n- That app POSTs a small JSON payload to your Pumped ingest endpoint with the token in the Authorization header.\n- The task lands in your Rapid Capture inbox tagged with the source name, ready to triage or promote to My Actions.\n- Re-sending the same source_id updates the existing item (idempotent) — safe for "sync on every edit" patterns.\n\n**Three ways to connect:**\n1. **Webhook Sources** — for any app you (or your AI builder) can add code to. Generate a token, paste it into your other app, done.\n2. **Zapier & Make** — for no-code flows. Use a "Webhooks → POST" step with the same endpoint and token. Unlocks 5,000+ trigger apps (Gmail, Slack, Outlook, Notion, Trello, Sheets, etc.) without any coding.\n3. **Native connectors (coming soon)** — one-click sign-in for Gmail, Slack, Linear, Asana, Notion, Outlook. No tokens to manage.\n\n**Token security:**\n- Tokens are shown **once on creation** and stored only as a SHA-256 hash. Save them immediately or regenerate.\n- "Regenerate" creates a fresh token and instantly invalidates the old one — use this if a token leaks or you lose it.\n- "Send test task to my inbox" verifies the full loop end-to-end right after creating or regenerating a token.\n\n**Example use cases:**\n- A recruiter app pushes "Follow up with candidate X" into your inbox the moment you log a call.\n- A Zap watches your starred Gmail messages and creates a Pumped task for each.\n- Your project-management side app sends every new deliverable into Pumped so all your work lives in one inbox.\n- A weekly cron script pushes "Run weekly review" every Monday morning.\n\n**Benefits:**\n- One inbox for every system you use — no more checking five apps for what to do today.\n- Never lose a task buried in another tool.\n- Keep deep context: source_url deep-links straight back to the originating record.\n- Centralised triage in Rapid Capture, then promote to My Actions or assign to a Project/WP.` },
];

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at: string };

export default function KnowledgebasePage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDesc, setSuggestDesc] = useState("");
  const [submittingSuggest, setSubmittingSuggest] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("kb_chat_messages")
        .select("id, role, content, created_at")
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Msg[]);
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    const optimistic: Msg = { id: `tmp-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      const { data, error } = await supabase.functions.invoke("kb-chat", { body: { message: text } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((m) => [...m, { id: `tmp-a-${Date.now()}`, role: "assistant", content: data.reply, created_at: new Date().toISOString() }]);
    } catch (e) {
      toast({ title: "Chat failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    const { error } = await supabase.from("kb_chat_messages").delete().not("id", "is", null);
    if (error) {
      toast({ title: "Could not clear chat", description: error.message, variant: "destructive" });
      return;
    }
    setMessages([]);
  };

  const openSuggest = () => {
    // Prefill from last user message
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    setSuggestTitle(lastUser ? lastUser.content.slice(0, 80) : "");
    setSuggestDesc(lastUser ? `Context from chat:\n\n${lastUser.content}` : "");
    setSuggestOpen(true);
  };

  const submitSuggestion = async () => {
    if (suggestTitle.trim().length < 3) {
      toast({ title: "Title too short", variant: "destructive" });
      return;
    }
    setSubmittingSuggest(true);
    try {
      const { data, error } = await supabase.functions.invoke("kb-suggest-feature", {
        body: { title: suggestTitle.trim(), description: suggestDesc.trim() || suggestTitle.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Suggestion sent!",
        description: data?.github_issue_url ? "Created a GitHub issue for the team." : "Saved — the team will review it.",
      });
      setSuggestOpen(false);
      setSuggestTitle("");
      setSuggestDesc("");
    } catch (e) {
      toast({ title: "Could not send", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSubmittingSuggest(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Knowledgebase</h2>
        <p className="text-muted-foreground mt-1">
          Ask the assistant anything, or browse the feature reference below.
        </p>
      </div>

      {/* AI Assistant */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Pumped Assistant
          </CardTitle>
          <div className="flex gap-2">
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat}>
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={openSuggest}>
              <Lightbulb className="h-4 w-4 mr-1" /> Suggest a feature
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            ref={scrollRef}
            className="h-[360px] overflow-y-auto rounded-md border bg-muted/30 p-4 space-y-3"
          >
            {messages.length === 0 && !sending && (
              <div className="text-sm text-muted-foreground text-center pt-12">
                Ask me anything about Pumped — what a feature does, how to use it, or whether the app supports something.
                <br />
                If it doesn't, you can suggest it to the team.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border"
                  }`}
                >
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex gap-2 justify-start">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-lg px-3 py-2 text-sm bg-background border">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Ask about a feature, or 'can Pumped do X?'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={sending}
            />
            <Button onClick={send} disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Getting started */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>
            Pumped helps you manage projects, actions, and delegated tasks in one place. The workflow is simple:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Set up your <strong>Projects</strong> and <strong>Work Packages</strong>.</li>
            <li>Add tasks to <strong>My Actions</strong> — things <em>you</em> need to do.</li>
            <li>Track delegated items in <strong>Waiting For</strong> — things <em>others</em> owe you.</li>
            <li>Use the <strong>Dashboard</strong> each morning to pick your daily focus.</li>
            <li>Follow the <strong>SOP</strong> rhythm to stay consistent.</li>
          </ol>
        </CardContent>
      </Card>

      <Accordion type="multiple" className="space-y-2">
        {sections.map(({ id, icon: Icon, title, content }) => (
          <AccordionItem key={id} value={id} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line pl-7">
                {content}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Suggest feature dialog */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Suggest a feature to the Pumped Team
            </DialogTitle>
            <DialogDescription>
              We'll create an issue on GitHub so the team can review and discuss it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={suggestTitle}
                onChange={(e) => setSuggestTitle(e.target.value)}
                placeholder="Short summary of the feature"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={suggestDesc}
                onChange={(e) => setSuggestDesc(e.target.value)}
                placeholder="What problem does it solve? How might it work?"
                rows={6}
                maxLength={5000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuggestOpen(false)}>Cancel</Button>
            <Button onClick={submitSuggestion} disabled={submittingSuggest}>
              {submittingSuggest && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Send to team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
