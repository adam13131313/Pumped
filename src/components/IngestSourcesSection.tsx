// Stubbed for v2 phase 4. Same story as IntegrationsPage — the v1
// `ingest_sources` table moved to `webhook_sources` and the UI needs a
// rewrite. Real rewrite belongs to phase 7.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function IngestSourcesSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Webhook sources</CardTitle>
        <CardDescription>Rewrite pending for the v2 webhook_sources schema.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Existing sources continue to ingest. The management UI will return in the next phase.
      </CardContent>
    </Card>
  );
}
