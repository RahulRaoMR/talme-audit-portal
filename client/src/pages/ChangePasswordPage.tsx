import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { useAuth } from "../hooks/useAuth";
import { changePasswordRequest } from "../services/auth.service";

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export function ChangePasswordPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!passwordPattern.test(newPassword)) {
      setError("Use at least 12 characters with uppercase, lowercase, number, and symbol.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation must match");
      return;
    }

    try {
      setIsSubmitting(true);
      await changePasswordRequest(currentPassword, newPassword, confirmPassword);
      await refreshUser();
      navigate("/dashboard", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to change password");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputType = showPasswords ? "text" : "password";

  return (
    <AuthCard title="Change Temporary Password" description="Choose a private password before continuing.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {[
          ["Current Password", currentPassword, setCurrentPassword, "current-password"],
          ["New Password", newPassword, setNewPassword, "new-password"],
          ["Confirm New Password", confirmPassword, setConfirmPassword, "new-password"]
        ].map(([label, value, setter, autoComplete]) => (
          <label className="block" key={label as string}>
            <span className="text-sm font-medium text-slate-700">{label as string}</span>
            <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2.5 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
              <LockKeyhole className="h-4 w-4 text-slate-400" />
              <input
                className="w-full border-0 bg-transparent text-sm outline-none"
                type={inputType}
                value={value as string}
                onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                autoComplete={autoComplete as string}
                required
              />
            </span>
          </label>
        ))}

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(event) => setShowPasswords(event.target.checked)}
          />
          {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          Show passwords
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
          className="inline-flex w-full items-center justify-center rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:bg-slate-400"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Changing password..." : "Change password"}
        </button>
      </form>
    </AuthCard>
  );
}
