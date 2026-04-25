import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { setToken } from "@/auth/token";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, LogIn, UserPlus } from "lucide-react";

type AuthUser = {
  id: string;
  email: string;
  role: "PATIENT" | "CLINIC" | "OWNER";
};

type NormalLoginResponse = {
  token: string;
  user: AuthUser;
};

type MfaRequiredResponse = {
  mfaRequired: true;
  mfaToken: string;
  user: AuthUser;
};

type LoginResponse = NormalLoginResponse | MfaRequiredResponse;
type MfaVerifyResponse = NormalLoginResponse;
type AuthMeResponse = {
  id: string;
  email: string;
  role?: "PATIENT" | "CLINIC" | "OWNER";
  consentAcceptedAt?: string;
  procedureName?: string;
  recoveryStartDate?: string;
};

function formatError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.code === "VALIDATION_ERROR") return "Please check the fields and try again.";
  if (err?.code === "INVALID_CREDENTIALS" || err?.status === 401) return "Incorrect email or password.";
  if (err?.code === "EMAIL_NOT_VERIFIED") return "Please verify your email to continue.";
  if (err?.code === "UNAUTHORIZED") return "Your session expired. Please sign in again.";
  return "Something went wrong. Please try again.";
}

function formatMfaError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.code === "INVALID_MFA_CODE") return "Invalid authentication code. Try again.";
  if (err?.code === "INVALID_MFA_TOKEN") return "Your sign-in session expired. Please sign in again.";
  if (err?.code === "VALIDATION_ERROR") return "Enter the 6-digit authentication code.";
  return "Something went wrong. Please try again.";
}

function isMfaRequiredResponse(res: LoginResponse): res is MfaRequiredResponse {
  return "mfaRequired" in res && res.mfaRequired === true;
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMfaStep = mfaToken !== null;
  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 8 && !loading && !isMfaStep;
  }, [email, password, loading, isMfaStep]);
  const canVerifyMfa = useMemo(() => {
    return /^\d{6}$/.test(mfaCode) && !loading && !!mfaToken;
  }, [mfaCode, loading, mfaToken]);

  async function forward() {
    try {
      const me = await api<AuthMeResponse>("/auth/me", { method: "GET" });

      if (me.role === "CLINIC" || me.role === "OWNER") {
        navigate("/clinic", { replace: true });
        return;
      }

      await api("/log/entries", { method: "GET" });
      navigate("/home", { replace: true });
    } catch (e) {
      const err = e as Partial<ApiError>;
      if (err?.code === "CONSENT_REQUIRED" || err?.code === "ONBOARDING_REQUIRED") return;
      setError(formatError(e));
    }
  }

  function resetMfaStep() {
    setMfaToken(null);
    setMfaCode("");
    setError(null);
  }

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      const res = await api<LoginResponse>("/auth/login", {
        method: "POST",
        json: { email: email.trim(), password },
      });
      if (isMfaRequiredResponse(res)) {
        setMfaToken(res.mfaToken);
        setMfaCode("");
        return;
      }

      setToken(res.token);
      await forward();
    } catch (e) {
      const err = e as Partial<ApiError>;
      if (err?.code === "EMAIL_NOT_VERIFIED") {
        navigate(`/verify?email=${encodeURIComponent(email.trim())}`, { replace: true });
        return;
      }
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyMfa() {
    if (!mfaToken) return;

    setError(null);
    setLoading(true);
    try {
      const res = await api<MfaVerifyResponse>("/auth/mfa/login/verify", {
        method: "POST",
        json: { mfaToken, code: mfaCode },
      });
      setToken(res.token);
      await forward();
    } catch (e) {
      const err = e as Partial<ApiError>;
      if (err?.code === "INVALID_MFA_TOKEN") {
        resetMfaStep();
      }
      setError(formatMfaError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-11rem)] w-full max-w-sm flex-col justify-center py-2 sm:min-h-[calc(100vh-12rem)] sm:py-4">
      <Card className="rounded-2xl border border-black/5 bg-white/95 p-5 shadow-sm sm:p-6">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium tracking-[0.08em] text-emerald-800">
            Frederick Recovery
          </div>
          <h2 className="text-xl font-semibold">
            {isMfaStep ? "Enter authentication code" : "Sign in"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isMfaStep
              ? "Open your authenticator app and enter the 6-digit code."
              : "Secure access to your recovery account."}
          </p>
        </div>

        <div className="mt-5 space-y-4 sm:mt-6">
          {isMfaStep ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Authentication code</label>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
              </div>
            </>
          )}

          {error ? (
            <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-950">
              <div className="text-sm">{error}</div>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3">
            <Button
              className="h-11 w-full rounded-2xl disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-100 sm:h-12"
              onClick={isMfaStep ? onVerifyMfa : onLogin}
              disabled={isMfaStep ? !canVerifyMfa : !canSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isMfaStep ? "Verifying…" : "Signing in…"}
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  {isMfaStep ? "Verify code" : "Sign in"}
                </>
              )}
            </Button>

            {!isMfaStep && !canSubmit && !loading ? (
              <p className="text-center text-xs text-muted-foreground">
                Enter your email and password to continue.
              </p>
            ) : null}

            {isMfaStep ? (
              <Button
                variant="outline"
                className="h-11 w-full rounded-2xl sm:h-12"
                onClick={resetMfaStep}
                disabled={loading}
              >
                Back
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-11 w-full rounded-2xl sm:h-12"
                onClick={() => navigate("/signup")}
                disabled={loading}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Claim with activation code
              </Button>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
