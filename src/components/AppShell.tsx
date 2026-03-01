import { AppNav } from "./AppNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              P
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Programme Tracker</h1>
          </div>
          <AppNav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
