import { NavLink as RouterNavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CheckSquare, Clock, BookOpen, FolderKanban,
  Sparkles, Library, Inbox, LucideIcon, PanelLeftClose, PanelLeft, GanttChart, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const links: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/actions", label: "My Actions", icon: CheckSquare },
  { to: "/waiting", label: "Waiting For", icon: Clock },
  { to: "/inbox", label: "Rapid Capture", icon: Inbox },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/visual-planner", label: "Visual Planner", icon: GanttChart },
  { to: "/planner", label: "WBS Planner", icon: Sparkles },
  { to: "/sop", label: "SOP", icon: BookOpen },
  { to: "/knowledgebase", label: "Knowledgebase", icon: Library },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppNav({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  return (
    <nav
      className={cn(
        "flex flex-col gap-0.5 py-2 transition-all duration-200",
        collapsed ? "px-1.5" : "px-2"
      )}
    >
      <div className={cn("flex items-center mb-2", collapsed ? "justify-center" : "justify-between px-2")}>
        {!collapsed && (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Navigation</span>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onToggle}>
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      {links.map(({ to, label, icon: Icon }) => {
        const linkContent = (
          <RouterNavLink
            key={to}
            to={to}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && label}
          </RouterNavLink>
        );

        if (collapsed) {
          return (
            <Tooltip key={to} delayDuration={0}>
              <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
            </Tooltip>
          );
        }

        return <div key={to}>{linkContent}</div>;
      })}
    </nav>
  );
}
