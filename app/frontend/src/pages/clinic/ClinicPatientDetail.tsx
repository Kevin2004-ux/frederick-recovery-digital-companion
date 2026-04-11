import { AlertTriangle, ArrowLeft, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatePanel } from "@/components/ui/StatePanel";
import { routes } from "@/lib/routes";
import type { ClinicPatientSummary } from "@/types/clinic";

export function ClinicPatientDetail() {
  const { patientId = "" } = useParams();
  const hasPatientId = Boolean(patientId);
  const [summary, setSummary] = useState<ClinicPatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    if (!hasPatientId) {
      return;
    }

    async function loadSummary() {
      setLoading(true);

      try {
        const response = await api.get<ClinicPatientSummary>(`/clinic/patients/${patientId}/summary`);
        setSummary(response);
        setError("");
      } catch (caughtError) {
        setSummary(null);
        setError((caughtError as ApiError).message || "Unable to load this patient summary.");
      } finally {
        setLoading(false);
      }
    }

    void loadSummary();
  }, [hasPatientId, patientId]);

  return (
    <main className="bg-app">
      <div className="app-shell max-w-6xl">
        <Link className="button-ghost" to={routes.clinicDashboard}>
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <PageIntro
          className="mt-5"
          description="Summary data comes directly from `/clinic/patients/:patientId/summary`."
          eyebrow="Clinic patient detail"
          title={summary?.patient.displayName || "Patient summary"}
          actions={
            summary?.recovery.simpleStatus ? <Badge tone="info">{summary.recovery.simpleStatus}</Badge> : null
          }
        />

        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <p className="eyebrow">Patient snapshot</p>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-900">{summary?.patient.email || "Not available"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Activation code</dt>
                <dd className="font-medium text-slate-900">{summary?.activation.activationCode || "Unknown"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Recovery start</dt>
                <dd className="font-medium text-slate-900">{summary?.recovery.recoveryStartDate || "Not set"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Recovery day</dt>
                <dd className="font-medium text-slate-900">{summary?.recovery.currentRecoveryDay || "?"}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                disabled={!summary}
                onClick={() => {
                  setExportError("");
                  void api
                    .downloadBlob(
                      `/clinic/patients/${patientId}/export.pdf`,
                      `patient-${patientId}-recovery-log.pdf`,
                    )
                    .catch((caughtError) => {
                      setExportError(
                        (caughtError as ApiError).message || "Unable to export the patient PDF.",
                      );
                    });
                }}
                variant="secondary"
              >
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
            </div>

            {exportError ? (
              <StatePanel
                className="mt-5"
                description={exportError}
                title="PDF export issue"
                tone="danger"
              />
            ) : null}
          </Card>

          <Card>
            <p className="eyebrow">Latest check-in and alerts</p>
            {!hasPatientId ? (
              <StatePanel
                className="mt-6"
                description="A patient ID is required to load the current clinic summary."
                title="Missing patient ID"
                tone="warning"
              />
            ) : loading ? (
              <StatePanel
                className="mt-6"
                description="Loading the current clinic summary and recent check-ins for this patient."
                title="Loading patient summary"
              />
            ) : error ? (
              <StatePanel className="mt-6" description={error} title="Patient summary issue" tone="danger" />
            ) : summary?.latestCheckIn ? (
              <div className="mt-6 rounded-[26px] border border-slate-100 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">{summary.latestCheckIn.date}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Pain {summary.latestCheckIn.painLevel}/10 • Swelling {summary.latestCheckIn.swellingLevel}/10
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {summary.latestCheckIn.notes || "No note provided."}
                </p>
              </div>
            ) : (
              <StatePanel className="mt-6" description="No check-ins were returned for this patient." title="No recent check-ins" />
            )}

            <div className="mt-6 grid gap-3">
              {summary?.openAlerts.length ? (
                summary.openAlerts.map((alert) => (
                  <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-4" key={alert.id}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
                      <div>
                        <p className="font-medium text-amber-900">{alert.summary || alert.type}</p>
                        <p className="mt-1 text-sm leading-7 text-amber-800">
                          Severity {alert.severity} • Triggered {new Date(alert.triggeredAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <StatePanel description="No open alerts are currently attached to this patient." title="No active alerts" />
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
