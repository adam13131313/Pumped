// Stubbed for v2 phase 4. Original v1 implementation read action.project /
// action.workPackage strings and a separate WorkPackage[] store slice — both
// gone in v2. Real rewrite belongs to phase 5 (dashboard) and will read RAG
// status off WBS work_package nodes directly.

import { Activity } from "lucide-react";
import { WidgetEmpty } from "./WidgetTitle";

export function RagTrendChart() {
  return <WidgetEmpty icon={Activity} message="RAG trend chart is being rewritten for v2." />;
}

export function WPCompletionBars() {
  return <WidgetEmpty icon={Activity} message="Work-package completion chart is being rewritten for v2." />;
}
