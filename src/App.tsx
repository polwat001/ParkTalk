import { useEffect } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { runDeadlineCheck, useCurrentUser } from "./lib/parktalk/store";
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import MyTasks from "./pages/MyTasks.tsx";
import Projects from "./pages/Projects.tsx";
import ProjectBoard from "./pages/ProjectBoard.tsx";
import TaskDetail from "./pages/TaskDetail.tsx";
import Workload from "./pages/Workload.tsx";
import CalendarPage from "./pages/CalendarPage.tsx";
import Notifications from "./pages/Notifications.tsx";
import ProfileSettings from "./pages/ProfileSettings.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminPermissions from "./pages/admin/AdminPermissions.tsx";
import AdminSettings from "./pages/admin/AdminSettings.tsx";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs.tsx";
import NotFound from "./pages/NotFound.tsx";

const DEADLINE_CHECK_MS = 60_000;

/**
 * Deadline monitor. In this frontend-only build it runs while any tab is open,
 * whether or not anyone is logged in; with a backend it moves to a server cron.
 */
function useDeadlineMonitor() {
  useEffect(() => {
    runDeadlineCheck();
    const timer = window.setInterval(runDeadlineCheck, DEADLINE_CHECK_MS);
    return () => window.clearInterval(timer);
  }, []);
}

/** Sends anyone not logged in to /login, remembering where they were going. */
function RequireAuth() {
  const user = useCurrentUser();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

const App = () => {
  useDeadlineMonitor();
  return (
    <TooltipProvider>
      <Sonner theme="dark" richColors position="top-right" />
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/my-tasks" element={<MyTasks />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id/board" element={<ProjectBoard />} />
              <Route path="/tasks/:id" element={<TaskDetail />} />
              <Route path="/team/workload" element={<Workload />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/profile" element={<ProfileSettings />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/permissions" element={<AdminPermissions />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  );
};

export default App;
