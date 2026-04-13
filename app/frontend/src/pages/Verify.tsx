import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/api/client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, ArrowLeft, RefreshCw } from "lucide-react";

function formatError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.code === "INVALID_CODE") return "That code is incorrect. Try again.";
  if (err?.code === "CODE_EXPIRED") return "That code expired. Please resend a new one.";
  if (err?.code === "USER_NOT_FOUND") return "No account found for that email. Create an account first.";
  if (err?.code === "VALIDATION_ERROR") return "Please check the fields and try again.";
  return "Something went wrong. Please try again.";
}

export default function Verify() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canVerify = useMemo(() => {
    return email.trim().length > 3 && code.trim().length >= 4 && !loading;
  }, [email, code, loading]);

  async function onVerify() {
    setError(null);
    setInfo(null);
    setLoading("verify");
    try {
      await api<void>("/auth/verify", {
        method: "POST",
        json: { email: email.trim(), code: code.trim() },
      });
      navigate(`/login?email=${encodeURIComponent(email.trim())}`, { replace: true });
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(null);
    }
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    setLoading("resend");
    try {
      const res = await api<{ ok?: boolean }>("/auth/verify/resend", {
        method: "POST",
        json: { email: email.trim() },
      });

      if (res) {
        setInfo("A new code has been sent to your email.");
      }
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-11rem)] w-full max-w-sm flex-col justify-center py-2 sm:min-h-[calc(100vh-12rem)] sm:py-4">
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium tracking-[0.08em] text-emerald-800">
            Email verification
          </div>
          <div className="space-y-2">
            <h2 className="text-[1.75rem] font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Verify your email
            </h2>
            <p className="text-sm leading-6 text-slate-500">
              Enter the code sent to your email to continue.
            </p>
          </div>
        </div>

        <div className="space-y-5 rounded-[28px] bg-white px-4 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5 sm:px-6 sm:py-6">
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
            <label className="text-sm font-medium text-slate-700">Verification code</label>
            <Input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="h-12 rounded-2xl border-slate-200 bg-[#fcfbf8] px-4 text-[15px] shadow-none focus-visible:ring-emerald-700"
            />
          </div>

          {error ? (
            <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-950 shadow-none">
              <div className="text-sm">{error}</div>
            </Alert>
          ) : null}

          {info ? (
            <Alert className="rounded-2xl border-emerald-200 bg-emerald-50 text-emerald-950 shadow-none">
              <div className="text-sm">{info}</div>
            </Alert>
          ) : null}

          <Button
            className="h-12 w-full rounded-2xl bg-emerald-700 text-white shadow-none hover:bg-emerald-800 disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-100"
            onClick={onVerify}
            disabled={!canVerify}
          >
            {loading === "verify" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying code…
              </>
            ) : (
              "Continue"
            )}
          </Button>

          {!canVerify && loading === null ? (
            <p className="text-center text-xs text-slate-500">
              Enter your email and code to continue.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              className="h-11 w-full rounded-2xl border-slate-200 bg-[#fcfbf8] text-slate-700 shadow-none hover:bg-stone-100"
              onClick={onResend}
              disabled={loading !== null || email.trim().length < 4}
            >
              {loading === "resend" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resending…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend code
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={() => navigate("/signup")}
              disabled={loading !== null}
              className="inline-flex items-center justify-start gap-2 text-sm font-medium text-emerald-800 transition hover:text-emerald-900 disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to account setup
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
