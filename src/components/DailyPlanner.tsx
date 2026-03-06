import { useState, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useFilteredData } from "@/hooks/useFilteredData";
import { Action, WaitingItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type TodayItem =
  | { kind: "action"; data: Action }
  | { kind: "waiting"; data: WaitingItem };

const START_HOUR = 7;
const END_HOUR = 24;
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const SLOT_HEIGHT = 40; // px per slot
const DEFAULT_DURATION = 2; // 2 slots = 1 hour

function slotToTime(slot: number): string {
  const totalMinutes = START_HOUR * 60 + slot * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function timeLabel(slot: number): string {
  const totalMinutes = START_HOUR * 60 + slot * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m !== 0) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} ${ampm}`;
}

function durationLabel(slots: number): string {
  const mins = slots * SLOT_MINUTES;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function DailyPlanner() {
  const { actions, waitingItems } = useFilteredData();
  const todayIds = useAppStore((s) => s.todayIds);
  const scheduleMap = useAppStore((s) => s.scheduleMap);
  const durationMap = useAppStore((s) => s.durationMap);
  const scheduleTask = useAppStore((s) => s.scheduleTask);
  const setTaskDuration = useAppStore((s) => s.setTaskDuration);
  const unscheduleTask = useAppStore((s) => s.unscheduleTask);

  const [dragId, setDragId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStartY = useRef(0);
  const resizeStartDuration = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const gatheredItems: TodayItem[] = useMemo(() => [
    ...actions.filter((a) => todayIds.has(a.id)).map((a) => ({ kind: "action" as const, data: a })),
    ...waitingItems.filter((w) => todayIds.has(w.id)).map((w) => ({ kind: "waiting" as const, data: w })),
  ], [actions, waitingItems, todayIds]);

  const scheduledItems = useMemo(() => {
    const items: (TodayItem & { slot: number; duration: number })[] = [];
    gatheredItems.forEach((item) => {
      const slot = scheduleMap[item.data.id];
      if (slot !== undefined) {
        items.push({ ...item, slot, duration: durationMap[item.data.id] ?? DEFAULT_DURATION });
      }
    });
    return items.sort((a, b) => a.slot - b.slot);
  }, [gatheredItems, scheduleMap, durationMap]);

  const unscheduledItems = useMemo(
    () => gatheredItems.filter((item) => scheduleMap[item.data.id] === undefined),
    [gatheredItems, scheduleMap]
  );

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDropOnSlot = useCallback((e: React.DragEvent, slot: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) scheduleTask(id, slot);
    setDragId(null);
  }, [dragId, scheduleTask]);

  const handleDropOnPool = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) unscheduleTask(id);
    setDragId(null);
  }, [dragId, unscheduleTask]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, id: string, currentDuration: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingId(id);
    resizeStartY.current = e.clientY;
    resizeStartDuration.current = currentDuration;

    const onMouseMove = (ev: MouseEvent) => {
      const deltaY = ev.clientY - resizeStartY.current;
      const deltaSlots = Math.round(deltaY / SLOT_HEIGHT);
      const newDuration = Math.max(1, resizeStartDuration.current + deltaSlots);
      const maxDuration = TOTAL_SLOTS - (scheduleMap[id] ?? 0);
      setTaskDuration(id, Math.min(newDuration, maxDuration));
    };

    const onMouseUp = () => {
      setResizingId(null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [scheduleMap, setTaskDuration]);

  if (gatheredItems.length === 0) return null;

  return (
    <div className="flex gap-4 h-full">
      {/* Unscheduled pool */}
      <div
        className="w-64 shrink-0 flex flex-col"
        onDragOver={handleDragOver}
        onDrop={handleDropOnPool}
      >
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
          Unscheduled ({unscheduledItems.length})
        </h3>
        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {unscheduledItems.map((item) => (
            <TaskCard
              key={item.data.id}
              item={item}
              onDragStart={handleDragStart}
              compact
            />
          ))}
          {unscheduledItems.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-4 text-center">
              All tasks scheduled! Drag here to unschedule.
            </p>
          )}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto border rounded-lg bg-card">
        <div
          ref={gridRef}
          className="relative"
          style={{ height: TOTAL_SLOTS * SLOT_HEIGHT }}
        >
          {/* Time slot rows */}
          {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
            const label = timeLabel(i);
            return (
              <div
                key={i}
                className={cn(
                  "absolute left-0 right-0 border-b border-border/50 flex",
                  dragId && "hover:bg-accent/30"
                )}
                style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnSlot(e, i)}
              >
                <div className="w-16 shrink-0 text-xs text-muted-foreground pr-2 text-right pt-1 select-none">
                  {label}
                </div>
                <div className="flex-1 border-l border-border/30" />
              </div>
            );
          })}

          {/* Scheduled task cards overlaid */}
          {scheduledItems.map((item) => {
            const height = item.duration * SLOT_HEIGHT - 4;
            return (
              <div
                key={item.data.id}
                className="absolute left-16 right-2"
                style={{
                  top: item.slot * SLOT_HEIGHT + 2,
                  height,
                  zIndex: resizingId === item.data.id ? 20 : 10,
                }}
              >
                <TaskCard
                  item={item}
                  onDragStart={handleDragStart}
                  timeLabel={`${slotToTime(item.slot)} – ${slotToTime(item.slot + item.duration)}`}
                  duration={item.duration}
                  height={height}
                  onResizeStart={(e) => handleResizeStart(e, item.data.id, item.duration)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  item,
  onDragStart,
  compact,
  timeLabel: time,
  duration,
  height,
  onResizeStart,
}: {
  item: TodayItem;
  onDragStart: (e: React.DragEvent, id: string) => void;
  compact?: boolean;
  timeLabel?: string;
  duration?: number;
  height?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
}) {
  const isAction = item.kind === "action";
  const a = isAction ? (item.data as Action) : null;
  const w = !isAction ? (item.data as WaitingItem) : null;

  // For scheduled blocks: determine if we're in a tiny slot
  const isSmall = !compact && height !== undefined && height < SLOT_HEIGHT * 2;
  const isTiny = !compact && height !== undefined && height <= SLOT_HEIGHT;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.data.id)}
      className={cn(
        "rounded-md border bg-card cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow group relative",
        isAction ? "border-primary/20 bg-primary/5" : "border-rag-amber/20 bg-rag-amber/5",
        compact ? "px-2.5 py-1.5" : isTiny ? "px-1.5 py-0.5" : isSmall ? "px-2 py-1" : "px-2.5 pt-1.5 pb-0",
        !compact && height ? "overflow-hidden" : ""
      )}
      style={!compact && height ? { height } : undefined}
    >
      {isTiny ? (
        /* Tiny: single-line with all info squeezed horizontally */
        <div className="flex items-center gap-1 h-full min-w-0">
          <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          {isAction ? (
            <CheckCircle2 className="h-2.5 w-2.5 text-primary shrink-0" />
          ) : (
            <Clock className="h-2.5 w-2.5 text-rag-amber shrink-0" />
          )}
          <span className="text-[10px] font-medium truncate flex-1">
            {isAction ? a!.task : w!.description}
          </span>
          {duration && (
            <span className="text-[9px] text-muted-foreground shrink-0">{durationLabel(duration)}</span>
          )}
        </div>
      ) : isSmall ? (
        /* Small: two compact lines */
        <div className="flex items-start gap-1 min-w-0">
          <GripVertical className="h-3 w-3 text-muted-foreground/40 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {isAction ? (
                <CheckCircle2 className="h-2.5 w-2.5 text-primary shrink-0" />
              ) : (
                <Clock className="h-2.5 w-2.5 text-rag-amber shrink-0" />
              )}
              <span className="text-[11px] font-medium truncate">
                {isAction ? a!.task : w!.description}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {time && <span className="text-[9px] font-mono text-muted-foreground">{time}</span>}
              {duration && <span className="text-[9px] text-muted-foreground">({durationLabel(duration)})</span>}
            </div>
          </div>
        </div>
      ) : (
        /* Normal: full layout */
        <div className="flex items-start gap-1.5">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isAction ? (
                <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
              ) : (
                <Clock className="h-3 w-3 text-rag-amber shrink-0" />
              )}
              <span className="text-xs font-medium truncate">
                {isAction ? a!.task : w!.description}
              </span>
            </div>
            {!compact && (
              <div className="flex items-center gap-2 mt-0.5">
                {time && (
                  <span className="text-[10px] font-mono text-muted-foreground">{time}</span>
                )}
                {duration && (
                  <span className="text-[10px] text-muted-foreground">({durationLabel(duration)})</span>
                )}
                {a?.project && (
                  <span className="text-[10px] text-muted-foreground truncate">{a.project}</span>
                )}
                {a?.priority && (
                  <Badge variant="outline" className={cn(
                    "text-[10px] px-1 py-0 h-4",
                    a.priority === "High" ? "text-rag-red border-rag-red/30" : ""
                  )}>
                    {a.priority}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resize handle */}
      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize flex items-center justify-center hover:bg-muted/60 transition-colors"
          onMouseDown={onResizeStart}
        >
          <div className="w-8 h-0.5 rounded-full bg-muted-foreground/30" />
        </div>
      )}
    </div>
  );
}
