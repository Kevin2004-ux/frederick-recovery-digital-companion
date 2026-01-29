import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, CheckCircle2 } from "lucide-react";

function formatError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.code === "UNAUTHORIZED") return "Your session expired. Please log in again.";
  return "Could not record consent. Please try again.";
}

export default function Consent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAgree() {
    setError(null);
    setLoading(true);
    try {
      await api<void>("/auth/consent", { method: "POST" });
      // Next step is onboarding or log; let the API gating determine it.
      await api("/log/entries", { method: "GET" });
      navigate("/log", { replace: true });
    } catch (e) {
      const err = e as Partial<ApiError>;
      if (err?.code === "ONBOARDING_REQUIRED") return; // client already navigated
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Consent</h2>
        <p className="text-sm text-muted-foreground">
          Please review and accept to continue.
        </p>
      </div>

      <div className="mt-5">
        <div className="max-h-64 overflow-auto rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed">
          <p className="font-medium">Placeholder Consent Text</p>
          <p className="mt-2 text-muted-foreground">
            This app helps you track recovery information (pain, swelling, notes) that you choose to enter.
            You own your data and can export it at any time to share with your clinic.
          </p>
          <p className="mt-3 text-muted-foreground">
            We recommend not entering highly sensitive information. This is not emergency care. If you
            have urgent symptoms, contact your provider or seek emergency services.
          </p>
          <p className="mt-3 text-muted-foreground">
            By selecting “I Agree”, you acknowledge and accept these terms for use of this tool.
          </p>
        </div>

        {error ? (
          <Alert className="mt-4 rounded-xl">
            <div className="text-sm">{error}</div>
          </Alert>
        ) : null}

        <Button
          className="mt-5 w-full rounded-xl"
          onClick={onAgree}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              I Agree
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
