import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { organisationSchema, firstZodError } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Minimal first-org bootstrap. Phase 1 ships this as the entry point for a
// freshly signed-up user with no membership; later phases can replace it with
// a richer onboarding flow.
export default function OrgBootstrapPage() {
  const bootstrapOrganisation = useAppStore((s) => s.bootstrapOrganisation);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const parsed = organisationSchema.safeParse({ name });
    if (!parsed.success) {
      toast.error(firstZodError(parsed.error));
      return;
    }
    setSubmitting(true);
    try {
      await bootstrapOrganisation(parsed.data.name);
      toast.success(`Created ${parsed.data.name}`);
    } catch (e) {
      // Supabase PostgrestError is a plain object with .message/.code/.hint,
      // not an Error instance — so a bare `instanceof Error` check swallows
      // the real reason. Pull the message off whatever shape we got.
      console.error("[bootstrap] failed", e);
      const description = describeError(e);
      toast.error("Could not create organisation", { description });
    } finally {
      setSubmitting(false);
    }
  };

  function describeError(e: unknown): string {
    if (!e) return "Unknown error";
    if (typeof e === "string") return e;
    if (typeof e === "object") {
      const o = e as { message?: unknown; hint?: unknown; code?: unknown; details?: unknown };
      const parts: string[] = [];
      if (typeof o.message === "string" && o.message) parts.push(o.message);
      if (typeof o.hint === "string" && o.hint) parts.push(`Hint: ${o.hint}`);
      if (typeof o.details === "string" && o.details && o.details !== o.message) parts.push(o.details);
      if (typeof o.code === "string" && o.code) parts.push(`(${o.code})`);
      if (parts.length) return parts.join(" — ");
    }
    return "Unknown error";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome to Pumped</h1>
          <p className="text-sm text-muted-foreground">
            Let's set up your workspace. You can rename it later.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Organisation name</Label>
            <Input
              id="org-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) submit();
              }}
              placeholder="Acme Co"
              maxLength={200}
              disabled={submitting}
            />
          </div>
          <Button onClick={submit} disabled={submitting || !name.trim()} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create workspace"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
