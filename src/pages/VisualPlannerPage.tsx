import { useState, useRef, useCallback, useMemo } from "react";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useAppStore } from "@/lib/store";
import { WorkPackage, Programme, Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Link2, ZoomIn, ZoomOut, ChevronRight, ChevronDown } from "lucide-react";
import { addDays, differenceInDays, startOfWeek, endOfWeek, startOfMonth, format, parseISO, isValid, addWeeks, addMonths, isBefore, isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import { WPDialog } from "@/components/WPDialog";
import { toast } from "sonner";

// ── Constants ──
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 52;
const LEFT_PANEL_WIDTH = 280;
const MIN_DAY_WIDTH = 3;
const MAX_DAY_WIDTH = 24;
const ZOOM_STEPS = [3, 5, 8, 12, 18, 24];

const RAG_COLORS: Record<string, string> = {
  Green: "hsl(var(--chart-2))",
  Amber: "hsl(var(--chart-4))",
  Red: "hsl(var(--chart-5))",
};

const RAG_BG: Record<string, string> = {
  Green: "hsl(var(--chart-2) / 0.15)",
  Amber: "hsl(var(--chart-4) / 0.15)",
  Red: "hsl(var(--chart-5) / 0.15)",
};

const DEP_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

// ── Helpers ──
function safeParseDate(d: string): Date | null {
  if (!d) return null;
  try {
    const parsed = parseISO(d);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function dateToStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

interface WPRow {
  wp: WorkPackage;
  project: Project;
  programme: Programme | null;
  rowIndex: number;
}

type DragMode = "move" | "resize-left" | "resize-right";

interface DragState {
  wpId: string;
  mode: DragMode;
  startX: number;
  origStartDate: Date;
  origEndDate: Date;
}

export default function VisualPlannerPage() {
  const { programmes, updateWorkPackage, addWorkPackage } = useAppStore();
  const { projects, workPackages } = useFilteredData();

  const [zoomIdx, setZoomIdx] = useState(2);
  const dayWidth = ZOOM_STEPS[zoomIdx];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [wpDialogOpen, setWpDialogOpen] = useState(false);
  const [editingWP, setEditingWP] = useState<WorkPackage | undefined>(undefined);
  const timelineRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Sync vertical scroll between panels
  const handleTimelineScroll = useCallback(() => {
    if (timelineRef.current && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  }, []);

  // ── Build ordered rows (Programme → Project → WP) ──
  const rows: WPRow[] = useMemo(() => {
    const result: WPRow[] = [];
    let idx = 0;

    // Group projects by programme
    const progProjects = new Map<string, Project[]>();
    const standaloneProjects: Project[] = [];

    for (const proj of projects) {
      if (proj.programmeId) {
        const list = progProjects.get(proj.programmeId) || [];
        list.push(proj);
        progProjects.set(proj.programmeId, list);
      } else {
        standaloneProjects.push(proj);
      }
    }

    const addProjectWPs = (proj: Project, prog: Programme | null) => {
      if (collapsed[`proj-${proj.id}`]) return;
      const wps = workPackages.filter((wp) => wp.project === proj.name);
      for (const wp of wps) {
        result.push({ wp, project: proj, programme: prog, rowIndex: idx++ });
      }
    };

    // Only iterate programmes that have filtered projects
    const filteredProgIds = new Set(progProjects.keys());
    for (const prog of programmes) {
      if (!filteredProgIds.has(prog.id)) continue;
      if (collapsed[`prog-${prog.id}`]) {
        idx++;
        continue;
      }
      const projs = progProjects.get(prog.id) || [];
      for (const proj of projs) {
        addProjectWPs(proj, prog);
      }
    }

    for (const proj of standaloneProjects) {
      addProjectWPs(proj, null);
    }

    return result;
  }, [programmes, projects, workPackages, collapsed]);

  // ── Timeline range ──
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const today = new Date();
    let earliest = addDays(today, -14);
    let latest = addDays(today, 90);

    for (const row of rows) {
      const s = safeParseDate(row.wp.startDate);
      const e = safeParseDate(row.wp.dueDate);
      if (s && isBefore(s, earliest)) earliest = addDays(s, -14);
      if (e && isAfter(e, latest)) latest = addDays(e, 14);
    }

    const start = startOfWeek(earliest, { weekStartsOn: 1 });
    const end = addWeeks(endOfWeek(latest, { weekStartsOn: 1 }), 2);
    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: differenceInDays(end, start),
    };
  }, [rows]);

  // ── Month / week headers ──
  const monthHeaders = useMemo(() => {
    const headers: { label: string; left: number; width: number }[] = [];
    let d = startOfMonth(timelineStart);
    while (isBefore(d, timelineEnd)) {
      const nextMonth = addMonths(d, 1);
      const from = isBefore(d, timelineStart) ? timelineStart : d;
      const to = isAfter(nextMonth, timelineEnd) ? timelineEnd : nextMonth;
      const left = differenceInDays(from, timelineStart) * dayWidth;
      const w = differenceInDays(to, from) * dayWidth;
      headers.push({ label: format(from, "MMM yyyy"), left, width: w });
      d = nextMonth;
    }
    return headers;
  }, [timelineStart, timelineEnd, dayWidth]);

  const weekLines = useMemo(() => {
    const lines: { left: number; label: string }[] = [];
    let d = startOfWeek(timelineStart, { weekStartsOn: 1 });
    while (isBefore(d, timelineEnd)) {
      const left = differenceInDays(d, timelineStart) * dayWidth;
      lines.push({ left, label: format(d, "d") });
      d = addWeeks(d, 1);
    }
    return lines;
  }, [timelineStart, timelineEnd, dayWidth]);

  // ── Today line ──
  const todayOffset = differenceInDays(new Date(), timelineStart) * dayWidth;

  // ── Bar positions ──
  const getBarPosition = useCallback(
    (wp: WorkPackage) => {
      const s = safeParseDate(wp.startDate);
      const e = safeParseDate(wp.dueDate);
      if (!s || !e) return null;
      const left = differenceInDays(s, timelineStart) * dayWidth;
      const width = Math.max(differenceInDays(e, s) * dayWidth, dayWidth);
      return { left, width };
    },
    [timelineStart, dayWidth]
  );

  // ── Drag handlers ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, wpId: string, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();
      const row = rows.find((r) => r.wp.id === wpId);
      if (!row) return;
      const s = safeParseDate(row.wp.startDate);
      const d = safeParseDate(row.wp.dueDate);
      if (!s || !d) return;
      setDragState({ wpId, mode, startX: e.clientX, origStartDate: s, origEndDate: d });
      setDragDelta(0);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [rows]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;
      const delta = e.clientX - dragState.startX;
      setDragDelta(delta);
    },
    [dragState]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragState) return;
    const daysDelta = Math.round(dragDelta / dayWidth);
    if (daysDelta !== 0) {
      const { wpId, mode, origStartDate, origEndDate } = dragState;
      let newStart = origStartDate;
      let newEnd = origEndDate;

      if (mode === "move") {
        newStart = addDays(origStartDate, daysDelta);
        newEnd = addDays(origEndDate, daysDelta);
      } else if (mode === "resize-left") {
        newStart = addDays(origStartDate, daysDelta);
        if (!isBefore(newStart, newEnd)) newStart = addDays(newEnd, -1);
      } else if (mode === "resize-right") {
        newEnd = addDays(origEndDate, daysDelta);
        if (!isAfter(newEnd, newStart)) newEnd = addDays(newStart, 1);
      }

      updateWorkPackage(wpId, {
        startDate: dateToStr(newStart),
        dueDate: dateToStr(newEnd),
      });
    }
    setDragState(null);
    setDragDelta(0);
  }, [dragState, dragDelta, dayWidth, updateWorkPackage]);

  // ── Dependency linking ──
  const handleBarClick = useCallback(
    (wpId: string) => {
      if (!linkingFrom) return;
      if (linkingFrom === wpId) {
        setLinkingFrom(null);
        return;
      }
      // Create FS dependency: linkingFrom → wpId
      const targetWP = workPackages.find((wp) => wp.id === wpId);
      if (!targetWP) return;
      const existing = targetWP.dependencies || [];
      if (existing.some((d) => d.targetId === linkingFrom)) {
        toast.info("Dependency already exists");
        setLinkingFrom(null);
        return;
      }
      updateWorkPackage(wpId, {
        dependencies: [...existing, { targetId: linkingFrom, type: "FS" as const }],
      });
      toast.success("Dependency created");
      setLinkingFrom(null);
    },
    [linkingFrom, workPackages, updateWorkPackage]
  );

  // ── Dependency arrows ──
  const depArrows = useMemo(() => {
    const arrows: {
      fromX: number; fromY: number;
      toX: number; toY: number;
      color: string;
      fromId: string; toId: string;
    }[] = [];

    const wpRowMap = new Map(rows.map((r) => [r.wp.id, r]));
    let colorIdx = 0;

    for (const row of rows) {
      const deps = row.wp.dependencies || [];
      for (const dep of deps) {
        const sourceRow = wpRowMap.get(dep.targetId);
        if (!sourceRow) continue;
        const sourcePos = getBarPosition(sourceRow.wp);
        const targetPos = getBarPosition(row.wp);
        if (!sourcePos || !targetPos) continue;

        const fromX = sourcePos.left + sourcePos.width;
        const fromY = sourceRow.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const toX = targetPos.left;
        const toY = row.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        arrows.push({
          fromX, fromY, toX, toY,
          color: DEP_COLORS[colorIdx % DEP_COLORS.length],
          fromId: dep.targetId, toId: row.wp.id,
        });
        colorIdx++;
      }
    }
    return arrows;
  }, [rows, getBarPosition]);

  // Build a set of WP IDs that are part of any dependency chain
  const depWPIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of depArrows) {
      ids.add(a.fromId);
      ids.add(a.toId);
    }
    return ids;
  }, [depArrows]);

  // ── Collapse toggles for the left panel ──
  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Build left panel labels ──
  const leftPanelRows = useMemo(() => {
    type LabelRow =
      | { type: "programme"; prog: Programme; level: 0 }
      | { type: "project"; proj: Project; level: number }
      | { type: "wp"; wp: WorkPackage; level: number };

    const result: LabelRow[] = [];

    const progProjects = new Map<string, Project[]>();
    const standaloneProjects: Project[] = [];

    for (const proj of projects) {
      if (proj.programmeId) {
        const list = progProjects.get(proj.programmeId) || [];
        list.push(proj);
        progProjects.set(proj.programmeId, list);
      } else {
        standaloneProjects.push(proj);
      }
    }

    // Only show programmes that have filtered projects
    const filteredProgIds = new Set(progProjects.keys());
    for (const prog of programmes) {
      if (!filteredProgIds.has(prog.id)) continue;
      result.push({ type: "programme", prog, level: 0 });
      if (!collapsed[`prog-${prog.id}`]) {
        const projs = progProjects.get(prog.id) || [];
        for (const proj of projs) {
          result.push({ type: "project", proj, level: 1 });
          if (!collapsed[`proj-${proj.id}`]) {
            const wps = workPackages.filter((wp) => wp.project === proj.name);
            for (const wp of wps) {
              result.push({ type: "wp", wp, level: 2 });
            }
          }
        }
      }
    }

    for (const proj of standaloneProjects) {
      result.push({ type: "project", proj, level: 0 });
      if (!collapsed[`proj-${proj.id}`]) {
        const wps = workPackages.filter((wp) => wp.project === proj.name);
        for (const wp of wps) {
          result.push({ type: "wp", wp, level: 1 });
        }
      }
    }

    return result;
  }, [programmes, projects, workPackages, collapsed]);

  const totalHeight = leftPanelRows.length * ROW_HEIGHT;

  // Map from WP id to its visual row index in leftPanelRows
  const wpToVisualRow = useMemo(() => {
    const map = new Map<string, number>();
    leftPanelRows.forEach((row, idx) => {
      if (row.type === "wp") map.set(row.wp.id, idx);
    });
    return map;
  }, [leftPanelRows]);

  // Recalculate arrows using visual row indices
  const visualArrows = useMemo(() => {
    const arrows: {
      fromX: number; fromY: number;
      toX: number; toY: number;
      color: string;
    }[] = [];
    let colorIdx = 0;

    for (const row of leftPanelRows) {
      if (row.type !== "wp") continue;
      const deps = row.wp.dependencies || [];
      for (const dep of deps) {
        const sourceVisIdx = wpToVisualRow.get(dep.targetId);
        const targetVisIdx = wpToVisualRow.get(row.wp.id);
        if (sourceVisIdx === undefined || targetVisIdx === undefined) continue;

        const sourceWP = workPackages.find((w) => w.id === dep.targetId);
        if (!sourceWP) continue;
        const sourcePos = getBarPosition(sourceWP);
        const targetPos = getBarPosition(row.wp);
        if (!sourcePos || !targetPos) continue;

        arrows.push({
          fromX: sourcePos.left + sourcePos.width,
          fromY: sourceVisIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          toX: targetPos.left,
          toY: targetVisIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          color: DEP_COLORS[colorIdx % DEP_COLORS.length],
        });
        colorIdx++;
      }
    }
    return arrows;
  }, [leftPanelRows, wpToVisualRow, workPackages, getBarPosition]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visual Planner</h1>
          <p className="text-sm text-muted-foreground">
            Drag to move, resize edges to adjust duration, click Link to create dependencies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={linkingFrom ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (linkingFrom) {
                setLinkingFrom(null);
              } else {
                toast.info("Click a source WP bar, then click the target WP to link them");
                setLinkingFrom("__awaiting_source__");
              }
            }}
          >
            <Link2 className="h-4 w-4 mr-1" />
            {linkingFrom ? "Cancel Link" : "Link WPs"}
          </Button>
          <Button variant="outline" size="icon" disabled={zoomIdx <= 0} onClick={() => setZoomIdx((z) => z - 1)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={zoomIdx >= ZOOM_STEPS.length - 1} onClick={() => setZoomIdx((z) => z + 1)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => { setEditingWP(undefined); setWpDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add WP
          </Button>
        </div>
      </div>

      {/* Gantt container */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="flex" style={{ height: `calc(100vh - 200px)` }}>
          {/* Left panel (WBS tree) */}
          <div
            className="flex-shrink-0 border-r bg-muted/30 flex flex-col"
            style={{ width: LEFT_PANEL_WIDTH }}
          >
            {/* Left header */}
            <div
              className="border-b bg-muted/50 px-3 flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0"
              style={{ height: HEADER_HEIGHT }}
            >
              Work Breakdown Structure
            </div>
            {/* Left rows */}
            <div ref={leftPanelRef} className="overflow-y-auto flex-1">
              {leftPanelRows.map((row, idx) => {
                if (row.type === "programme") {
                  const isCollapsed = collapsed[`prog-${row.prog.id}`];
                  return (
                    <div
                      key={`prog-${row.prog.id}`}
                      className="flex items-center gap-1 px-2 border-b cursor-pointer hover:bg-muted/50 text-xs font-semibold"
                      style={{ height: ROW_HEIGHT, paddingLeft: 8 }}
                      onClick={() => toggleCollapse(`prog-${row.prog.id}`)}
                    >
                      {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      <span className="truncate text-foreground">{row.prog.name}</span>
                    </div>
                  );
                }
                if (row.type === "project") {
                  const isCollapsed = collapsed[`proj-${row.proj.id}`];
                  return (
                    <div
                      key={`proj-${row.proj.id}`}
                      className="flex items-center gap-1 px-2 border-b cursor-pointer hover:bg-muted/50 text-xs font-medium"
                      style={{ height: ROW_HEIGHT, paddingLeft: 8 + row.level * 16 }}
                      onClick={() => toggleCollapse(`proj-${row.proj.id}`)}
                    >
                      {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      <span className="truncate text-foreground/80">{row.proj.name}</span>
                    </div>
                  );
                }
                // WP row
                return (
                  <div
                    key={`wp-${row.wp.id}`}
                    className="flex items-center gap-1.5 px-2 border-b text-xs hover:bg-muted/50 cursor-pointer"
                    style={{ height: ROW_HEIGHT, paddingLeft: 8 + row.level * 16 }}
                    onClick={() => { setEditingWP(row.wp); setWpDialogOpen(true); }}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: RAG_COLORS[row.wp.ragStatus] || RAG_COLORS.Green }}
                    />
                    <span className="truncate">{row.wp.workPackage}</span>
                    {depWPIds.has(row.wp.id) && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto flex-shrink-0">
                        <Link2 className="h-2.5 w-2.5" />
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel (timeline) */}
          <div
            ref={timelineRef}
            className="flex-1 overflow-auto"
            onScroll={handleTimelineScroll}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Timeline header */}
            <div className="sticky top-0 z-10 bg-card border-b" style={{ height: HEADER_HEIGHT, width: totalDays * dayWidth }}>
              {/* Month row */}
              <div className="relative h-6 border-b">
                {monthHeaders.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center px-2 text-[10px] font-semibold text-muted-foreground border-r bg-muted/20"
                    style={{ left: m.left, width: m.width }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              {/* Week row */}
              <div className="relative" style={{ height: HEADER_HEIGHT - 24 }}>
                {weekLines.map((w, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-end pb-1 text-[9px] text-muted-foreground border-r"
                    style={{ left: w.left, width: 7 * dayWidth }}
                  >
                    <span className="pl-1">{w.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bars area */}
            <div className="relative" style={{ width: totalDays * dayWidth, height: totalHeight }}>
              {/* Week gridlines */}
              {weekLines.map((w, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-r border-border/30"
                  style={{ left: w.left }}
                />
              ))}

              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-10"
                style={{ left: todayOffset }}
              />

              {/* Row backgrounds */}
              {leftPanelRows.map((row, idx) => (
                <div
                  key={idx}
                  className={cn("absolute w-full border-b", idx % 2 === 0 ? "bg-transparent" : "bg-muted/10")}
                  style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
                />
              ))}

              {/* SVG dependency arrows */}
              <svg
                className="absolute inset-0 pointer-events-none z-20"
                style={{ width: totalDays * dayWidth, height: totalHeight }}
              >
                <defs>
                  {DEP_COLORS.map((color, i) => (
                    <marker
                      key={i}
                      id={`arrow-${i}`}
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                    </marker>
                  ))}
                </defs>
                {visualArrows.map((a, i) => {
                  const colorIdx = DEP_COLORS.indexOf(a.color);
                  const midX = a.fromX + (a.toX - a.fromX) / 2;
                  // Curved path
                  const path =
                    a.fromY === a.toY
                      ? `M ${a.fromX} ${a.fromY} L ${a.toX} ${a.toY}`
                      : `M ${a.fromX} ${a.fromY} C ${midX} ${a.fromY}, ${midX} ${a.toY}, ${a.toX} ${a.toY}`;
                  return (
                    <path
                      key={i}
                      d={path}
                      fill="none"
                      stroke={a.color}
                      strokeWidth={2}
                      markerEnd={`url(#arrow-${colorIdx >= 0 ? colorIdx : 0})`}
                      opacity={0.7}
                    />
                  );
                })}
              </svg>

              {/* WP Bars */}
              {leftPanelRows.map((row, idx) => {
                if (row.type !== "wp") return null;
                const pos = getBarPosition(row.wp);
                if (!pos) return null;

                const isDragging = dragState?.wpId === row.wp.id;
                let barLeft = pos.left;
                let barWidth = pos.width;

                if (isDragging && dragState) {
                  const daysDelta = dragDelta / dayWidth;
                  if (dragState.mode === "move") {
                    barLeft = pos.left + dragDelta;
                  } else if (dragState.mode === "resize-left") {
                    barLeft = pos.left + dragDelta;
                    barWidth = pos.width - dragDelta;
                  } else if (dragState.mode === "resize-right") {
                    barWidth = pos.width + dragDelta;
                  }
                  barWidth = Math.max(barWidth, dayWidth);
                }

                const isLinkSource = linkingFrom === row.wp.id;

                return (
                  <div
                    key={row.wp.id}
                    className={cn(
                      "absolute rounded-md shadow-sm border transition-shadow z-10 group",
                      isDragging && "shadow-lg z-30 opacity-90",
                      linkingFrom && linkingFrom !== "__awaiting_source__" && "cursor-crosshair",
                      isLinkSource && "ring-2 ring-primary ring-offset-1"
                    )}
                    style={{
                      left: barLeft,
                      width: barWidth,
                      top: idx * ROW_HEIGHT + 6,
                      height: ROW_HEIGHT - 12,
                      backgroundColor: RAG_COLORS[row.wp.ragStatus] || RAG_COLORS.Green,
                      minWidth: dayWidth,
                    }}
                    onClick={() => {
                      if (linkingFrom === "__awaiting_source__") {
                        setLinkingFrom(row.wp.id);
                        toast.info("Now click the target WP");
                      } else if (linkingFrom) {
                        handleBarClick(row.wp.id);
                      }
                    }}
                  >
                    {/* Resize handle left */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/20 rounded-l-md"
                      onPointerDown={(e) => handlePointerDown(e, row.wp.id, "resize-left")}
                    />
                    {/* Drag body */}
                    <div
                      className="absolute inset-0 mx-2 cursor-grab active:cursor-grabbing flex items-center overflow-hidden"
                      onPointerDown={(e) => handlePointerDown(e, row.wp.id, "move")}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[10px] font-medium text-white truncate drop-shadow-sm select-none px-1">
                            {row.wp.workPackage}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-xs">
                          <p className="font-semibold">{row.wp.workPackage}</p>
                          <p className="text-muted-foreground">
                            {row.wp.startDate} → {row.wp.dueDate}
                          </p>
                          {row.wp.wpLead && <p>Lead: {row.wp.wpLead}</p>}
                          {(row.wp.dependencies?.length || 0) > 0 && (
                            <p>{row.wp.dependencies.length} dependenc{row.wp.dependencies.length === 1 ? "y" : "ies"}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {/* Resize handle right */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-black/20 rounded-r-md"
                      onPointerDown={(e) => handlePointerDown(e, row.wp.id, "resize-right")}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* WP Dialog for creating/editing */}
      <WPDialog
        open={wpDialogOpen}
        onOpenChange={setWpDialogOpen}
        wp={editingWP}
        onSave={(wp) => {
          if (editingWP) {
            updateWorkPackage(wp.id, wp);
          } else {
            addWorkPackage(wp);
          }
          setWpDialogOpen(false);
        }}
        onDelete={(id) => {
          useAppStore.getState().deleteWorkPackage(id);
          setWpDialogOpen(false);
        }}
      />
    </div>
  );
}
