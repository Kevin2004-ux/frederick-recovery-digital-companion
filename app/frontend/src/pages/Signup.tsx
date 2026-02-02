import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, UserPlus, ArrowLeft } from "lucide-react";

function formatError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.code === "VALIDATION_ERROR") return "Please check the fields and try again.";
  if (err?.code === "EMAIL_ALREADY_EXISTS") return "That email is already in use. Try logging in.";
  return "Something went wrong. Please try again.";
}

export default function Signup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 8 && !loading;
  }, [email, password, loading]);

  async function onSignup() {
    setError(null);
    setLoading(true);
    try {
      await api("/auth/signup", {
        method: "POST",
        json: { email: email.trim(), password },
      });
      navigate(`/verify?email=${encodeURIComponent(email.trim())}`, { replace: true });
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Create account</h2>
        <p className="text-sm text-muted-foreground">
          We’ll send a 6-digit code to verify your email before you can log in.
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <p className="text-xs text-muted-foreground">Minimum 8 characters (MVP).</p>
        </div>

        {error ? (
          <Alert className="rounded-xl">
            <div className="text-sm">{error}</div>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button className="w-full rounded-xl" onClick={onSignup} disabled={!canSubmit}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create account
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => navigate("/login")}
            disabled={loading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to login
          </Button>
        </div>
      </div>
    </Card>
  );
}
