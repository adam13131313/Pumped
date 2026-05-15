import { WaitingItem, Project, WorkPackage } from "@/lib/types";
import { differenceInCalendarDays } from "date-fns";
import { WidgetEmpty } from "./WidgetTitle";
import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function WaitingRiskMatrix({
  waitingItems,
  projects,
  workPackages,
}: {
  waitingItems: WaitingItem[];
  projects: Project[];
  workPackages: WorkPackage[];
}) {
  const today = new Date();
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const projectsByName = new Map(projects.map((p) => [p.name, p]));

  // Determine RAG per project: highest severity WP rag wins
  const projectRag = new Map<string, "Green" | "Amber" | "Red" | "None">();
  for (const p of projects) {
    const wps = workPackages.filter((w) => w.project === p.name);
    if (wps.length === 0) {
      projectRag.set(p.id, "None");
    } else if (wps.some((w) => w.ragStatus === "Red")) {
      projectRag.set(p.id, "Red");
    } else if (wps.some((w) => w.ragStatus === "Amber")) {
      projectRag.set(p.id, "Amber");
    } else {
      projectRag.set(p.id, "Green");
    }
  }

  const dots = waitingItems
    .filter((w) => w.status === "Pending" && w.dueBy)
    .map((w) => {
      const days = differenceInCalendarDays(new Date(w.dueBy), today);
      let proj: Project | undefined;
      if (w.linkedProjectId) proj = projectsById.get(w.linkedProjectId);
      if (!proj && w.projectWP) {
        const projName = w.projectWP.split(" / ")[0];
        proj = projectsByName.get(projName);
      }
      const rag = proj ? projectRag.get(proj.id) ?? "None" : "None";
      const highRisk = rag === "Red" || rag === "Amber";
      return { item: w, days, highRisk, rag };
    });

  if (dots.length === 0) {
    return <WidgetEmpty icon={AlertTriangle} message="No pending waiting items in this scope." />;
  }

  // Domain: clamp days from -7 to +30
  const xMin = -7, xMax = 30;
  const clamp = (n: number) => Math.max(xMin, Math.min(xMax, n));

  const W = 100, H = 100; // SVG viewBox
  const xToPct = (d: number) => ((clamp(d) - xMin) / (xMax - xMin)) * W;

  return (
    <div className="space-y-2">
      <div className="relative w-full" style={{ aspectRatio: "2/1" }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {/* Quadrant tints */}
          <rect x={0} y={0} width={W / 2} height={H / 2} fill="hsl(var(--rag-red) / 0.08)" />
          <rect x={W / 2} y={0} width={W / 2} height={H / 2} fill="hsl(var(--rag-amber) / 0.06)" />
          <rect x={0} y={H / 2} width={W / 2} height={H / 2} fill="hsl(var(--rag-amber) / 0.04)" />
          <rect x={W / 2} y={H / 2} width={W / 2} height={H / 2} fill="hsl(var(--muted) / 0.4)" />
          {/* Axes */}
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="hsl(var(--border))" strokeWidth={0.3} />
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="hsl(var(--border))" strokeWidth={0.3} />
        </svg>
        {/* Quadrant labels */}
        <div className="absolute top-1.5 left-2 text-[10px] font-semibold text-rag-red">Chase now</div>
        <div className="absolute top-1.5 right-2 text-[10px] text-muted-foreground">Watch list</div>
        <div className="absolute bottom-1.5 left-2 text-[10px] text-muted-foreground">Soon, low risk</div>
        <div className="absolute bottom-1.5 right-2 text-[10px] text-muted-foreground">Comfortable</div>
        {/* Dots */}
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
                  {d.item.fromWhom && `From ${d.item.fromWhom} · `}
                  {d.days < 0 ? `${Math.abs(d.days)}d overdue` : `due in ${d.days}d`}
                  {d.rag !== "None" && ` · ${d.rag}`}
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
