import {
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  FileBarChart,
  FileText,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { NavLink } from "react-router-dom";
import talmeLogo from "../assets/talme-logo.png";
import { useAuth } from "../hooks/useAuth";
import { classNames } from "../utils/classNames";

const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Employees", path: "/employees", icon: Users, adminOnly: true },
  { label: "Monthly Reports", path: "/monthly-reports", icon: FileText },
  { label: "Report Review", path: "/monthly-reports/review", icon: ListChecks, reviewerOnly: true },
  { label: "Quarterly Reports", path: "/quarterly-reports", icon: FileBarChart },
  { label: "Quarterly Review", path: "/quarterly-reports/review", icon: ListChecks, reviewerOnly: true },
  { label: "Attendance", path: "/dashboard", icon: CalendarCheck },
  { label: "KPI Management", path: "/kpis", icon: Gauge, adminOnly: true },
  { label: "Performance Reviews", path: "/dashboard", icon: ClipboardCheck },
  { label: "Internal Audits", path: "/audits", icon: ShieldCheck },
  { label: "CAPA Register", path: "/capas", icon: ListChecks },
  { label: "Compliance Documents", path: "/compliance-documents", icon: FileText },
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Departments", path: "/dashboard", icon: Building2 },
  { label: "Reports & Analytics", path: "/audit-reports", icon: BarChart3 },
  { label: "Settings", path: "/dashboard", icon: Settings }
];

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const canManageEmployees = user && ["SUPER_ADMIN", "HR_ADMIN"].includes(user.role.name);
  const canReviewReports = user && ["MANAGER", "HR_ADMIN", "SUPER_ADMIN", "AUDITOR"].includes(user.role.name);

  return (
    <>
      {isOpen ? (
        <button
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
        />
      ) : null}
      <aside
        className={classNames(
                  "fixed inset-y-0 left-0 z-50 min-h-screen w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 transition-transform lg:static lg:z-auto lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
      <div className="relative mb-7 border-b border-slate-100 px-2 pb-5 text-center">
        <button
          className="absolute right-0 top-0 inline-flex h-9 w-9 items-center justify-center text-slate-500 lg:hidden"
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
        <img
          className="mx-auto h-24 w-auto object-contain"
          src={talmeLogo}
          alt="Talme Technologies Pvt Ltd"
        />
        <h1 className="mt-3 text-base font-bold text-slate-950">Employee Audit Portal</h1>
      </div>

      <nav className="space-y-1">
        {navigation.filter((item) =>
          (!item.adminOnly || canManageEmployees) && (!item.reviewerOnly || canReviewReports)
        ).map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                classNames(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      </aside>
    </>
  );
}
