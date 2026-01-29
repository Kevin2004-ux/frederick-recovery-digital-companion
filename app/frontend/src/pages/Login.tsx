import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { setToken } from "@/auth/token";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, LogIn, UserPlus } from "lucide-react";

type AuthResponse = { token: string };

function formatError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.code === "VALIDATION_ERROR") return "Please check the fields and try again.";
  if (err?.status === 401) return "Email or password is incorrect.";
  return "Something went wrong. Please try again.";
}

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState<"login" | "signup" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && !loading;
  }, [email, password, loading]);

  async function forward() {
    // Let the API client gate-route. If fully cleared, we land on /log.
    // We try /log/entries because it will trigger consent/onboarding gates automatically.
    try {
      await api("/auth/me", { method: "GET" });
      await api("/log/entries", { method: "GET" });
      navigate("/log", { replace: true });
    } catch (e) {
      // If a gate is required, client.ts already navigated.
      // If it's something else, show the message.
      const err = e as Partial<ApiError>;
      if (err?.code === "CONSENT_REQUIRED" || err?.code === "ONBOARDING_REQUIRED") return;
      setError(formatError(e));
    }
  }

  async function onLogin() {
    setError(null);
    setLoading("login");
    try {
      const res = await api<AuthResponse>("/auth/login", {
        method: "POST",
        json: { email: email.trim(), password },
      });
      setToken(res.token);
      await forward();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(null);
    }
  }

  async function onSignup() {
    setError(null);
    setLoading("signup");
    try {
      const res = await api<AuthResponse>("/auth/signup", {
        method: "POST",
        json: { email: email.trim(), password },
      });
      setToken(res.token);
      await forward();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground">
          Log in to track your daily recovery and export a shareable record.
        </p>
      </div>

      <div className="mt-6 space-y-4">
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
          <p className="text-xs text-muted-foreground">
            Minimum 6 characters (MVP).
          </p>
        </div>

        {error ? (
          <Alert className="rounded-xl">
            <div className="text-sm">{error}</div>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button
            className="w-full rounded-xl"
            onClick={onLogin}
            disabled={!canSubmit}
          >
            {loading === "login" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in…
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Log in
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={onSignup}
            disabled={!canSubmit}
          >
            {loading === "signup" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create account
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
