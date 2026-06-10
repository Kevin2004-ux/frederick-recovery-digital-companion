import { ArrowLeft, Building2, Download, Loader2, PlusCircle, Save, TableProperties } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import type {
  ActivationCodeDetail,
  ActivationCodeDetailResponse,
  CreateBatchResponse,
  RecoveryLibraryAdminPayload,
  RecoveryLibraryBoxItem,
  RecoveryLibraryProductMode,
} from "@/types";

type OwnerClinicDetailResponse = {
  clinic: {
    clinicTag: string;
    name?: string | null;
    defaultCategory?: string | null;
    notes?: string | null;
    archivedAt?: string | null;
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
  assignedBoxItems?: RecoveryLibraryBoxItem[];
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
  removedBoxItemKeysText: string;
  guideIdsText: string;
  recommendedGuideIdsText: string;
};

type ParsedBoxItemTextItem = {
  key?: string | null;
  label: string;
  note?: string;
};

type GenerateCodesForm = {
  quantity: string;
  educationBundleId: string;
  boxTemplateId: string;
  procedureName: string;
  productMode: RecoveryLibraryProductMode;
};

const EMPTY_CODE_ASSIGNMENT_FORM: CodeAssignmentForm = {
  educationBundleId: "",
  boxTemplateId: "",
  procedureName: "",
  productMode: "full_platform",
  assignedBoxItemsText: "",
  removedBoxItemKeysText: "",
  guideIdsText: "",
  recommendedGuideIdsText: "",
};

const EMPTY_GENERATE_CODES_FORM: GenerateCodesForm = {
  quantity: "10",
  educationBundleId: "",
  boxTemplateId: "",
  procedureName: "",
  productMode: "full_platform",
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
  archivedAt?: string | null;
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

function formatActivationCodeStatus(status: string) {
  if (status === "CLAIMED") return "Claimed";
  if (status === "INVALIDATED") return "Invalidated";
  if (status === "ISSUED" || status === "DRAFT" || status === "APPROVED") {
    return "Unused";
  }

  return status.toLowerCase().replace(/(^|_)([a-z])/g, (_match, prefix: string, letter: string) =>
    `${prefix ? " " : ""}${letter.toUpperCase()}`
  );
}

function formatProductMode(productMode?: RecoveryLibraryProductMode | null) {
  return productMode === "kit_only" ? "Kit-only education" : "Full platform";
}

function productModeDescription(productMode: RecoveryLibraryProductMode) {
  if (productMode === "kit_only") {
    return "Kit-only education shows the patient library, box items, education guides, videos, and instructions only.";
  }

  return "Full platform codes can include the complete recovery platform, including clinic dashboard features, logs, check-ins, tracking, and alerts.";
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

  if (apiError?.code === "CLINIC_DELETE_CONFIRMATION_MISMATCH") {
    return "Type the clinic tag exactly before deleting this clinic.";
  }

  if (apiError?.code === "CLINIC_ARCHIVED") {
    return "This clinic is archived. Reactivate or provision the clinic before generating new codes.";
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

function boxItemsToText(items: RecoveryLibraryBoxItem[] = []) {
  return items
    .map((item) => {
      const label = item.name || item.label;
      const base = item.key ? `${item.key}|${label}` : label;
      return item.note ? `${base}|${item.note}` : base;
    })
    .join("\n");
}

function parseBoxItemsText(value: string): ParsedBoxItemTextItem[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawKey, rawLabel, ...noteParts] = line.split("|");
      const label = rawLabel?.trim() ?? "";
      const note = noteParts.join("|").trim();

      if (label) {
        return {
          key: rawKey.trim() || null,
          label,
          ...(note ? { note } : {}),
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
    removedBoxItemKeysText: idsToText(code.removedBoxItemKeys ?? []),
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
  const [generateCodesForm, setGenerateCodesForm] = useState<GenerateCodesForm>(
    EMPTY_GENERATE_CODES_FORM,
  );
  const [generateCodesLoading, setGenerateCodesLoading] = useState(false);
  const [generateCodesError, setGenerateCodesError] = useState("");
  const [generateCodesSuccess, setGenerateCodesSuccess] = useState("");
  const [selectedCode, setSelectedCode] = useState<ActivationCodeDetail | null>(null);
  const [codeEditorForm, setCodeEditorForm] = useState<CodeAssignmentForm>(
    EMPTY_CODE_ASSIGNMENT_FORM,
  );
  const [codeEditorLoading, setCodeEditorLoading] = useState(false);
  const [codeEditorSaving, setCodeEditorSaving] = useState(false);
  const [codeEditorError, setCodeEditorError] = useState("");
  const [codeEditorSuccess, setCodeEditorSuccess] = useState("");
  const [guidePickId, setGuidePickId] = useState("");
  const [boxItemPickKey, setBoxItemPickKey] = useState("");
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
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteConfirmationTag, setDeleteConfirmationTag] = useState("");
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

  const loadCodes = useCallback(async (nextBatchId?: string | null) => {
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
  }, [clinicTag]);

  useEffect(() => {
    void loadCodes(null);
  }, [loadCodes]);

  async function handleGenerateCodes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(generateCodesForm.quantity);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      setGenerateCodesError("Enter a whole number from 1 to 500 activation codes.");
      setGenerateCodesSuccess("");
      return;
    }

    setGenerateCodesLoading(true);
    setGenerateCodesError("");
    setGenerateCodesSuccess("");
    setCodesError("");

    try {
      const payload = await api.post<CreateBatchResponse>("/clinic/batches", {
        clinicTag,
        quantity,
        ...(generateCodesForm.educationBundleId
          ? { educationBundleId: generateCodesForm.educationBundleId }
          : {}),
        ...(generateCodesForm.boxTemplateId
          ? { boxTemplateId: generateCodesForm.boxTemplateId }
          : {}),
        ...(generateCodesForm.procedureName.trim()
          ? { procedureName: generateCodesForm.procedureName.trim() }
          : {}),
        productMode: generateCodesForm.productMode,
      });

      setGenerateCodesSuccess(
        `Generated ${payload.batch.quantity} activation code(s) for ${clinicTag}.`,
      );
      setGenerateCodesForm(EMPTY_GENERATE_CODES_FORM);
      await loadDetail(false);
      await loadCodes(null);
    } catch (nextError) {
      setGenerateCodesError(
        formatClinicError(nextError, "We couldn’t generate activation codes right now."),
      );
    } finally {
      setGenerateCodesLoading(false);
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
      setBoxItemPickKey("");
      window.setTimeout(() => {
        document
          .getElementById("code-assignment-editor")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
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
          removedBoxItemKeys: parseIdsText(codeEditorForm.removedBoxItemKeysText),
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

  function addCatalogBoxItemToCode() {
    if (!boxItemPickKey) return;

    const catalogItem = libraryPayload?.boxItems.find((item) => item.key === boxItemPickKey);
    const label = catalogItem?.name ?? boxItemPickKey;

    setCodeEditorForm((current) => {
      const currentItems = parseBoxItemsText(current.assignedBoxItemsText);
      if (currentItems.some((item) => item.key === boxItemPickKey)) {
        return current;
      }

      return {
        ...current,
        assignedBoxItemsText: boxItemsToText([
          ...currentItems.map((item) => ({
            key: item.key ?? null,
            label: item.label,
            name: item.label,
            category: null,
            description: null,
            instructions: null,
            defaultEducationModuleId: null,
            imageUrl: null,
            note: item.note ?? null,
            educationGuide: null,
          })),
          {
            key: boxItemPickKey,
            label,
            name: label,
            category: catalogItem?.category ?? null,
            description: catalogItem?.description ?? null,
            instructions: catalogItem?.instructions ?? null,
            defaultEducationModuleId: catalogItem?.defaultEducationModuleId ?? null,
            imageUrl: catalogItem?.imageUrl ?? null,
            note: null,
            educationGuide: null,
          },
        ]),
      };
    });
  }

  function markInheritedBoxItemRemoved(key: string | null) {
    if (!key) return;

    setCodeEditorForm((current) => {
      const removed = parseIdsText(current.removedBoxItemKeysText);
      if (!removed.includes(key)) removed.push(key);

      return {
        ...current,
        removedBoxItemKeysText: idsToText(removed),
      };
    });
  }

  function restoreInheritedBoxItem(key: string) {
    setCodeEditorForm((current) => ({
      ...current,
      removedBoxItemKeysText: idsToText(
        parseIdsText(current.removedBoxItemKeysText).filter((itemKey) => itemKey !== key)
      ),
    }));
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
      "Archive this clinic? This disables clinic logins, invalidates unused codes, removes the clinic from the active owner list, and preserves claimed patient records and audit history.",
    );
    if (!confirmed) return;

    setClinicActionLoading("deactivate");
    setClinicActionError("");
    setClinicActionSuccess("");
    setDeleteBlockedActivity(null);

    try {
      const payload = await api.post<DeactivateClinicResponse>(`/owner/clinics/${clinicTag}/deactivate`);
      setClinicActionSuccess(
        `Clinic archived. Disabled ${payload.disabledClinicUsersCount} clinic user login(s), invalidated ${payload.invalidatedCodesCount} unused code(s), preserved ${payload.claimedCodesPreservedCount} claimed code(s).`,
      );
      await loadDetail(false);
    } catch (nextError) {
      setClinicActionError(formatClinicError(nextError, "We couldn’t deactivate this clinic right now."));
    } finally {
      setClinicActionLoading(null);
    }
  }

  async function handleDeleteClinic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const confirmationClinicTag = deleteConfirmationTag.trim();

    if (confirmationClinicTag !== clinicTag) {
      setClinicActionError("Type the clinic tag exactly before deleting this clinic.");
      return;
    }

    setClinicActionLoading("delete");
    setClinicActionError("");
    setClinicActionSuccess("");
    setDeleteBlockedActivity(null);

    try {
      const payload = await api.delete<DeleteClinicResponse>(`/owner/clinics/${clinicTag}`, {
        confirmationClinicTag,
      });
      setClinicActionSuccess(
        `Deleted test clinic ${payload.clinicTag}. Removed ${payload.deleted.clinicUsers} clinic user(s), ${payload.deleted.activationCodes} activation code(s), and ${payload.deleted.activationBatches} batch(es).`,
      );
      setDeleteConfirmationOpen(false);
      setDeleteConfirmationTag("");
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
  const catalogItemByKey = new Map((libraryPayload?.boxItems ?? []).map((boxItem) => [boxItem.key, boxItem]));
  const formInheritedBoxItems: RecoveryLibraryBoxItem[] = selectedFormTemplate
    ? selectedFormTemplate.boxItemKeys.map((key) => {
        const catalogItem = catalogItemByKey.get(key);
        const label = catalogItem?.name ?? key.replace(/[_-]+/g, " ");

        return {
          key,
          label,
          name: label,
          category: catalogItem?.category ?? null,
          description: catalogItem?.description ?? null,
          instructions: catalogItem?.instructions ?? null,
          defaultEducationModuleId: catalogItem?.defaultEducationModuleId ?? null,
          imageUrl: catalogItem?.imageUrl ?? null,
          note: null,
          educationGuide: null,
        };
      })
    : selectedCode?.inheritedBoxItems ?? [];
  const currentRemovedBoxItemKeys = parseIdsText(codeEditorForm.removedBoxItemKeysText);
  const removedBoxItemKeySet = new Set(currentRemovedBoxItemKeys);
  const visibleInheritedBoxItems =
    formInheritedBoxItems.filter((item) => !item.key || !removedBoxItemKeySet.has(item.key));
  const codeLevelBoxItems = parseBoxItemsText(codeEditorForm.assignedBoxItemsText);
  const finalPreviewBoxItems = [
    ...codeLevelBoxItems.map((item) => ({
      key: item.key ?? null,
      label: item.label,
      name: item.label,
      note: item.note ?? null,
    })),
    ...visibleInheritedBoxItems.filter((item) => {
      const dedupeKey = item.key ?? item.label;
      return !codeLevelBoxItems.some((codeItem) => (codeItem.key ?? codeItem.label) === dedupeKey);
    }),
  ];

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

  const clinicArchived = Boolean(detail.clinic.archivedAt);

  return (
    <div className="page-shell">
      <section className="panel hero-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Clinic workspace</p>
            <h1>{detail.clinic.name || detail.clinic.clinicTag}</h1>
            <p className="muted">
              Manage clinic overview, logins, activation batches, generated codes, code configuration, and lifecycle actions for{" "}
              <strong>{detail.clinic.clinicTag}</strong>.
            </p>
            {detail.clinic.archivedAt ? (
              <p className="muted">
                Archived {formatDateTime(detail.clinic.archivedAt)}. Clinic logins are disabled and unused codes should not be claimable.
              </p>
            ) : null}
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

      <section className="panel clinic-workspace-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workspace map</p>
            <h2>Manage this clinic from one place</h2>
            <p className="muted">
              Use these sections to move from clinic setup to activation-code generation and code-level configuration.
            </p>
          </div>
        </div>
        <nav className="workspace-nav" aria-label="Clinic workspace sections">
          <a href="#clinic-overview">Clinic overview</a>
          <a href="#clinic-users">Clinic users / logins</a>
          <a href="#activation-batches">Activation batches</a>
          <a href="#generate-codes">Generate codes</a>
          <a href="#activation-codes">Activation codes</a>
          <a href="#code-assignment-editor">Configure code</a>
          <a href="#clinic-lifecycle">Delete / archive clinic</a>
        </nav>
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {adminError ? <div className="alert error">{adminError}</div> : null}
      {adminSuccess ? <div className="alert success">{adminSuccess}</div> : null}
      {userActionError ? <div className="alert error">{userActionError}</div> : null}
      {userActionSuccess ? <div className="alert success">{userActionSuccess}</div> : null}
      {clinicActionError ? <div className="alert error">{clinicActionError}</div> : null}
      {clinicActionSuccess ? <div className="alert success">{clinicActionSuccess}</div> : null}
      {codesError ? <div className="alert error">{codesError}</div> : null}
      {generateCodesError ? <div className="alert error">{generateCodesError}</div> : null}
      {generateCodesSuccess ? <div className="alert success">{generateCodesSuccess}</div> : null}

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

      <section className="grid-two owner-detail-grid" id="clinic-overview">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Clinic overview</p>
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
              ["Archive status", detail.clinic.archivedAt ? `Archived ${formatDateTime(detail.clinic.archivedAt)}` : "Active"],
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

      <section className="panel" id="code-assignment-editor">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Configure individual code</p>
            <h2>Activation code assignment editor</h2>
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
                    <dd>{formatActivationCodeStatus(selectedCode.status)}</dd>
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
                  <option value="kit_only">Kit-only education</option>
                  <option value="full_platform">Full platform</option>
                </select>
              </label>
            </div>

            <div className="inline-note">
              <span>{productModeDescription(codeEditorForm.productMode)}</span>
            </div>

            <div className="info-card form-stack">
              <h3>Final box contents for this activation code</h3>
              <p className="muted">
                Add or remove items for this one code only. The master box template is not changed.
              </p>

              <div className="grid-two">
                <label className="field">
                  <span>Add item from catalog</span>
                  <select
                    value={boxItemPickKey}
                    onChange={(event) => setBoxItemPickKey(event.target.value)}
                  >
                    <option value="">Choose a box item</option>
                    {(libraryPayload?.boxItems ?? []).map((boxItem) => (
                      <option key={boxItem.id} value={boxItem.key}>
                        {boxItem.name} · {boxItem.key}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="action-stack">
                  <button
                    className="button secondary action-button"
                    type="button"
                    onClick={addCatalogBoxItemToCode}
                    disabled={!boxItemPickKey}
                  >
                    Add to this code
                  </button>
                </div>
              </div>

              <div className="grid-two">
                <div className="info-card">
                  <h3>Inherited from template/batch</h3>
                  {formInheritedBoxItems.length ? (
                    <div className="tag-cloud">
                      {formInheritedBoxItems.map((item) => {
                        const removed = Boolean(item.key && removedBoxItemKeySet.has(item.key));
                        return (
                          <button
                            key={item.key ?? item.label}
                            className="chip-button"
                            type="button"
                            onClick={() =>
                              removed && item.key
                                ? restoreInheritedBoxItem(item.key)
                                : markInheritedBoxItemRemoved(item.key)
                            }
                          >
                            {removed ? "Restore" : "Remove"} {item.name || item.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted">No inherited box items from the selected template.</p>
                  )}
                </div>

                <div className="info-card">
                  <h3>Final resolved contents</h3>
                  {finalPreviewBoxItems.length ? (
                    <div className="library-module-row-meta">
                      {finalPreviewBoxItems.map((item) => (
                        <span key={item.key ?? item.label}>
                          {item.name || item.label}
                          {item.note ? ` · ${item.note}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No final items configured yet.</p>
                  )}
                </div>
              </div>

              <label className="field">
                <span>Code-level added items and notes</span>
                <textarea
                  value={codeEditorForm.assignedBoxItemsText}
                  onChange={(event) =>
                    setCodeEditorForm((current) => ({
                      ...current,
                      assignedBoxItemsText: event.target.value,
                    }))
                  }
                  placeholder={"icepack|Ice Pack|Use 20 minutes at a time\ncompression_socks|Compression Socks"}
                  rows={4}
                />
              </label>

              <label className="field">
                <span>Removed inherited item keys</span>
                <textarea
                  value={codeEditorForm.removedBoxItemKeysText}
                  onChange={(event) =>
                    setCodeEditorForm((current) => ({
                      ...current,
                      removedBoxItemKeysText: event.target.value,
                    }))
                  }
                  placeholder="Keys removed for this code only"
                  rows={3}
                />
              </label>
            </div>

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

      <section className="panel" id="clinic-users">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Clinic users / logins</p>
            <h2>Full-platform clinic login management</h2>
            <p className="muted">
              Create, view, reset, and disable clinic user logins tied to <strong>{clinicTag}</strong>.
              Clinic users are scoped by their clinic tag and backend tenant checks only return their own clinic data.
            </p>
          </div>
        </div>

        <div className="info-card owner-form-card">
          <h3>Create clinic user login</h3>
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
              {adminSubmitting ? "Creating clinic login..." : "Create Clinic Login"}
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

      <section className="panel" id="activation-batches">
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
                        {formatProductMode(batch.productMode)}
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

      <section className="panel" id="activation-codes">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Activation Codes</p>
            <h2>Generate and configure codes</h2>
            <p className="muted">
              {activeBatchId
                ? `Showing codes for batch ${activeBatchId}.`
                : "Generate codes for this clinic, then configure each code before placing it in a recovery box."}
            </p>
          </div>

          {codesLoaded && activeBatchId ? (
            <button className="button secondary" type="button" onClick={() => setActiveBatchId(null)}>
              <Building2 size={16} />
              View all clinic codes
            </button>
          ) : null}
        </div>

        <div className="info-card owner-form-card" id="generate-codes">
          <h3>Generate codes for this clinic</h3>
          {clinicArchived ? (
            <div className="alert error">
              This clinic is archived. New activation codes cannot be generated until the clinic is provisioned again.
            </div>
          ) : null}
          <form className="form-stack" onSubmit={handleGenerateCodes}>
            <div className="grid-two">
              <label className="field">
                <span>Quantity</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={generateCodesForm.quantity}
                  onChange={(event) =>
                    setGenerateCodesForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="field">
                <span>Default education bundle</span>
                <select
                  value={generateCodesForm.educationBundleId}
                  onChange={(event) =>
                    setGenerateCodesForm((current) => ({
                      ...current,
                      educationBundleId: event.target.value,
                    }))
                  }
                >
                  <option value="">No default bundle</option>
                  {(libraryPayload?.bundles ?? []).map((bundle) => (
                    <option key={bundle.id} value={bundle.id}>
                      {bundle.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Default box template</span>
                <select
                  value={generateCodesForm.boxTemplateId}
                  onChange={(event) =>
                    setGenerateCodesForm((current) => ({
                      ...current,
                      boxTemplateId: event.target.value,
                    }))
                  }
                >
                  <option value="">No default template</option>
                  {(libraryPayload?.boxTemplates ?? []).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Default procedure name</span>
                <input
                  type="text"
                  value={generateCodesForm.procedureName}
                  onChange={(event) =>
                    setGenerateCodesForm((current) => ({
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
                  value={generateCodesForm.productMode}
                  onChange={(event) =>
                    setGenerateCodesForm((current) => ({
                      ...current,
                      productMode: event.target.value as RecoveryLibraryProductMode,
                    }))
                  }
                >
                  <option value="kit_only">Kit-only education</option>
                  <option value="full_platform">Full platform</option>
                </select>
              </label>
            </div>

            <button className="button primary" type="submit" disabled={generateCodesLoading || clinicArchived}>
              {generateCodesLoading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Generating codes
                </>
              ) : (
                <>
                  <PlusCircle size={16} />
                  Generate codes
                </>
              )}
            </button>
          </form>
        </div>

        <div className="table-wrap">
          {!codesLoaded && !codesLoading ? (
            <p className="muted">Clinic codes will load automatically.</p>
          ) : codesLoading ? (
            <p className="muted">Loading codes...</p>
          ) : visibleCodes.length === 0 ? (
            <p className="muted">No codes yet. Generate the first set above.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Activation code</th>
                  <th>Status</th>
                  <th>Claimed patient</th>
                  <th>Box template</th>
                  <th>Education bundle</th>
                  <th>Procedure</th>
                  <th>Product mode</th>
                  <th>Created</th>
                  <th>Configure</th>
                </tr>
              </thead>
              <tbody>
                {visibleCodes.map((code) => (
                  <tr key={`${code.code}-${code.batchId || "none"}`}>
                    <td>
                      <div className="cell-strong">{code.code}</div>
                      <div className="cell-muted">Batch: {code.batchId || "—"}</div>
                    </td>
                    <td>{formatActivationCodeStatus(code.status)}</td>
                    <td>
                      <div className="cell-strong">{code.claimedByUserId || "—"}</div>
                      <div className="cell-muted">{formatDateTime(code.claimedAt)}</div>
                    </td>
                    <td>
                      {code.boxTemplateId
                        ? templateNameById.get(code.boxTemplateId) ?? "Template assigned"
                        : "No template"}
                    </td>
                    <td>
                      {code.educationBundleId
                        ? bundleNameById.get(code.educationBundleId) ?? "Bundle assigned"
                        : "No bundle"}
                    </td>
                    <td>{code.procedureName || "—"}</td>
                    <td>{formatProductMode(code.productMode)}</td>
                    <td>{formatDateTime(code.createdAt)}</td>
                    <td>
                      <button
                        className="button secondary action-button"
                        type="button"
                        onClick={() => void handleOpenCode(code.code)}
                        disabled={codeEditorLoading}
                      >
                        Configure
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="panel" id="clinic-lifecycle">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Clinic lifecycle actions</p>
            <h2>Archive or delete</h2>
            <p className="muted">Use archive for real clinics and hard delete only for empty test clinics with no patient history.</p>
          </div>
        </div>

        <div className="grid-two">
          <div className="info-card warning-card">
            <h3>Archive clinic</h3>
            <p className="muted">
              This disables clinic logins, invalidates unused codes, removes the clinic from the active owner list, and preserves claimed patient records and audit history.
            </p>
            <button
              className="button secondary"
              type="button"
              onClick={() => void handleDeactivateClinic()}
              disabled={clinicActionLoading === "deactivate" || clinicArchived}
            >
              {clinicArchived
                ? "Clinic Archived"
                : clinicActionLoading === "deactivate"
                  ? "Archiving..."
                  : "Archive Clinic"}
            </button>
          </div>

          <div className="info-card danger-card">
            <h3>Delete test clinic</h3>
            <p className="muted">
              Hard delete is only for empty test clinics. Clinics with claimed patients, logs, recovery plans, alerts, or reminder history will be blocked.
            </p>
            {deleteConfirmationOpen ? (
              <form className="form-stack" onSubmit={handleDeleteClinic}>
                <label className="field">
                  <span>Type {clinicTag} to confirm</span>
                  <input
                    type="text"
                    value={deleteConfirmationTag}
                    onChange={(event) => setDeleteConfirmationTag(event.target.value)}
                    placeholder={clinicTag}
                    autoComplete="off"
                  />
                </label>
                <div className="action-row">
                  <button
                    className="button danger"
                    type="submit"
                    disabled={
                      clinicActionLoading === "delete" ||
                      deleteConfirmationTag.trim() !== clinicTag
                    }
                  >
                    {clinicActionLoading === "delete" ? "Deleting..." : "Delete Test Clinic"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      setDeleteConfirmationOpen(false);
                      setDeleteConfirmationTag("");
                      setDeleteBlockedActivity(null);
                    }}
                    disabled={clinicActionLoading === "delete"}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="button danger"
                type="button"
                onClick={() => {
                  setDeleteConfirmationOpen(true);
                  setDeleteConfirmationTag("");
                  setClinicActionError("");
                  setClinicActionSuccess("");
                  setDeleteBlockedActivity(null);
                }}
                disabled={clinicActionLoading === "delete"}
              >
                Delete Test Clinic
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
