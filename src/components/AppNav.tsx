import { NavLink as RouterNavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, CheckSquare, Clock, LucideIcon } from "lucide-react";

const links: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/actions", label: "My Actions", icon: CheckSquare },
  { to: "/waiting", label: "Waiting For", icon: Clock },
];

export function AppNav() {
  return (
    <nav className="flex items-center gap-1 rounded-lg bg-card p-1 shadow-sm border">
      {links.map(({ to, label, icon: Icon }) => (
        <RouterNavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </RouterNavLink>
      ))}
    </nav>
  );
}
