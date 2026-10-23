import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function PasswordChangedRoute() {
  const { user } = useAuth();

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
