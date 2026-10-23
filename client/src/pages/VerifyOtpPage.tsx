import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { resendResetOtpRequest, verifyResetOtpRequest } from "../services/auth.service";
import {
  getResendAvailableAt,
  getResetEmail,
  setResendAvailableAt,
  setResetToken
} from "../services/passwordResetSession";

type LocationState = {
  message?: string;
};

function getCountdownSeconds() {
  return Math.max(0, Math.ceil((getResendAvailableAt() - Date.now()) / 1000));
}

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = getResetEmail();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    (location.state as LocationState | null)?.message ??
      "We sent a 6-digit OTP to your registered email."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(getCountdownSeconds);

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(getCountdownSeconds()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!email) {
    return <Navigate to="/forgot-password" replace />;
  }

  const resetEmail = email;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await verifyResetOtpRequest(resetEmail, otp);
      setResetToken(result.resetToken);
      navigate("/reset-password", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to verify OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    setMessage("");
    setIsResending(true);

    try {
      const result = await resendResetOtpRequest(resetEmail);
      setResendAvailableAt(Date.now() + 60_000);
      setCountdown(60);
      setMessage(result.message);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to resend OTP");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthCard title="Verify OTP" description="We sent a 6-digit OTP to your registered email.">
      <form className="space-y-5" onSubmit={handleSubmit}>
        {message ? (
          <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {message}
          </p>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-slate-700">OTP</span>
          <span className="mt-2 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <KeyRound className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              className="w-full border-0 bg-transparent text-center font-mono text-xl text-slate-950 outline-none placeholder:text-slate-300"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              autoComplete="one-time-code"
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
          disabled={isSubmitting || otp.length !== 6}
        >
          {isSubmitting ? "Verifying..." : "Verify OTP"}
        </button>

        <div className="text-center text-sm text-slate-600">
          <span>Didn't receive the code? </span>
          <button
            className="font-semibold text-brand-700 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-slate-400"
            type="button"
            onClick={handleResend}
            disabled={countdown > 0 || isResending}
          >
            {isResending ? "Sending..." : countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
          </button>
        </div>

        <Link
          className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-700"
          to="/forgot-password"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
      </form>
    </AuthCard>
  );
}
