import { NavLink } from "react-router-dom";
import { CheckSquare, Clock, Inbox, FolderKanban, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/dashboard", label: "Pulse", icon: Gauge },
  { to: "/", label: "Actions", icon: CheckSquare },
  { to: "/inbox", label: "Capture", icon: Inbox },
  { to: "/waiting", label: "Waiting", icon: Clock },
  { to: "/projects", label: "Projects", icon: FolderKanban },
];

export function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-md safe-area-bottom md:hidden">
      <div className="flex items-stretch justify-around">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
