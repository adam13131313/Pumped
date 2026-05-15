import { HealthScoreResult, scoreColor } from "@/lib/healthScore";
import { cn } from "@/lib/utils";

export function HealthRing({ result, size = 160 }: { result: HealthScoreResult; size?: number }) {
  const { score } = result;
  const tone = scoreColor(score);
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  const colorClass = {
    green: "stroke-rag-green",
    amber: "stroke-rag-amber",
    red: "stroke-rag-red",
  }[tone];

  const textTone = { green: "text-rag-green", amber: "text-rag-amber", red: "text-rag-red" }[tone];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} className="stroke-muted" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn("transition-all duration-700", colorClass)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={cn("text-4xl font-bold tabular-nums", textTone)}>{score}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Health</div>
      </div>
    </div>
  );
}

export function HealthBreakdown({ result }: { result: HealthScoreResult }) {
  const rows: Array<{ label: string; value: number; tone: "green" | "amber" | "red" | "neutral" }> = [
    { label: "Base", value: result.components.base, tone: "neutral" },
    { label: "On-time delivery", value: result.components.onTime, tone: result.components.onTime >= 20 ? "green" : result.components.onTime >= 10 ? "amber" : "red" },
    { label: "Overdue waiting", value: result.components.overdueWaiting, tone: result.components.overdueWaiting === 0 ? "green" : result.components.overdueWaiting >= -7 ? "amber" : "red" },
    { label: "Routine streak", value: result.components.routine, tone: result.components.routine >= 14 ? "green" : result.components.routine >= 7 ? "amber" : "red" },
    { label: "RAG red penalty", value: result.components.rag, tone: result.components.rag === 0 ? "green" : result.components.rag >= -5 ? "amber" : "red" },
    { label: "Inbox lag", value: result.components.inboxLag, tone: result.components.inboxLag === 0 ? "green" : result.components.inboxLag >= -5 ? "amber" : "red" },
  ];

  const toneClass = (t: string) => ({
    green: "text-rag-green",
    amber: "text-rag-amber",
    red: "text-rag-red",
    neutral: "text-muted-foreground",
  } as Record<string, string>)[t];

  return (
    <div className="space-y-1.5 text-xs w-full">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between">
          <span className="text-muted-foreground">{r.label}</span>
          <span className={cn("font-mono font-semibold", toneClass(r.tone))}>
            {r.value > 0 ? `+${r.value}` : r.value}
          </span>
        </div>
      ))}
    </div>
  );
}
