import { Download, FileStack, Plus, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatePanel } from "@/components/ui/StatePanel";
import { buildClinicPatientDetailRoute, routes } from "@/lib/routes";
import type { ClinicBatch, ClinicBatchCode, ClinicPatientRosterItem } from "@/types/clinic";

interface BatchListResponse {
  batches: ClinicBatch[];
}

interface BatchCodesResponse {
  batchId: string;
  batch: ClinicBatch;
  codes: ClinicBatchCode[];
}

interface PatientsResponse {
  patients: ClinicPatientRosterItem[];
}

export function ClinicDashboard() {
  const [patients, setPatients] = useState<ClinicPatientRosterItem[]>([]);
  const [batches, setBatches] = useState<ClinicBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [codes, setCodes] = useState<ClinicBatchCode[]>([]);
  const [error, setError] = useState("");
  const [codesError, setCodesError] = useState("");
  const [creating, setCreating] = useState(false);
  const [clinicTag, setClinicTag] = useState("");
  const [quantity, setQuantity] = useState(25);
  const [boxType, setBoxType] = useState("Recovery Starter");
  const [includedItems, setIncludedItems] = useState("icepack,Gauze,Medical tape");

  useEffect(() => {
    void Promise.allSettled([
      api.get<PatientsResponse>("/clinic/patients"),
      api.get<BatchListResponse>("/clinic/batches"),
    ]).then(([patientsResult, batchesResult]) => {
      if (patientsResult.status === "fulfilled") {
        setPatients(patientsResult.value.patients);
      } else {
        setError("Patient roster is unavailable right now. Batch tools can still be used if that endpoint is healthy.");
      }
      if (batchesResult.status === "fulfilled") {
        setBatches(batchesResult.value.batches);
        if (batchesResult.value.batches[0]) {
          setSelectedBatchId(batchesResult.value.batches[0].id);
          setClinicTag((current) => current || batchesResult.value.batches[0].clinicTag || "");
        }
      } else {
        setError((current) =>
          current
            ? `${current} Batch data is also unavailable right now.`
            : "Activation batches are unavailable right now.",
        );
      }
      if (patientsResult.status === "rejected" && batchesResult.status === "rejected") {
        setError(
          "Unable to load clinic data. This can happen if the backend rejects the current clinic context.",
        );
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedBatchId) {
      setCodes([]);
      setCodesError("");
      return;
    }
    void api
      .get<BatchCodesResponse>(`/clinic/batches/${selectedBatchId}/codes`)
      .then((response) => {
        setCodes(response.codes);
        setCodesError("");
      })
      .catch((caughtError) => {
        setCodes([]);
        setCodesError((caughtError as ApiError).message || "Unable to load codes for this batch.");
      });
  }, [selectedBatchId]);

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) || null,
    [batches, selectedBatchId],
  );
  const claimedCount = patients.filter((patient) => patient.patientId).length;
  const flaggedCount = patients.filter((patient) => patient.unresolvedAlertCount > 0).length;
  const totalCodeCount = batches.reduce((sum, batch) => sum + batch.quantity, 0);

  async function handleCreateBatch() {
    setCreating(true);
    setError("");
    try {
      const response = await api.post<{ batch: ClinicBatch }>("/clinic/batches", {
        clinicTag,
        quantity,
        boxType,
        includedItems: includedItems
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean)
          .map((label) => ({ label })),
      });
      setBatches((current) => [response.batch, ...current]);
      setSelectedBatchId(response.batch.id);
      setClinicTag(response.batch.clinicTag || clinicTag);
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to create a batch.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="bg-app">
      <div className="app-shell">
        <PageIntro
          description="Patient roster, activation batches, and code management all stay within the locked clinic endpoints."
          eyebrow="Clinic dashboard"
          title="Operations overview"
        />

        <section className="hero-panel">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
              <p className="text-sm text-slate-200">Active patients</p>
              <p className="mt-2 text-3xl font-semibold text-white">{claimedCount}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
              <p className="text-sm text-slate-200">Open patient alerts</p>
              <p className="mt-2 text-3xl font-semibold text-white">{flaggedCount}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
              <p className="text-sm text-slate-200">Batches</p>
              <p className="mt-2 text-3xl font-semibold text-white">{batches.length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
              <p className="text-sm text-slate-200">Total generated codes</p>
              <p className="mt-2 text-3xl font-semibold text-white">{totalCodeCount}</p>
            </div>
          </div>
        </section>

        {error ? (
          <StatePanel className="mt-5" description={error} title="Clinic data problem" tone="danger" />
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h2 className="section-title">Patient roster</h2>
                <p className="section-subtitle">
                  {patients.length} patient(s) returned from `/clinic/patients`.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {patients.length ? (
                patients.map((patient) => (
                  patient.patientId ? (
                    <Link
                      className="rounded-[26px] border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-slate-100"
                      key={patient.activationCode}
                      to={buildClinicPatientDetailRoute(patient.patientId)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {patient.displayName || "Unknown patient"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">Code {patient.activationCode}</p>
                        </div>
                        <Badge tone={patient.unresolvedAlertCount ? "warning" : "success"}>
                          {patient.simpleStatus || "Tracking"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p>Recovery day: {patient.currentRecoveryDay || "?"}</p>
                        <p>Last check-in: {patient.lastCheckInDate || "Not logged"}</p>
                        <p>Pain: {patient.lastPainLevel ?? "N/A"}</p>
                        <p>Swelling: {patient.lastSwellingLevel ?? "N/A"}</p>
                      </div>
                      {patient.topOpenAlert ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                          {patient.topOpenAlert.summary}
                        </div>
                      ) : null}
                    </Link>
                  ) : (
                    <div
                      className="rounded-[26px] border border-slate-100 bg-slate-50/70 p-4"
                      key={patient.activationCode}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {patient.displayName || "Unknown patient"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">Code {patient.activationCode}</p>
                        </div>
                        <Badge tone="warning">Unavailable</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        This patient record does not currently include a summary route target.
                      </p>
                    </div>
                  )
                ))
              ) : (
                <StatePanel description="No patients were returned for this clinic context." title="Patient roster empty" />
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                <FileStack className="h-6 w-6" />
              </div>
              <div>
                <h2 className="section-title">Activation batches</h2>
                <p className="section-subtitle">
                  Create batches and inspect codes without changing endpoint names.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 rounded-[30px] border border-slate-100 bg-slate-50/70 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="clinic-tag">
                    Clinic tag
                  </label>
                  <input
                    className="field"
                    id="clinic-tag"
                    onChange={(event) => setClinicTag(event.target.value)}
                    value={clinicTag}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="batch-quantity">
                    Quantity
                  </label>
                  <input
                    className="field"
                    id="batch-quantity"
                    min={1}
                    onChange={(event) => setQuantity(Number(event.target.value))}
                    type="number"
                    value={quantity}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="box-type">
                    Box type
                  </label>
                  <input
                    className="field"
                    id="box-type"
                    onChange={(event) => setBoxType(event.target.value)}
                    value={boxType}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="included-items">
                    Included items (comma separated)
                  </label>
                  <input
                    className="field"
                    id="included-items"
                    onChange={(event) => setIncludedItems(event.target.value)}
                    value={includedItems}
                  />
                </div>
              </div>

              <Button className="justify-center" disabled={creating} onClick={handleCreateBatch}>
                <Plus className="h-4 w-4" />
                {creating ? "Creating batch..." : "Create batch"}
              </Button>
            </div>

            <div className="mt-6 grid gap-3">
              {batches.map((batch) => (
                <button
                  className={`rounded-[26px] border px-4 py-4 text-left transition ${
                    selectedBatchId === batch.id
                      ? "border-brand-200 bg-brand-50/70"
                      : "border-slate-100 bg-slate-50/70 hover:bg-slate-100"
                  }`}
                  key={batch.id}
                  onClick={() => setSelectedBatchId(batch.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{batch.boxType || "Unnamed batch"}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Clinic tag: {batch.clinicTag || "Unassigned"}
                      </p>
                      {batch.codeCounts ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Unused {batch.codeCounts.unused} • Claimed {batch.codeCounts.claimed} •
                          Configured {batch.codeCounts.configured}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone="info">{batch.quantity} codes</Badge>
                  </div>
                </button>
              ))}
            </div>

            {selectedBatch ? (
              <div className="mt-6 rounded-[30px] border border-slate-100 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Batch codes</h3>
                    <p className="mt-1 text-sm text-slate-500">{selectedBatch.id}</p>
                  </div>
                  <Button
                    onClick={() => {
                      void api
                        .downloadBlob(
                          `/clinic/batches/${selectedBatch.id}/codes.csv`,
                          `activation-codes-${selectedBatch.id}.csv`,
                        )
                        .catch((caughtError) => {
                          setCodesError(
                            (caughtError as ApiError).message || "Unable to export batch codes.",
                          );
                        });
                    }}
                    variant="secondary"
                  >
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                </div>
                {codesError ? (
                  <StatePanel
                    className="mt-4"
                    description={codesError}
                    title="Batch code issue"
                    tone="danger"
                  />
                ) : null}
                <div className="mt-4 grid gap-3">
                  {codes.map((code) => (
                    <div className="rounded-[26px] border border-slate-100 bg-slate-50/70 p-4" key={code.code}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-mono text-sm text-slate-900">{code.code}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {code.claimedAt
                              ? `Claimed ${new Date(code.claimedAt).toLocaleDateString()}`
                              : "Not yet claimed"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={
                              code.status === "CLAIMED"
                                ? "success"
                                : code.status === "APPROVED"
                                  ? "info"
                                  : "neutral"
                            }
                          >
                            {code.status}
                          </Badge>
                          <Link
                            className="button-ghost px-3 py-2"
                            to={`${routes.clinicCodeManager}?code=${encodeURIComponent(code.code)}`}
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </main>
  );
}
