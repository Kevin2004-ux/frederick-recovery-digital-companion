import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { setToken } from "@/auth/token";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, LogIn, UserPlus } from "lucide-react";

type AuthResponse = { token: string };
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

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 8 && !loading;
  }, [email, password, loading]);

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

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      const res = await api<AuthResponse>("/auth/login", {
        method: "POST",
        json: { email: email.trim(), password },
      });
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

  return (
    <section className="mx-auto flex min-h-[calc(100vh-11rem)] w-full max-w-sm flex-col justify-center py-2 sm:min-h-[calc(100vh-12rem)] sm:py-4">
      <Card className="rounded-2xl border border-black/5 bg-white/95 p-5 shadow-sm sm:p-6">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium tracking-[0.08em] text-emerald-800">
            Frederick Recovery
          </div>
          <h2 className="text-xl font-semibold">Sign in</h2>
          <p className="text-sm text-muted-foreground">
            Secure access to your recovery account.
          </p>
        </div>

        <div className="mt-5 space-y-4 sm:mt-6">
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

          {error ? (
            <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-950">
              <div className="text-sm">{error}</div>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3">
            <Button
              className="h-11 w-full rounded-2xl disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-100 sm:h-12"
              onClick={onLogin}
              disabled={!canSubmit}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </>
              )}
            </Button>

            {!canSubmit && !loading ? (
              <p className="text-center text-xs text-muted-foreground">
                Enter your email and password to continue.
              </p>
            ) : null}

            <Button
              variant="outline"
              className="h-11 w-full rounded-2xl sm:h-12"
              onClick={() => navigate("/signup")}
              disabled={loading}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Claim with activation code
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
