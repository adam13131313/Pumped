import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Copy, Loader2, Plus, Trash2, Plug, AlertTriangle, RefreshCw, Send, ChevronDown, ChevronRight, Zap, Sparkles,
} from "lucide-react";

type Source = {
  id: string;
  name: string;
  slug: string;
  token_prefix: string;
  last_received_at: string | null;
  created_at: string;
};

const FUNCTION_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/ingest-task`;

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pmp_${hex}`;
}

function curlSnippet(token: string) {
  return `curl -X POST '${FUNCTION_URL}' \\
  -H 'Authorization: Bearer ${token}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "source_id": "task-123",
    "task": "Follow up with Alice",
    "priority": "High",
    "due_date": "2026-05-20",
    "project": "Sales",
    "notes": "context",
    "source_url": "https://example.com/task/123"
  }'`;
}

function jsSnippet(token: string) {
  return `await fetch("${FUNCTION_URL}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    source_id: "task-123",
    task: "Follow up with Alice",
    priority: "High",          // High | Medium | Low
    due_date: "2026-05-20",    // optional
    project: "Sales",          // optional
    notes: "context",          // optional
    source_url: "https://...", // optional deep link
  }),
});`;
}

export default function IntegrationsPage() {
  const { user } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; name: string; sourceId: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ingest_sources")
      .select("id, name, slug, token_prefix, last_received_at, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load sources", { description: error.message });
    else setSources(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const slug = slugify(name);
    if (!slug) {
      toast.error("Invalid name", { description: "Use letters/numbers" });
      return;
    }
    setCreating(true);
    const token = generateToken();
    const tokenHash = await sha256Hex(token);
    const tokenPrefix = token.slice(0, 12);
    const { data, error } = await supabase
      .from("ingest_sources")
      .insert({
        user_id: user.id,
        name: name.trim(),
        slug,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Failed to create source", { description: error?.message });
      return;
    }
    setNewToken({ token, name: name.trim(), sourceId: data.id });
    setName("");
    setExpandedId(data.id);
    load();
  };

  const handleRegenerate = async (source: Source) => {
    if (!confirm(`Regenerate token for "${source.name}"? The old token will stop working immediately.`)) return;
    const token = generateToken();
    const tokenHash = await sha256Hex(token);
    const tokenPrefix = token.slice(0, 12);
    const { error } = await supabase
      .from("ingest_sources")
      .update({ token_hash: tokenHash, token_prefix: tokenPrefix })
      .eq("id", source.id);
    if (error) {
      toast.error("Regenerate failed", { description: error.message });
      return;
    }
    setNewToken({ token, name: source.name, sourceId: source.id });
    setExpandedId(source.id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this source? Existing inbox items remain, but the token will stop working.")) return;
    const { error } = await supabase.from("ingest_sources").delete().eq("id", id);
    if (error) toast.error("Delete failed", { description: error.message });
    else load();
  };

  const handleTestSend = async () => {
    if (!newToken) return;
    setTesting(true);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${newToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_id: `test-${Date.now()}`,
          task: `Test from ${newToken.name}`,
          priority: "Medium",
          notes: "Sent from Pumped Integrations test tool",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Test sent ✓", { description: "Check your Rapid Capture inbox." });
      } else {
        toast.error(`Test failed (${res.status})`, { description: body?.error ?? "Unknown error" });
      }
    } catch (e) {
      toast.error("Test failed", { description: e instanceof Error ? e.message : "Network error" });
    }
    setTesting(false);
  };

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect other apps to push tasks into your Pumped inbox.
        </p>
      </div>

      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sources">
            <Plug className="h-4 w-4 mr-1.5" /> Webhook Sources
          </TabsTrigger>
          <TabsTrigger value="zapier">
            <Zap className="h-4 w-4 mr-1.5" /> Zapier & Make
          </TabsTrigger>
          <TabsTrigger value="native">
            <Sparkles className="h-4 w-4 mr-1.5" /> Native (coming soon)
          </TabsTrigger>
        </TabsList>

        {/* SOURCES TAB */}
        <TabsContent value="sources" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add a new source</CardTitle>
              <CardDescription>
                One source per external app (e.g. "Job Navigator", "Lillipilli", "Google Sheets via Zapier").
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="sourceName">Source name</Label>
                  <Input
                    id="sourceName"
                    placeholder="e.g. My CRM, Reading Tracker"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                  />
                </div>
                <Button type="submit" size="sm" disabled={creating || !name.trim()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add source</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* One-time token reveal */}
          {newToken && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  Token for "{newToken.name}" — save it now
                </CardTitle>
                <CardDescription>
                  This token will <strong>not be shown again</strong>. Copy it and store it as a secret in your other app. If you lose it, regenerate to create a new one.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono break-all bg-background p-2 rounded border border-border">{newToken.token}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(newToken.token, "Token copied")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleTestSend} disabled={testing}>
                    {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
                    Send test task to my inbox
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setNewToken(null)}>
                    I've copied it
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sources list */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your sources</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : sources.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No sources yet. Add one above.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {sources.map((s) => {
                    const expanded = expandedId === s.id;
                    return (
                      <li key={s.id} className="p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            onClick={() => setExpandedId(expanded ? null : s.id)}
                            className="flex items-center gap-2 min-w-0 text-left flex-1 hover:text-primary transition-colors"
                          >
                            {expanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{s.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {s.slug} · {s.token_prefix}…
                                {" · "}
                                {s.last_received_at
                                  ? `Last: ${new Date(s.last_received_at).toLocaleString()}`
                                  : "No tasks yet"}
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleRegenerate(s)} title="Regenerate token">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} title="Delete source">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {expanded && (
                          <div className="pl-6 space-y-3">
                            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Endpoint</p>
                                <Button size="sm" variant="ghost" onClick={() => copy(FUNCTION_URL)}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <code className="block text-xs font-mono break-all bg-background p-2 rounded">{FUNCTION_URL}</code>
                            </div>

                            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">curl example</p>
                                <Button size="sm" variant="ghost" onClick={() => copy(curlSnippet("YOUR_TOKEN"))}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <pre className="text-xs font-mono bg-background p-2 rounded overflow-x-auto whitespace-pre">{curlSnippet("YOUR_TOKEN")}</pre>
                            </div>

                            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">JavaScript example</p>
                                <Button size="sm" variant="ghost" onClick={() => copy(jsSnippet("YOUR_TOKEN"))}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <pre className="text-xs font-mono bg-background p-2 rounded overflow-x-auto whitespace-pre">{jsSnippet("YOUR_TOKEN")}</pre>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              Replace <code className="font-mono">YOUR_TOKEN</code> with the token shown when you created or last regenerated this source. Re-sending the same <code className="font-mono">source_id</code> updates the existing inbox item (idempotent).
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ZAPIER TAB */}
        <TabsContent value="zapier" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" /> Connect via Zapier or Make
              </CardTitle>
              <CardDescription>
                Use any of 5,000+ apps as a trigger for new Pumped tasks — Gmail, Slack, Outlook, Notion, Trello, Sheets, and more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-2 text-sm list-decimal list-inside text-muted-foreground">
                <li>Create a source in the <strong>Webhook Sources</strong> tab and copy its token.</li>
                <li>In Zapier, add a <strong>Webhooks by Zapier → POST</strong> action (or in Make, an <strong>HTTP → Make a request</strong> module).</li>
                <li>URL: paste the endpoint below. Method: <code className="font-mono">POST</code>. Header: <code className="font-mono">Authorization: Bearer &lt;your token&gt;</code>.</li>
                <li>Body: JSON with at least <code className="font-mono">source_id</code> and <code className="font-mono">task</code>. Map other fields from your trigger.</li>
              </ol>

              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Endpoint</p>
                  <Button size="sm" variant="ghost" onClick={() => copy(FUNCTION_URL)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <code className="block text-xs font-mono break-all bg-background p-2 rounded">{FUNCTION_URL}</code>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sample JSON body</p>
                  <Button size="sm" variant="ghost" onClick={() => copy(`{
  "source_id": "{{trigger_id}}",
  "task": "{{trigger_title}}",
  "priority": "Medium",
  "due_date": "{{trigger_due}}",
  "project": "{{trigger_project}}",
  "notes": "{{trigger_body}}",
  "source_url": "{{trigger_url}}"
}`)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <pre className="text-xs font-mono bg-background p-2 rounded overflow-x-auto whitespace-pre">{`{
  "source_id": "{{trigger_id}}",
  "task": "{{trigger_title}}",
  "priority": "Medium",
  "due_date": "{{trigger_due}}",
  "project": "{{trigger_project}}",
  "notes": "{{trigger_body}}",
  "source_url": "{{trigger_url}}"
}`}</pre>
              </div>

              <p className="text-xs text-muted-foreground">
                A first-class Pumped Zapier app is on the roadmap — for now the generic Webhooks step works perfectly.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NATIVE TAB */}
        <TabsContent value="native" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Native one-click connectors
              </CardTitle>
              <CardDescription>
                Coming soon — sign in once, no webhooks or tokens required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {["Gmail", "Slack", "Linear", "Asana", "Notion", "Outlook"].map((n) => (
                  <div key={n} className="rounded-md border border-border bg-muted/20 p-3 text-sm flex items-center justify-between">
                    <span className="font-medium">{n}</span>
                    <span className="text-xs text-muted-foreground">Soon</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Want one of these prioritised? Suggest it from the Knowledgebase page.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
