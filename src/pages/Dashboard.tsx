import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Action, WaitingItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Target, Plus, X, CheckCircle2, Clock, ListChecks } from "lucide-react";

type TodayItem =
  | { kind: "action"; data: Action }
  | { kind: "waiting"; data: WaitingItem };

export default function Dashboard() {
  const actions = useAppStore((s) => s.actions);
  const waitingItems = useAppStore((s) => s.waitingItems);
  const todayIds = useAppStore((s) => s.todayIds);
  const addToday = useAppStore((s) => s.addToday);
  const removeToday = useAppStore((s) => s.removeToday);
  const clearToday = useAppStore((s) => s.clearToday);

  const [pickerOpen, setPickerOpen] = useState(false);

  // Gathered items
  const todayItems: TodayItem[] = [
    ...actions.filter((a) => todayIds.has(a.id)).map((a) => ({ kind: "action" as const, data: a })),
    ...waitingItems.filter((w) => todayIds.has(w.id)).map((w) => ({ kind: "waiting" as const, data: w })),
  ];

  // Available to pick (not already gathered)
  const availableActions = actions.filter((a) => !todayIds.has(a.id) && a.status !== "Complete");
  const availableWaiting = waitingItems.filter((w) => !todayIds.has(w.id) && w.status !== "Received");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" /> Today's Focus
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {todayItems.length === 0
              ? "Gather the tasks you'll work on today"
              : `${todayItems.length} item${todayItems.length !== 1 ? "s" : ""} gathered`}
          </p>
        </div>
        <div className="flex gap-2">
          {todayItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearToday}>
              Clear All
            </Button>
          )}
          <Button onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Gather Tasks
          </Button>
        </div>
      </div>

      {/* Today's items */}
      {todayItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium mb-1">No tasks gathered yet</p>
            <p className="text-sm">Click "Gather Tasks" to pick what you'll focus on today.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {todayItems.map((item) => {
            const id = item.data.id;
            const isAction = item.kind === "action";
            const a = isAction ? (item.data as Action) : null;
            const w = !isAction ? (item.data as WaitingItem) : null;

            return (
              <div
                key={id}
                className="flex items-start gap-3 rounded-lg border bg-card p-4 group hover:border-primary/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={isAction ? "bg-primary/10 text-primary border-primary/20" : "bg-rag-amber/10 text-rag-amber border-rag-amber/20"}>
                      {isAction ? <><CheckCircle2 className="h-3 w-3 mr-1" />My Action</> : <><Clock className="h-3 w-3 mr-1" />Waiting For</>}
                    </Badge>
                    {a?.priority && (
                      <Badge variant="outline" className={
                        a.priority === "High" ? "bg-rag-red/10 text-rag-red border-rag-red/20" :
                        a.priority === "Medium" ? "bg-rag-amber/10 text-rag-amber border-rag-amber/20" :
                        "bg-muted text-muted-foreground"
                      }>{a.priority}</Badge>
                    )}
                    {a?.status && <Badge variant="secondary" className="text-xs">{a.status}</Badge>}
                    {w?.status && <Badge variant="secondary" className="text-xs">{w.status}</Badge>}
                  </div>
                  <p className="font-medium text-sm">{isAction ? a!.task : w!.description}</p>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    {isAction && a!.project && <span>{a!.project}</span>}
                    {isAction && a!.dueDate && <span className="font-mono">Due: {a!.dueDate}</span>}
                    {!isAction && w!.fromWhom && <span>From: {w!.fromWhom}</span>}
                    {!isAction && w!.dueBy && <span className="font-mono">Due: {w!.dueBy}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => removeToday(id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
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
