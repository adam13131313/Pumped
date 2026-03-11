import { useState } from "react";
import { AppNav } from "./AppNav";
import { GlobalFilter } from "./GlobalFilter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileBottomNav } from "./MobileBottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className={cn("flex items-center gap-2.5 border-b px-3 py-3", !isMobile && collapsed && "justify-center px-1.5")}>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          P
        </div>
        {(isMobile || !collapsed) && (
          <h1 className="text-sm font-semibold tracking-tight truncate">Programme Tracker</h1>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto">
        <AppNav
          collapsed={isMobile ? false : collapsed}
          onToggle={isMobile ? () => setMobileOpen(false) : () => setCollapsed(!collapsed)}
          onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
        />
      </div>

      {/* User actions */}
      <div className={cn("border-t p-2", !isMobile && collapsed ? "flex justify-center" : "px-3")}>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground w-full justify-start gap-2">
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {(isMobile || !collapsed) && <span className="text-xs">Sign out</span>}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          className={cn(
            "sticky top-0 z-30 flex h-screen flex-col border-r bg-card/90 backdrop-blur-md transition-all duration-200",
            collapsed ? "w-14" : "w-52"
          )}
        >
          {sidebarContent}
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur-md">
          <div className="flex items-center gap-2 px-3 py-2 sm:px-6">
            {isMobile && (
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0 flex flex-col">
                  {sidebarContent}
                </SheetContent>
              </Sheet>
            )}
            <GlobalFilter />
          </div>
        </header>
        <main className={cn("flex-1 px-3 py-4 sm:px-6 sm:py-6 animate-fade-in", isMobile && "pb-20")}>
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}
