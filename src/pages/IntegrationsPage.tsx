// Stubbed for v2 phase 4. The full integrations UI relied on the v1
// `ingest_sources` table; v2 moved this to `webhook_sources` with a different
// shape, and the ingest-task edge function still needs its v2 rewrite. Real
// rewrite belongs to phase 7.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Plug className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Integrations</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming back soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            The integrations console is being rewritten for the v2 webhook-sources
            schema. The endpoints will reappear once the ingest-task edge function
            is ported.
          </p>
          <p>If you have an active webhook source it will keep working — only this UI is paused.</p>
        </CardContent>
      </Card>
    </div>
  );
}
