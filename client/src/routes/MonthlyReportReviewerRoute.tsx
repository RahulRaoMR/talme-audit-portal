import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function MonthlyReportReviewerRoute() {
  const { user } = useAuth();
  return user && ["MANAGER", "HR_ADMIN", "SUPER_ADMIN", "AUDITOR"].includes(user.role.name)
    ? <Outlet />
    : <Navigate to="/monthly-reports" replace />;
}

