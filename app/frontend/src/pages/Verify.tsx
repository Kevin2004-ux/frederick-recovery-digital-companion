import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/api/client";

import { Card } from "@/components/ui/card";
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
        setInfo("Verification code resent. Check your email (dev: backend console).");
      }
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Verify your email</h2>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code we sent. (Dev mode: it prints in the backend console.)
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
          <label className="text-sm font-medium">Verification code</label>
          <Input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />
        </div>

        {error ? (
          <Alert className="rounded-xl">
            <div className="text-sm">{error}</div>
          </Alert>
        ) : null}

        {info ? (
          <Alert className="rounded-xl">
            <div className="text-sm">{info}</div>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button className="w-full rounded-xl" onClick={onVerify} disabled={!canVerify}>
            {loading === "verify" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              "Verify"
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full rounded-xl"
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

          <Button
            variant="ghost"
            className="w-full rounded-xl"
            onClick={() => navigate("/signup")}
            disabled={loading !== null}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to create account
          </Button>
        </div>
      </div>
    </Card>
  );
}
