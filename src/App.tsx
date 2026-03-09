import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useAppStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import MyActions from "@/pages/MyActions";
import WaitingFor from "@/pages/WaitingFor";
import SOPPage from "@/pages/SOPPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import WBSPlanner from "@/pages/WBSPlanner";
import VisualPlannerPage from "@/pages/VisualPlannerPage";
import KnowledgebasePage from "@/pages/KnowledgebasePage";
import InboxPage from "@/pages/InboxPage";

import AuthPage from "@/pages/AuthPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const isDevEnvironment = () => {
  const host = window.location.hostname;
  return host === 'localhost' || host.includes('preview--');
};

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  const dataLoaded = useAppStore((s) => s.dataLoaded);
  const isDev = isDevEnvironment();

  if (!isDev && (loading || (session && !dataLoaded))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isDev && !session) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/actions" element={<MyActions />} />
        
        <Route path="/waiting" element={<WaitingFor />} />
        <Route path="/visual-planner" element={<VisualPlannerPage />} />
        <Route path="/planner" element={<WBSPlanner />} />
        <Route path="/sop" element={<SOPPage />} />
        <Route path="/knowledgebase" element={<KnowledgebasePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (isDevEnvironment()) return <Navigate to="/" replace />;
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
