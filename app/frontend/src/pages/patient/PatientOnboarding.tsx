import { Calendar, CheckCircle2, FileSignature } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatePanel } from "@/components/ui/StatePanel";
import { routes } from "@/lib/routes";

export function PatientOnboarding() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [consentChecked, setConsentChecked] = useState(Boolean(user?.consentAcceptedAt));
  const [procedureName, setProcedureName] = useState(user?.procedureName || "");
  const [recoveryStartDate, setRecoveryStartDate] = useState(user?.recoveryStartDate || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setConsentChecked(Boolean(user?.consentAcceptedAt));
    setProcedureName(user?.procedureName || "");
    setRecoveryStartDate(user?.recoveryStartDate || "");
  }, [user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!user?.consentAcceptedAt) {
        if (!consentChecked) {
          throw new Error("Please accept consent before continuing.");
        }
        await api.post("/auth/consent/accept");
      }

      await api.put("/user/profile", {
        procedureName: procedureName.trim(),
        recoveryStartDate,
      });

      await refreshProfile();
      navigate(routes.patientHome);
    } catch (caughtError) {
      const apiError = caughtError as ApiError | Error;
      setError(apiError.message || "Unable to finish onboarding.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-app">
      <div className="app-shell max-w-5xl">
        <PageIntro
          description="The backend requires consent, a procedure name, and a recovery start date before patient home access."
          eyebrow="Patient onboarding"
          title="Complete your recovery setup"
        />

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                <FileSignature className="h-6 w-6" />
              </div>
              <div>
                <h2 className="section-title">Consent acknowledgement</h2>
                <p className="section-subtitle">
                  Your consent status is tracked server-side and must be accepted before profile updates are allowed.
                </p>
              </div>
            </div>

            <label className="mt-6 flex items-start gap-3 rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <input
                checked={consentChecked}
                className="mt-1 h-4 w-4"
                disabled={Boolean(user?.consentAcceptedAt)}
                onChange={(event) => setConsentChecked(event.target.checked)}
                type="checkbox"
              />
              <span className="text-sm leading-7 text-slate-700">
                I understand this app supports recovery tracking and does not replace direct medical advice from my clinic.
              </span>
            </label>

            {user?.consentAcceptedAt ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Consent already accepted
              </div>
            ) : null}

            <div className="soft-divider mt-7" />

            <div className="mt-7 flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <h2 className="section-title">Recovery details</h2>
                <p className="section-subtitle">
                  These values map directly to the locked `/user/profile` backend payload shape.
                </p>
              </div>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              <div>
                <label className="field-label" htmlFor="procedure-name">
                  Procedure name
                </label>
                <input
                  className="field"
                  id="procedure-name"
                  onChange={(event) => setProcedureName(event.target.value)}
                  required
                  value={procedureName}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="recovery-start-date">
                  Recovery start date
                </label>
                <input
                  className="field"
                  id="recovery-start-date"
                  onChange={(event) => setRecoveryStartDate(event.target.value)}
                  required
                  type="date"
                  value={recoveryStartDate}
                />
              </div>

              {error ? <StatePanel description={error} title="Onboarding issue" tone="danger" /> : null}

              <div className="mt-2 flex flex-wrap gap-3">
                <Button className="justify-center" disabled={loading} type="submit">
                  {loading ? "Saving..." : "Finish onboarding"}
                </Button>
                <Button
                  className="justify-center"
                  onClick={() => navigate(routes.signIn)}
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <p className="eyebrow">What unlocks next</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              Finish once, then move straight into recovery.
            </h2>
            <div className="mt-6 grid gap-3">
              <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Patient Home</p>
                <p className="mt-1 text-sm leading-7 text-slate-600">Daily recovery snapshot, progress, and plan focus.</p>
              </div>
              <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Patient Tracker</p>
                <p className="mt-1 text-sm leading-7 text-slate-600">Daily check-ins with the existing backend payload contract.</p>
              </div>
              <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Medical Hub & My Box</p>
                <p className="mt-1 text-sm leading-7 text-slate-600">Guidance, item details, and medication lookup stay available.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
