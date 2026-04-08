import { useState, useMemo, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useFilteredData } from "@/hooks/useFilteredData";
import { Action, WaitingItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ActionDialog } from "@/components/ActionDialog";
import { WaitingDialog } from "@/components/WaitingDialog";
import { Target, Plus, X, CheckCircle2, Clock, ListChecks, CalendarCheck, GripVertical, ChevronDown, CalendarPlus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type TodayItem =
  | { kind: "action"; data: Action }
  | { kind: "waiting"; data: WaitingItem };

type ViewMode = "gathered" | "due-today";

function TaskCard({
  item,
  onRemove,
  onSetDueToday,
  draggable = false,
  dragHandlers,
  isDragOver,
}: {
  item: TodayItem;
  onRemove?: (id: string) => void;
  onSetDueToday?: (item: TodayItem) => void;
  draggable?: boolean;
  dragHandlers?: {
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
  isDragOver?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = item.data.id;
  const isAction = item.kind === "action";
  const a = isAction ? (item.data as Action) : null;
  const w = !isAction ? (item.data as WaitingItem) : null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const hasDueToday = isAction
    ? a!.dueDate?.slice(0, 10) === todayStr
    : w!.dueBy?.slice(0, 10) === todayStr;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        draggable={draggable}
        onDragStart={dragHandlers?.onDragStart}
        onDragOver={dragHandlers?.onDragOver}
        onDragEnd={dragHandlers?.onDragEnd}
        className={cn(
          "rounded-lg border bg-card group hover:border-primary/30 transition-all",
          draggable && "cursor-grab active:cursor-grabbing",
          isDragOver && "border-primary/50 bg-primary/5"
        )}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-start gap-2 p-3 cursor-pointer select-none">
            {draggable && (
              <div className="shrink-0 pt-1 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                {a?.priority && (
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    a.priority === "High" ? "bg-rag-red/10 text-rag-red border-rag-red/20" :
                    a.priority === "Medium" ? "bg-rag-amber/10 text-rag-amber border-rag-amber/20" :
                    "bg-muted text-muted-foreground"
                  )}>{a.priority}</Badge>
                )}
                {a?.status && <Badge variant="secondary" className="text-xs">{a.status}</Badge>}
                {w?.status && <Badge variant="secondary" className="text-xs">{w.status}</Badge>}
                {a?.labels && a.labels.length > 0 && a.labels.map((label) => (
                  <Badge key={label} variant="outline" className="text-xs bg-accent/50">{label}</Badge>
                ))}
              </div>
              <p className="font-medium text-sm">{isAction ? a!.task : w!.description}</p>
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                {isAction && a!.project && <span>{a!.project}</span>}
                {isAction && a!.dueDate && <span className="font-mono">Due: {a!.dueDate}</span>}
                {!isAction && w!.fromWhom && <span>From: {w!.fromWhom}</span>}
                {!isAction && w!.dueBy && <span className="font-mono">Due: {w!.dueBy}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onSetDueToday && !hasDueToday && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDueToday(item);
                  }}
                  title="Set due date to today"
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                >
                  <CalendarPlus className="h-4 w-4" />
                </button>
              )}
              {onRemove && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(id);
                  }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                expanded && "rotate-180"
              )} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t mx-3 mt-0 pt-3 space-y-2 text-sm">
            {isAction ? (
              <>
                {a!.project && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Project:</span>
                    <span>{a!.project}</span>
                  </div>
                )}
                {a!.workPackage && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Work Package:</span>
                    <span>{a!.workPackage}</span>
                  </div>
                )}
                {a!.startDate && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Start Date:</span>
                    <span className="font-mono">{a!.startDate}</span>
                  </div>
                )}
                {a!.dueDate && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Due Date:</span>
                    <span className="font-mono">{a!.dueDate}</span>
                  </div>
                )}
                {a!.notes && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Notes:</span>
                    <span className="whitespace-pre-wrap">{a!.notes}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {w!.fromWhom && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">From:</span>
                    <span>{w!.fromWhom}</span>
                  </div>
                )}
                {w!.projectWP && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Project/WP:</span>
                    <span>{w!.projectWP}</span>
                  </div>
                )}
                {w!.askedOn && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Asked On:</span>
                    <span className="font-mono">{w!.askedOn}</span>
                  </div>
                )}
                {w!.dueBy && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Due By:</span>
                    <span className="font-mono">{w!.dueBy}</span>
                  </div>
                )}
                {w!.notes && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Notes:</span>
                    <span className="whitespace-pre-wrap">{w!.notes}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DraggableSection({
  title,
  icon,
  items,
  onRemove,
  onReorder,
  onSetDueToday,
  colorClass,
}: {
  title: string;
  icon: React.ReactNode;
  items: TodayItem[];
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onSetDueToday: (item: TodayItem) => void;
  colorClass: string;
}) {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItem.current = index;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      onReorder(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDragOverIndex(null);
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className={cn("text-sm font-semibold flex items-center gap-2", colorClass)}>
        {icon} {title}
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
      </h2>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <TaskCard
            key={item.data.id}
            item={item}
            onRemove={onRemove}
            onSetDueToday={onSetDueToday}
            draggable
            dragHandlers={{
              onDragStart: () => handleDragStart(index),
              onDragOver: (e) => handleDragOver(e, index),
              onDragEnd: handleDragEnd,
            }}
            isDragOver={dragOverIndex === index}
          />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { actions, waitingItems } = useFilteredData();
  const todayIds = useAppStore((s) => s.todayIds);
  const todayOrder = useAppStore((s) => s.todayOrder);
  const addToday = useAppStore((s) => s.addToday);
  const removeToday = useAppStore((s) => s.removeToday);
  const clearToday = useAppStore((s) => s.clearToday);
  const reorderToday = useAppStore((s) => s.reorderToday);
  const updateAction = useAppStore((s) => s.updateAction);
  const updateWaitingItem = useAppStore((s) => s.updateWaitingItem);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("gathered");

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleSetDueToday = useCallback((item: TodayItem) => {
    if (item.kind === "action") {
      updateAction(item.data.id, { dueDate: todayStr });
    } else {
      updateWaitingItem(item.data.id, { dueBy: todayStr });
    }
  }, [updateAction, updateWaitingItem, todayStr]);

  // Build gathered items in stored order, separated by type
  const { gatheredActions, gatheredWaiting } = useMemo(() => {
    const actionMap = new Map(actions.filter((a) => todayIds.has(a.id)).map((a) => [a.id, a]));
    const waitingMap = new Map(waitingItems.filter((w) => todayIds.has(w.id)).map((w) => [w.id, w]));

    const orderedActionIds = todayOrder.filter((id) => actionMap.has(id));
    const orderedWaitingIds = todayOrder.filter((id) => waitingMap.has(id));

    actionMap.forEach((_, id) => { if (!orderedActionIds.includes(id)) orderedActionIds.push(id); });
    waitingMap.forEach((_, id) => { if (!orderedWaitingIds.includes(id)) orderedWaitingIds.push(id); });

    return {
      gatheredActions: orderedActionIds.map((id) => ({ kind: "action" as const, data: actionMap.get(id)! })),
      gatheredWaiting: orderedWaitingIds.map((id) => ({ kind: "waiting" as const, data: waitingMap.get(id)! })),
    };
  }, [actions, waitingItems, todayIds, todayOrder]);

  const totalGathered = gatheredActions.length + gatheredWaiting.length;

  const dueTodayItems: TodayItem[] = useMemo(() => {
    const dueActions = actions
      .filter((a) => a.status !== "Complete" && a.dueDate && a.dueDate.slice(0, 10) === todayStr)
      .map((a) => ({ kind: "action" as const, data: a }));
    const dueWaiting = waitingItems
      .filter((w) => w.status !== "Received" && w.dueBy && w.dueBy.slice(0, 10) === todayStr)
      .map((w) => ({ kind: "waiting" as const, data: w }));
    return [...dueActions, ...dueWaiting];
  }, [actions, waitingItems, todayStr]);

  const availableActions = actions.filter((a) => !todayIds.has(a.id) && a.status !== "Complete");
  const availableWaiting = waitingItems.filter((w) => !todayIds.has(w.id) && w.status !== "Received");

  const handleReorderActions = useCallback((fromIndex: number, toIndex: number) => {
    const actionIds = todayOrder.filter((id) => actions.some((a) => a.id === id && todayIds.has(id)));
    const waitingIds = todayOrder.filter((id) => waitingItems.some((w) => w.id === id && todayIds.has(id)));
    actions.filter((a) => todayIds.has(a.id) && !actionIds.includes(a.id)).forEach((a) => actionIds.push(a.id));

    const item = actionIds.splice(fromIndex, 1)[0];
    actionIds.splice(toIndex, 0, item);
    reorderToday([...actionIds, ...waitingIds]);
  }, [todayOrder, actions, waitingItems, todayIds, reorderToday]);

  const handleReorderWaiting = useCallback((fromIndex: number, toIndex: number) => {
    const actionIds = todayOrder.filter((id) => actions.some((a) => a.id === id && todayIds.has(id)));
    const waitingIds = todayOrder.filter((id) => waitingItems.some((w) => w.id === id && todayIds.has(id)));
    waitingItems.filter((w) => todayIds.has(w.id) && !waitingIds.includes(w.id)).forEach((w) => waitingIds.push(w.id));

    const item = waitingIds.splice(fromIndex, 1)[0];
    waitingIds.splice(toIndex, 0, item);
    reorderToday([...actionIds, ...waitingIds]);
  }, [todayOrder, actions, waitingItems, todayIds, reorderToday]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" /> Today's Focus
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {viewMode === "gathered"
              ? totalGathered === 0
                ? "Gather the tasks you'll work on today"
                : `${totalGathered} item${totalGathered !== 1 ? "s" : ""} gathered`
              : dueTodayItems.length === 0
                ? "No tasks due today"
                : `${dueTodayItems.length} item${dueTodayItems.length !== 1 ? "s" : ""} due today`}
          </p>
        </div>
        <div className="flex gap-2">
          {viewMode === "gathered" && totalGathered > 0 && (
            <Button variant="outline" size="sm" onClick={clearToday}>
              Clear All
            </Button>
          )}
          {viewMode === "gathered" && (
            <Button onClick={() => setPickerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Gather Tasks
            </Button>
          )}
        </div>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 rounded-lg border bg-card p-1 w-fit">
        <button
          onClick={() => setViewMode("gathered")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            viewMode === "gathered" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          )}
        >
          <Target className="h-4 w-4" /> Gathered
          {totalGathered > 0 && (
            <span className={cn(
              "ml-1 text-xs rounded-full px-1.5 py-0.5",
              viewMode === "gathered" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {totalGathered}
            </span>
          )}
        </button>
        <button
          onClick={() => setViewMode("due-today")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            viewMode === "due-today" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          )}
        >
          <CalendarCheck className="h-4 w-4" /> Due Today
          {dueTodayItems.length > 0 && (
            <span className={cn(
              "ml-1 text-xs rounded-full px-1.5 py-0.5",
              viewMode === "due-today" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {dueTodayItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Gathered view */}
      {viewMode === "gathered" ? (
        totalGathered === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-base font-medium mb-1">No tasks gathered yet</p>
              <p className="text-sm">Click "Gather Tasks" to pick what you'll focus on today.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <DraggableSection
              title="My Actions"
              icon={<CheckCircle2 className="h-4 w-4" />}
              items={gatheredActions}
              onRemove={removeToday}
              onReorder={handleReorderActions}
              onSetDueToday={handleSetDueToday}
              colorClass="text-primary"
            />
            <DraggableSection
              title="Waiting For"
              icon={<Clock className="h-4 w-4" />}
              items={gatheredWaiting}
              onRemove={removeToday}
              onReorder={handleReorderWaiting}
              onSetDueToday={handleSetDueToday}
              colorClass="text-rag-amber"
            />
          </div>
        )
      ) : (
        dueTodayItems.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-base font-medium mb-1">Nothing due today</p>
              <p className="text-sm">No actions or waiting items have today's date as their due date.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {dueTodayItems.map((item) => (
              <TaskCard
                key={item.data.id}
                item={item}
                onSetDueToday={handleSetDueToday}
              />
            ))}
          </div>
        )
      )}

      {/* Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Gather Tasks for Today</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {availableActions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> My Actions
                  </h3>
                  <div className="space-y-1">
                    {availableActions.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={todayIds.has(a.id)}
                          onCheckedChange={(checked) => checked ? addToday(a.id) : removeToday(a.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{a.task}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                            {a.project && <span>{a.project}</span>}
                            {a.priority && <span className={a.priority === "High" ? "text-rag-red" : ""}>{a.priority}</span>}
                            {a.dueDate && <span className="font-mono">{a.dueDate}</span>}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {availableWaiting.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Waiting For
                  </h3>
                  <div className="space-y-1">
                    {availableWaiting.map((w) => (
                      <label
                        key={w.id}
                        className="flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={todayIds.has(w.id)}
                          onCheckedChange={(checked) => checked ? addToday(w.id) : removeToday(w.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{w.description}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                            {w.fromWhom && <span>From: {w.fromWhom}</span>}
                            {w.dueBy && <span className="font-mono">{w.dueBy}</span>}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {availableActions.length === 0 && availableWaiting.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">All tasks have been gathered already.</p>
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setPickerOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
