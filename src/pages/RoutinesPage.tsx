// Stubbed for v2 phase 4. The v1 routines UI did its own supabase queries and
// pre-dated the multi-tenant organisation_id requirement on routines /
// routine_completions. Real rewrite belongs to phase 7, using the store
// helpers in lib/store.ts (addRoutine, addRoutineCompletion).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Repeat } from "lucide-react";

export default function RoutinesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Repeat className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Personal Routines</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Routines are being rewritten</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Your routine definitions and completion history are safe in the v2
            database. The tracking UI will come back in the next phase, wired
            up through the new multi-tenant store helpers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
