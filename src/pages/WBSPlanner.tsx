// Stubbed for v2 phase 4. The v1 planner used Programme/Project/WorkPackage
// store slices and a generate-wbs edge function that emitted that v1 shape.
// Both need updating for the unified wbs_nodes hierarchy. Real rewrite
// belongs to phase 7 once the new generate-wbs prompt is ready.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function WBSPlanner() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">WBS Planner</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Planner is being rewritten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The AI WBS planner is paused while we wire it up to the new
            wbs_nodes hierarchy. In the meantime, build your structure manually
            on the Work Breakdown page.
          </p>
          <Button asChild variant="outline" size="sm"><Link to="/wbs">Open Work Breakdown</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
