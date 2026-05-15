import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export function WidgetTitle({ title, info }: { title: string; info: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-semibold tracking-tight">{title}</span>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="What this means">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {info}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function WidgetEmpty({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/50 mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
