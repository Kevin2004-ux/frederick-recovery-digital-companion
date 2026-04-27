import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Download,
  Loader2,
  TableProperties,
} from "lucide-react";

import { api, apiBlob, ApiError } from "@/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type OwnerClinicDetailResponse = {
  clinic: {
    clinicTag: string;
    name?: string | null;
    defaultCategory?: string | null;
    notes?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  adminUsers: Array<{
    id: string;
    email: string;
    role: string;
    clinicTag?: string | null;
    mfaEnabled: boolean;
    lastLoginAt?: string | null;
    isBanned: boolean;
    lockedUntil?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  batches: Array<{
    id: string;
    clinicTag?: string | null;
    quantity: number;
    boxType?: string | null;
    createdAt?: string;
    createdByUserId?: string | null;
    codeCounts: {
      total: number;
      issued: number;
      draft: number;
      approved: number;
      claimed: number;
      invalidated: number;
    };
  }>;
  summary: {
    patientCount: number;
    batchCount: number;
    totalCodes: number;
    issuedCodes: number;
    draftCodes: number;
    approvedCodes: number;
    claimedCodes: number;
    invalidatedCodes: number;
  };
};

type OwnerClinicCodesResponse = {
  clinicTag: string;
  codes?: OwnerClinicCodeRow[];
};

type OwnerClinicCodeRow = {
  code: string;
  status: string;
  clinicTag?: string | null;
  batchId?: string | null;
  boxType?: string | null;
  createdAt?: string;
  claimedAt?: string | null;
  claimedByUserId?: string | null;
};

type OwnerClinicUserMutationResponse = {
  user: {
    id: string;
    email: string;
    role: string;
    clinicTag?: string | null;
    mfaEnabled: boolean;
    isBanned: boolean;
    lockedUntil?: string | null;
    lastLoginAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
};

type DeactivateClinicResponse = {
  ok: true;
  clinicTag: string;
  disabledClinicUsersCount: number;
  invalidatedCodesCount: number;
  claimedCodesPreservedCount: number;
};

type DeleteClinicResponse = {
  ok: true;
  clinicTag: string;
  deleted: {
    clinicUsers: number;
    activationCodes: number;
    activationBatches: number;
    recoveryTemplates: number;
    clinicPlanConfig: number;
  };
};

type DeleteClinicBlockedResponse = {
  code: "CLINIC_HAS_ACTIVITY";
  message: string;
  activity?: {
    claimedCodesCount: number;
    logEntriesCount: number;
    recoveryPlansCount: number;
    operationalAlertsCount: number;
    reminderOutboxCount: number;
  };
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

function formatError(error: unknown, fallback: string) {
  const apiError = error as Partial<ApiError>;
  if (apiError?.code === "NOT_FOUND") return "That clinic could not be found.";
  return fallback;
}

function formatUserActionError(error: unknown, fallback: string) {
  const apiError = error as Partial<ApiError>;

  if (apiError?.code === "EMAIL_ALREADY_EXISTS") {
    return "That email is already attached to another account.";
  }

  if (apiError?.code === "CLINIC_NOT_FOUND") {
    return "Clinic was not found.";
  }

  if (apiError?.code === "TARGET_NOT_CLINIC_USER") {
    return "Only clinic users can be managed here.";
  }

  if (apiError?.code === "VALIDATION_ERROR") {
    return "Please review the fields and try again.";
  }

  if (apiError?.code === "NOT_FOUND") {
    return "That clinic user could not be found.";
  }

  return fallback;
}

function formatClinicLifecycleError(error: unknown, fallback: string) {
  const apiError = error as Partial<ApiError>;

  if (apiError?.code === "CLINIC_HAS_ACTIVITY") {
    return "This clinic has activity. Use Deactivate instead.";
  }

  if (apiError?.code === "NOT_FOUND") {
    return "That clinic could not be found.";
  }

  return fallback;
}

function getUserStatus(user: OwnerClinicDetailResponse["adminUsers"][number]) {
  if (user.isBanned) return "Disabled";

  if (user.lockedUntil) {
    const lockedUntil = new Date(user.lockedUntil);
    if (!Number.isNaN(lockedUntil.getTime()) && lockedUntil.getTime() > Date.now()) {
      return "Locked";
    }
  }

  return "Active";
}

export default function OwnerClinicDetail() {
  const { clinicTag = "" } = useParams();
  const [detail, setDetail] = useState<OwnerClinicDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<OwnerClinicCodeRow[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesLoaded, setCodesLoaded] = useState(false);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [downloadingClinic, setDownloadingClinic] = useState(false);
  const [downloadingBatchId, setDownloadingBatchId] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({
    email: "",
    temporaryPassword: "",
    requireMfa: true,
  });
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionSuccess, setUserActionSuccess] = useState<string | null>(null);
  const [clinicActionLoading, setClinicActionLoading] = useState<"deactivate" | "delete" | null>(null);
  const [clinicActionError, setClinicActionError] = useState<string | null>(null);
  const [clinicActionSuccess, setClinicActionSuccess] = useState<string | null>(null);
  const [deleteBlockedActivity, setDeleteBlockedActivity] = useState<DeleteClinicBlockedResponse["activity"] | null>(null);

  const loadDetail = useCallback(async (showPageLoader = true) => {
    if (showPageLoader) {
      setLoading(true);
    }
    setError(null);

    try {
      const payload = await api<OwnerClinicDetailResponse>(`/owner/clinics/${clinicTag}`, {
        method: "GET",
      });
      setDetail(payload);
    } catch (nextError) {
      setError(formatError(nextError, "We couldn’t load this clinic right now."));
      setDetail(null);
    } finally {
      if (showPageLoader) {
        setLoading(false);
      }
    }
  }, [clinicTag]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function loadCodes(nextBatchId?: string | null) {
    setCodesLoading(true);
    setCodesError(null);

    try {
      const payload = await api<OwnerClinicCodesResponse>(
        `/owner/clinics/${clinicTag}/codes?limit=500`,
        { method: "GET" },
      );
      setCodes(Array.isArray(payload?.codes) ? payload.codes : []);
      setCodesLoaded(true);
      setActiveBatchId(nextBatchId ?? null);
    } catch (nextError) {
      setCodesError(formatError(nextError, "We couldn’t load clinic codes right now."));
    } finally {
      setCodesLoading(false);
    }
  }

  async function onDownloadClinicCsv() {
    setDownloadingClinic(true);

    try {
      const blob = await apiBlob(`/owner/clinics/${clinicTag}/codes.csv`, { method: "GET" });
      downloadBlob(blob, `activation-codes-${clinicTag}.csv`);
    } catch (nextError) {
      setError(formatError(nextError, "We couldn’t download the clinic CSV right now."));
    } finally {
      setDownloadingClinic(false);
    }
  }

  async function onDownloadBatchCsv(batchId: string) {
    setDownloadingBatchId(batchId);

    try {
      const blob = await apiBlob(`/owner/batches/${batchId}/codes.csv`, { method: "GET" });
      downloadBlob(blob, `activation-codes-batch-${batchId}.csv`);
    } catch (nextError) {
      setError(formatError(nextError, "We couldn’t download that batch CSV right now."));
    } finally {
      setDownloadingBatchId(null);
    }
  }

  async function onAddClinicUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminSubmitting(true);
    setAdminError(null);
    setAdminSuccess(null);
    setUserActionError(null);
    setUserActionSuccess(null);

    try {
      const payload = await api<OwnerClinicUserMutationResponse>("/owner/clinic-users", {
        method: "POST",
        json: {
          clinicTag,
          email: adminForm.email.trim().toLowerCase(),
          temporaryPassword: adminForm.temporaryPassword,
          requireMfa: adminForm.requireMfa,
        },
      });

      setAdminSuccess(`Clinic admin added for ${payload.user.email}.`);
      setAdminForm({
        email: "",
        temporaryPassword: "",
        requireMfa: true,
      });
      await loadDetail(false);
    } catch (nextError) {
      setAdminError(
        formatUserActionError(nextError, "We couldn’t add that clinic admin right now."),
      );
      setAdminForm((current) => ({
        ...current,
        temporaryPassword: "",
      }));
    } finally {
      setAdminSubmitting(false);
    }
  }

  async function onResetPassword(userId: string) {
    if (!resetPassword.trim()) {
      setUserActionError("Enter a temporary password before submitting.");
      return;
    }

    setUserActionLoading(`reset:${userId}`);
    setUserActionError(null);
    setUserActionSuccess(null);
    setAdminError(null);
    setAdminSuccess(null);

    try {
      const payload = await api<OwnerClinicUserMutationResponse>(
        `/owner/clinic-users/${userId}/reset-password`,
        {
          method: "POST",
          json: {
            temporaryPassword: resetPassword,
          },
        },
      );

      setUserActionSuccess(`Temporary password reset for ${payload.user.email}.`);
      setResetUserId(null);
      setResetPassword("");
      await loadDetail(false);
    } catch (nextError) {
      setUserActionError(
        formatUserActionError(nextError, "We couldn’t reset that password right now."),
      );
      setResetPassword("");
    } finally {
      setUserActionLoading(null);
    }
  }

  async function onDeactivateClinic() {
    const confirmed = window.confirm(
      "This disables clinic logins and invalidates unused codes. Claimed patient records and audit history are preserved. This cannot automatically restore invalidated codes.",
    );

    if (!confirmed) return;

    setClinicActionLoading("deactivate");
    setClinicActionError(null);
    setClinicActionSuccess(null);
    setDeleteBlockedActivity(null);

    try {
      const payload = await api<DeactivateClinicResponse>(`/owner/clinics/${clinicTag}/deactivate`, {
        method: "POST",
      });

      setClinicActionSuccess(
        `Clinic deactivated. Disabled ${payload.disabledClinicUsersCount} clinic user(s), invalidated ${payload.invalidatedCodesCount} unused code(s), preserved ${payload.claimedCodesPreservedCount} claimed code(s).`,
      );
      await loadDetail(false);
    } catch (nextError) {
      setClinicActionError(
        formatClinicLifecycleError(nextError, "We couldn’t deactivate this clinic right now."),
      );
    } finally {
      setClinicActionLoading(null);
    }
  }

  async function onDeleteClinic() {
    const confirmed = window.confirm(
      "Hard delete is only for empty test clinics. Clinics with claimed patients, logs, recovery plans, alerts, or reminder history will be blocked.",
    );

    if (!confirmed) return;

    setClinicActionLoading("delete");
    setClinicActionError(null);
    setClinicActionSuccess(null);
    setDeleteBlockedActivity(null);

    try {
      const payload = await api<DeleteClinicResponse>(`/owner/clinics/${clinicTag}`, {
        method: "DELETE",
      });

      setClinicActionSuccess(
        `Deleted test clinic ${payload.clinicTag}. Removed ${payload.deleted.clinicUsers} clinic user(s), ${payload.deleted.activationCodes} activation code(s), and ${payload.deleted.activationBatches} batch(es).`,
      );
      window.setTimeout(() => {
        window.location.assign("/owner/clinics");
      }, 250);
    } catch (nextError) {
      const apiError = nextError as Partial<ApiError>;
      if (apiError?.code === "CLINIC_HAS_ACTIVITY") {
        const issues = apiError.issues as DeleteClinicBlockedResponse["activity"] | undefined;
        setDeleteBlockedActivity(issues ?? null);
      }

      setClinicActionError(
        formatClinicLifecycleError(nextError, "We couldn’t delete this clinic right now."),
      );
    } finally {
      setClinicActionLoading(null);
    }
  }

  async function onDisableUser(userId: string, email: string) {
    if (!window.confirm(`Disable clinic admin ${email}?`)) {
      return;
    }

    setUserActionLoading(`disable:${userId}`);
    setUserActionError(null);
    setUserActionSuccess(null);

    try {
      const payload = await api<OwnerClinicUserMutationResponse>(
        `/owner/clinic-users/${userId}/disable`,
        { method: "POST" },
      );
      setUserActionSuccess(`${payload.user.email} has been disabled.`);
      await loadDetail(false);
    } catch (nextError) {
      setUserActionError(
        formatUserActionError(nextError, "We couldn’t disable that clinic user right now."),
      );
    } finally {
      setUserActionLoading(null);
    }
  }

  async function onEnableUser(userId: string) {
    setUserActionLoading(`enable:${userId}`);
    setUserActionError(null);
    setUserActionSuccess(null);

    try {
      const payload = await api<OwnerClinicUserMutationResponse>(
        `/owner/clinic-users/${userId}/enable`,
        { method: "POST" },
      );
      setUserActionSuccess(`${payload.user.email} has been re-enabled.`);
      await loadDetail(false);
    } catch (nextError) {
      setUserActionError(
        formatUserActionError(nextError, "We couldn’t enable that clinic user right now."),
      );
    } finally {
      setUserActionLoading(null);
    }
  }

  const visibleCodes = useMemo(() => {
    if (!activeBatchId) return codes;
    return codes.filter((code) => code.batchId === activeBatchId);
  }, [activeBatchId, codes]);

  const panelClass =
    "rounded-[28px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6";

  if (loading) {
    return (
      <Card className={panelClass}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading clinic details…
        </div>
      </Card>
    );
  }

  if (!detail) {
    return (
      <Card className={panelClass}>
        <div className="space-y-4">
          <Button asChild variant="outline" className="rounded-2xl">
            <Link to="/owner/clinics">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to clinic management
            </Link>
          </Button>

          <Alert variant="destructive">
            <AlertTitle>Unable to load clinic</AlertTitle>
            <AlertDescription>{error ?? "This clinic is unavailable right now."}</AlertDescription>
          </Alert>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-5 sm:space-y-6">
      <header className="space-y-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Button asChild variant="ghost" className="h-9 rounded-full px-0 text-muted-foreground">
              <Link to="/owner/clinics">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to clinic management
              </Link>
            </Button>

            <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">
              Clinic Detail
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
              {detail.clinic.name || detail.clinic.clinicTag}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
              Review admin users, activation batches, and generated codes for{" "}
              <span className="font-mono text-foreground">{detail.clinic.clinicTag}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => void loadCodes(null)}
              disabled={codesLoading}
            >
              {codesLoading && !codesLoaded ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading codes…
                </>
              ) : (
                <>
                  <TableProperties className="mr-2 h-4 w-4" />
                  View Codes
                </>
              )}
            </Button>

            <Button className="rounded-2xl" onClick={onDownloadClinicCsv} disabled={downloadingClinic}>
              {downloadingClinic ? (
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
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {userActionError ? (
        <Alert variant="destructive">
          <AlertTitle>Clinic admin action failed</AlertTitle>
          <AlertDescription>{userActionError}</AlertDescription>
        </Alert>
      ) : null}

      {userActionSuccess ? (
        <Alert>
          <AlertTitle>Clinic admin updated</AlertTitle>
          <AlertDescription>{userActionSuccess}</AlertDescription>
        </Alert>
      ) : null}

      {clinicActionError ? (
        <Alert variant="destructive">
          <AlertTitle>Clinic action failed</AlertTitle>
          <AlertDescription>{clinicActionError}</AlertDescription>
        </Alert>
      ) : null}

      {clinicActionSuccess ? (
        <Alert>
          <AlertTitle>Clinic updated</AlertTitle>
          <AlertDescription>{clinicActionSuccess}</AlertDescription>
        </Alert>
      ) : null}

      {deleteBlockedActivity ? (
        <Alert variant="destructive">
          <AlertTitle>Delete blocked</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>This clinic has activity. Use Deactivate instead.</p>
              <div className="grid gap-1 text-xs text-red-900/80 sm:grid-cols-2">
                <span>Claimed codes: {deleteBlockedActivity.claimedCodesCount}</span>
                <span>Log entries: {deleteBlockedActivity.logEntriesCount}</span>
                <span>Recovery plans: {deleteBlockedActivity.recoveryPlansCount}</span>
                <span>Operational alerts: {deleteBlockedActivity.operationalAlertsCount}</span>
                <span>Reminder outbox: {deleteBlockedActivity.reminderOutboxCount}</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className={panelClass}>
          <CardHeader className="px-0 pt-0">
            <CardTitle>Clinic profile</CardTitle>
            <CardDescription>Core clinic settings and timestamps.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-0 pb-0 md:grid-cols-2">
            {[
              ["Name", detail.clinic.name || "Unnamed clinic"],
              ["Clinic tag", detail.clinic.clinicTag],
              ["Default category", detail.clinic.defaultCategory || "—"],
              ["Notes", detail.clinic.notes || "—"],
              ["Created", formatDateTime(detail.clinic.createdAt)],
              ["Updated", formatDateTime(detail.clinic.updatedAt)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-black/5 bg-stone-50/75 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                  {label}
                </div>
                <div className="mt-2 text-sm text-foreground">{value}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={panelClass}>
          <CardHeader className="px-0 pt-0">
            <CardTitle>Clinic summary</CardTitle>
            <CardDescription>Batch, code, and patient activity at a glance.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-0 pb-0 md:grid-cols-2">
            {[
              ["Patient count", detail.summary.patientCount],
              ["Batch count", detail.summary.batchCount],
              ["Total codes", detail.summary.totalCodes],
              ["Issued", detail.summary.issuedCodes],
              ["Draft", detail.summary.draftCodes],
              ["Approved", detail.summary.approvedCodes],
              ["Claimed", detail.summary.claimedCodes],
              ["Invalidated", detail.summary.invalidatedCodes],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-black/5 bg-stone-50/75 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                  {label}
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className={panelClass}>
        <CardHeader className="px-0 pt-0">
          <CardTitle>Clinic lifecycle actions</CardTitle>
          <CardDescription>
            Deactivate clinics safely or hard-delete empty test clinics only.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-0 pb-0 md:grid-cols-2">
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-amber-950">Deactivate clinic</h3>
              <p className="text-sm leading-6 text-amber-900/80">
                Disables clinic logins and invalidates unused codes while preserving claimed patient records and audit history.
              </p>
              <Button
                variant="outline"
                className="rounded-2xl border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                onClick={() => void onDeactivateClinic()}
                disabled={clinicActionLoading === "deactivate"}
              >
                {clinicActionLoading === "deactivate" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deactivating…
                  </>
                ) : (
                  "Deactivate Clinic"
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-red-200/70 bg-red-50/80 p-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-red-950">Delete test clinic</h3>
              <p className="text-sm leading-6 text-red-900/80">
                Only for empty test clinics. Clinics with claimed patients, logs, recovery plans, alerts, or reminder history will be blocked.
              </p>
              <Button
                variant="outline"
                className="rounded-2xl border-red-300 bg-white text-red-900 hover:bg-red-100"
                onClick={() => void onDeleteClinic()}
                disabled={clinicActionLoading === "delete"}
              >
                {clinicActionLoading === "delete" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  "Delete Test Clinic"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={panelClass}>
        <CardHeader className="px-0 pt-0">
          <CardTitle>Admin users</CardTitle>
          <CardDescription>Clinic login accounts provisioned for this clinic.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="mb-5 rounded-[24px] border border-black/5 bg-stone-50/80 p-4 sm:p-5">
            <div className="mb-4 space-y-1">
              <h3 className="text-base font-semibold text-foreground">Add clinic admin</h3>
              <p className="text-sm text-muted-foreground">
                Provision another clinic user for this clinic.
              </p>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={onAddClinicUser}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={adminForm.email}
                  onChange={(event) =>
                    setAdminForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="nurselead@clinic.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Temporary password</label>
                <Input
                  type="password"
                  value={adminForm.temporaryPassword}
                  onChange={(event) =>
                    setAdminForm((current) => ({
                      ...current,
                      temporaryPassword: event.target.value,
                    }))
                  }
                  placeholder="TempPassword123!"
                />
              </div>

              <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-black/5 bg-white/80 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
                  checked={adminForm.requireMfa}
                  onChange={(event) =>
                    setAdminForm((current) => ({
                      ...current,
                      requireMfa: event.target.checked,
                    }))
                  }
                />
                Require MFA at first setup
              </label>

              {adminError ? (
                <Alert variant="destructive" className="md:col-span-2">
                  <AlertTitle>Unable to add clinic admin</AlertTitle>
                  <AlertDescription>{adminError}</AlertDescription>
                </Alert>
              ) : null}

              {adminSuccess ? (
                <Alert className="md:col-span-2">
                  <AlertTitle>Clinic admin added</AlertTitle>
                  <AlertDescription>{adminSuccess}</AlertDescription>
                </Alert>
              ) : null}

              <div className="md:col-span-2">
                <Button type="submit" className="rounded-2xl" disabled={adminSubmitting}>
                  {adminSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding clinic admin…
                    </>
                  ) : (
                    "Add Clinic Admin"
                  )}
                </Button>
              </div>
            </form>
          </div>

          {detail.adminUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50/80 px-4 py-8 text-center text-sm text-muted-foreground">
              No admin users yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.16em] text-muted-foreground/75">
                    <th className="border-b border-black/5 px-3 py-3">Email</th>
                    <th className="border-b border-black/5 px-3 py-3">Role</th>
                    <th className="border-b border-black/5 px-3 py-3">MFA</th>
                    <th className="border-b border-black/5 px-3 py-3">Status</th>
                    <th className="border-b border-black/5 px-3 py-3">Last login</th>
                    <th className="border-b border-black/5 px-3 py-3">Created</th>
                    <th className="border-b border-black/5 px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.adminUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="border-b border-black/5 px-3 py-3">
                        <div className="font-medium">{user.email}</div>
                        <div className="text-xs text-muted-foreground">{user.id}</div>
                      </td>
                      <td className="border-b border-black/5 px-3 py-3">{user.role}</td>
                      <td className="border-b border-black/5 px-3 py-3">
                        {user.mfaEnabled ? "Yes" : "No"}
                      </td>
                      <td className="border-b border-black/5 px-3 py-3">{getUserStatus(user)}</td>
                      <td className="border-b border-black/5 px-3 py-3">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="border-b border-black/5 px-3 py-3">{formatDateTime(user.createdAt)}</td>
                      <td className="border-b border-black/5 px-3 py-3">
                        <div className="flex min-w-[14rem] flex-col gap-2">
                          {resetUserId === user.id ? (
                            <div className="rounded-2xl border border-black/5 bg-stone-50/80 p-3">
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                                  New temporary password
                                </label>
                                <Input
                                  type="password"
                                  value={resetPassword}
                                  onChange={(event) => setResetPassword(event.target.value)}
                                  placeholder="NewTempPassword123!"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => void onResetPassword(user.id)}
                                    disabled={userActionLoading === `reset:${user.id}`}
                                  >
                                    {userActionLoading === `reset:${user.id}` ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving…
                                      </>
                                    ) : (
                                      "Save"
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => {
                                      setResetUserId(null);
                                      setResetPassword("");
                                    }}
                                    disabled={userActionLoading === `reset:${user.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="justify-start rounded-xl"
                              onClick={() => {
                                setResetUserId(user.id);
                                setResetPassword("");
                                setUserActionError(null);
                                setUserActionSuccess(null);
                              }}
                            >
                              Reset Password
                            </Button>
                          )}

                          {user.isBanned ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="justify-start rounded-xl"
                              onClick={() => void onEnableUser(user.id)}
                              disabled={userActionLoading === `enable:${user.id}`}
                            >
                              {userActionLoading === `enable:${user.id}` ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Enabling…
                                </>
                              ) : (
                                "Enable User"
                              )}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="justify-start rounded-xl text-red-700 hover:text-red-800"
                              onClick={() => void onDisableUser(user.id, user.email)}
                              disabled={userActionLoading === `disable:${user.id}`}
                            >
                              {userActionLoading === `disable:${user.id}` ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Disabling…
                                </>
                              ) : (
                                "Disable User"
                              )}
                            </Button>
                          )}
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

      <Card className={panelClass}>
        <CardHeader className="px-0 pt-0">
          <CardTitle>Activation batches</CardTitle>
          <CardDescription>Generated batches and code counts for this clinic.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {detail.batches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50/80 px-4 py-8 text-center text-sm text-muted-foreground">
              No batches yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.16em] text-muted-foreground/75">
                    <th className="border-b border-black/5 px-3 py-3">Batch</th>
                    <th className="border-b border-black/5 px-3 py-3">Quantity</th>
                    <th className="border-b border-black/5 px-3 py-3">Box type</th>
                    <th className="border-b border-black/5 px-3 py-3">Created</th>
                    <th className="border-b border-black/5 px-3 py-3">Created by</th>
                    <th className="border-b border-black/5 px-3 py-3">Code counts</th>
                    <th className="border-b border-black/5 px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.batches.map((batch) => (
                    <tr key={batch.id} className={activeBatchId === batch.id ? "bg-emerald-50/35" : undefined}>
                      <td className="border-b border-black/5 px-3 py-3">
                        <div className="font-medium">{batch.id}</div>
                        <div className="text-xs text-muted-foreground">{batch.clinicTag || "—"}</div>
                      </td>
                      <td className="border-b border-black/5 px-3 py-3">{batch.quantity}</td>
                      <td className="border-b border-black/5 px-3 py-3">{batch.boxType || "—"}</td>
                      <td className="border-b border-black/5 px-3 py-3">{formatDateTime(batch.createdAt)}</td>
                      <td className="border-b border-black/5 px-3 py-3">{batch.createdByUserId || "—"}</td>
                      <td className="border-b border-black/5 px-3 py-3">
                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          <span>Total: {batch.codeCounts.total}</span>
                          <span>Issued: {batch.codeCounts.issued}</span>
                          <span>Draft: {batch.codeCounts.draft}</span>
                          <span>Approved: {batch.codeCounts.approved}</span>
                          <span>Claimed: {batch.codeCounts.claimed}</span>
                          <span>Invalidated: {batch.codeCounts.invalidated}</span>
                        </div>
                      </td>
                      <td className="border-b border-black/5 px-3 py-3">
                        <div className="flex min-w-[13rem] flex-col gap-2">
                          <Button
                            variant="outline"
                            className="justify-start rounded-xl"
                            onClick={() => void loadCodes(batch.id)}
                            disabled={codesLoading}
                          >
                            <TableProperties className="mr-2 h-4 w-4" />
                            View Codes
                          </Button>
                          <Button
                            variant="ghost"
                            className="justify-start rounded-xl"
                            onClick={() => void onDownloadBatchCsv(batch.id)}
                            disabled={downloadingBatchId === batch.id}
                          >
                            {downloadingBatchId === batch.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Downloading…
                              </>
                            ) : (
                              <>
                                <Download className="mr-2 h-4 w-4" />
                                Download Batch CSV
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

      <Card className={panelClass}>
        <CardHeader className="px-0 pt-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Generated codes</CardTitle>
              <CardDescription>
                {activeBatchId
                  ? `Showing codes for batch ${activeBatchId}.`
                  : "Showing clinic-wide code activity."}
              </CardDescription>
            </div>

            {codesLoaded && activeBatchId ? (
              <Button variant="outline" className="rounded-2xl" onClick={() => setActiveBatchId(null)}>
                <Building2 className="mr-2 h-4 w-4" />
                View all clinic codes
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {codesError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Unable to load codes</AlertTitle>
              <AlertDescription>{codesError}</AlertDescription>
            </Alert>
          ) : null}

          {!codesLoaded && !codesLoading ? (
            <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50/80 px-4 py-8 text-center text-sm text-muted-foreground">
              Select “View Codes” to load clinic or batch codes.
            </div>
          ) : codesLoading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-stone-50/80 px-4 py-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading codes…
            </div>
          ) : visibleCodes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50/80 px-4 py-8 text-center text-sm text-muted-foreground">
              No codes yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.16em] text-muted-foreground/75">
                    <th className="border-b border-black/5 px-3 py-3">Code</th>
                    <th className="border-b border-black/5 px-3 py-3">Status</th>
                    <th className="border-b border-black/5 px-3 py-3">Clinic tag</th>
                    <th className="border-b border-black/5 px-3 py-3">Batch ID</th>
                    <th className="border-b border-black/5 px-3 py-3">Box type</th>
                    <th className="border-b border-black/5 px-3 py-3">Created</th>
                    <th className="border-b border-black/5 px-3 py-3">Claimed</th>
                    <th className="border-b border-black/5 px-3 py-3">Claimed by</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCodes.map((code) => (
                    <tr key={`${code.code}-${code.batchId || "none"}`}>
                      <td className="border-b border-black/5 px-3 py-3 font-mono text-xs">{code.code}</td>
                      <td className="border-b border-black/5 px-3 py-3">{code.status}</td>
                      <td className="border-b border-black/5 px-3 py-3">{code.clinicTag || "—"}</td>
                      <td className="border-b border-black/5 px-3 py-3">{code.batchId || "—"}</td>
                      <td className="border-b border-black/5 px-3 py-3">{code.boxType || "—"}</td>
                      <td className="border-b border-black/5 px-3 py-3">{formatDateTime(code.createdAt)}</td>
                      <td className="border-b border-black/5 px-3 py-3">{formatDateTime(code.claimedAt)}</td>
                      <td className="border-b border-black/5 px-3 py-3">{code.claimedByUserId || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
