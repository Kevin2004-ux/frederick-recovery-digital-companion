import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, CheckCircle2 } from "lucide-react";

function formatError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.code === "UNAUTHORIZED") return "Your session expired. Please sign in again.";
  return "Could not save your response. Please try again.";
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
    <div className="space-y-5 rounded-[28px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur sm:space-y-6 sm:p-8">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
          Consent
        </p>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Review and continue
          </h2>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Please read and accept these terms to continue.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="max-h-72 overflow-auto rounded-[24px] border border-black/6 bg-stone-50/80 p-4 text-sm leading-7 text-foreground sm:p-5">
          <p className="font-medium text-foreground">Using Frederick Recovery</p>
          <p className="mt-3 text-muted-foreground">
            Frederick Recovery helps you track the recovery information you choose to enter, including things
            like pain, swelling, and notes.
          </p>
          <p className="mt-3 text-muted-foreground">
            This app is not emergency care. If you have urgent symptoms, contact your provider or seek
            emergency services.
          </p>
          <p className="mt-3 text-muted-foreground">
            By selecting “Agree and continue,” you acknowledge these terms for using the app.
          </p>
        </div>

        {error ? (
          <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-950">
            <div className="text-sm">{error}</div>
          </Alert>
        ) : null}

        <Button
          className="h-12 w-full rounded-full px-5 text-[15px] disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-100"
          onClick={onAgree}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving response…
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Agree and continue
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
