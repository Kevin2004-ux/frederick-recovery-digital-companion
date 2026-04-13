import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, UserPlus, ArrowLeft } from "lucide-react";

function formatError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.code === "VALIDATION_ERROR") return "Please check the fields and try again.";
  if (err?.code === "INVALID_CODE" || err?.status === 404) {
    return "That activation code was not recognized.";
  }
  if (err?.code === "CODE_ALREADY_USED") {
    return "That activation code has already been claimed.";
  }
  if (err?.code === "EMAIL_TAKEN" || err?.code === "EMAIL_ALREADY_EXISTS") {
    return "That email is already in use. Sign in instead.";
  }
  return "Something went wrong. Please try again.";
}

export default function Signup() {
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      code.trim().length >= 5 &&
      email.trim().length > 3 &&
      password.length >= 12 &&
      confirmPassword.length >= 12 &&
      password === confirmPassword &&
      !loading
    );
  }, [code, email, password, confirmPassword, loading]);

  async function onSignup() {
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api("/activation/claim", {
        method: "POST",
        json: { code: code.trim(), email: email.trim(), password },
      });
      navigate(`/verify?email=${encodeURIComponent(email.trim())}`, { replace: true });
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-11rem)] w-full max-w-sm flex-col justify-center py-2 sm:min-h-[calc(100vh-12rem)] sm:py-4">
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium tracking-[0.08em] text-emerald-800">
            Activation claim
          </div>
          <div className="space-y-2">
            <h2 className="text-[1.75rem] font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Claim your recovery access
            </h2>
            <p className="text-sm leading-6 text-slate-500">
              Use your activation code to create your account. We&apos;ll send a verification code to your email next.
            </p>
          </div>
        </div>

        <div className="space-y-5 rounded-[28px] bg-white px-4 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5 sm:px-6 sm:py-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Activation code</label>
            <Input
              type="text"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your code"
              className="h-12 rounded-2xl border-slate-200 bg-[#fcfbf8] px-4 text-[15px] shadow-none focus-visible:ring-emerald-700"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 rounded-2xl border-slate-200 bg-[#fcfbf8] px-4 text-[15px] shadow-none focus-visible:ring-emerald-700"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <span className="text-xs text-slate-400">Minimum 12 characters</span>
            </div>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              className="h-12 rounded-2xl border-slate-200 bg-[#fcfbf8] px-4 text-[15px] shadow-none focus-visible:ring-emerald-700"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Confirm password</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="h-12 rounded-2xl border-slate-200 bg-[#fcfbf8] px-4 text-[15px] shadow-none focus-visible:ring-emerald-700"
            />
          </div>

          {error ? (
            <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-950 shadow-none">
              <div className="text-sm">{error}</div>
            </Alert>
          ) : null}

          <Button
            className="h-12 w-full rounded-2xl bg-emerald-700 text-white shadow-none hover:bg-emerald-800 disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-100"
            onClick={onSignup}
            disabled={!canSubmit}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Claiming…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Continue
              </>
            )}
          </Button>

          {!canSubmit && !loading ? (
            <p className="text-center text-xs text-slate-500">
              Enter your activation code, email, and matching password to continue.
            </p>
          ) : null}

          <div className="border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => navigate("/login")}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 transition hover:text-emerald-900 disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
