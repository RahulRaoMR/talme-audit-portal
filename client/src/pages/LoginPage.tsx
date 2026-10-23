import { FormEvent, useState } from "react";
import { CheckCircle2, LockKeyhole, Mail } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { useAuth } from "../hooks/useAuth";

type LocationState = {
  from?: {
    pathname?: string;
  };
  successMessage?: string;
};

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = location.state as LocationState | null;
  const redirectTo = state?.from?.pathname ?? "/dashboard";

  if (user) {
    return <Navigate to={user.mustChangePassword ? "/change-password" : "/dashboard"} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const loggedInUser = await login({ email, password });
      navigate(loggedInUser.mustChangePassword ? "/change-password" : redirectTo, {
        replace: true
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="TALME EMPLOYEE AUDIT PORTAL"
      description="Sign in to access employee reports, reviews, and audit records."
    >
      {state?.successMessage ? (
        <p className="mb-5 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{state.successMessage}</span>
        </p>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              className="w-full border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="employee@talme.com"
              autoComplete="email"
              required
            />
          </span>
        </label>

        <label className="block">
          <span className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <Link
              className="text-sm font-medium text-brand-700 hover:text-brand-600"
              to="/forgot-password"
            >
              Forgot password?
            </Link>
          </span>
          <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              className="w-full border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </span>
        </label>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          className="inline-flex w-full items-center justify-center rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-400"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}
