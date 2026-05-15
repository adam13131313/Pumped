import { Action } from "@/lib/types";
import { addDays, addWeeks, format, startOfWeek, parseISO, isSameDay } from "date-fns";
import { WidgetEmpty } from "./WidgetTitle";
import { CalendarDays } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function WorkloadHeatmap({ actions }: { actions: Action[] }) {
  // Build a map dueDate -> count
  const counts = new Map<string, number>();
  for (const a of actions) {
    if (!a.dueDate) continue;
    counts.set(a.dueDate, (counts.get(a.dueDate) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return <WidgetEmpty icon={CalendarDays} message="No actions have due dates yet." />;
  }

  // 12 weeks (Mon..Fri)
  const today = new Date();
  const startWeek = startOfWeek(addWeeks(today, -11), { weekStartsOn: 1 });
  const weeks: Date[] = [];
  for (let w = 0; w < 12; w++) weeks.push(addWeeks(startWeek, w));

  const intensity = (n: number): string => {
    if (n === 0) return "bg-muted/40";
    if (n <= 1) return "bg-primary/15";
    if (n <= 2) return "bg-primary/30";
    if (n <= 4) return "bg-primary/50";
    if (n <= 6) return "bg-primary/70";
    return "bg-primary";
  };

  const dayLabels = ["M", "T", "W", "T", "F"];

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <div className="w-4" />
        {weeks.map((wk) => (
          <div key={wk.toISOString()} className="flex-1 text-center text-[9px] text-muted-foreground font-mono">
            {format(wk, "MM/dd")}
          </div>
        ))}
      </div>
      {dayLabels.map((d, dayIdx) => (
        <div key={d + dayIdx} className="flex items-center gap-1">
          <div className="w-4 text-[10px] text-muted-foreground text-center">{d}</div>
          {weeks.map((wk) => {
            const day = addDays(wk, dayIdx);
            const dayKey = format(day, "yyyy-MM-dd");
            const n = counts.get(dayKey) ?? 0;
            const isToday = isSameDay(day, today);
            return (
              <Tooltip key={dayKey} delayDuration={0}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex-1 h-5 rounded-sm transition-all hover:ring-2 hover:ring-primary/50 ${intensity(n)} ${isToday ? "ring-1 ring-foreground/40" : ""}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {format(day, "EEE MMM d")} — {n} task{n !== 1 ? "s" : ""}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
      <div className="flex items-center justify-end gap-2 pt-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        <div className="h-2.5 w-2.5 rounded-sm bg-muted/40" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary/15" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary/30" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary/50" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary/70" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
        <span>More</span>
      </div>
    </div>
  );
}
