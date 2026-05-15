import { Card, CardContent } from "@/components/ui/card";
import { WidgetTitle } from "./WidgetTitle";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  info,
  value,
  sub,
  tone = "neutral",
}: {
  title: string;
  info: string;
  value: string | number;
  sub?: string;
  tone?: "green" | "amber" | "red" | "neutral";
}) {
  const toneClass = {
    green: "text-rag-green",
    amber: "text-rag-amber",
    red: "text-rag-red",
    neutral: "text-foreground",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4 space-y-1.5">
        <WidgetTitle title={title} info={info} />
        <div className={cn("text-3xl font-bold tabular-nums tracking-tight", toneClass)}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
