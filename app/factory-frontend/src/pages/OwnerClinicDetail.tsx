import { ArrowLeft, Building2, Download, Loader2, Save, TableProperties } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import type {
  ActivationCodeDetail,
  ActivationCodeDetailResponse,
  RecoveryLibraryAdminPayload,
  RecoveryLibraryProductMode,
} from "@/types";

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
    educationBundleId?: string | null;
    boxTemplateId?: string | null;
    productMode?: RecoveryLibraryProductMode;
    procedureName?: string | null;
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

type OwnerClinicCodeRow = {
  code: string;
  status: string;
  clinicTag?: string | null;
  batchId?: string | null;
  boxType?: string | null;
  educationBundleId?: string | null;
  boxTemplateId?: string | null;
  productMode?: RecoveryLibraryProductMode;
  procedureName?: string | null;
  assignedBoxItems?: Array<{ key?: string | null; label: string }>;
  assignedEducation?: {
    guideIds: string[];
    recommendedGuideIds: string[];
  };
  createdAt?: string;
  claimedAt?: string | null;
  claimedByUserId?: string | null;
};

type OwnerClinicCodesResponse = {
  clinicTag: string;
  codes?: OwnerClinicCodeRow[];
};

type CodeAssignmentForm = {
  educationBundleId: string;
  boxTemplateId: string;
  procedureName: string;
  productMode: RecoveryLibraryProductMode;
  assignedBoxItemsText: string;
  guideIdsText: string;
  recommendedGuideIdsText: string;
};

const EMPTY_CODE_ASSIGNMENT_FORM: CodeAssignmentForm = {
  educationBundleId: "",
  boxTemplateId: "",
  procedureName: "",
  productMode: "full_platform",
  assignedBoxItemsText: "",
  guideIdsText: "",
  recommendedGuideIdsText: "",
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

function formatClinicError(error: unknown, fallback: string) {
  const apiError = error as Partial<ApiError>;

  if (apiError?.code === "EMAIL_ALREADY_EXISTS") {
    return "That email is already attached to another account.";
  }

  if (apiError?.code === "CLINIC_ADMIN_ALREADY_EXISTS") {
    return "That clinic admin already exists.";
  }

  if (apiError?.code === "CLINIC_NOT_FOUND" || apiError?.code === "NOT_FOUND") {
    return "Clinic was not found.";
  }

  if (apiError?.code === "TARGET_NOT_CLINIC_USER") {
    return "Only clinic users can be managed here.";
  }

  if (apiError?.code === "CLINIC_HAS_ACTIVITY") {
    return "This clinic has activity. Use Deactivate instead.";
  }

  if (apiError?.code === "VALIDATION_ERROR") {
    return "Please review the fields and try again.";
  }

  return fallback;
}

function idsToText(ids: string[] = []) {
  return ids.join("\n");
}

function parseIdsText(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function boxItemsToText(items: Array<{ key?: string | null; label: string }> = []) {
  return items
    .map((item) => (item.key ? `${item.key}|${item.label}` : item.label))
    .join("\n");
}

function parseBoxItemsText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawKey, ...labelParts] = line.split("|");
      const label = labelParts.join("|").trim();

      if (label) {
        return {
          key: rawKey.trim() || null,
          label,
        };
      }

      return {
        label: line,
      };
    });
}

function codeDetailToForm(code: ActivationCodeDetail): CodeAssignmentForm {
  return {
    educationBundleId: code.educationBundleId ?? code.effectiveEducationBundleId ?? "",
    boxTemplateId: code.boxTemplateId ?? code.effectiveBoxTemplateId ?? "",
    procedureName: code.procedureName ?? code.effectiveProcedureName ?? "",
    productMode: code.productMode ?? code.effectiveProductMode ?? "full_platform",
    assignedBoxItemsText: boxItemsToText(code.assignedBoxItems),
    guideIdsText: idsToText(code.assignedEducation.guideIds),
    recommendedGuideIdsText: idsToText(code.assignedEducation.recommendedGuideIds),
  };
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

export default function OwnerClinicDetailPage() {
  const { clinicTag = "" } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<OwnerClinicDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [libraryPayload, setLibraryPayload] = useState<RecoveryLibraryAdminPayload | null>(null);
  const [libraryError, setLibraryError] = useState("");
  const [codes, setCodes] = useState<OwnerClinicCodeRow[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesLoaded, setCodesLoaded] = useState(false);
  const [codesError, setCodesError] = useState("");
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<ActivationCodeDetail | null>(null);
  const [codeEditorForm, setCodeEditorForm] = useState<CodeAssignmentForm>(
    EMPTY_CODE_ASSIGNMENT_FORM,
  );
  const [codeEditorLoading, setCodeEditorLoading] = useState(false);
  const [codeEditorSaving, setCodeEditorSaving] = useState(false);
  const [codeEditorError, setCodeEditorError] = useState("");
  const [codeEditorSuccess, setCodeEditorSuccess] = useState("");
  const [guidePickId, setGuidePickId] = useState("");
  const [downloadingClinic, setDownloadingClinic] = useState(false);
  const [downloadingBatchId, setDownloadingBatchId] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({
    email: "",
    temporaryPassword: "",
    requireMfa: true,
  });
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState("");
  const [userActionSuccess, setUserActionSuccess] = useState("");
  const [clinicActionLoading, setClinicActionLoading] = useState<"deactivate" | "delete" | null>(null);
  const [clinicActionError, setClinicActionError] = useState("");
  const [clinicActionSuccess, setClinicActionSuccess] = useState("");
  const [deleteBlockedActivity, setDeleteBlockedActivity] = useState<DeleteClinicBlockedResponse["activity"] | null>(null);

  const loadDetail = useCallback(async (showPageLoader = true) => {
    if (showPageLoader) setLoading(true);
    setError("");

    try {
      const payload = await api.get<OwnerClinicDetailResponse>(`/owner/clinics/${clinicTag}`);
      setDetail(payload);
    } catch (nextError) {
      setError(formatClinicError(nextError, "We couldn’t load this clinic right now."));
      setDetail(null);
    } finally {
      if (showPageLoader) setLoading(false);
    }
  }, [clinicTag]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    let active = true;

    async function loadLibraryOptions() {
      setLibraryError("");

      try {
        const payload = await api.get<RecoveryLibraryAdminPayload>("/education/library/admin");
        if (!active) return;
        setLibraryPayload(payload);
      } catch (nextError) {
        if (!active) return;
        setLibraryError(formatClinicError(nextError, "We couldn’t load library assignment options."));
      }
    }

    void loadLibraryOptions();

    return () => {
      active = false;
    };
  }, []);

  async function loadCodes(nextBatchId?: string | null) {
    setCodesLoading(true);
    setCodesError("");

    try {
      const payload = await api.get<OwnerClinicCodesResponse>(`/owner/clinics/${clinicTag}/codes?limit=500`);
      setCodes(Array.isArray(payload?.codes) ? payload.codes : []);
      setCodesLoaded(true);
      setActiveBatchId(nextBatchId ?? null);
    } catch (nextError) {
      setCodesError(formatClinicError(nextError, "We couldn’t load clinic codes right now."));
    } finally {
      setCodesLoading(false);
    }
  }

  async function handleOpenCode(code: string) {
    setCodeEditorLoading(true);
    setCodeEditorError("");
    setCodeEditorSuccess("");

    try {
      const payload = await api.get<ActivationCodeDetailResponse>(
        `/owner/activation-codes/${encodeURIComponent(code)}`,
      );
      setSelectedCode(payload.activationCode);
      setCodeEditorForm(codeDetailToForm(payload.activationCode));
      setGuidePickId("");
    } catch (nextError) {
      setCodeEditorError(formatClinicError(nextError, "We couldn’t load that activation code."));
    } finally {
      setCodeEditorLoading(false);
    }
  }

  async function handleSaveCodeAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCode) return;

    setCodeEditorSaving(true);
    setCodeEditorError("");
    setCodeEditorSuccess("");

    try {
      const payload = await api.put<ActivationCodeDetailResponse>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}`,
        {
          educationBundleId: codeEditorForm.educationBundleId || null,
          boxTemplateId: codeEditorForm.boxTemplateId || null,
          procedureName: codeEditorForm.procedureName.trim() || null,
          productMode: codeEditorForm.productMode,
          assignedBoxItems: parseBoxItemsText(codeEditorForm.assignedBoxItemsText),
          assignedEducation: {
            guideIds: parseIdsText(codeEditorForm.guideIdsText),
            recommendedGuideIds: parseIdsText(codeEditorForm.recommendedGuideIdsText),
          },
        },
      );

      setSelectedCode(payload.activationCode);
      setCodeEditorForm(codeDetailToForm(payload.activationCode));
      setCodeEditorSuccess(`Saved assignments for ${payload.activationCode.code}.`);
      setCodes((current) =>
        current.map((codeRow) =>
          codeRow.code === payload.activationCode.code
            ? {
                ...codeRow,
                educationBundleId: payload.activationCode.effectiveEducationBundleId,
                boxTemplateId: payload.activationCode.effectiveBoxTemplateId,
                productMode: payload.activationCode.effectiveProductMode,
                procedureName: payload.activationCode.effectiveProcedureName,
                assignedBoxItems: payload.activationCode.assignedBoxItems,
                assignedEducation: payload.activationCode.assignedEducation,
              }
            : codeRow,
        ),
      );
    } catch (nextError) {
      setCodeEditorError(formatClinicError(nextError, "We couldn’t save that activation code."));
    } finally {
      setCodeEditorSaving(false);
    }
  }

  function addGuideToCodeField(field: "guideIdsText" | "recommendedGuideIdsText") {
    if (!guidePickId) return;

    setCodeEditorForm((current) => {
      const nextIds = parseIdsText(current[field]);
      if (!nextIds.includes(guidePickId)) nextIds.push(guidePickId);

      return {
        ...current,
        [field]: idsToText(nextIds),
      };
    });
  }

  async function handleDownloadClinicCsv() {
    setDownloadingClinic(true);
    setError("");

    try {
      const blob = await api.blob(`/owner/clinics/${clinicTag}/codes.csv`);
      downloadBlob(blob, `activation-codes-${clinicTag}.csv`);
    } catch (nextError) {
      setError(formatClinicError(nextError, "We couldn’t download the clinic CSV right now."));
    } finally {
      setDownloadingClinic(false);
    }
  }

  async function handleDownloadBatchCsv(batchId: string) {
    setDownloadingBatchId(batchId);
    setError("");

    try {
      const blob = await api.blob(`/owner/batches/${batchId}/codes.csv`);
      downloadBlob(blob, `activation-codes-batch-${batchId}.csv`);
    } catch (nextError) {
      setError(formatClinicError(nextError, "We couldn’t download that batch CSV right now."));
    } finally {
      setDownloadingBatchId(null);
    }
  }

  async function handleAddClinicUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminSubmitting(true);
    setAdminError("");
    setAdminSuccess("");
    setUserActionError("");
    setUserActionSuccess("");

    try {
      const payload = await api.post<OwnerClinicUserMutationResponse>("/owner/clinic-users", {
        clinicTag,
        email: adminForm.email.trim().toLowerCase(),
        temporaryPassword: adminForm.temporaryPassword,
        requireMfa: adminForm.requireMfa,
      });

      setAdminSuccess(`Clinic admin added for ${payload.user.email}.`);
      setAdminForm({
        email: "",
        temporaryPassword: "",
        requireMfa: true,
      });
      await loadDetail(false);
    } catch (nextError) {
      setAdminError(formatClinicError(nextError, "We couldn’t add that clinic admin right now."));
      setAdminForm((current) => ({ ...current, temporaryPassword: "" }));
    } finally {
      setAdminSubmitting(false);
    }
  }

  async function handleResetPassword(userId: string) {
    if (!resetPassword.trim()) {
      setUserActionError("Enter a temporary password before submitting.");
      return;
    }

    setUserActionLoading(`reset:${userId}`);
    setUserActionError("");
    setUserActionSuccess("");
    setAdminError("");
    setAdminSuccess("");

    try {
      const payload = await api.post<OwnerClinicUserMutationResponse>(
        `/owner/clinic-users/${userId}/reset-password`,
        { temporaryPassword: resetPassword },
      );
      setUserActionSuccess(`Temporary password reset for ${payload.user.email}.`);
      setResetUserId(null);
      setResetPassword("");
      await loadDetail(false);
    } catch (nextError) {
      setUserActionError(formatClinicError(nextError, "We couldn’t reset that password right now."));
      setResetPassword("");
    } finally {
      setUserActionLoading(null);
    }
  }

  async function handleDisableUser(userId: string, email: string) {
    if (!window.confirm(`Disable clinic admin ${email}?`)) return;

    setUserActionLoading(`disable:${userId}`);
    setUserActionError("");
    setUserActionSuccess("");

    try {
      const payload = await api.post<OwnerClinicUserMutationResponse>(`/owner/clinic-users/${userId}/disable`);
      setUserActionSuccess(`${payload.user.email} has been disabled.`);
      await loadDetail(false);
    } catch (nextError) {
      setUserActionError(formatClinicError(nextError, "We couldn’t disable that clinic user right now."));
    } finally {
      setUserActionLoading(null);
    }
  }

  async function handleEnableUser(userId: string) {
    setUserActionLoading(`enable:${userId}`);
    setUserActionError("");
    setUserActionSuccess("");

    try {
      const payload = await api.post<OwnerClinicUserMutationResponse>(`/owner/clinic-users/${userId}/enable`);
      setUserActionSuccess(`${payload.user.email} has been re-enabled.`);
      await loadDetail(false);
    } catch (nextError) {
      setUserActionError(formatClinicError(nextError, "We couldn’t enable that clinic user right now."));
    } finally {
      setUserActionLoading(null);
    }
  }

  async function handleDeactivateClinic() {
    const confirmed = window.confirm(
      "This disables clinic logins and invalidates unused codes. Claimed patient records and audit history are preserved. This cannot automatically restore invalidated codes.",
    );
    if (!confirmed) return;

    setClinicActionLoading("deactivate");
    setClinicActionError("");
    setClinicActionSuccess("");
    setDeleteBlockedActivity(null);

    try {
      const payload = await api.post<DeactivateClinicResponse>(`/owner/clinics/${clinicTag}/deactivate`);
      setClinicActionSuccess(
        `Clinic deactivated. Disabled ${payload.disabledClinicUsersCount} clinic user(s), invalidated ${payload.invalidatedCodesCount} unused code(s), preserved ${payload.claimedCodesPreservedCount} claimed code(s).`,
      );
      await loadDetail(false);
    } catch (nextError) {
      setClinicActionError(formatClinicError(nextError, "We couldn’t deactivate this clinic right now."));
    } finally {
      setClinicActionLoading(null);
    }
  }

  async function handleDeleteClinic() {
    const confirmed = window.confirm(
      "Hard delete is only for empty test clinics. Clinics with claimed patients, logs, recovery plans, alerts, or reminder history will be blocked.",
    );
    if (!confirmed) return;

    setClinicActionLoading("delete");
    setClinicActionError("");
    setClinicActionSuccess("");
    setDeleteBlockedActivity(null);

    try {
      const payload = await api.delete<DeleteClinicResponse>(`/owner/clinics/${clinicTag}`);
      setClinicActionSuccess(
        `Deleted test clinic ${payload.clinicTag}. Removed ${payload.deleted.clinicUsers} clinic user(s), ${payload.deleted.activationCodes} activation code(s), and ${payload.deleted.activationBatches} batch(es).`,
      );
      window.setTimeout(() => {
        navigate("/owner/clinics", { replace: true });
      }, 250);
    } catch (nextError) {
      const apiError = nextError as Partial<ApiError> & {
        issues?: DeleteClinicBlockedResponse["activity"];
        activity?: DeleteClinicBlockedResponse["activity"];
      };
      if (apiError?.code === "CLINIC_HAS_ACTIVITY") {
        setDeleteBlockedActivity(apiError.issues ?? apiError.activity ?? null);
      }
      setClinicActionError(formatClinicError(nextError, "We couldn’t delete this clinic right now."));
    } finally {
      setClinicActionLoading(null);
    }
  }

  const visibleCodes = useMemo(() => {
    if (!activeBatchId) return codes;
    return codes.filter((code) => code.batchId === activeBatchId);
  }, [activeBatchId, codes]);

  const bundleNameById = useMemo(() => {
    return new Map((libraryPayload?.bundles ?? []).map((bundle) => [bundle.id, bundle.name]));
  }, [libraryPayload?.bundles]);

  const templateNameById = useMemo(() => {
    return new Map(
      (libraryPayload?.boxTemplates ?? []).map((template) => [template.id, template.name]),
    );
  }, [libraryPayload?.boxTemplates]);

  const selectedFormBundle =
    libraryPayload?.bundles.find((bundle) => bundle.id === codeEditorForm.educationBundleId) ?? null;
  const selectedFormTemplate =
    libraryPayload?.boxTemplates.find((template) => template.id === codeEditorForm.boxTemplateId) ?? null;

  if (loading) {
    return (
      <div className="page-shell">
        <div className="panel status-panel">
          <p className="eyebrow">Clinic Detail</p>
          <h1>Loading clinic details</h1>
          <p className="muted">Fetching clinic profile, admins, batches, and codes.</p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-shell">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Clinic Detail</p>
              <h1>Clinic unavailable</h1>
              <p className="muted">{error || "This clinic could not be loaded."}</p>
            </div>
            <Link className="button secondary" to="/owner/clinics">
              <ArrowLeft size={16} />
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="panel hero-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Clinic Detail</p>
            <h1>{detail.clinic.name || detail.clinic.clinicTag}</h1>
            <p className="muted">
              Review clinic profile, admin users, activation batches, and generated codes for{" "}
              <strong>{detail.clinic.clinicTag}</strong>.
            </p>
          </div>

          <div className="hero-actions">
            <Link className="button secondary" to="/owner/clinics">
              <ArrowLeft size={16} />
              Back
            </Link>
            <button className="button secondary" type="button" onClick={() => void loadCodes()} disabled={codesLoading}>
              {codesLoading && !codesLoaded ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Loading codes...
                </>
              ) : (
                <>
                  <TableProperties size={16} />
                  View Codes
                </>
              )}
            </button>
            <button className="button secondary" type="button" onClick={() => void handleDownloadClinicCsv()} disabled={downloadingClinic}>
              {downloadingClinic ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Download Clinic CSV
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {adminError ? <div className="alert error">{adminError}</div> : null}
      {adminSuccess ? <div className="alert success">{adminSuccess}</div> : null}
      {userActionError ? <div className="alert error">{userActionError}</div> : null}
      {userActionSuccess ? <div className="alert success">{userActionSuccess}</div> : null}
      {clinicActionError ? <div className="alert error">{clinicActionError}</div> : null}
      {clinicActionSuccess ? <div className="alert success">{clinicActionSuccess}</div> : null}
      {codesError ? <div className="alert error">{codesError}</div> : null}

      {deleteBlockedActivity ? (
        <div className="alert error">
          <strong>Delete blocked.</strong>
          <div className="owner-activity-grid">
            <span>Claimed codes: {deleteBlockedActivity.claimedCodesCount}</span>
            <span>Log entries: {deleteBlockedActivity.logEntriesCount}</span>
            <span>Recovery plans: {deleteBlockedActivity.recoveryPlansCount}</span>
            <span>Operational alerts: {deleteBlockedActivity.operationalAlertsCount}</span>
            <span>Reminder outbox: {deleteBlockedActivity.reminderOutboxCount}</span>
          </div>
        </div>
      ) : null}

      <section className="grid-two owner-detail-grid">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Clinic profile</p>
              <h2>Profile</h2>
              <p className="muted">Core clinic settings and timestamps.</p>
            </div>
          </div>

          <div className="grid-two">
            {[
              ["Name", detail.clinic.name || "Unnamed clinic"],
              ["Clinic tag", detail.clinic.clinicTag],
              ["Default category", detail.clinic.defaultCategory || "—"],
              ["Notes", detail.clinic.notes || "—"],
              ["Created", formatDateTime(detail.clinic.createdAt)],
              ["Updated", formatDateTime(detail.clinic.updatedAt)],
            ].map(([label, value]) => (
              <div key={label} className="info-card">
                <h3>{label}</h3>
                <p className="muted">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Clinic summary</p>
              <h2>Activity</h2>
              <p className="muted">Batch, code, and patient counts at a glance.</p>
            </div>
          </div>

          <div className="grid-two">
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
              <div key={label} className="info-card">
                <h3>{label}</h3>
                <p className="metric-value">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Activation code education</p>
            <h2>Code assignment editor</h2>
            <p className="muted">
              Select a generated code to adjust its bundle, box template, procedure, product mode,
              and code-level guide overrides.
            </p>
          </div>
        </div>

        {libraryError ? <div className="alert error">{libraryError}</div> : null}
        {codeEditorError ? <div className="alert error">{codeEditorError}</div> : null}
        {codeEditorSuccess ? <div className="alert success">{codeEditorSuccess}</div> : null}

        {codeEditorLoading ? (
          <div className="info-card">
            <Loader2 size={18} className="spin" />
            <p className="muted">Loading activation code assignment.</p>
          </div>
        ) : selectedCode ? (
          <form className="form-stack" onSubmit={handleSaveCodeAssignment}>
            <div className="grid-two">
              <div className="info-card">
                <h3>{selectedCode.code}</h3>
                <dl className="meta-list">
                  <div>
                    <dt>Status</dt>
                    <dd>{selectedCode.status}</dd>
                  </div>
                  <div>
                    <dt>Clinic</dt>
                    <dd>{selectedCode.clinicTag || "—"}</dd>
                  </div>
                  <div>
                    <dt>Claimed</dt>
                    <dd>{formatDateTime(selectedCode.claimedAt)}</dd>
                  </div>
                  <div>
                    <dt>Claimed by</dt>
                    <dd>{selectedCode.claimedByUserId || "—"}</dd>
                  </div>
                </dl>
              </div>

              <div className="info-card">
                <h3>Selected preview</h3>
                <p className="muted">
                  {selectedFormBundle
                    ? `${selectedFormBundle.name} · ${selectedFormBundle.moduleCount} guide(s)`
                    : "No education bundle selected."}
                </p>
                <p className="muted">
                  {selectedFormTemplate
                    ? `${selectedFormTemplate.name} · ${selectedFormTemplate.boxItemKeys.length} item key(s)`
                    : "No box template selected."}
                </p>
              </div>
            </div>

            <div className="grid-two">
              <label className="field">
                <span>Education bundle</span>
                <select
                  value={codeEditorForm.educationBundleId}
                  onChange={(event) =>
                    setCodeEditorForm((current) => ({
                      ...current,
                      educationBundleId: event.target.value,
                    }))
                  }
                >
                  <option value="">No bundle</option>
                  {(libraryPayload?.bundles ?? []).map((bundle) => (
                    <option key={bundle.id} value={bundle.id}>
                      {bundle.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Box template</span>
                <select
                  value={codeEditorForm.boxTemplateId}
                  onChange={(event) =>
                    setCodeEditorForm((current) => ({
                      ...current,
                      boxTemplateId: event.target.value,
                    }))
                  }
                >
                  <option value="">No template</option>
                  {(libraryPayload?.boxTemplates ?? []).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Procedure name</span>
                <input
                  type="text"
                  value={codeEditorForm.procedureName}
                  onChange={(event) =>
                    setCodeEditorForm((current) => ({
                      ...current,
                      procedureName: event.target.value,
                    }))
                  }
                  placeholder="Knee Replacement"
                />
              </label>

              <label className="field">
                <span>Product mode</span>
                <select
                  value={codeEditorForm.productMode}
                  onChange={(event) =>
                    setCodeEditorForm((current) => ({
                      ...current,
                      productMode: event.target.value as RecoveryLibraryProductMode,
                    }))
                  }
                >
                  <option value="kit_only">Kit-only</option>
                  <option value="full_platform">Full platform</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Code-level box item overrides</span>
              <textarea
                value={codeEditorForm.assignedBoxItemsText}
                onChange={(event) =>
                  setCodeEditorForm((current) => ({
                    ...current,
                    assignedBoxItemsText: event.target.value,
                  }))
                }
                placeholder={"icepack|Ice Pack\ncompression_socks|Compression Socks"}
                rows={4}
              />
            </label>

            <div className="info-card form-stack">
              <h3>Guide overrides</h3>
              <div className="grid-two">
                <label className="field">
                  <span>Select an existing guide</span>
                  <select value={guidePickId} onChange={(event) => setGuidePickId(event.target.value)}>
                    <option value="">Choose a guide</option>
                    {(libraryPayload?.modules ?? []).map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="action-stack">
                  <button
                    className="button secondary action-button"
                    type="button"
                    onClick={() => addGuideToCodeField("guideIdsText")}
                    disabled={!guidePickId}
                  >
                    Add selected
                  </button>
                  <button
                    className="button secondary action-button"
                    type="button"
                    onClick={() => addGuideToCodeField("recommendedGuideIdsText")}
                    disabled={!guidePickId}
                  >
                    Add recommended
                  </button>
                </div>
              </div>

              <div className="grid-two">
                <label className="field">
                  <span>Selected guide IDs</span>
                  <textarea
                    value={codeEditorForm.guideIdsText}
                    onChange={(event) =>
                      setCodeEditorForm((current) => ({
                        ...current,
                        guideIdsText: event.target.value,
                      }))
                    }
                    rows={4}
                  />
                </label>

                <label className="field">
                  <span>Recommended guide IDs</span>
                  <textarea
                    value={codeEditorForm.recommendedGuideIdsText}
                    onChange={(event) =>
                      setCodeEditorForm((current) => ({
                        ...current,
                        recommendedGuideIdsText: event.target.value,
                      }))
                    }
                    rows={4}
                  />
                </label>
              </div>
            </div>

            <button className="button primary" type="submit" disabled={codeEditorSaving}>
              {codeEditorSaving ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Saving
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save code assignment
                </>
              )}
            </button>
          </form>
        ) : (
          <p className="muted">Open a generated code to edit its education assignment.</p>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Clinic Admin Users</p>
            <h2>Manage clinic admins</h2>
            <p className="muted">Add clinic admins and manage account access.</p>
          </div>
        </div>

        <div className="info-card owner-form-card">
          <h3>Add clinic admin</h3>
          <form className="form-stack" onSubmit={handleAddClinicUser}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={adminForm.email}
                onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="nurselead@clinic.com"
                required
              />
            </label>

            <label className="field">
              <span>Temporary password</span>
              <input
                type="password"
                value={adminForm.temporaryPassword}
                onChange={(event) =>
                  setAdminForm((current) => ({ ...current, temporaryPassword: event.target.value }))
                }
                placeholder="TempPassword123!"
                required
              />
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={adminForm.requireMfa}
                onChange={(event) =>
                  setAdminForm((current) => ({ ...current, requireMfa: event.target.checked }))
                }
              />
              <span>Require MFA checkbox</span>
            </label>

            <button className="button primary" type="submit" disabled={adminSubmitting}>
              {adminSubmitting ? "Adding clinic admin..." : "Add Clinic Admin"}
            </button>
          </form>
        </div>

        <div className="table-wrap">
          {detail.adminUsers.length === 0 ? (
            <p className="muted">No admin users yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>MFA enabled</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {detail.adminUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="cell-strong">{user.email}</div>
                      <div className="cell-muted">{user.role}</div>
                    </td>
                    <td>{user.mfaEnabled ? "Yes" : "No"}</td>
                    <td>{getUserStatus(user)}</td>
                    <td>{formatDateTime(user.lastLoginAt)}</td>
                    <td>{formatDateTime(user.createdAt)}</td>
                    <td>
                      <div className="action-stack">
                        {resetUserId === user.id ? (
                          <div className="inline-reset-box">
                            <label className="field">
                              <span>New temporary password</span>
                              <input
                                type="password"
                                value={resetPassword}
                                onChange={(event) => setResetPassword(event.target.value)}
                                placeholder="NewTempPassword123!"
                              />
                            </label>
                            <div className="action-row">
                              <button
                                className="button primary action-button"
                                type="button"
                                onClick={() => void handleResetPassword(user.id)}
                                disabled={userActionLoading === `reset:${user.id}`}
                              >
                                {userActionLoading === `reset:${user.id}` ? "Saving..." : "Save"}
                              </button>
                              <button
                                className="button secondary action-button"
                                type="button"
                                onClick={() => {
                                  setResetUserId(null);
                                  setResetPassword("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="button secondary action-button"
                            type="button"
                            onClick={() => {
                              setResetUserId(user.id);
                              setResetPassword("");
                              setUserActionError("");
                              setUserActionSuccess("");
                            }}
                          >
                            Reset Password
                          </button>
                        )}

                        {user.isBanned ? (
                          <button
                            className="button secondary action-button"
                            type="button"
                            onClick={() => void handleEnableUser(user.id)}
                            disabled={userActionLoading === `enable:${user.id}`}
                          >
                            {userActionLoading === `enable:${user.id}` ? "Enabling..." : "Enable User"}
                          </button>
                        ) : (
                          <button
                            className="button danger action-button"
                            type="button"
                            onClick={() => void handleDisableUser(user.id, user.email)}
                            disabled={userActionLoading === `disable:${user.id}`}
                          >
                            {userActionLoading === `disable:${user.id}` ? "Disabling..." : "Disable User"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Activation batches</p>
            <h2>Batch list</h2>
            <p className="muted">Review batches, code counts, and export batch CSV files.</p>
          </div>
        </div>

        <div className="table-wrap">
          {detail.batches.length === 0 ? (
            <p className="muted">No batches yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Quantity</th>
                  <th>Box type</th>
                  <th>Education</th>
                  <th>Created</th>
                  <th>Created by</th>
                  <th>Code counts</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {detail.batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <div className="cell-strong">{batch.id}</div>
                      <div className="cell-muted">{batch.clinicTag || "—"}</div>
                    </td>
                    <td>{batch.quantity}</td>
                    <td>{batch.boxType || "—"}</td>
                    <td>
                      <div className="cell-strong">
                        {batch.productMode === "kit_only" ? "Kit-only" : "Full platform"}
                      </div>
                      <div className="cell-muted">
                        {batch.educationBundleId
                          ? bundleNameById.get(batch.educationBundleId) ?? "Bundle assigned"
                          : "No bundle"}
                      </div>
                      <div className="cell-muted">
                        {batch.boxTemplateId
                          ? templateNameById.get(batch.boxTemplateId) ?? "Template assigned"
                          : "No template"}
                      </div>
                    </td>
                    <td>{formatDateTime(batch.createdAt)}</td>
                    <td>{batch.createdByUserId || "—"}</td>
                    <td>
                      <div className="owner-count-grid">
                        <span>Total: {batch.codeCounts.total}</span>
                        <span>Issued: {batch.codeCounts.issued}</span>
                        <span>Draft: {batch.codeCounts.draft}</span>
                        <span>Approved: {batch.codeCounts.approved}</span>
                        <span>Claimed: {batch.codeCounts.claimed}</span>
                        <span>Invalidated: {batch.codeCounts.invalidated}</span>
                      </div>
                    </td>
                    <td>
                      <div className="action-stack">
                        <button
                          className="button secondary action-button"
                          type="button"
                          onClick={() => void loadCodes(batch.id)}
                          disabled={codesLoading}
                        >
                          View Codes
                        </button>
                        <button
                          className="button secondary action-button"
                          type="button"
                          onClick={() => void handleDownloadBatchCsv(batch.id)}
                          disabled={downloadingBatchId === batch.id}
                        >
                          {downloadingBatchId === batch.id ? "Downloading..." : "Download Batch CSV"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Generated codes</p>
            <h2>Code viewer</h2>
            <p className="muted">
              {activeBatchId
                ? `Showing codes for batch ${activeBatchId}.`
                : "Showing clinic-wide code activity."}
            </p>
          </div>

          {codesLoaded && activeBatchId ? (
            <button className="button secondary" type="button" onClick={() => setActiveBatchId(null)}>
              <Building2 size={16} />
              View all clinic codes
            </button>
          ) : null}
        </div>

        <div className="table-wrap">
          {!codesLoaded && !codesLoading ? (
            <p className="muted">Select View Codes to load clinic or batch codes.</p>
          ) : codesLoading ? (
            <p className="muted">Loading codes...</p>
          ) : visibleCodes.length === 0 ? (
            <p className="muted">No codes yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Clinic tag</th>
	                  <th>Batch ID</th>
	                  <th>Box type</th>
	                  <th>Education</th>
	                  <th>Created</th>
	                  <th>Claimed</th>
	                  <th>Claimed by</th>
	                  <th>Actions</th>
	                </tr>
	              </thead>
	              <tbody>
	                {visibleCodes.map((code) => (
                  <tr key={`${code.code}-${code.batchId || "none"}`}>
                    <td>{code.code}</td>
                    <td>{code.status}</td>
	                    <td>{code.clinicTag || "—"}</td>
	                    <td>{code.batchId || "—"}</td>
	                    <td>{code.boxType || "—"}</td>
	                    <td>
	                      <div className="cell-strong">
	                        {code.productMode === "kit_only" ? "Kit-only" : "Full platform"}
	                      </div>
	                      <div className="cell-muted">
	                        {code.educationBundleId
	                          ? bundleNameById.get(code.educationBundleId) ?? "Bundle assigned"
	                          : "No bundle"}
	                      </div>
	                      <div className="cell-muted">
	                        {code.boxTemplateId
	                          ? templateNameById.get(code.boxTemplateId) ?? "Template assigned"
	                          : "No template"}
	                      </div>
	                    </td>
	                    <td>{formatDateTime(code.createdAt)}</td>
	                    <td>{formatDateTime(code.claimedAt)}</td>
	                    <td>{code.claimedByUserId || "—"}</td>
	                    <td>
	                      <button
	                        className="button secondary action-button"
	                        type="button"
	                        onClick={() => void handleOpenCode(code.code)}
	                        disabled={codeEditorLoading}
	                      >
	                        Edit
	                      </button>
	                    </td>
	                  </tr>
	                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Clinic lifecycle actions</p>
            <h2>Deactivate or delete</h2>
            <p className="muted">Use deactivate for real clinics and hard delete only for empty test clinics.</p>
          </div>
        </div>

        <div className="grid-two">
          <div className="info-card warning-card">
            <h3>Deactivate clinic</h3>
            <p className="muted">
              This disables clinic logins and invalidates unused codes. Claimed patient records and audit history are preserved.
            </p>
            <button
              className="button secondary"
              type="button"
              onClick={() => void handleDeactivateClinic()}
              disabled={clinicActionLoading === "deactivate"}
            >
              {clinicActionLoading === "deactivate" ? "Deactivating..." : "Deactivate Clinic"}
            </button>
          </div>

          <div className="info-card danger-card">
            <h3>Delete test clinic</h3>
            <p className="muted">
              Hard delete is only for empty test clinics. Clinics with claimed patients, logs, recovery plans, alerts, or reminder history will be blocked.
            </p>
            <button
              className="button danger"
              type="button"
              onClick={() => void handleDeleteClinic()}
              disabled={clinicActionLoading === "delete"}
            >
              {clinicActionLoading === "delete" ? "Deleting..." : "Delete Test Clinic"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
