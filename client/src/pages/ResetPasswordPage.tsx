import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { resetPasswordRequest } from "../services/auth.service";
import { clearPasswordResetSession, getResetToken } from "../services/passwordResetSession";

const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const resetToken = getResetToken();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }

  const verifiedResetToken = resetToken;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!strongPasswordPattern.test(password)) {
      setError("Use at least 12 characters with uppercase, lowercase, a number, and a symbol.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await resetPasswordRequest(verifiedResetToken, password);
      clearPasswordResetSession();
      navigate("/login", {
        replace: true,
        state: { successMessage: result.message }
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to reset password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard title="Reset Password" description="Create a new password for your Talme account.">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">New Password</span>
          <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              className="w-full border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
              required
            />
            <button
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 hover:text-slate-800"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Confirm Password</span>
          <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              className="w-full border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              required
            />
            <button
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-slate-500 hover:text-slate-800"
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              title={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>

        <p className="text-xs leading-5 text-slate-500">
          Use at least 12 characters with uppercase, lowercase, a number, and a symbol.
        </p>

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
          {isSubmitting ? "Resetting password..." : "Reset Password"}
        </button>
      </form>
    </AuthCard>
  );
}
