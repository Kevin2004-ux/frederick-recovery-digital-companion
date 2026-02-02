import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";

import { Card } from "@/components/ui/card";
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
  if (err?.code === "UNAUTHORIZED") return "Your session expired. Please log in again.";
  return "Could not save your profile. Please try again.";
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
      // Try to load log; if cleared, route to /log. Otherwise API will gate-route.
      await api("/log/entries", { method: "GET" });
      navigate("/log", { replace: true });
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-2xl p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Quick setup</h2>
        <p className="text-sm text-muted-foreground">
          This helps your clinic interpret your recovery log later.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Procedure name</label>
          <Input
            value={procedureName}
            onChange={(e) => setProcedureName(e.target.value)}
            placeholder="e.g., Rhinoplasty"
          />
          <p className="text-xs text-muted-foreground">
            Use the name your clinic used (or type something simple you’ll recognize).
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Recovery start date</label>
          <Input
            type="date"
            value={recoveryStartDate}
            onChange={(e) => setRecoveryStartDate(e.target.value)}
          />
        </div>

        {error ? (
          <Alert className="rounded-xl">
            <div className="text-sm">{error}</div>
          </Alert>
        ) : null}

        <Button className="w-full rounded-xl" onClick={onSubmit} disabled={!canSubmit}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
