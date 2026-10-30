import { Bell, LogOut, Menu, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../services/api";
import { useAuth } from "../hooks/useAuth";

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  useEffect(() => { const refresh = () => { apiRequest<{ unread: number }>("/notifications").then((result) => setUnread(result.unread)).catch(() => undefined); }; refresh(); const interval = window.setInterval(refresh, 60000); return () => window.clearInterval(interval); }, [location.pathname]);
  const sectionTitle = location.pathname.startsWith("/audits") ? "Internal Audits"
    : location.pathname.startsWith("/capas") || location.pathname.startsWith("/findings") ? "CAPA and Findings"
    : location.pathname.startsWith("/compliance-documents") ? "Compliance Documents"
    : location.pathname.startsWith("/audit-reports") ? "Audit Reports"
    : location.pathname.startsWith("/notifications") ? "Notifications"
    : location.pathname.startsWith("/employees")
    ? "Employees"
    : location.pathname.startsWith("/monthly-reports")
      ? "Monthly Reports"
      : location.pathname.startsWith("/quarterly-reports")
        ? "Quarterly Reports"
        : location.pathname.startsWith("/kpis")
          ? "KPI Management"
      : "Dashboard";
  const displayName = user?.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : user?.email ?? "Employee";

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 lg:hidden"
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{sectionTitle}</p>
          <p className="hidden text-xs text-slate-500 sm:block">Internal performance and audit workspace</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
          <UserCircle className="h-5 w-5 text-slate-400" />
          <span className="max-w-52 truncate">{displayName}</span>
        </div>
        <Link to="/notifications" className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={`Notifications, ${unread} unread`}><Bell className="h-5 w-5" />{unread ? <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span> : null}</Link>
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
          type="button"
          onClick={logout}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
