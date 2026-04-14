import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ClipboardCheck,
  Download,
  FileText,
  History,
  Package2,
  ShieldAlert,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";

import { api } from "@/api/client";
import { AlertResolutionDrawer } from "@/components/clinic/AlertResolutionDrawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClinicPatientSummary, DailyLogEntry, OperationalAlert } from "@/types";

type LocationState = {
  patientId?: string;
  displayName?: string;
  email?: string;
  activationCode?: string;
};

function formatDate(value?: string | Date | null) {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return typeof value === "string" ? value : null;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return typeof value === "string" ? value : null;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatPatientName(summary: ClinicPatientSummary | null) {
  return (
    summary?.patient?.displayName?.trim() ||
    summary?.patient?.email?.trim() ||
    "Patient detail"
  );
}

function openAlertSeverity(alert?: OperationalAlert | null) {
  return alert?.severity?.trim() || "Alert";
}

function openAlertSummary(alert?: OperationalAlert | null) {
  return alert?.summary?.trim() || alert?.reasons?.[0] || "Open recovery alert";
}

function formatDetailLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extractCheckInDetails(entry?: DailyLogEntry | null) {
  const details =
    entry?.details && typeof entry.details === "object" ? entry.details : null;
  if (!details) return [];

  const items: string[] = [];

  const medicationStatus = details["medicationStatus"];
  if (typeof medicationStatus === "string") {
    items.push(
      `Medication: ${
        medicationStatus === "missed_dose" ? "Missed dose" : "Taken as planned"
      }`
    );
  } else if (typeof details["tookMeds"] === "string" && details["tookMeds"]) {
    items.push(`Medication: ${String(details["tookMeds"])}`);
  }

  const mobility = details["mobility"] ?? details["movedAsRecommended"];
  if (typeof mobility === "string" && mobility) {
    items.push(`Mobility: ${formatDetailLabel(mobility)}`);
  }

  const woundStatus = details["woundStatus"] ?? details["siteChange"];
  if (typeof woundStatus === "string" && woundStatus) {
    items.push(`Incision: ${formatDetailLabel(woundStatus)}`);
  }

  const redFlags = Array.isArray(details["redFlags"])
    ? details["redFlags"].filter((value) => typeof value === "string" && value && value !== "None")
    : [];
  if (redFlags.length > 0) {
    items.push(`Red flags: ${redFlags.map((value) => formatDetailLabel(String(value))).join(", ")}`);
  }

  const sideEffectsOrConcerns = details["sideEffectsOrConcerns"];
  if (typeof sideEffectsOrConcerns === "string" && sideEffectsOrConcerns.trim()) {
    items.push(`Concerns: ${sideEffectsOrConcerns.trim()}`);
  } else if (Array.isArray(details["sideEffects"])) {
    const sideEffects = details["sideEffects"].filter(
      (value) => typeof value === "string" && value && value !== "None"
    );
    if (sideEffects.length > 0) {
      items.push(
        `Side effects: ${sideEffects.map((value) => formatDetailLabel(String(value))).join(", ")}`
      );
    }
  }

  const followUpRequested = details["followUpRequested"];
  if (followUpRequested === true) {
    items.push("Follow-up requested");
  }

  return items.slice(0, 4);
}

export default function ClinicPatientDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const routeState = (location.state ?? null) as LocationState | null;
  const patientId = params.patientId ?? routeState?.patientId ?? null;

  const [summary, setSummary] = useState<ClinicPatientSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const resolvedPatientId = patientId;

    let active = true;

    async function loadSummary() {
      setLoading(true);
      setError(null);

      try {
        const payload = await api<ClinicPatientSummary>(
          `/clinic/patients/${encodeURIComponent(resolvedPatientId)}/summary`,
          { method: "GET" }
        );

        if (!active) return;
        setSummary(payload);
      } catch {
        if (!active) return;
        setError("We couldn’t load this patient summary right now.");
        setSummary(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      active = false;
    };
  }, [patientId]);

  const latestCheckIn = summary?.latestCheckIn ?? null;
  const recentCheckIns = summary?.recentCheckIns ?? [];
  const openAlert = summary?.openAlerts?.[0] ?? null;
  const openAlerts = summary?.openAlerts ?? [];
  const headerDisplayName =
    formatPatientName(summary) !== "Patient detail"
      ? formatPatientName(summary)
      : routeState?.displayName?.trim() || routeState?.email?.trim() || "Patient detail";
  const headerEmail = summary?.patient?.email?.trim() || routeState?.email?.trim() || null;
  const headerActivationCode =
    summary?.activation?.activationCode?.trim() ||
    routeState?.activationCode?.trim() ||
    null;

  const metrics = useMemo(
    () => [
      {
        label: "Recovery day",
        value:
          typeof summary?.recovery?.currentRecoveryDay === "number"
            ? `Day ${summary.recovery.currentRecoveryDay}`
            : "Unavailable",
        icon: Stethoscope,
      },
      {
        label: "Latest pain",
        value:
          typeof latestCheckIn?.painLevel === "number"
            ? `${latestCheckIn.painLevel}/10`
            : "Unavailable",
        icon: ClipboardCheck,
      },
      {
        label: "Latest swelling",
        value:
          typeof latestCheckIn?.swellingLevel === "number"
            ? `${latestCheckIn.swellingLevel}/10`
            : "Unavailable",
        icon: TriangleAlert,
      },
      {
        label: "Open alerts",
        value: String(summary?.openAlerts?.length ?? 0),
        icon: ShieldAlert,
      },
    ],
    [latestCheckIn, summary?.openAlerts?.length, summary?.recovery?.currentRecoveryDay]
  );

  const panelClass =
    "rounded-[28px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6";
  const insetClass = "rounded-[22px] border border-black/5 bg-stone-50/75 p-4";

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-5 sm:space-y-6">
      <header className="space-y-3.5">
        <Button
          type="button"
          variant="ghost"
          className="h-9 self-start rounded-full px-3 text-muted-foreground"
          onClick={() => navigate("/clinic")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">
                Clinic portal
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {headerDisplayName}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm leading-6 text-muted-foreground">
                {headerEmail ? <span>{headerEmail}</span> : null}
                {headerActivationCode ? (
                  <span>Code: {headerActivationCode}</span>
                ) : null}
                {patientId ? <span>ID: {patientId}</span> : null}
              </div>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full border border-black/5 bg-stone-50/90 px-3 py-1.5 text-sm font-medium text-muted-foreground">
              <Download className="h-4 w-4" />
              Export
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <Card className={panelClass}>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={insetClass}>
                <div className="h-5 w-40 rounded-full bg-stone-200/70" />
                <div className="mt-3 h-4 w-full rounded-full bg-stone-200/60" />
                <div className="mt-2 h-4 w-4/5 rounded-full bg-stone-200/50" />
              </div>
            ))}
          </div>
        </Card>
      ) : error ? (
        <Card className={panelClass}>
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Unable to load patient detail
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">{error}</p>
            </div>
          </div>
        </Card>
      ) : !patientId ? (
        <Card className={panelClass}>
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                No patient selected
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Open a patient from the clinic dashboard to view their recovery summary here.
              </p>
            </div>
          </div>
        </Card>
      ) : !summary ? (
        <Card className={panelClass}>
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Summary unavailable
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                This patient summary is not available yet or may still be incomplete.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {openAlert ? (
            <Card className={panelClass}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">
                      {openAlertSeverity(openAlert)}
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {openAlertSummary(openAlert)}
                    </p>
                    {openAlert.triggeredAt ? (
                      <div className="text-xs text-muted-foreground">
                        Triggered {formatDateTime(openAlert.triggeredAt)}
                      </div>
                    ) : null}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="self-start"
                  onClick={() => setDrawerOpen(true)}
                >
                  Resolve Alert
                </Button>
              </div>
            </Card>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <Card key={metric.label} className={panelClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                        {metric.label}
                      </div>
                      <div className="text-2xl font-semibold tracking-tight text-foreground">
                        {metric.value}
                      </div>
                    </div>
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>

          {(summary.recovery?.simpleStatus || summary.recovery?.statusReasons?.length) ? (
            <Card className={panelClass}>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Recovery status
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {summary.recovery?.simpleStatus || "Status details unavailable"}
                </p>
                {summary.recovery?.statusReasons?.length ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {summary.recovery.statusReasons.map((reason) => (
                      <div
                        key={String(reason)}
                        className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700"
                      >
                        {reason}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card className={panelClass}>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    Recent check-ins
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Recent recovery updates and latest reported symptoms.
                  </p>
                </div>

                {summary.recentPainTrend || summary.recentSwellingTrend ? (
                  <div className={`${insetClass} text-sm leading-6 text-muted-foreground`}>
                    {summary.recentPainTrend ? <div>Pain trend: {summary.recentPainTrend}</div> : null}
                    {summary.recentSwellingTrend ? (
                      <div>Swelling trend: {summary.recentSwellingTrend}</div>
                    ) : null}
                  </div>
                ) : null}

                {recentCheckIns.length > 0 ? (
                  <div className="space-y-3">
                    {recentCheckIns.map((entry) => (
                      <div key={entry.date} className={insetClass}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-foreground">
                              {formatDate(entry.date) || entry.date}
                            </div>
                            {entry.notes ? (
                              <p className="text-sm leading-6 text-muted-foreground">
                                {entry.notes}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <div className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700">
                              Pain {entry.painLevel}/10
                            </div>
                            <div className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700">
                              Swelling {entry.swellingLevel}/10
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : latestCheckIn ? (
                  <div className={insetClass}>
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-foreground">
                        {formatDate(latestCheckIn.date) || latestCheckIn.date}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700">
                          Pain {latestCheckIn.painLevel}/10
                        </div>
                        <div className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700">
                          Swelling {latestCheckIn.swellingLevel}/10
                        </div>
                      </div>
                      {latestCheckIn.notes ? (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {latestCheckIn.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className={`${insetClass} text-sm leading-6 text-muted-foreground`}>
                    No recent check-ins are available yet.
                  </div>
                )}
              </div>
            </Card>

            <Card className={panelClass}>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    My Box
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Current recovery kit details tied to this patient.
                  </p>
                </div>

                <div className={insetClass}>
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
                      <Package2 className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">
                        {summary.myBox?.boxType || "Recovery kit"}
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {summary.myBox?.includedItems?.length
                          ? `${summary.myBox.includedItems.length} included items`
                          : "Included item details unavailable"}
                      </p>
                    </div>
                  </div>
                </div>

                {summary.myBox?.includedItems?.length ? (
                  <div className="space-y-2">
                    {summary.myBox.includedItems.slice(0, 6).map((item) => (
                      <div
                        key={item}
                        className="rounded-full bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Clinical History
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Recent patient updates, current alert context, and room for internal charting once the workflow is connected.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card className={panelClass}>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
                      <History className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        Recent check-in history
                      </h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Scannable patient updates from the most recent recovery entries.
                      </p>
                    </div>
                  </div>

                  {recentCheckIns.length > 0 ? (
                    <div className="space-y-3">
                      {recentCheckIns.map((entry) => {
                        const detailItems = extractCheckInDetails(entry);

                        return (
                          <div key={entry.date} className={insetClass}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <div className="text-sm font-semibold text-foreground">
                                  {formatDate(entry.date) || entry.date}
                                </div>
                                {entry.notes ? (
                                  <p className="text-sm leading-6 text-muted-foreground">
                                    {entry.notes}
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <div className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700">
                                  Pain {entry.painLevel}/10
                                </div>
                                <div className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700">
                                  Swelling {entry.swellingLevel}/10
                                </div>
                              </div>
                            </div>

                            {detailItems.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {detailItems.map((detail) => (
                                  <div
                                    key={detail}
                                    className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700"
                                  >
                                    {detail}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`${insetClass} text-sm leading-6 text-muted-foreground`}>
                      No recent check-in history is available yet.
                    </div>
                  )}
                </div>
              </Card>

              <div className="space-y-4">
                <Card className={panelClass}>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                          Open alert snapshot
                        </h3>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Current active alerts only. Resolved history will appear here once that workflow is connected.
                        </p>
                      </div>
                    </div>

                    {openAlerts.length > 0 ? (
                      <div className="space-y-3">
                        {openAlerts.map((alert) => (
                          <div key={alert.id} className={insetClass}>
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-foreground">
                                {openAlertSeverity(alert)}
                              </div>
                              <p className="text-sm leading-6 text-muted-foreground">
                                {openAlertSummary(alert)}
                              </p>
                              {alert.triggeredAt ? (
                                <div className="text-xs text-muted-foreground">
                                  Triggered {formatDateTime(alert.triggeredAt)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`${insetClass} text-sm leading-6 text-muted-foreground`}>
                        No current open alerts for this patient.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className={panelClass}>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                          Internal charting
                        </h3>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Resolution notes and internal charting entries can appear here once the workflow is wired.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-dashed border-black/10 bg-stone-50/75 p-4 text-sm leading-6 text-muted-foreground">
                      This panel is reserved for non-persistent clinician notes, follow-up summaries, and alert-resolution history once backend wiring is ready.
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </section>
        </>
      )}

      <AlertResolutionDrawer
        open={drawerOpen && Boolean(openAlert)}
        alert={openAlert}
        patientName={headerDisplayName}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
