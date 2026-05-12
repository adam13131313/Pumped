import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, Plus, Trash2, Plug } from "lucide-react";

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

export default function IngestSourcesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; name: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ingest_sources")
      .select("id, name, slug, token_prefix, last_received_at, created_at")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load sources", description: error.message, variant: "destructive" });
    else setSources(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const slug = slugify(name);
    if (!slug) {
      toast({ title: "Invalid name", description: "Use letters/numbers", variant: "destructive" });
      return;
    }
    setCreating(true);
    const token = generateToken();
    const tokenHash = await sha256Hex(token);
    const tokenPrefix = token.slice(0, 12);
    const { error } = await supabase.from("ingest_sources").insert({
      user_id: user.id,
      name: name.trim(),
      slug,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Failed to create source", description: error.message, variant: "destructive" });
      return;
    }
    setNewToken({ token, name: name.trim() });
    setName("");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this source? Existing inbox items remain, but the token will stop working.")) return;
    const { error } = await supabase.from("ingest_sources").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="h-4 w-4" /> Connected Sources
        </CardTitle>
        <CardDescription>
          Generate per-app tokens so your other apps can push tasks into your Pumped inbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add</>}
          </Button>
        </form>

        {newToken && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
            <p className="text-sm font-medium">Token for "{newToken.name}" — shown once, copy now:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono break-all bg-background p-2 rounded">{newToken.token}</code>
              <Button size="sm" variant="outline" onClick={() => copy(newToken.token)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setNewToken(null)}>I've copied it</Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sources yet. Add one above.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    slug: {s.slug} · token: {s.token_prefix}…
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.last_received_at
                      ? `Last received ${new Date(s.last_received_at).toLocaleString()}`
                      : "No tasks received yet"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Ingest endpoint</p>
            <Button size="sm" variant="ghost" onClick={() => copy(FUNCTION_URL)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <code className="block text-xs font-mono break-all bg-background p-2 rounded">{FUNCTION_URL}</code>
          <p className="text-xs text-muted-foreground">
            From your other app, send a POST with header <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> and JSON body:
          </p>
          <pre className="text-xs font-mono bg-background p-2 rounded overflow-x-auto">{`{
  "source_id": "task-123",        // your app's stable ID for this task
  "task": "Follow up with Alice", // required
  "priority": "High",             // High | Medium | Low (optional)
  "due_date": "2026-05-20",       // optional
  "project": "Sales",             // optional, free text
  "notes": "context",             // optional
  "source_url": "https://..."     // optional deep link
}`}</pre>
          <p className="text-xs text-muted-foreground">
            Re-sending the same <code className="font-mono">source_id</code> updates the existing inbox item (idempotent).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
