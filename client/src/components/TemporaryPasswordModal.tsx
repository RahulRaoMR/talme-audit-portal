import { useState } from "react";
import { Check, Copy, KeyRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

type TemporaryPasswordModalProps = {
  employeeCode: string;
  email: string;
  temporaryPassword: string;
};

export function TemporaryPasswordModal({
  employeeCode,
  email,
  temporaryPassword
}: TemporaryPasswordModalProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section
        className="w-full max-w-lg rounded-md border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="temporary-password-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 id="temporary-password-title" className="text-lg font-bold text-slate-950">
                Employee created successfully
              </h2>
              <p className="mt-1 text-sm text-slate-500">{employeeCode} · {email}</p>
            </div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:text-slate-950"
            type="button"
            onClick={() => navigate("/employees")}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Temporary Password
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 p-2">
              <code className="min-w-0 flex-1 break-all px-2 text-sm font-semibold text-slate-950">
                {temporaryPassword}
              </code>
              <button
                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                type="button"
                onClick={() => void copyPassword()}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            This temporary password is shown only once. The employee must change it on first login.
          </p>
        </div>

        <footer className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            type="button"
            onClick={() => navigate("/employees")}
          >
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
