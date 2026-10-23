import { FormEvent, useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { forgotPasswordRequest } from "../services/auth.service";
import { setResendAvailableAt, setResetEmail } from "../services/passwordResetSession";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await forgotPasswordRequest(normalizedEmail);
      setResetEmail(normalizedEmail);
      setResendAvailableAt(Date.now() + 60_000);
      navigate("/verify-otp", { replace: true, state: { message: result.message } });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to send OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard title="Forgot Password" description="Enter your registered Talme email address.">
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
          {isSubmitting ? "Sending OTP..." : "Send OTP"}
        </button>

        <Link
          className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-700"
          to="/login"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Sign in
        </Link>
      </form>
    </AuthCard>
  );
}
