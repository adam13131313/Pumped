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

// 7:00 AM to 7:00 PM, 30-min slots = 24 slots
const START_HOUR = 7;
const END_HOUR = 19;
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const SLOT_HEIGHT = 56; // px per slot

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

export default function DailyPlanner() {
  const { actions, waitingItems } = useFilteredData();
  const todayIds = useAppStore((s) => s.todayIds);
  const scheduleMap = useAppStore((s) => s.scheduleMap);
  const scheduleTask = useAppStore((s) => s.scheduleTask);
  const unscheduleTask = useAppStore((s) => s.unscheduleTask);

  const [dragId, setDragId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // All gathered items
  const gatheredItems: TodayItem[] = useMemo(() => [
    ...actions.filter((a) => todayIds.has(a.id)).map((a) => ({ kind: "action" as const, data: a })),
    ...waitingItems.filter((w) => todayIds.has(w.id)).map((w) => ({ kind: "waiting" as const, data: w })),
  ], [actions, waitingItems, todayIds]);

  // Scheduled vs unscheduled
  const scheduledItems = useMemo(() => {
    const items: (TodayItem & { slot: number })[] = [];
    gatheredItems.forEach((item) => {
      const slot = scheduleMap[item.data.id];
      if (slot !== undefined) {
        items.push({ ...item, slot });
      }
    });
    return items.sort((a, b) => a.slot - b.slot);
  }, [gatheredItems, scheduleMap]);

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
    if (id) {
      scheduleTask(id, slot);
    }
    setDragId(null);
  }, [dragId, scheduleTask]);

  const handleDropOnPool = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) {
      unscheduleTask(id);
    }
    setDragId(null);
  }, [dragId, unscheduleTask]);

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
          {scheduledItems.map((item) => (
            <div
              key={item.data.id}
              className="absolute left-16 right-2"
              style={{ top: item.slot * SLOT_HEIGHT + 2 }}
            >
              <TaskCard
                item={item}
                onDragStart={handleDragStart}
                timeLabel={slotToTime(item.slot)}
                onRemove={() => unscheduleTask(item.data.id)}
              />
            </div>
          ))}
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
  onRemove,
}: {
  item: TodayItem;
  onDragStart: (e: React.DragEvent, id: string) => void;
  compact?: boolean;
  timeLabel?: string;
  onRemove?: () => void;
}) {
  const isAction = item.kind === "action";
  const a = isAction ? (item.data as Action) : null;
  const w = !isAction ? (item.data as WaitingItem) : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.data.id)}
      className={cn(
        "rounded-md border bg-card px-2.5 py-1.5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow group",
        isAction ? "border-primary/20" : "border-rag-amber/20"
      )}
    >
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
    </div>
  );
}
