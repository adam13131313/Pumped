import { useState, useMemo, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useFilteredData } from "@/hooks/useFilteredData";
import { WorkPackage, Action, DependencyType, Dependency } from "@/lib/types";
import { calculateCriticalPath } from "@/lib/criticalPath";
import { RAGBadge } from "@/components/RAGBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { WPDialog } from "@/components/WPDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GanttChart, Plus, Trash2, AlertTriangle, Info, ChevronDown, ChevronRight, Pencil, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 36;
const TASK_ROW_HEIGHT = 30;
const HEADER_HEIGHT = 40;
const LABEL_WIDTH = 280;
const DAY_WIDTH = 28;

const depTypeLabels: Record<DependencyType, string> = {
  FS: "Finish-to-Start",
  FF: "Finish-to-Finish",
  SS: "Start-to-Start",
  SF: "Start-to-Finish",
};

interface GanttRow {
  type: "wp" | "task";
  wp: WorkPackage;
  action?: Action;
  rowHeight: number;
}

export default function GanttPage() {
  const { workPackages, actions } = useFilteredData();
  const allWorkPackages = useAppStore((s) => s.workPackages);
  const allActions = useAppStore((s) => s.actions);
  const updateWorkPackage = useAppStore((s) => s.updateWorkPackage);
  const deleteWorkPackage = useAppStore((s) => s.deleteWorkPackage);
  const addAction = useAppStore((s) => s.addAction);
  const updateAction = useAppStore((s) => s.updateAction);
  const deleteAction = useAppStore((s) => s.deleteAction);
  const delegateAction = useAppStore((s) => s.delegateAction);

  const [showCritical, setShowCritical] = useState(true);
  const [depDialogOpen, setDepDialogOpen] = useState(false);
  const [depWPId, setDepWPId] = useState<string>("");
  const [collapsedWPs, setCollapsedWPs] = useState<Set<string>>(new Set());
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [addToWPContext, setAddToWPContext] = useState<WorkPackage | null>(null);
  const [wpDialogOpen, setWpDialogOpen] = useState(false);
  const [editingWP, setEditingWP] = useState<WorkPackage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build flat rows: WP + its child tasks
  const rows = useMemo(() => {
    const result: GanttRow[] = [];
    // Group WPs by project
    const projectMap = new Map<string, WorkPackage[]>();
    for (const wp of workPackages) {
      const arr = projectMap.get(wp.project) || [];
      arr.push(wp);
      projectMap.set(wp.project, arr);
    }
    for (const [, wps] of projectMap) {
      for (const wp of wps) {
        result.push({ type: "wp", wp, rowHeight: ROW_HEIGHT });
        if (!collapsedWPs.has(wp.id)) {
          const wpActions = actions.filter(
            (a) => a.workPackage === wp.workPackage && a.project === wp.project
          );
          for (const a of wpActions) {
            result.push({ type: "task", wp, action: a, rowHeight: TASK_ROW_HEIGHT });
          }
        }
      }
    }
    // Also show unassigned tasks
    const unassigned = actions.filter((a) => !a.workPackage);
    if (unassigned.length > 0) {
      const dummyWP: WorkPackage = {
        id: "__unassigned__",
        project: "",
        workPackage: "Unassigned Tasks",
        wpLead: "",
        startDate: "",
        dueDate: "",
        ragStatus: "Green",
        blockers: "",
        dependencies: [],
      };
      result.push({ type: "wp", wp: dummyWP, rowHeight: ROW_HEIGHT });
      if (!collapsedWPs.has("__unassigned__")) {
        for (const a of unassigned) {
          result.push({ type: "task", wp: dummyWP, action: a, rowHeight: TASK_ROW_HEIGHT });
        }
      }
    }
    return result;
  }, [workPackages, actions, collapsedWPs]);

  // Collect all dates for range calculation (from WPs AND tasks)
  const { minDate, maxDate, totalDays } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const wp of workPackages) {
      if (wp.startDate) min = Math.min(min, new Date(wp.startDate).getTime());
      if (wp.dueDate) max = Math.max(max, new Date(wp.dueDate).getTime());
    }
    for (const a of actions) {
      if (a.startDate) {
        const t = new Date(a.startDate).getTime();
        min = Math.min(min, t);
        max = Math.max(max, t);
      }
      if (a.dueDate) {
        const t = new Date(a.dueDate).getTime();
        min = Math.min(min, t);
        max = Math.max(max, t);
      }
    }
    if (min === Infinity) {
      const now = new Date();
      min = now.getTime();
      max = now.getTime() + 30 * 86400000;
    }
    min -= 7 * 86400000;
    max += 7 * 86400000;
    const days = Math.ceil((max - min) / 86400000);
    return { minDate: new Date(min), maxDate: new Date(max), totalDays: days };
  }, [workPackages, actions]);

  const cpmNodes = useMemo(() => calculateCriticalPath(workPackages), [workPackages]);

  const weeks = useMemo(() => {
    const result: { date: Date; label: string }[] = [];
    const d = new Date(minDate);
    d.setDate(d.getDate() - d.getDay() + 1);
    while (d.getTime() <= maxDate.getTime()) {
      result.push({ date: new Date(d), label: `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}` });
      d.setDate(d.getDate() + 7);
    }
    return result;
  }, [minDate, maxDate]);

  const dayOffset = (date: string) => {
    const d = new Date(date);
    return Math.round((d.getTime() - minDate.getTime()) / 86400000);
  };

  const toggleCollapse = (wpId: string) => {
    setCollapsedWPs((prev) => {
      const next = new Set(prev);
      if (next.has(wpId)) next.delete(wpId);
      else next.add(wpId);
      return next;
    });
  };

  const openDepDialog = (wpId: string) => {
    setDepWPId(wpId);
    setDepDialogOpen(true);
  };

  const addDependency = (wpId: string, dep: Dependency) => {
    const wp = allWorkPackages.find((w) => w.id === wpId);
    if (!wp) return;
    updateWorkPackage(wpId, { dependencies: [...(wp.dependencies || []), dep] });
  };

  const removeDependency = (wpId: string, targetId: string) => {
    const wp = allWorkPackages.find((w) => w.id === wpId);
    if (!wp) return;
    updateWorkPackage(wpId, { dependencies: (wp.dependencies || []).filter((d) => d.targetId !== targetId) });
  };

  const updateDependency = (wpId: string, targetId: string, updates: Partial<Dependency>) => {
    const wp = allWorkPackages.find((w) => w.id === wpId);
    if (!wp) return;
    updateWorkPackage(wpId, {
      dependencies: (wp.dependencies || []).map((d) =>
        d.targetId === targetId ? { ...d, ...updates } : d
      ),
    });
  };

  const handleAddTask = (wp: WorkPackage) => {
    setAddToWPContext(wp);
    setEditingAction(null);
    setActionDialogOpen(true);
  };

  const handleEditWP = (wp: WorkPackage) => {
    setEditingWP(wp);
    setWpDialogOpen(true);
  };

  const handleSaveWP = (wp: WorkPackage) => {
    if (editingWP) {
      updateWorkPackage(wp.id, wp);
    }
    setWpDialogOpen(false);
    setEditingWP(null);
  };

  const handleEditTask = (action: Action) => {
    setEditingAction(action);
    setAddToWPContext(null);
    setActionDialogOpen(true);
  };

  const handleSaveAction = (action: Action) => {
    if (editingAction) {
      updateAction(action.id, action);
    } else {
      addAction(action);
    }
    setActionDialogOpen(false);
    setEditingAction(null);
    setAddToWPContext(null);
  };

  const wpOnlyRows = rows.filter((r) => r.type === "wp");
  const criticalCount = Array.from(cpmNodes.values()).filter((n) => n.isCritical).length;
  const chartWidth = totalDays * DAY_WIDTH;
  const totalHeight = rows.reduce((sum, r) => sum + r.rowHeight, 0);

  // Count tasks per WP
  const taskCountForWP = (wp: WorkPackage) =>
    actions.filter((a) => a.workPackage === wp.workPackage && a.project === wp.project).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GanttChart className="h-6 w-6 text-primary" /> Gantt Schedule
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {wpOnlyRows.length} work packages · {actions.length} tasks · {criticalCount} on critical path
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button size="sm" onClick={() => { setEditingAction(null); setAddToWPContext(null); setActionDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Task
          </Button>
          <div className="flex items-center gap-2">
            <Switch checked={showCritical} onCheckedChange={setShowCritical} id="critical" />
            <Label htmlFor="critical" className="text-sm cursor-pointer">Critical Path</Label>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary" /> WP</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary/50" /> Task</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[hsl(var(--rag-red))]" /> Critical</span>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GanttChart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No work packages or tasks found. Create work packages with dates to see the schedule.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex">
            {/* Left labels */}
            <div className="flex-shrink-0 border-r bg-card z-10" style={{ width: LABEL_WIDTH }}>
              <div className="border-b px-3 flex items-center text-xs font-medium text-muted-foreground" style={{ height: HEADER_HEIGHT }}>
                Schedule Items
              </div>
              {rows.map((row, idx) => {
                if (row.type === "wp") {
                  const node = cpmNodes.get(row.wp.id);
                  const isCritical = node?.isCritical && showCritical;
                  const isCollapsed = collapsedWPs.has(row.wp.id);
                  const tCount = row.wp.id === "__unassigned__"
                    ? actions.filter((a) => !a.workPackage).length
                    : taskCountForWP(row.wp);
                  return (
                    <div
                      key={`wp-${row.wp.id}`}
                      className={cn(
                        "flex items-center gap-1 px-2 border-b transition-colors",
                        isCritical && "bg-[hsl(var(--rag-red))]/5"
                      )}
                      style={{ height: row.rowHeight }}
                    >
                      <button
                        className="p-0.5 hover:bg-accent rounded"
                        onClick={() => toggleCollapse(row.wp.id)}
                      >
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{row.wp.workPackage}</p>
                      </div>
                      {tCount > 0 && (
                        <Badge variant="secondary" className="text-[9px] px-1 h-4">{tCount}</Badge>
                      )}
                      {row.wp.id !== "__unassigned__" && (
                        <>
                          <RAGBadge status={row.wp.ragStatus} />
                          {isCritical && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-3 w-3 text-[hsl(var(--rag-red))]" />
                              </TooltipTrigger>
                              <TooltipContent>Critical · Slack: {node?.slack ?? 0}d</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="p-0.5 hover:bg-accent rounded" onClick={(e) => { e.stopPropagation(); openDepDialog(row.wp.id); }}>
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Manage dependencies</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="p-0.5 hover:bg-accent rounded" onClick={(e) => { e.stopPropagation(); handleEditWP(row.wp); }}>
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Edit work package</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="p-0.5 hover:bg-accent rounded" onClick={(e) => { e.stopPropagation(); handleAddTask(row.wp); }}>
                                <ListPlus className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Add task to this WP</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  );
                } else {
                  const a = row.action!;
                  const statusColor = a.status === "Complete" ? "text-green-600" : a.status === "Blocked" ? "text-[hsl(var(--rag-red))]" : "text-muted-foreground";
                  return (
                    <div
                      key={`task-${a.id}`}
                      className="flex items-center gap-1.5 pl-8 pr-2 border-b hover:bg-accent/40 cursor-pointer transition-colors"
                      style={{ height: row.rowHeight }}
                      onClick={() => handleEditTask(a)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] truncate">{a.task}</p>
                      </div>
                      <span className={cn("text-[9px] font-medium", statusColor)}>{a.status}</span>
                      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-50" />
                    </div>
                  );
                }
              })}
            </div>

            {/* Right chart area */}
            <div className="flex-1 overflow-x-auto" ref={scrollRef}>
              <div style={{ width: chartWidth, minWidth: "100%" }}>
                {/* Week headers */}
                <div className="flex border-b relative" style={{ height: HEADER_HEIGHT }}>
                  {weeks.map((w, i) => (
                    <div
                      key={i}
                      className="text-[10px] font-medium text-muted-foreground border-r flex items-center px-1"
                      style={{ width: 7 * DAY_WIDTH, position: "absolute", left: dayOffset(w.date.toISOString().split("T")[0]) * DAY_WIDTH }}
                    >
                      {w.label}
                    </div>
                  ))}
                </div>

                {/* Bars */}
                <svg width={chartWidth} height={totalHeight + 20} className="overflow-visible">
                  {/* Today line */}
                  {(() => {
                    const todayOff = dayOffset(new Date().toISOString().split("T")[0]);
                    if (todayOff >= 0 && todayOff <= totalDays) {
                      return (
                        <line
                          x1={todayOff * DAY_WIDTH}
                          y1={0}
                          x2={todayOff * DAY_WIDTH}
                          y2={totalHeight + 20}
                          stroke="hsl(var(--primary))"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          opacity={0.5}
                        />
                      );
                    }
                    return null;
                  })()}

                  {/* Grid lines */}
                  {weeks.map((w, i) => {
                    const x = dayOffset(w.date.toISOString().split("T")[0]) * DAY_WIDTH;
                    return <line key={i} x1={x} y1={0} x2={x} y2={totalHeight + 20} stroke="hsl(var(--border))" strokeWidth={0.5} />;
                  })}

                  {/* Render bars */}
                  {(() => {
                    let yOffset = 0;
                    return rows.map((row, rowIdx) => {
                      const currentY = yOffset;
                      yOffset += row.rowHeight;

                      if (row.type === "wp") {
                        const wp = row.wp;
                        if (wp.id === "__unassigned__" || !wp.startDate || !wp.dueDate) {
                          return (
                            <g key={`wp-bar-${wp.id}`}>
                              {wp.id !== "__unassigned__" && (
                                <>
                                  <rect
                                    x={10}
                                    y={currentY + row.rowHeight / 2 - 4}
                                    width={60}
                                    height={8}
                                    rx={4}
                                    fill="hsl(var(--muted-foreground) / 0.2)"
                                  />
                                  <text x={80} y={currentY + row.rowHeight / 2 + 3} fontSize={9} fill="hsl(var(--muted-foreground))">
                                    No dates
                                  </text>
                                </>
                              )}
                            </g>
                          );
                        }

                        const startOff = dayOffset(wp.startDate);
                        const endOff = dayOffset(wp.dueDate);
                        const barWidth = Math.max((endOff - startOff) * DAY_WIDTH, 6);
                        const x = startOff * DAY_WIDTH;
                        const y = currentY + row.rowHeight / 2 - 8;
                        const node = cpmNodes.get(wp.id);
                        const isCritical = node?.isCritical && showCritical;

                        return (
                          <g key={`wp-bar-${wp.id}`}>
                            {/* WP bar - thicker, darker */}
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={16}
                              rx={3}
                              fill={isCritical ? "hsl(var(--rag-red))" : "hsl(var(--primary))"}
                              opacity={isCritical ? 0.85 : 0.8}
                            />
                            {/* Diamond end caps for summary bar */}
                            <polygon
                              points={`${x},${y + 8} ${x + 4},${y + 4} ${x + 8},${y + 8} ${x + 4},${y + 12}`}
                              fill={isCritical ? "hsl(var(--rag-red))" : "hsl(var(--primary))"}
                            />
                            <polygon
                              points={`${x + barWidth - 8},${y + 8} ${x + barWidth - 4},${y + 4} ${x + barWidth},${y + 8} ${x + barWidth - 4},${y + 12}`}
                              fill={isCritical ? "hsl(var(--rag-red))" : "hsl(var(--primary))"}
                            />
                            {barWidth > 50 && (
                              <text x={x + 12} y={y + 12} fontSize={9} fontWeight={600} fill="white">
                                {endOff - startOff}d
                              </text>
                            )}
                            {node && (
                              <text x={x + barWidth + 4} y={y + 12} fontSize={8} fill="hsl(var(--muted-foreground))">
                                {isCritical ? "Critical" : `Slack: ${node.slack}d`}
                              </text>
                            )}
                          </g>
                        );
                      } else {
                        // Task bar
                        const a = row.action!;
                        if (!a.dueDate && !a.startDate) return <g key={`task-bar-${a.id}`} />;

                        // Use actual task dates
                        const taskEnd = a.dueDate ? dayOffset(a.dueDate) : (a.startDate ? dayOffset(a.startDate) + 3 : 0);
                        const taskStart = a.startDate ? dayOffset(a.startDate) : taskEnd - 3;
                        const barWidth = Math.max((taskEnd - taskStart) * DAY_WIDTH, 8);
                        const x = taskStart * DAY_WIDTH;
                        const y = currentY + row.rowHeight / 2 - 5;
                        const isComplete = a.status === "Complete";
                        const isBlocked = a.status === "Blocked";

                        return (
                          <g key={`task-bar-${a.id}`} className="cursor-pointer">
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={10}
                              rx={2}
                              fill={
                                isComplete ? "hsl(var(--rag-green))"
                                  : isBlocked ? "hsl(var(--rag-red))"
                                    : "hsl(var(--primary))"
                              }
                              opacity={isComplete ? 0.5 : 0.45}
                            />
                            {/* Due date diamond marker */}
                            <polygon
                              points={`${taskEnd * DAY_WIDTH - 4},${y + 5} ${taskEnd * DAY_WIDTH},${y + 1} ${taskEnd * DAY_WIDTH + 4},${y + 5} ${taskEnd * DAY_WIDTH},${y + 9}`}
                              fill={
                                isComplete ? "hsl(var(--rag-green))"
                                  : isBlocked ? "hsl(var(--rag-red))"
                                    : "hsl(var(--primary))"
                              }
                              opacity={0.8}
                            />
                          </g>
                        );
                      }
                    });
                  })()}

                  {/* Dependency arrows (WP-level only) */}
                  {(() => {
                    // Build a map of wpId -> yCenter
                    let yOff = 0;
                    const wpYMap = new Map<string, number>();
                    for (const row of rows) {
                      if (row.type === "wp") {
                        wpYMap.set(row.wp.id, yOff + row.rowHeight / 2);
                      }
                      yOff += row.rowHeight;
                    }

                    return rows
                      .filter((r) => r.type === "wp")
                      .flatMap((row) =>
                        (row.wp.dependencies || []).map((dep) => {
                          const pred = allWorkPackages.find((w) => w.id === dep.targetId);
                          if (!pred || !pred.startDate || !pred.dueDate || !row.wp.startDate || !row.wp.dueDate) return null;
                          const fromY = wpYMap.get(dep.targetId);
                          const toY = wpYMap.get(row.wp.id);
                          if (fromY === undefined || toY === undefined) return null;

                          const predStartOff = dayOffset(pred.startDate);
                          const predEndOff = dayOffset(pred.dueDate);
                          const succStartOff = dayOffset(row.wp.startDate);
                          const succEndOff = dayOffset(row.wp.dueDate);

                          let fromX: number, toX: number;
                          switch (dep.type) {
                            case "FS": fromX = predEndOff * DAY_WIDTH; toX = succStartOff * DAY_WIDTH; break;
                            case "FF": fromX = predEndOff * DAY_WIDTH; toX = succEndOff * DAY_WIDTH; break;
                            case "SS": fromX = predStartOff * DAY_WIDTH; toX = succStartOff * DAY_WIDTH; break;
                            case "SF": fromX = predStartOff * DAY_WIDTH; toX = succEndOff * DAY_WIDTH; break;
                          }

                          const node = cpmNodes.get(row.wp.id);
                          const isCritical = node?.isCritical && showCritical;
                          const midX = fromX + 10;

                          return (
                            <path
                              key={`dep-${row.wp.id}-${dep.targetId}`}
                              d={`M${fromX},${fromY} L${midX},${fromY} L${midX},${toY} L${toX},${toY}`}
                              fill="none"
                              stroke={isCritical ? "hsl(var(--rag-red))" : "hsl(var(--muted-foreground))"}
                              strokeWidth={1.5}
                              opacity={0.6}
                              markerEnd="url(#arrow)"
                            />
                          );
                        })
                      );
                  })()}

                  <defs>
                    <marker id="arrow" viewBox="0 0 6 6" refX={6} refY={3} markerWidth={6} markerHeight={6} orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="hsl(var(--muted-foreground))" opacity={0.6} />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Schedule Analysis */}
      {wpOnlyRows.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4" /> Schedule Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden rounded-b-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-3 py-2 font-medium">Work Package</th>
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Tasks</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">Dependencies</th>
                    <th className="px-3 py-2 font-medium">Slack</th>
                    <th className="px-3 py-2 font-medium">Critical</th>
                  </tr>
                </thead>
                <tbody>
                  {workPackages.filter((wp) => wp.id !== "__unassigned__").map((wp) => {
                    const node = cpmNodes.get(wp.id);
                    const deps = (wp.dependencies || [])
                      .map((d) => {
                        const target = allWorkPackages.find((w) => w.id === d.targetId);
                        return target ? `${target.workPackage} (${d.type})` : null;
                      })
                      .filter(Boolean);
                    const tCount = taskCountForWP(wp);

                    return (
                      <tr
                        key={wp.id}
                        className={cn(
                          "border-t hover:bg-muted/30 cursor-pointer",
                          node?.isCritical && showCritical && "bg-[hsl(var(--rag-red))]/5"
                        )}
                        onClick={() => openDepDialog(wp.id)}
                      >
                        <td className="px-3 py-2 font-medium">{wp.workPackage}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{wp.project}</td>
                        <td className="px-3 py-2 text-xs">{tCount}</td>
                        <td className="px-3 py-2 text-xs font-mono">
                          {wp.startDate && wp.dueDate ? `${node?.duration ?? "?"}d` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {deps.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {deps.map((d, i) => (
                                <Badge key={i} variant="outline" className="text-[10px]">{d}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs font-mono">{node ? `${node.slack}d` : "—"}</td>
                        <td className="px-3 py-2">
                          {node?.isCritical ? (
                            <Badge variant="destructive" className="text-[10px]">Critical</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">No</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dependency Dialog */}
      <DependencyDialog
        open={depDialogOpen}
        onOpenChange={setDepDialogOpen}
        wpId={depWPId}
        allWPs={allWorkPackages}
        onAdd={addDependency}
        onRemove={removeDependency}
        onUpdate={updateDependency}
      />

      {/* Action Dialog for add/edit tasks */}
      <ActionDialog
        open={actionDialogOpen}
        onOpenChange={(o) => {
          setActionDialogOpen(o);
          if (!o) { setEditingAction(null); setAddToWPContext(null); }
        }}
        action={editingAction ?? (addToWPContext ? {
          id: "",
          task: "",
          project: addToWPContext.project,
          workPackage: addToWPContext.workPackage,
          startDate: "",
          dueDate: "",
          priority: "Medium",
          status: "Not Started",
          notes: "",
        } : null)}
        onSave={handleSaveAction}
        onDelete={(id) => { deleteAction(id); setActionDialogOpen(false); }}
        onDelegate={(id, to) => { delegateAction(id, to); setActionDialogOpen(false); }}
      />

      {/* WP Edit Dialog */}
      <WPDialog
        open={wpDialogOpen}
        onOpenChange={(o) => { setWpDialogOpen(o); if (!o) setEditingWP(null); }}
        wp={editingWP}
        onSave={handleSaveWP}
        onDelete={(id) => { deleteWorkPackage(id); setWpDialogOpen(false); setEditingWP(null); }}
      />
    </div>
  );
}

function DependencyDialog({
  open,
  onOpenChange,
  wpId,
  allWPs,
  onAdd,
  onRemove,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  wpId: string;
  allWPs: WorkPackage[];
  onAdd: (wpId: string, dep: Dependency) => void;
  onRemove: (wpId: string, targetId: string) => void;
  onUpdate: (wpId: string, targetId: string, updates: Partial<Dependency>) => void;
}) {
  const wp = allWPs.find((w) => w.id === wpId);
  const [newTarget, setNewTarget] = useState("");
  const [newType, setNewType] = useState<DependencyType>("FS");
  const [newLag, setNewLag] = useState("0");

  if (!wp) return null;

  const deps = wp.dependencies || [];
  const availableTargets = allWPs.filter(
    (w) => w.id !== wpId && !deps.some((d) => d.targetId === w.id)
  );

  const handleAdd = () => {
    if (!newTarget) return;
    onAdd(wpId, { targetId: newTarget, type: newType, lagDays: parseInt(newLag) || 0 });
    setNewTarget("");
    setNewLag("0");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dependencies: {wp.workPackage}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            {wp.project} · {wp.startDate || "No start"} → {wp.dueDate || "No end"}
          </div>

          {deps.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Current Dependencies</Label>
              {deps.map((d) => {
                const target = allWPs.find((w) => w.id === d.targetId);
                return (
                  <div key={d.targetId} className="flex items-center gap-2 rounded-lg border p-2.5">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-sm font-medium truncate">{target?.workPackage ?? "Unknown"}</p>
                      <div className="flex items-center gap-2">
                        <Select
                          value={d.type}
                          onValueChange={(v) => onUpdate(wpId, d.targetId, { type: v as DependencyType })}
                        >
                          <SelectTrigger className="h-7 w-[140px] text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(depTypeLabels) as [DependencyType, string][]).map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={d.lagDays ?? 0}
                            onChange={(e) => onUpdate(wpId, d.targetId, { lagDays: parseInt(e.target.value) || 0 })}
                            className="w-14 h-7 text-[11px]"
                          />
                          <span className="text-[10px] text-muted-foreground">days lag</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive flex-shrink-0" onClick={() => onRemove(wpId, d.targetId)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No dependencies yet.</p>
          )}

          {availableTargets.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Add Dependency</Label>
              <div className="flex gap-2">
                <Select value={newTarget} onValueChange={setNewTarget}>
                  <SelectTrigger className="flex-1 h-9 text-xs">
                    <SelectValue placeholder="Select predecessor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTargets.map((w) => (
                      <SelectItem key={w.id} value={w.id} className="text-xs">{w.workPackage} ({w.project})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newType} onValueChange={(v) => setNewType(v as DependencyType)}>
                  <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(depTypeLabels) as [DependencyType, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" value={newLag} onChange={(e) => setNewLag(e.target.value)} className="w-16 h-9 text-xs" placeholder="Lag" />
                <Button size="sm" className="h-9" onClick={handleAdd} disabled={!newTarget}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
