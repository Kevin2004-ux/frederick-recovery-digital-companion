import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Loader2, ArrowRight } from "lucide-react";

type Profile = {
  procedureName: string;
  recoveryStartDate: string; // YYYY-MM-DD
};

function todayLocalYYYYMMDD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.code === "VALIDATION_ERROR") return "Please check the fields and try again.";
  if (err?.code === "UNAUTHORIZED") return "Your session expired. Please sign in again.";
  return "Could not save your details. Please try again.";
}

export default function Onboarding() {
  const navigate = useNavigate();

  const [procedureName, setProcedureName] = useState("");
  const [recoveryStartDate, setRecoveryStartDate] = useState(todayLocalYYYYMMDD());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return procedureName.trim().length > 0 && recoveryStartDate.length === 10 && !loading;
  }, [procedureName, recoveryStartDate, loading]);

  async function onSubmit() {
    setError(null);
    setLoading(true);

    const payload: Profile = {
      procedureName: procedureName.trim(),
      recoveryStartDate,
    };

    try {
      await api("/user/profile", { method: "PUT", json: payload });
      // Try to load log; if cleared, route to the portal home. Otherwise API will gate-route.
      await api("/log/entries", { method: "GET" });
      navigate("/home", { replace: true });
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 rounded-[28px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur sm:space-y-6 sm:p-8">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
          Setup
        </p>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Set up your recovery
          </h2>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Add your procedure and start date so your recovery log stays clear.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Procedure name</label>
          <Input
            value={procedureName}
            onChange={(e) => setProcedureName(e.target.value)}
            placeholder="e.g., Rhinoplasty"
            className="h-12 rounded-2xl border-black/8 bg-stone-50/60 px-4 text-[15px] shadow-none focus-visible:ring-emerald-600"
          />
          <p className="text-xs text-muted-foreground">
            Use the name your clinic gave you, or something easy to recognize.
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Recovery start date</label>
          <Input
            type="date"
            value={recoveryStartDate}
            onChange={(e) => setRecoveryStartDate(e.target.value)}
            className="h-12 rounded-2xl border-black/8 bg-stone-50/60 px-4 text-[15px] shadow-none focus-visible:ring-emerald-600"
          />
        </div>

        {error ? (
          <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-950">
            <div className="text-sm">{error}</div>
          </Alert>
        ) : null}

        <Button
          className="h-12 w-full rounded-full px-5 text-[15px] disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-100"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving details…
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        {!canSubmit && !loading ? (
          <p className="text-center text-xs text-muted-foreground">
            Enter your procedure and start date to continue.
          </p>
        ) : null}
      </div>
    </div>
  );
}
