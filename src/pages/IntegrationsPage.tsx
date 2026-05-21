import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore } from "@/lib/store";
import type { WebhookSource } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Copy, Loader2, Plus, Trash2, Plug, KeyRound, AlertTriangle, RefreshCw, Eye, EyeOff, Terminal,
} from "lucide-react";
import { format } from "date-fns";

// v2 Integrations console. Manages webhook_sources (named external
// integrations) and their integration_tokens (bearer credentials, stored
// as SHA-256 hash, displayed once at mint time). Top-of-page panel
// surfaces the endpoint URL and a "how to use" guide so users see what to
// do with the token they're about to mint.

interface TokenRow {
  id: string;
  source_id: string;
  token_prefix: string;
  revoked_at: string | null;
  created_at: string;
}

// Build the URL from VITE_SUPABASE_URL rather than the project ID so the
// pattern survives any future hostname change. The CLI exposes URL as the
// full base (e.g. https://zcybqreiksrgaisnkauj.supabase.co) and functions
// always live under /functions/v1/<name>.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ingest-task` : "";

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
    "priority": "medium",
    "due_date": "2026-06-01",
    "notes": "From the Tuesday call",
    "source_url": "https://example.com/task/123"
  }'`;
}

function CopyButton({
  value, label = "Copy", successMessage = "Copied", size = "sm", variant = "outline",
}: {
  value: string;
  label?: string;
  successMessage?: string;
  size?: "sm" | "icon";
  variant?: "outline" | "ghost";
}) {
  const onClick = () => {
    void navigator.clipboard.writeText(value);
    toast.success(successMessage);
  };
  if (size === "icon") {
    return (
      <Button size="sm" variant={variant} className="h-7 w-7 p-0 shrink-0" onClick={onClick} aria-label={label}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    );
  }
  return (
    <Button size="sm" variant={variant} onClick={onClick}>
      <Copy className="mr-1.5 h-3 w-3" /> {label}
    </Button>
  );
}

export default function IntegrationsPage() {
  const { user } = useAuth();
  const currentOrg = useAppStore((s) => s.currentOrg);
  const currentMembership = useAppStore((s) => s.currentMembership);
  const sources = useAppStore((s) => s.webhookSources);
  const addWebhookSource = useAppStore((s) => s.addWebhookSource);
  const deleteWebhookSource = useAppStore((s) => s.deleteWebhookSource);

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Cleartext token only lives in state long enough for the user to copy
  // it. We never persist or re-display it.
  const [newToken, setNewToken] = useState<string | null>(null);
  const [newTokenSourceName, setNewTokenSourceName] = useState<string>("");
  const [tokenVisible, setTokenVisible] = useState(false);

  const loadTokens = useCallback(async () => {
    if (!currentOrg) return;
    setLoadingTokens(true);
    const { data, error } = await supabase
      .from("integration_tokens")
      .select("id, source_id, token_prefix, revoked_at, created_at")
      .eq("organisation_id", currentOrg.id)
      .order("created_at", { ascending: false });
    if (!error) setTokens((data ?? []) as TokenRow[]);
    setLoadingTokens(false);
  }, [currentOrg]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  const tokensBySource = useMemo(() => {
    const m = new Map<string, TokenRow[]>();
    for (const t of tokens) {
      const list = m.get(t.source_id) ?? [];
      list.push(t);
      m.set(t.source_id, list);
    }
    return m;
  }, [tokens]);

  const handleCreateSource = async () => {
    if (!currentOrg || !user || !currentMembership) {
      toast.error("No active organisation");
      return;
    }
    const name = newName.trim();
    if (!name) return;
    const baseSlug = slugify(name) || `source-${Math.random().toString(36).slice(2, 7)}`;
    let slug = baseSlug;
    let suffix = 1;
    while (sources.some((s) => s.slug === slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }

    setCreating(true);
    try {
      const sourceId = crypto.randomUUID();
      const now = new Date().toISOString();
      const source: WebhookSource = {
        id: sourceId,
        organisationId: currentOrg.id,
        name,
        slug,
        description: newDescription.trim(),
        lastReceivedAt: null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      };
      addWebhookSource(source);

      const token = await mintTokenFor(sourceId);
      if (token) {
        setNewToken(token);
        setNewTokenSourceName(name);
        setTokenVisible(false);
      }
      setNewName("");
      setNewDescription("");
      setCreateOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const mintTokenFor = async (sourceId: string): Promise<string | null> => {
    if (!currentOrg || !user) return null;
    const token = generateToken();
    const tokenHash = await sha256Hex(token);
    const tokenPrefix = token.slice(0, 8);
    const { data, error } = await supabase
      .from("integration_tokens")
      .insert({
        organisation_id: currentOrg.id,
        source_id: sourceId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        created_by: user.id,
      })
      .select("id, source_id, token_prefix, revoked_at, created_at")
      .single();
    if (error || !data) {
      toast.error("Could not mint token", { description: error?.message });
      return null;
    }
    setTokens((prev) => [data as TokenRow, ...prev]);
    return token;
  };

  const handleMintNewToken = async (source: WebhookSource) => {
    const token = await mintTokenFor(source.id);
    if (token) {
      setNewToken(token);
      setNewTokenSourceName(source.name);
      setTokenVisible(false);
    }
  };

  const handleRevokeToken = async (token: TokenRow) => {
    if (!user) return;
    const now = new Date().toISOString();
    setTokens((prev) => prev.map((t) => (t.id === token.id ? { ...t, revoked_at: now } : t)));
    const { error } = await supabase
      .from("integration_tokens")
      .update({ revoked_at: now, revoked_by: user.id })
      .eq("id", token.id);
    if (error) {
      setTokens((prev) => prev.map((t) => (t.id === token.id ? { ...t, revoked_at: null } : t)));
      toast.error("Could not revoke token", { description: error.message });
      return;
    }
    toast.success("Token revoked");
  };

  const handleDeleteSource = (source: WebhookSource) => {
    deleteWebhookSource(source.id);
    setTokens((prev) => prev.filter((t) => t.source_id !== source.id));
    toast.success(`Deleted "${source.name}"`);
  };

  if (!currentOrg) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Set up an organisation to manage integrations.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plug className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-sm text-muted-foreground">External systems can POST tasks straight into your Rapid Capture inbox.</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New Source
        </Button>
      </div>

      {/* How-to panel — always visible, explains the wiring */}
      <Card className="border-primary/30 bg-primary/[0.02]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            How to use this
          </CardTitle>
          <CardDescription>
            Pumped exposes a single webhook endpoint. Each "source" you create here gets its own bearer token. Paste the URL and token into whatever tool is sending you tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Endpoint URL</Label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <code className="flex-1 break-all font-mono text-xs">{FUNCTION_URL || "Set VITE_SUPABASE_URL in your environment"}</code>
              {FUNCTION_URL && <CopyButton value={FUNCTION_URL} label="Copy URL" successMessage="URL copied" />}
            </div>
          </div>

          <ol className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
              <div>
                <span className="font-medium">Create a source</span> for the system you're connecting (e.g. "Linear inbox", "Zapier from Gmail"). Each source can have its own token, revoked independently.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
              <div>
                <span className="font-medium">Mint a token</span> for that source. The full token is shown <strong>once</strong> — copy it into a password manager or directly into your integration's config. We only keep the SHA-256 hash.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
              <div>
                <span className="font-medium">Configure your external system</span> to POST JSON to the endpoint above with <code className="font-mono text-xs">Authorization: Bearer &lt;your-token&gt;</code>. In Zapier or Make use the "Webhooks → POST" action; in custom code use any HTTP client.
              </div>
            </li>
          </ol>

          <details className="rounded-md border bg-background">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">Show example curl</summary>
            <div className="border-t p-3 space-y-2">
              <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed">{curlSnippet("YOUR_TOKEN_HERE")}</pre>
              <div className="flex items-center gap-2">
                <CopyButton value={curlSnippet("YOUR_TOKEN_HERE")} label="Copy curl" successMessage="Snippet copied" />
                <span className="text-xs text-muted-foreground">
                  Replace <code className="font-mono">YOUR_TOKEN_HERE</code> with the token you minted.
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Required fields: <code className="font-mono">source_id</code> (idempotency key) and <code className="font-mono">task</code>.
                Optional: <code className="font-mono">priority</code>, <code className="font-mono">due_date</code>, <code className="font-mono">notes</code>, <code className="font-mono">source_url</code>, <code className="font-mono">wbs_node_id</code>.
              </p>
            </div>
          </details>
        </CardContent>
      </Card>

      {sources.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Plug className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-4">No webhook sources yet.</p>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Create your first source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => {
            const sourceTokens = tokensBySource.get(source.id) ?? [];
            const activeTokens = sourceTokens.filter((t) => !t.revoked_at);
            return (
              <Card key={source.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {source.name}
                        <Badge variant="outline" className="font-mono text-xs">{source.slug}</Badge>
                      </CardTitle>
                      {source.description && (
                        <CardDescription className="mt-1">{source.description}</CardDescription>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {source.lastReceivedAt
                          ? `Last received ${format(new Date(source.lastReceivedAt), "PPp")}`
                          : "No payloads received yet"}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleMintNewToken(source)}>
                        <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Mint token
                      </Button>
                      <DeleteSourceButton source={source} onDelete={handleDeleteSource} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tokens ({activeTokens.length} active)</div>
                    {sourceTokens.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No tokens. Click "Mint token" to create one.
                      </p>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {sourceTokens.map((t) => (
                          <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                            <code className="font-mono">{t.token_prefix}…</code>
                            <span className="text-muted-foreground">
                              · created {format(new Date(t.created_at), "d MMM yyyy")}
                            </span>
                            {t.revoked_at ? (
                              <Badge variant="secondary" className="text-[10px]">
                                revoked {format(new Date(t.revoked_at), "d MMM")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-rag-green/40 text-rag-green">active</Badge>
                            )}
                            <div className="flex-1" />
                            {!t.revoked_at && (
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleRevokeToken(t)}>
                                Revoke
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create source dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) { setNewName(""); setNewDescription(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New webhook source</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="src-name">Name *</Label>
              <Input
                id="src-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Linear inbox"
                maxLength={200}
                className="mt-1"
                autoFocus
              />
              {newName.trim() && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Slug: <code className="font-mono">{slugify(newName) || "(auto)"}</code>
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="src-desc">Description</Label>
              <Textarea
                id="src-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What sends here? Helps you tell sources apart."
                rows={2}
                maxLength={1000}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSource} disabled={!newName.trim() || creating}>
              {creating ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating</> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show-token-once modal — surfaces URL + token + curl together so
          the user has every piece they need to paste into Zapier/Make. */}
      <AlertDialog open={!!newToken} onOpenChange={(v) => { if (!v) { setNewToken(null); setTokenVisible(false); } }}>
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Token minted for "{newTokenSourceName}"
            </AlertDialogTitle>
            <AlertDialogDescription>
              Copy these now — the token is shown only this once. We only keep the SHA-256 hash, so we can't recover it if you lose it.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Endpoint URL</Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <code className="flex-1 break-all font-mono text-xs">{FUNCTION_URL}</code>
                {FUNCTION_URL && <CopyButton value={FUNCTION_URL} size="icon" label="Copy URL" successMessage="URL copied" />}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bearer Token</Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <code className="flex-1 break-all font-mono text-xs">
                  {tokenVisible ? newToken : (newToken ? `${newToken.slice(0, 8)}${"•".repeat(40)}` : "")}
                </code>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0 shrink-0" onClick={() => setTokenVisible((v) => !v)} aria-label="Toggle token visibility">
                  {tokenVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                {newToken && <CopyButton value={newToken} size="icon" label="Copy token" successMessage="Token copied" />}
              </div>
            </div>

            <details className="rounded-md border bg-muted/30">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium select-none">Example curl (pre-filled with your token)</summary>
              <div className="border-t p-3 space-y-2">
                <pre className="overflow-x-auto rounded bg-background p-2 text-[11px] leading-relaxed">{newToken ? curlSnippet(newToken) : ""}</pre>
                {newToken && <CopyButton value={curlSnippet(newToken)} label="Copy full curl command" successMessage="Snippet copied" />}
              </div>
            </details>

            <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Store the token in a password manager or your integration's secret vault. We cannot show it again.</span>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setNewToken(null); setTokenVisible(false); }}>
              I've saved it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loadingTokens && (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" /> Loading tokens…
        </p>
      )}
    </div>
  );
}

function DeleteSourceButton({ source, onDelete }: { source: WebhookSource; onDelete: (s: WebhookSource) => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label="Delete source">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{source.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the source and revokes every token attached to it.
            Inbox items already pulled in stay safe, but new posts to this source will fail.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(source)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete source
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
