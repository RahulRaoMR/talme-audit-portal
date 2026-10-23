import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function EmployeeAdminRoute() {
  const { user } = useAuth();

  if (!user || !["SUPER_ADMIN", "HR_ADMIN"].includes(user.role.name)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
