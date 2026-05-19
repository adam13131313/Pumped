import { WaitingItem, WbsNode } from "@/lib/types";
import { differenceInCalendarDays } from "date-fns";
import { WidgetEmpty } from "./WidgetTitle";
import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { nodePath } from "@/components/NodePicker";

// v2 risk matrix. RAG severity per pending waiting item is derived by walking
// from the linked WBS node up to its containing project and inspecting all
// child work-package nodes' rag_status.

export function WaitingRiskMatrix({
  waitingItems,
  wbsNodes,
}: {
  waitingItems: WaitingItem[];
  wbsNodes: WbsNode[];
}) {
  const today = new Date();

  // For each project node, the worst RAG among its work-package descendants.
  const childMap = new Map<string | null, WbsNode[]>();
  for (const n of wbsNodes) {
    const list = childMap.get(n.parentId) ?? [];
    list.push(n);
    childMap.set(n.parentId, list);
  }
  const projectRag = new Map<string, "green" | "amber" | "red" | "none">();
  for (const proj of wbsNodes.filter((n) => n.nodeType === "project")) {
    const stack = [...(childMap.get(proj.id) ?? [])];
    const wps: WbsNode[] = [];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.nodeType === "work_package") wps.push(n);
      stack.push(...(childMap.get(n.id) ?? []));
    }
    if (wps.some((w) => w.ragStatus === "red")) projectRag.set(proj.id, "red");
    else if (wps.some((w) => w.ragStatus === "amber")) projectRag.set(proj.id, "amber");
    else if (wps.length > 0) projectRag.set(proj.id, "green");
    else projectRag.set(proj.id, "none");
  }

  // Find the project node that contains a given WBS node (walking up the path).
  const projectOf = (nodeId: string | null) => {
    if (!nodeId) return null;
    const path = nodePath(wbsNodes, nodeId);
    return path.find((n) => n.nodeType === "project") ?? null;
  };

  const dots = waitingItems
    .filter((w) => w.status === "pending" && w.dueBy)
    .map((w) => {
      const days = differenceInCalendarDays(new Date(w.dueBy!), today);
      const proj = projectOf(w.wbsNodeId);
      const rag = proj ? projectRag.get(proj.id) ?? "none" : "none";
      const highRisk = rag === "red" || rag === "amber";
      return { item: w, days, highRisk, rag };
    });

  if (dots.length === 0) {
    return <WidgetEmpty icon={AlertTriangle} message="No pending waiting items in this scope." />;
  }

  const xMin = -7, xMax = 30;
  const clamp = (n: number) => Math.max(xMin, Math.min(xMax, n));
  const W = 100, H = 100;
  const xToPct = (d: number) => ((clamp(d) - xMin) / (xMax - xMin)) * W;

  return (
    <div className="space-y-2">
      <div className="relative w-full" style={{ aspectRatio: "2/1" }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <rect x={0} y={0} width={W / 2} height={H / 2} fill="hsl(var(--rag-red) / 0.08)" />
          <rect x={W / 2} y={0} width={W / 2} height={H / 2} fill="hsl(var(--rag-amber) / 0.06)" />
          <rect x={0} y={H / 2} width={W / 2} height={H / 2} fill="hsl(var(--rag-amber) / 0.04)" />
          <rect x={W / 2} y={H / 2} width={W / 2} height={H / 2} fill="hsl(var(--muted) / 0.4)" />
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="hsl(var(--border))" strokeWidth={0.3} />
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="hsl(var(--border))" strokeWidth={0.3} />
        </svg>
        <div className="absolute top-1.5 left-2 text-[10px] font-semibold text-rag-red">Chase now</div>
        <div className="absolute top-1.5 right-2 text-[10px] text-muted-foreground">Watch list</div>
        <div className="absolute bottom-1.5 left-2 text-[10px] text-muted-foreground">Soon, low risk</div>
        <div className="absolute bottom-1.5 right-2 text-[10px] text-muted-foreground">Comfortable</div>
        {dots.map((d, i) => {
          const left = xToPct(d.days);
          const top = d.highRisk ? 20 + Math.random() * 25 : 55 + Math.random() * 25;
          const color = d.days < 0 ? "hsl(var(--rag-red))" : d.highRisk ? "hsl(var(--rag-amber))" : "hsl(var(--rag-green))";
          return (
            <Tooltip key={d.item.id + i} delayDuration={0}>
              <TooltipTrigger asChild>
                <div
                  className="absolute h-2.5 w-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ring-2 ring-background hover:scale-150 transition-transform cursor-pointer"
                  style={{ left: `${left}%`, top: `${top}%`, background: color }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">
                <div className="font-medium">{d.item.description}</div>
                <div className="text-muted-foreground mt-0.5">
                  {d.item.fromWhomText && `From ${d.item.fromWhomText} · `}
                  {d.days < 0 ? `${Math.abs(d.days)}d overdue` : `due in ${d.days}d`}
                  {d.rag !== "none" && ` · ${d.rag}`}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>← Sooner</span>
        <span>Days until due →</span>
      </div>
    </div>
  );
}
