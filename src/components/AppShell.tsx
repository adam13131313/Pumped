import { useState } from "react";
import { AppNav } from "./AppNav";
import { GlobalFilter } from "./GlobalFilter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-30 flex h-screen flex-col border-r bg-card/90 backdrop-blur-md transition-all duration-200",
          collapsed ? "w-14" : "w-52"
        )}
      >
        {/* Brand */}
        <div className={cn("flex items-center gap-2.5 border-b px-3 py-3", collapsed && "justify-center px-1.5")}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            P
          </div>
          {!collapsed && (
            <h1 className="text-sm font-semibold tracking-tight truncate">Programme Tracker</h1>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto">
          <AppNav collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </div>

        {/* User actions */}
        <div className={cn("border-t p-2", collapsed ? "flex justify-center" : "px-3")}>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground w-full justify-start gap-2">
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="text-xs">Sign out</span>}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur-md">
          <div className="px-4 py-2 sm:px-6">
            <GlobalFilter />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 animate-fade-in">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
