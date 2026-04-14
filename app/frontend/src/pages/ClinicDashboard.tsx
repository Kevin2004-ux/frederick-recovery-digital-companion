import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ClipboardCheck,
  LogOut,
  Search,
  ShieldAlert,
  Stethoscope,
  TriangleAlert,
  Users,
} from "lucide-react";

import { api } from "@/api/client";
import { clearToken } from "@/auth/token";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ClinicPatientRow } from "@/types";

type DashboardFilter = "all" | "alerts" | "needs-review" | "missed-check-in";

const FILTER_OPTIONS: Array<{ value: DashboardFilter; label: string }> = [
  { value: "all", label: "All patients" },
  { value: "alerts", label: "Alerts only" },
  { value: "needs-review", label: "Needs review" },
  { value: "missed-check-in", label: "Missed check-in" },
];

type ClinicRosterResponse = {
  patients?: ClinicPatientRow[];
};

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function formatPatientName(patient: ClinicPatientRow) {
  return patient.displayName?.trim() || patient.email?.trim() || "Patient";
}

function formatRecoveryDay(day?: number | null) {
  return typeof day === "number" && day > 0 ? `Day ${day}` : "Recovery day unavailable";
}

function formatLastCheckIn(date?: string | null) {
  if (!date) return "No recent check-in";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function statusTone(patient: ClinicPatientRow) {
  if ((patient.unresolvedAlertCount ?? 0) > 0) {
    return "bg-rose-50 text-rose-700";
  }

  const status = normalizeText(patient.simpleStatus);
  if (status.includes("review")) return "bg-amber-50 text-amber-700";
  if (status.includes("track") || status.includes("stable")) {
    return "bg-emerald-50 text-emerald-700";
  }

  return "bg-stone-100 text-stone-700";
}

function matchesFilter(patient: ClinicPatientRow, filter: DashboardFilter) {
  const status = normalizeText(patient.simpleStatus);
  const reason = normalizeText(patient.primaryStatusReasonLabel ?? patient.primaryStatusReason);
  const hasAlerts = (patient.unresolvedAlertCount ?? 0) > 0;
  const recentCheckIn = patient.hasRecentCheckIn;

  if (filter === "alerts") return hasAlerts;
  if (filter === "needs-review") {
    return status.includes("review") || reason.includes("review");
  }
  if (filter === "missed-check-in") {
    return recentCheckIn === false || status.includes("missed") || reason.includes("missed");
  }

  return true;
}

function matchesSearch(patient: ClinicPatientRow, query: string) {
  if (!query) return true;

  const normalized = query.trim().toLowerCase();
  return [
    patient.displayName,
    patient.email,
    patient.activationCode,
    patient.code,
  ]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(normalized));
}

function needsReview(patient: ClinicPatientRow) {
  const status = normalizeText(patient.simpleStatus);
  const reason = normalizeText(patient.primaryStatusReasonLabel ?? patient.primaryStatusReason);
  return status.includes("review") || reason.includes("review");
}

function isOnTrack(patient: ClinicPatientRow) {
  const status = normalizeText(patient.simpleStatus);
  return status.includes("track") || status.includes("stable");
}

function missedCheckIn(patient: ClinicPatientRow) {
  const status = normalizeText(patient.simpleStatus);
  const reason = normalizeText(patient.primaryStatusReasonLabel ?? patient.primaryStatusReason);
  return patient.hasRecentCheckIn === false || status.includes("missed") || reason.includes("missed");
}

function formatOpenAlertSummary(patient: ClinicPatientRow) {
  const topAlert = patient.topOpenAlert;

  if (topAlert && typeof topAlert === "object") {
    const summary = (topAlert as Record<string, unknown>).summary;
    if (typeof summary === "string" && summary.trim()) {
      return summary.trim();
    }
  }

  if (typeof patient.primaryStatusReasonLabel === "string" && patient.primaryStatusReasonLabel.trim()) {
    return patient.primaryStatusReasonLabel.trim();
  }

  if (typeof patient.primaryStatusReason === "string" && patient.primaryStatusReason.trim()) {
    return patient.primaryStatusReason.trim();
  }

  return null;
}

export default function ClinicDashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<ClinicPatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DashboardFilter>("all");

  function onLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    let active = true;

    async function loadPatients() {
      setLoading(true);
      setError(null);

      try {
        const payload = await api<ClinicRosterResponse>("/clinic/patients", {
          method: "GET",
        });

        if (!active) return;
        setPatients(Array.isArray(payload?.patients) ? payload.patients : []);
      } catch {
        if (!active) return;
        setError("We couldn’t load the clinic roster right now.");
        setPatients([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPatients();

    return () => {
      active = false;
    };
  }, []);

  const filteredPatients = useMemo(() => {
    return patients.filter(
      (patient) => matchesFilter(patient, filter) && matchesSearch(patient, query)
    );
  }, [filter, patients, query]);

  const metrics = useMemo(() => {
    return {
      needsReview: patients.filter(needsReview).length,
      missedCheckIn: patients.filter(missedCheckIn).length,
      onTrack: patients.filter(isOnTrack).length,
      openAlerts: patients.reduce(
        (total, patient) => total + Math.max(patient.unresolvedAlertCount ?? 0, 0),
        0
      ),
    };
  }, [patients]);

  const panelClass =
    "rounded-[28px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6";
  const insetClass = "rounded-[22px] border border-black/5 bg-stone-50/75 p-4";

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-5 sm:space-y-6">
      <header className="space-y-3.5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/75">
            Frederick Recovery
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
                Clinic dashboard
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                Review the current patient roster, spot follow-up needs, and keep recovery activity easy to scan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-stone-50/90 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                <Stethoscope className="h-4 w-4" />
                Clinic portal
              </div>

              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-full px-3 text-muted-foreground"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Needs Review",
            value: metrics.needsReview,
            icon: ClipboardCheck,
            tone: "bg-amber-50 text-amber-700",
          },
          {
            label: "Missed Check-in",
            value: metrics.missedCheckIn,
            icon: Users,
            tone: "bg-stone-100 text-stone-700",
          },
          {
            label: "On Track",
            value: metrics.onTrack,
            icon: Stethoscope,
            tone: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "Open Alerts",
            value: metrics.openAlerts,
            icon: TriangleAlert,
            tone: "bg-rose-50 text-rose-700",
          },
        ].map((metric) => {
          const Icon = metric.icon;

          return (
            <Card key={metric.label} className={panelClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                    {metric.label}
                  </div>
                  <div className="text-3xl font-semibold tracking-tight text-foreground">
                    {metric.value}
                  </div>
                </div>
                <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl", metric.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="space-y-4">
        <Card className={panelClass}>
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by patient, email, or activation code"
                className="pl-11"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={filter === option.value ? "secondary" : "ghost"}
                  className="h-9 rounded-full px-4"
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {loading ? (
          <Card className={panelClass}>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className={insetClass}>
                  <div className="h-5 w-44 rounded-full bg-stone-200/70" />
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
                  Unable to load the roster
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">{error}</p>
              </div>
            </div>
          </Card>
        ) : filteredPatients.length === 0 ? (
          <Card className={panelClass}>
            <div className="space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {patients.length === 0 ? "No patients yet" : "No patients match this view"}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {patients.length === 0
                    ? "Patient activity will appear here once people are connected to your clinic roster."
                    : "Try a different search or switch filters to see more of the roster."}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPatients.map((patient) => (
              <Card
                key={patient.patientId ?? patient.id ?? patient.email ?? patient.activationCode}
                className={`${panelClass} transition-all hover:shadow-[0_16px_38px_rgba(15,23,42,0.06)]`}
              >
                <button
                  type="button"
                  disabled={!patient.patientId}
                  onClick={() => {
                    if (!patient.patientId) return;

                    navigate(`/clinic/patients/${encodeURIComponent(patient.patientId)}`, {
                      state: {
                        patientId: patient.patientId,
                        displayName: patient.displayName,
                        email: patient.email,
                        activationCode: patient.activationCode ?? patient.code,
                      },
                    });
                  }}
                  className={cn(
                    "w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2",
                    !patient.patientId && "cursor-default"
                  )}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                          {formatPatientName(patient)}
                        </h3>
                        <div
                          className={cn(
                            "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
                            statusTone(patient)
                          )}
                        >
                          {patient.primaryStatusReasonLabel || patient.simpleStatus || "Monitoring"}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm leading-6 text-muted-foreground">
                        {patient.email ? <span>{patient.email}</span> : null}
                        {patient.activationCode || patient.code ? (
                          <span>Code: {patient.activationCode ?? patient.code}</span>
                        ) : null}
                        <span>{formatRecoveryDay(patient.currentRecoveryDay)}</span>
                        <span>Last check-in: {formatLastCheckIn(patient.lastCheckInDate)}</span>
                      </div>

                      {formatOpenAlertSummary(patient) ? (
                        <div className="rounded-[22px] bg-stone-50/80 px-4 py-3 text-sm leading-6 text-muted-foreground">
                          {formatOpenAlertSummary(patient)}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      {(patient.unresolvedAlertCount ?? 0) > 0 ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">
                          <ShieldAlert className="h-4 w-4" />
                          {patient.unresolvedAlertCount} open alert
                          {patient.unresolvedAlertCount === 1 ? "" : "s"}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700">
                          <ClipboardCheck className="h-4 w-4" />
                          No open alerts
                        </div>
                      )}

                      <div className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span>{patient.patientId ? "View" : "Unavailable"}</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
