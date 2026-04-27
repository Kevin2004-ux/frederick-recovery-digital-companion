import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Download,
  Loader2,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";

import { api, apiBlob, ApiError } from "@/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type OwnerClinicSummary = {
  clinicTag: string;
  name?: string | null;
  createdAt: string;
  updatedAt: string;
  adminUserCount: number;
  batchCount: number;
  totalCodes: number;
  issuedCodes: number;
  draftCodes: number;
  approvedCodes: number;
  claimedCodes: number;
  invalidatedCodes: number;
  patientCount: number;
};

type OwnerClinicsResponse = {
  clinics?: OwnerClinicSummary[];
};

type CreateClinicResponse = {
  clinic: {
    clinicTag: string;
    name?: string | null;
  };
  adminUser: {
    id: string;
    email: string;
    role: "CLINIC";
    clinicTag: string;
    mfaEnabled: boolean;
    mfaRequired: boolean;
  };
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function normalizeClinicTag(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function formatCreateError(error: unknown) {
  const apiError = error as Partial<ApiError>;

  if (apiError?.code === "EMAIL_ALREADY_EXISTS") {
    return "That email is already attached to another account.";
  }

  if (apiError?.code === "CLINIC_ADMIN_ALREADY_EXISTS") {
    return "That clinic admin already exists.";
  }

  if (apiError?.code === "VALIDATION_ERROR") {
    return "Please review the clinic form and try again.";
  }

  return "We couldn’t create the clinic right now. Please try again.";
}

function formatListError(error: unknown) {
  const apiError = error as Partial<ApiError>;
  if (apiError?.code === "FORBIDDEN") return "Not authorized.";
  return "We couldn’t load clinic management right now.";
}

export default function OwnerClinics() {
  const [clinics, setClinics] = useState<OwnerClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingClinicTag, setDownloadingClinicTag] = useState<string | null>(null);
  const [form, setForm] = useState({
    clinicName: "",
    clinicTag: "",
    adminEmail: "",
    temporaryPassword: "",
    requireMfa: true,
  });

  async function loadClinics() {
    setLoading(true);
    setError(null);

    try {
      const payload = await api<OwnerClinicsResponse>("/owner/clinics", { method: "GET" });
      setClinics(Array.isArray(payload?.clinics) ? payload.clinics : []);
    } catch (nextError) {
      setError(formatListError(nextError));
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClinics();
  }, []);

  const stats = useMemo(() => {
    return clinics.reduce(
      (acc, clinic) => {
        acc.totalClinics += 1;
        acc.totalCodes += clinic.totalCodes;
        acc.totalAdmins += clinic.adminUserCount;
        acc.totalPatients += clinic.patientCount;
        return acc;
      },
      { totalClinics: 0, totalCodes: 0, totalAdmins: 0, totalPatients: 0 },
    );
  }, [clinics]);

  async function onCreateClinic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);

    try {
      const payload = await api<CreateClinicResponse>("/owner/clinics", {
        method: "POST",
        json: {
          clinicName: form.clinicName.trim(),
          clinicTag: normalizeClinicTag(form.clinicTag),
          adminEmail: form.adminEmail.trim().toLowerCase(),
          temporaryPassword: form.temporaryPassword,
          requireMfa: form.requireMfa,
        },
      });

      setSubmitSuccess(
        `Clinic ${payload.clinic.clinicTag} created. Admin login ready for ${payload.adminUser.email}.`,
      );
      setForm((current) => ({
        ...current,
        clinicName: "",
        clinicTag: "",
        adminEmail: "",
        temporaryPassword: "",
        requireMfa: true,
      }));
      await loadClinics();
    } catch (nextError) {
      setSubmitError(formatCreateError(nextError));
      setForm((current) => ({
        ...current,
        temporaryPassword: "",
      }));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDownloadClinicCsv(clinicTag: string) {
    setDownloadingClinicTag(clinicTag);

    try {
      const blob = await apiBlob(`/owner/clinics/${clinicTag}/codes.csv`, { method: "GET" });
      downloadBlob(blob, `activation-codes-${clinicTag}.csv`);
    } catch (nextError) {
      setError(formatListError(nextError));
    } finally {
      setDownloadingClinicTag(null);
    }
  }

  const panelClass =
    "rounded-[28px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6";

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-5 sm:space-y-6">
      <header className="space-y-3.5">
        <div className="space-y-2">
          <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">
            Owner Tools
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
                Clinic management
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                Create clinic admin accounts, review generated code activity, and download clinic-level CSV exports.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900">
              <ShieldCheck className="h-4 w-4" />
              OWNER only
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Clinics", value: stats.totalClinics, icon: Building2 },
          { label: "Admin users", value: stats.totalAdmins, icon: ShieldCheck },
          { label: "Activation codes", value: stats.totalCodes, icon: Download },
          { label: "Patients claimed", value: stats.totalPatients, icon: PlusCircle },
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
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <Card className={panelClass}>
          <CardHeader className="px-0 pt-0">
            <CardTitle>Create Clinic</CardTitle>
            <CardDescription>
              Create the clinic profile and first clinic admin login in one step.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            <form className="space-y-4" onSubmit={onCreateClinic}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Clinic name</label>
                <Input
                  value={form.clinicName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, clinicName: event.target.value }))
                  }
                  placeholder="Tallahassee Orthopedic Clinic"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Clinic tag</label>
                <Input
                  value={form.clinicTag}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      clinicTag: normalizeClinicTag(event.target.value),
                    }))
                  }
                  placeholder="tallahassee-ortho"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin email</label>
                <Input
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, adminEmail: event.target.value }))
                  }
                  placeholder="admin@clinic.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Temporary password</label>
                <Input
                  type="password"
                  value={form.temporaryPassword}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, temporaryPassword: event.target.value }))
                  }
                  placeholder="TempPassword123!"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-black/5 bg-stone-50/80 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
                  checked={form.requireMfa}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, requireMfa: event.target.checked }))
                  }
                />
                Require MFA at first setup
              </label>

              {submitError ? (
                <Alert variant="destructive">
                  <AlertTitle>Clinic creation failed</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}

              {submitSuccess ? (
                <Alert>
                  <AlertTitle>Clinic created</AlertTitle>
                  <AlertDescription>{submitSuccess}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full rounded-2xl" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating clinic…
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Clinic
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className={panelClass}>
          <CardHeader className="px-0 pt-0">
            <CardTitle>All clinics</CardTitle>
            <CardDescription>
              Review clinic activity, open detail views, and download full clinic CSV exports.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            {error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Unable to load clinics</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-stone-50/80 px-4 py-5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading clinics…
              </div>
            ) : clinics.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50/80 px-4 py-8 text-center text-sm text-muted-foreground">
                No clinics yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.16em] text-muted-foreground/75">
                      <th className="border-b border-black/5 px-3 py-3">Clinic name</th>
                      <th className="border-b border-black/5 px-3 py-3">Clinic tag</th>
                      <th className="border-b border-black/5 px-3 py-3">Admin users</th>
                      <th className="border-b border-black/5 px-3 py-3">Total codes</th>
                      <th className="border-b border-black/5 px-3 py-3">Issued</th>
                      <th className="border-b border-black/5 px-3 py-3">Draft</th>
                      <th className="border-b border-black/5 px-3 py-3">Approved</th>
                      <th className="border-b border-black/5 px-3 py-3">Claimed</th>
                      <th className="border-b border-black/5 px-3 py-3">Invalidated</th>
                      <th className="border-b border-black/5 px-3 py-3">Patient count</th>
                      <th className="border-b border-black/5 px-3 py-3">Batch count</th>
                      <th className="border-b border-black/5 px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinics.map((clinic) => (
                      <tr key={clinic.clinicTag} className="align-top text-foreground">
                        <td className="border-b border-black/5 px-3 py-3">
                          <div className="font-medium">{clinic.name || "Unnamed clinic"}</div>
                          <div className="text-xs text-muted-foreground">
                            Updated {formatDate(clinic.updatedAt)}
                          </div>
                        </td>
                        <td className="border-b border-black/5 px-3 py-3 font-mono text-xs">
                          {clinic.clinicTag}
                        </td>
                        <td className="border-b border-black/5 px-3 py-3">{clinic.adminUserCount}</td>
                        <td className="border-b border-black/5 px-3 py-3">{clinic.totalCodes}</td>
                        <td className="border-b border-black/5 px-3 py-3">{clinic.issuedCodes}</td>
                        <td className="border-b border-black/5 px-3 py-3">{clinic.draftCodes}</td>
                        <td className="border-b border-black/5 px-3 py-3">{clinic.approvedCodes}</td>
                        <td className="border-b border-black/5 px-3 py-3">{clinic.claimedCodes}</td>
                        <td className="border-b border-black/5 px-3 py-3">{clinic.invalidatedCodes}</td>
                        <td className="border-b border-black/5 px-3 py-3">{clinic.patientCount}</td>
                        <td className="border-b border-black/5 px-3 py-3">{clinic.batchCount}</td>
                        <td className="border-b border-black/5 px-3 py-3">
                          <div className="flex min-w-[13rem] flex-col gap-2">
                            <Button asChild variant="outline" className="justify-start rounded-xl">
                              <Link to={`/owner/clinics/${clinic.clinicTag}`}>View Details</Link>
                            </Button>
                            <Button
                              variant="ghost"
                              className="justify-start rounded-xl"
                              onClick={() => onDownloadClinicCsv(clinic.clinicTag)}
                              disabled={downloadingClinicTag === clinic.clinicTag}
                            >
                              {downloadingClinicTag === clinic.clinicTag ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Downloading…
                                </>
                              ) : (
                                <>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download Clinic CSV
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
