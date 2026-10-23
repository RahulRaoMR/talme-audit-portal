import { LogOut, Menu, UserCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const sectionTitle = location.pathname.startsWith("/employees")
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
      <div className="flex items-center gap-3">
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 lg:hidden"
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="text-sm font-semibold text-slate-950">{sectionTitle}</p>
          <p className="text-xs text-slate-500">Internal performance and audit workspace</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
          <UserCircle className="h-5 w-5 text-slate-400" />
          <span className="max-w-52 truncate">{displayName}</span>
        </div>
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
