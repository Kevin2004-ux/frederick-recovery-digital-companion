import {
  ArrowLeft,
  BookPlus,
  Building2,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Download,
  Eye,
  FileDown,
  ListChecks,
  Loader2,
  LockKeyhole,
  PackageCheck,
  PlusCircle,
  Printer,
  RotateCcw,
  Save,
  TableProperties,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import type {
  ActivationCodeDetail,
  ActivationCodeDetailResponse,
  ClinicOrder,
  ClinicOrderResponse,
  ClinicOrdersResponse,
  CreateBatchResponse,
  RecoveryLibraryAdminModule,
  RecoveryLibraryAdminPayload,
  BoxItemCatalogItem,
  RecoveryLibraryBoxItem,
  RecoveryLibraryCategoryKey,
  RecoveryLibraryProductMode,
  Tier1FinalizeResponse,
  Tier1PackingListResponse,
  Tier1SnapshotPreview,
  Tier1SnapshotValidationResponse,
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
    clinicOrderId?: string | null;
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
  clinicOrderId?: string | null;
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

type ClinicOrderForm = {
  orderNumber: string;
  externalRef: string;
  requestedBoxCount: string;
  defaultProcedureName: string;
  defaultBoxTemplateId: string;
  defaultEducationBundleId: string;
  productMode: RecoveryLibraryProductMode;
  requestedByName: string;
  requestedByEmail: string;
  notes: string;
};

type InlineBoxItemForm = {
  key: string;
  name: string;
  category: string;
  description: string;
  instructions: string;
  defaultEducationModuleId: string;
  imageUrl: string;
  note: string;
};

type InlineGuideForm = {
  title: string;
  summary: string;
  body: string;
  categories: string;
  procedureNames: string;
  boxItemKeys: string;
  videoUrl: string;
  recommendationLabel: string;
  recommendationOrder: string;
  assignAsRecommended: boolean;
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
  productMode: "kit_only",
};

const EMPTY_CLINIC_ORDER_FORM: ClinicOrderForm = {
  orderNumber: "",
  externalRef: "",
  requestedBoxCount: "10",
  defaultProcedureName: "",
  defaultBoxTemplateId: "",
  defaultEducationBundleId: "",
  productMode: "kit_only",
  requestedByName: "",
  requestedByEmail: "",
  notes: "",
};

const EMPTY_INLINE_BOX_ITEM_FORM: InlineBoxItemForm = {
  key: "",
  name: "",
  category: "",
  description: "",
  instructions: "",
  defaultEducationModuleId: "",
  imageUrl: "",
  note: "",
};

const EMPTY_INLINE_GUIDE_FORM: InlineGuideForm = {
  title: "",
  summary: "",
  body: "",
  categories: "clinic-instructions",
  procedureNames: "",
  boxItemKeys: "",
  videoUrl: "",
  recommendationLabel: "",
  recommendationOrder: "",
  assignAsRecommended: true,
};

const RECOVERY_LIBRARY_CATEGORY_KEYS: RecoveryLibraryCategoryKey[] = [
  "start-here",
  "common-recovery-topics",
  "procedure-guides",
  "box-item-instructions",
  "videos",
  "clinic-instructions",
];

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

  return "Full platform codes use the broader recovery platform. Keep Tier 1 factory fulfillment on kit-only unless this code is intentionally outside the kit workflow.";
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

  if (apiError?.code === "CLINIC_ORDER_NOT_FOUND") {
    return "Clinic order was not found.";
  }

  if (apiError?.code === "TIER1_SNAPSHOT_LOCKED") {
    return "This Tier 1 snapshot is finalized and locked. Create a correction/new snapshot version before changing content.";
  }

  if (apiError?.code === "NOT_TIER1_ACTIVATION_CODE") {
    return "This action is only available for kit-only Tier 1 activation codes.";
  }

  if (apiError?.code === "INVALID_STATE_TRANSITION") {
    return "That lifecycle action is not available for the code’s current status.";
  }

  if (apiError?.code === "PACKING_LIST_NOT_READY") {
    return "Finalize this Tier 1 code before generating a packing list.";
  }

  if (apiError?.code === "PATIENT_SNAPSHOT_NOT_FOUND") {
    return "This code does not have a current PatientSnapshot to pack from.";
  }

  if (apiError?.code === "BOX_ITEM_KEY_EXISTS") {
    return "That box item key already exists. Choose the existing item from the catalog or use a unique key.";
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

function splitInputValues(value: string) {
  return parseIdsText(value);
}

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)));
}

function parseCategoryText(value: string): RecoveryLibraryCategoryKey[] {
  const allowed = new Set(RECOVERY_LIBRARY_CATEGORY_KEYS);
  const categories = splitInputValues(value).filter((category): category is RecoveryLibraryCategoryKey =>
    allowed.has(category as RecoveryLibraryCategoryKey)
  );

  return categories.length ? categories : ["clinic-instructions"];
}

function parseNumberText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isTier1SnapshotLocked(code: ActivationCodeDetail | null) {
  if (!code || code.productMode !== "kit_only") return false;

  return ["FINALIZED", "PACKED", "CLAIMED", "ARCHIVED", "VOIDED"].includes(code.status);
}

function isTier1FinalizableStatus(status?: string | null) {
  return Boolean(status && ["ISSUED", "DRAFT", "CONFIGURED", "APPROVED", "RESET_FOR_REISSUE"].includes(status));
}

function isTier1PackableStatus(status?: string | null) {
  return status === "FINALIZED" || status === "PACKED";
}

function formatOrderStatus(status?: string | null) {
  if (!status) return "Open";

  return status
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function isCodeReadyToPack(status?: string | null) {
  return Boolean(status && ["FINALIZED", "PACKED", "CLAIMED"].includes(status));
}

function isCodeNeedsFulfillmentSetup(status?: string | null) {
  return Boolean(
    status &&
      ["ISSUED", "DRAFT", "CONFIGURED", "APPROVED", "RESET_FOR_REISSUE"].includes(status),
  );
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function findGuideTitle(libraryPayload: RecoveryLibraryAdminPayload | null, guideId: string) {
  return libraryPayload?.modules.find((module) => module.id === guideId)?.title ?? guideId;
}

function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nestedRecord(value: unknown, key: string) {
  return asPlainRecord(asPlainRecord(value)[key]);
}

function readRecordString(value: unknown, key: string) {
  const entry = asPlainRecord(value)[key];
  return typeof entry === "string" && entry.trim() ? entry : null;
}

function formatSnapshotBoxItemName(item: Tier1SnapshotPreview["snapshot"]["boxItems"][number]) {
  return item.name || item.label || item.key || "Box item";
}

function formatSnapshotGuideTitle(guide: Tier1SnapshotPreview["snapshot"]["guides"][number]) {
  return guide.title || guide.id || "Education guide";
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
  const [clinicOrders, setClinicOrders] = useState<ClinicOrder[]>([]);
  const [clinicOrdersLoading, setClinicOrdersLoading] = useState(false);
  const [clinicOrdersError, setClinicOrdersError] = useState("");
  const [clinicOrdersSuccess, setClinicOrdersSuccess] = useState("");
  const [clinicOrderForm, setClinicOrderForm] = useState<ClinicOrderForm>(
    EMPTY_CLINIC_ORDER_FORM,
  );
  const [clinicOrderSubmitting, setClinicOrderSubmitting] = useState(false);
  const [orderGenerateQuantityById, setOrderGenerateQuantityById] = useState<Record<string, string>>({});
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);
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
  const [inlineBoxItemForm, setInlineBoxItemForm] = useState<InlineBoxItemForm>(
    EMPTY_INLINE_BOX_ITEM_FORM,
  );
  const [inlineGuideForm, setInlineGuideForm] = useState<InlineGuideForm>(
    EMPTY_INLINE_GUIDE_FORM,
  );
  const [inlineBoxItemSaving, setInlineBoxItemSaving] = useState(false);
  const [inlineGuideSaving, setInlineGuideSaving] = useState(false);
  const [snapshotPreview, setSnapshotPreview] = useState<Tier1SnapshotPreview | null>(null);
  const [snapshotValidation, setSnapshotValidation] =
    useState<Tier1SnapshotValidationResponse | null>(null);
  const [snapshotPreviewLoading, setSnapshotPreviewLoading] = useState(false);
  const [packingList, setPackingList] = useState<Tier1PackingListResponse | null>(null);
  const [packingListLoading, setPackingListLoading] = useState(false);
  const [packingListError, setPackingListError] = useState("");
  const [fulfillmentNotice, setFulfillmentNotice] = useState("");
  const [codeReissueReason, setCodeReissueReason] = useState("");
  const [codeReissueLoading, setCodeReissueLoading] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState<"finalize" | "pack" | null>(null);
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

  const loadClinicOrders = useCallback(async () => {
    setClinicOrdersLoading(true);
    setClinicOrdersError("");

    try {
      const params = new URLSearchParams({
        clinicTag,
        limit: "500",
      });
      const payload = await api.get<ClinicOrdersResponse>(
        `/owner/clinic-orders?${params.toString()}`,
      );
      const orders = Array.isArray(payload.orders) ? payload.orders : [];
      setClinicOrders(orders);
      setOrderGenerateQuantityById((current) => {
        const next = { ...current };
        for (const order of orders) {
          if (!next[order.id]) {
            next[order.id] = String(order.requestedBoxCount ?? 1);
          }
        }
        return next;
      });
    } catch (nextError) {
      setClinicOrdersError(
        formatClinicError(nextError, "We couldn’t load clinic orders right now."),
      );
      setClinicOrders([]);
    } finally {
      setClinicOrdersLoading(false);
    }
  }, [clinicTag]);

  useEffect(() => {
    void loadClinicOrders();
  }, [loadClinicOrders]);

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

  async function handleCreateClinicOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedBoxCount = parseNumberText(clinicOrderForm.requestedBoxCount);

    if (!requestedBoxCount || !Number.isInteger(requestedBoxCount) || requestedBoxCount < 1) {
      setClinicOrdersError("Enter a whole-number box quantity of at least 1.");
      setClinicOrdersSuccess("");
      return;
    }

    setClinicOrderSubmitting(true);
    setClinicOrdersError("");
    setClinicOrdersSuccess("");

    try {
      const payload = await api.post<ClinicOrderResponse>("/owner/clinic-orders", {
        clinicTag,
        productMode: "kit_only",
        requestedBoxCount,
        ...(clinicOrderForm.orderNumber.trim()
          ? { orderNumber: clinicOrderForm.orderNumber.trim() }
          : {}),
        ...(clinicOrderForm.externalRef.trim()
          ? { externalRef: clinicOrderForm.externalRef.trim() }
          : {}),
        ...(clinicOrderForm.defaultProcedureName.trim()
          ? { defaultProcedureName: clinicOrderForm.defaultProcedureName.trim() }
          : {}),
        ...(clinicOrderForm.defaultBoxTemplateId
          ? { defaultBoxTemplateId: clinicOrderForm.defaultBoxTemplateId }
          : {}),
        ...(clinicOrderForm.defaultEducationBundleId
          ? { defaultEducationBundleId: clinicOrderForm.defaultEducationBundleId }
          : {}),
        ...(clinicOrderForm.requestedByName.trim()
          ? { requestedByName: clinicOrderForm.requestedByName.trim() }
          : {}),
        ...(clinicOrderForm.requestedByEmail.trim()
          ? { requestedByEmail: clinicOrderForm.requestedByEmail.trim() }
          : {}),
        ...(clinicOrderForm.notes.trim() ? { notes: clinicOrderForm.notes.trim() } : {}),
      });

      setClinicOrdersSuccess(`Clinic order created for ${payload.order.requestedBoxCount ?? requestedBoxCount} kit(s).`);
      setClinicOrderForm(EMPTY_CLINIC_ORDER_FORM);
      await loadClinicOrders();
    } catch (nextError) {
      setClinicOrdersError(
        formatClinicError(nextError, "We couldn’t create that clinic order right now."),
      );
    } finally {
      setClinicOrderSubmitting(false);
    }
  }

  async function handleGenerateCodesFromOrder(order: ClinicOrder) {
    const quantityText = orderGenerateQuantityById[order.id] ?? String(order.requestedBoxCount ?? 1);
    const quantity = parseNumberText(quantityText);

    if (!quantity || !Number.isInteger(quantity) || quantity < 1) {
      setClinicOrdersError("Enter a whole-number quantity before generating codes.");
      setClinicOrdersSuccess("");
      return;
    }

    setOrderActionLoading(order.id);
    setClinicOrdersError("");
    setClinicOrdersSuccess("");
    setCodesError("");

    try {
      const payload = await api.post<CreateBatchResponse>(
        `/owner/clinic-orders/${encodeURIComponent(order.id)}/generate-codes`,
        { quantity },
      );

      setClinicOrdersSuccess(
        `Generated ${payload.batch.quantity} kit-only activation code(s) from this order.`,
      );
      await loadClinicOrders();
      await loadDetail(false);
      await loadCodes(payload.batch.id);
    } catch (nextError) {
      setClinicOrdersError(
        formatClinicError(nextError, "We couldn’t generate codes from that order right now."),
      );
    } finally {
      setOrderActionLoading(null);
    }
  }

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
    setSnapshotPreview(null);
    setSnapshotValidation(null);
    setPackingList(null);
    setPackingListError("");
    setFulfillmentNotice("");
    setCodeReissueReason("");
    setInlineBoxItemForm(EMPTY_INLINE_BOX_ITEM_FORM);
    setInlineGuideForm(EMPTY_INLINE_GUIDE_FORM);

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
      setSnapshotPreview(null);
      setSnapshotValidation(null);
      setPackingList(null);
      setPackingListError("");
      setFulfillmentNotice("");
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

  async function handleApplyBoxTemplate() {
    if (!selectedCode || !codeEditorForm.boxTemplateId) return;
    if (isTier1SnapshotLocked(selectedCode)) {
      setCodeEditorError("This finalized Tier 1 snapshot is locked and cannot be edited casually.");
      return;
    }

    setCodeEditorSaving(true);
    setCodeEditorError("");
    setCodeEditorSuccess("");
    setSnapshotPreview(null);
    setSnapshotValidation(null);
    setPackingList(null);
    setPackingListError("");
    setFulfillmentNotice("");

    try {
      const payload = await api.post<ActivationCodeDetailResponse>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}/apply-box-template`,
        { boxTemplateId: codeEditorForm.boxTemplateId },
      );
      setSelectedCode(payload.activationCode);
      setCodeEditorForm(codeDetailToForm(payload.activationCode));
      setCodeEditorSuccess("Box template applied to this activation code only.");
      await loadCodes(activeBatchId);
    } catch (nextError) {
      setCodeEditorError(formatClinicError(nextError, "We couldn’t apply that box template."));
    } finally {
      setCodeEditorSaving(false);
    }
  }

  async function handleApplyEducationBundle() {
    if (!selectedCode || !codeEditorForm.educationBundleId) return;
    if (isTier1SnapshotLocked(selectedCode)) {
      setCodeEditorError("This finalized Tier 1 snapshot is locked and cannot be edited casually.");
      return;
    }

    setCodeEditorSaving(true);
    setCodeEditorError("");
    setCodeEditorSuccess("");
    setSnapshotPreview(null);
    setSnapshotValidation(null);
    setPackingList(null);
    setPackingListError("");
    setFulfillmentNotice("");

    try {
      const payload = await api.post<ActivationCodeDetailResponse>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}/apply-education-bundle`,
        { educationBundleId: codeEditorForm.educationBundleId },
      );
      setSelectedCode(payload.activationCode);
      setCodeEditorForm(codeDetailToForm(payload.activationCode));
      setCodeEditorSuccess("Education bundle applied to this activation code only.");
      await loadCodes(activeBatchId);
    } catch (nextError) {
      setCodeEditorError(formatClinicError(nextError, "We couldn’t apply that education bundle."));
    } finally {
      setCodeEditorSaving(false);
    }
  }

  async function handleCreateInlineBoxItem() {
    if (!selectedCode) return;
    if (isTier1SnapshotLocked(selectedCode)) {
      setCodeEditorError("This finalized Tier 1 snapshot is locked and cannot be edited casually.");
      return;
    }

    setInlineBoxItemSaving(true);
    setCodeEditorError("");
    setCodeEditorSuccess("");
    setSnapshotPreview(null);
    setSnapshotValidation(null);
    setPackingList(null);
    setPackingListError("");
    setFulfillmentNotice("");

    try {
      const payload = await api.post<{
        boxItem: BoxItemCatalogItem;
        activationCode: ActivationCodeDetail;
      }>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}/box-items/inline`,
        {
          key: inlineBoxItemForm.key.trim(),
          name: inlineBoxItemForm.name.trim(),
          ...(inlineBoxItemForm.category.trim() ? { category: inlineBoxItemForm.category.trim() } : {}),
          ...(inlineBoxItemForm.description.trim()
            ? { description: inlineBoxItemForm.description.trim() }
            : {}),
          ...(inlineBoxItemForm.instructions.trim()
            ? { instructions: inlineBoxItemForm.instructions.trim() }
            : {}),
          ...(inlineBoxItemForm.defaultEducationModuleId.trim()
            ? { defaultEducationModuleId: inlineBoxItemForm.defaultEducationModuleId.trim() }
            : {}),
          ...(inlineBoxItemForm.imageUrl.trim() ? { imageUrl: inlineBoxItemForm.imageUrl.trim() } : {}),
          ...(inlineBoxItemForm.note.trim() ? { note: inlineBoxItemForm.note.trim() } : {}),
          active: true,
        },
      );

      setLibraryPayload((current) =>
        current
          ? {
              ...current,
              boxItems: [
                payload.boxItem,
                ...current.boxItems.filter((item) => item.id !== payload.boxItem.id),
              ],
            }
          : current,
      );
      setSelectedCode(payload.activationCode);
      setCodeEditorForm(codeDetailToForm(payload.activationCode));
      setInlineBoxItemForm(EMPTY_INLINE_BOX_ITEM_FORM);
      setCodeEditorSuccess("Created a new box item and assigned it to this code.");
      await loadCodes(activeBatchId);
    } catch (nextError) {
      setCodeEditorError(formatClinicError(nextError, "We couldn’t create and assign that box item."));
    } finally {
      setInlineBoxItemSaving(false);
    }
  }

  async function handleCreateInlineGuide() {
    if (!selectedCode) return;
    if (isTier1SnapshotLocked(selectedCode)) {
      setCodeEditorError("This finalized Tier 1 snapshot is locked and cannot be edited casually.");
      return;
    }

    setInlineGuideSaving(true);
    setCodeEditorError("");
    setCodeEditorSuccess("");
    setSnapshotPreview(null);
    setSnapshotValidation(null);
    setPackingList(null);
    setPackingListError("");
    setFulfillmentNotice("");

    try {
      const recommendationOrder = parseNumberText(inlineGuideForm.recommendationOrder);
      const payload = await api.post<{
        guide: RecoveryLibraryAdminModule;
        activationCode: ActivationCodeDetail;
      }>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}/education-guides/inline`,
        {
          title: inlineGuideForm.title.trim(),
          summary: inlineGuideForm.summary.trim(),
          body: inlineGuideForm.body.trim(),
          moduleType: "education",
          categories: parseCategoryText(inlineGuideForm.categories),
          procedureNames:
            splitInputValues(inlineGuideForm.procedureNames).length > 0
              ? splitInputValues(inlineGuideForm.procedureNames)
              : codeEditorForm.procedureName.trim()
                ? [codeEditorForm.procedureName.trim()]
                : [],
          boxItemKeys: splitInputValues(inlineGuideForm.boxItemKeys),
          redFlags: [],
          requiredBoxItems: [],
          ...(inlineGuideForm.videoUrl.trim() ? { videoUrl: inlineGuideForm.videoUrl.trim() } : {}),
          recommended: inlineGuideForm.assignAsRecommended,
          featured: false,
          ...(inlineGuideForm.recommendationLabel.trim()
            ? { recommendationLabel: inlineGuideForm.recommendationLabel.trim() }
            : {}),
          ...(recommendationOrder !== null ? { recommendationOrder } : {}),
          assignAsRecommended: inlineGuideForm.assignAsRecommended,
          active: true,
        },
      );

      setLibraryPayload((current) =>
        current
          ? {
              ...current,
              modules: [
                payload.guide,
                ...current.modules.filter((module) => module.id !== payload.guide.id),
              ],
            }
          : current,
      );
      setSelectedCode(payload.activationCode);
      setCodeEditorForm(codeDetailToForm(payload.activationCode));
      setInlineGuideForm(EMPTY_INLINE_GUIDE_FORM);
      setCodeEditorSuccess("Created a new education guide and assigned it to this code.");
      await loadCodes(activeBatchId);
    } catch (nextError) {
      setCodeEditorError(formatClinicError(nextError, "We couldn’t create and assign that guide."));
    } finally {
      setInlineGuideSaving(false);
    }
  }

  async function handlePreviewSnapshot() {
    if (!selectedCode) return;

    if (!procedureSavedForPreview) {
      setCodeEditorError("Procedure is required before previewing or finalizing. Enter or confirm the procedure, then save this box setup.");
      return;
    }

    if (procedureHasUnsavedChange) {
      setCodeEditorError("Save the procedure before previewing so the frozen patient view uses the right procedure.");
      return;
    }

    setSnapshotPreviewLoading(true);
    setCodeEditorError("");
    setCodeEditorSuccess("");

    try {
      const validation = await api.get<Tier1SnapshotValidationResponse>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}/validate-finalization`,
      );
      setSnapshotValidation(validation);
      setSnapshotPreview(validation.preview);
      setCodeEditorSuccess(
        validation.valid
          ? "Preview validated. This is what will freeze into the PatientSnapshot."
          : "Preview loaded with validation issues to resolve before finalization.",
      );
    } catch (nextError) {
      setCodeEditorError(formatClinicError(nextError, "We couldn’t preview that PatientSnapshot."));
      setSnapshotPreview(null);
      setSnapshotValidation(null);
    } finally {
      setSnapshotPreviewLoading(false);
    }
  }

  async function handleFinalizeCode() {
    if (!selectedCode) return;

    if (!snapshotValidation?.valid) {
      setCodeEditorError("Preview and resolve validation before finalizing this Tier 1 code.");
      return;
    }

    const confirmed = window.confirm(
      "Finalize this Tier 1 code and freeze the PatientSnapshot before the physical box leaves our hands?",
    );
    if (!confirmed) return;

    setLifecycleLoading("finalize");
    setCodeEditorError("");
    setCodeEditorSuccess("");

    try {
      const payload = await api.post<Tier1FinalizeResponse>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}/finalize`,
      );
      const detailPayload = await api.get<ActivationCodeDetailResponse>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}`,
      );
      setSelectedCode(detailPayload.activationCode);
      setCodeEditorForm(codeDetailToForm(detailPayload.activationCode));
      setCodeEditorSuccess(
        `Finalized snapshot v${payload.snapshot.version}. The Tier 1 patient view is now frozen.`,
      );
      await loadCodes(activeBatchId);
      await loadDetail(false);
      await handleLoadPackingList(selectedCode.code);
    } catch (nextError) {
      setCodeEditorError(formatClinicError(nextError, "We couldn’t finalize that activation code."));
    } finally {
      setLifecycleLoading(null);
    }
  }

  async function handlePackCode() {
    if (!selectedCode) return;

    setLifecycleLoading("pack");
    setCodeEditorError("");
    setCodeEditorSuccess("");

    try {
      await api.post<{ activationCode: Tier1FinalizeResponse["activationCode"] }>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}/pack`,
      );
      const detailPayload = await api.get<ActivationCodeDetailResponse>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}`,
      );
      setSelectedCode(detailPayload.activationCode);
      setCodeEditorForm(codeDetailToForm(detailPayload.activationCode));
      setCodeEditorSuccess("Code marked packed. The physical box is ready/prepared.");
      await loadCodes(activeBatchId);
      await loadDetail(false);
      await handleLoadPackingList(selectedCode.code);
    } catch (nextError) {
      setCodeEditorError(formatClinicError(nextError, "We couldn’t mark that code as packed."));
    } finally {
      setLifecycleLoading(null);
    }
  }

  function getOrderCodes(orderId: string) {
    return codes.filter((code) => code.clinicOrderId === orderId);
  }

  function getPackingListBundleName(list: Tier1PackingListResponse) {
    const sourceBundle = nestedRecord(list.fulfillment.sourceMetadata, "educationBundle");
    const frozenName = readRecordString(sourceBundle, "name");
    const bundleId = list.snapshot.educationBundleId ?? list.activationCode.educationBundleId;
    return frozenName ?? (bundleId ? bundleNameById.get(bundleId) ?? bundleId : "—");
  }

  function getPackingListTemplateName(list: Tier1PackingListResponse) {
    const sourceTemplate = nestedRecord(list.fulfillment.sourceMetadata, "boxTemplate");
    const frozenName = readRecordString(sourceTemplate, "name");
    const templateId = list.snapshot.boxTemplateId ?? list.activationCode.boxTemplateId;
    return frozenName ?? (templateId ? templateNameById.get(templateId) ?? templateId : "—");
  }

  function getPackingClinicNotes(list: Tier1PackingListResponse) {
    return readRecordString(list.fulfillment.clinicNotes, "clinicNotes");
  }

  function getPackingItemNotes(list: Tier1PackingListResponse) {
    const itemNotes = asPlainRecord(list.fulfillment.clinicNotes).itemNotes;
    return Array.isArray(itemNotes) ? itemNotes.map(asPlainRecord) : [];
  }

  function buildPackingListText(list: Tier1PackingListResponse) {
    const instructionGuideIds = uniqueText([
      ...list.fulfillment.assignedGuideIds,
      ...list.fulfillment.recommendedGuideIds,
      ...list.fulfillment.procedureGuideIds,
      ...list.fulfillment.boxItemGuideIds,
    ]);
    const instructionGuideIdSet = new Set(instructionGuideIds);
    const instructionGuides = list.fulfillment.guides.filter(
      (guide) => guide.id && instructionGuideIdSet.has(guide.id),
    );
    const generalLibraryGuideCount = Math.max(list.fulfillment.counts.guides - instructionGuides.length, 0);
    const lines = [
      `Packing list for ${list.activationCode.code}`,
      `Clinic: ${list.activationCode.clinicName || list.activationCode.clinicTag || "—"}`,
      `Clinic order: ${list.clinicOrder?.orderNumber || list.clinicOrder?.id || list.activationCode.clinicOrderId || "—"}`,
      `Procedure: ${list.snapshot.procedureName || list.activationCode.procedureName || "—"}`,
      `Product mode: ${formatProductMode(list.snapshot.productMode)}`,
      `Box template: ${getPackingListTemplateName(list)}`,
      `Education bundle: ${getPackingListBundleName(list)}`,
      `Snapshot: v${list.snapshot.version} (${list.snapshot.status})`,
      "",
      "Box items:",
      ...(list.fulfillment.boxItems.length
        ? list.fulfillment.boxItems.map((item, index) => {
            const note = item.note ? ` — ${item.note}` : "";
            const instructions = item.instructions ? ` (${item.instructions})` : "";
            return `${index + 1}. ${formatSnapshotBoxItemName(item)}${note}${instructions}`;
          })
        : ["No box items assigned."]),
      "",
      "Box-specific patient instructions:",
      ...(instructionGuides.length
        ? instructionGuides.map((guide, index) => {
            const label = guide.recommendationLabel ? ` — ${guide.recommendationLabel}` : "";
            return `${index + 1}. ${formatSnapshotGuideTitle(guide)}${label}`;
          })
        : ["No box-specific guides assigned."]),
      "",
      `General library frozen separately: ${generalLibraryGuideCount} article(s)`,
    ];

    return lines.join("\n");
  }

  async function copyTextToClipboard(text: string, onSuccess: () => void, onFailure: () => void) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      onSuccess();
    } catch {
      onFailure();
    }
  }

  async function handleLoadPackingList(codeOverride?: string) {
    const targetCode = codeOverride ?? selectedCode?.code;
    if (!targetCode) return;

    setPackingListLoading(true);
    setPackingListError("");
    setFulfillmentNotice("");

    try {
      const payload = await api.get<Tier1PackingListResponse>(
        `/owner/activation-codes/${encodeURIComponent(targetCode)}/packing-list`,
      );
      setPackingList(payload);
      setFulfillmentNotice("Packing list loaded from the frozen PatientSnapshot.");
    } catch (nextError) {
      setPackingList(null);
      setPackingListError(formatClinicError(nextError, "We couldn’t load the packing list."));
    } finally {
      setPackingListLoading(false);
    }
  }

  async function handleCopyPackingList() {
    if (!packingList) return;
    await copyTextToClipboard(
      buildPackingListText(packingList),
      () => setFulfillmentNotice("Packing list copied to clipboard."),
      () => setPackingListError("Clipboard access was unavailable. Use Print packing list instead."),
    );
  }

  function handlePrintPackingList() {
    if (!packingList) {
      setPackingListError("Load the packing list before printing.");
      return;
    }
    window.print();
  }

  async function handleResetCodeForReissue() {
    if (!selectedCode) return;
    const reason = codeReissueReason.trim();

    if (!reason) {
      setPackingListError("Enter an owner audit reason before resetting this code for reissue.");
      return;
    }

    const confirmed = window.confirm(
      "Reset this Tier 1 activation code for reissue? This is an audited owner-only action and should not be used for casual reuse.",
    );
    if (!confirmed) return;

    setCodeReissueLoading(true);
    setCodeEditorError("");
    setCodeEditorSuccess("");
    setPackingListError("");
    setFulfillmentNotice("");

    try {
      await api.post<{ activationCode: Tier1FinalizeResponse["activationCode"] }>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}/reset-for-reissue`,
        { reason },
      );
      const detailPayload = await api.get<ActivationCodeDetailResponse>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}`,
      );
      setSelectedCode(detailPayload.activationCode);
      setCodeEditorForm(codeDetailToForm(detailPayload.activationCode));
      setSnapshotPreview(null);
      setSnapshotValidation(null);
      setPackingList(null);
      setCodeReissueReason("");
      setCodeEditorSuccess("Code reset for reissue with an owner audit reason. Reconfigure and finalize before packing again.");
      await loadCodes(activeBatchId);
      await loadDetail(false);
    } catch (nextError) {
      setPackingListError(formatClinicError(nextError, "We couldn’t reset that code for reissue."));
    } finally {
      setCodeReissueLoading(false);
    }
  }

  async function handleCopyOrderCodes(order: ClinicOrder) {
    const orderCodes = getOrderCodes(order.id);

    if (orderCodes.length === 0) {
      setClinicOrdersError("No activation codes are loaded for this order yet.");
      setClinicOrdersSuccess("");
      return;
    }

    await copyTextToClipboard(
      orderCodes.map((code) => code.code).join("\n"),
      () => {
        setClinicOrdersSuccess(`Copied ${orderCodes.length} activation code(s) for this order.`);
        setClinicOrdersError("");
      },
      () => {
        setClinicOrdersError("Clipboard access was unavailable. Use Export order CSV instead.");
        setClinicOrdersSuccess("");
      },
    );
  }

  function handleExportOrderCodes(order: ClinicOrder) {
    const orderCodes = getOrderCodes(order.id);

    if (orderCodes.length === 0) {
      setClinicOrdersError("No activation codes are loaded for this order yet.");
      setClinicOrdersSuccess("");
      return;
    }

    const headers = [
      "code",
      "status",
      "clinicTag",
      "clinicOrderId",
      "batchId",
      "procedureName",
      "productMode",
      "boxTemplateId",
      "educationBundleId",
      "createdAt",
      "claimedAt",
      "claimedByUserId",
    ];
    const rows = orderCodes.map((code) => [
      code.code,
      code.status,
      code.clinicTag,
      code.clinicOrderId,
      code.batchId,
      code.procedureName,
      code.productMode,
      code.boxTemplateId,
      code.educationBundleId,
      code.createdAt,
      code.claimedAt,
      code.claimedByUserId,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");
    const filenameSeed = order.orderNumber || order.id;

    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `activation-codes-order-${filenameSeed}.csv`,
    );
    setClinicOrdersSuccess(`Exported ${orderCodes.length} activation code(s) for this order.`);
    setClinicOrdersError("");
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

  const codesByOrderId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const code of codes) {
      if (!code.clinicOrderId) continue;
      counts.set(code.clinicOrderId, (counts.get(code.clinicOrderId) ?? 0) + 1);
    }
    return counts;
  }, [codes]);

  const orderCodeSummaryById = useMemo(() => {
    const summaries = new Map<
      string,
      {
        total: number;
        readyToPack: number;
        needsSetup: number;
        packed: number;
        claimed: number;
      }
    >();

    for (const code of codes) {
      if (!code.clinicOrderId) continue;
      const current =
        summaries.get(code.clinicOrderId) ??
        {
          total: 0,
          readyToPack: 0,
          needsSetup: 0,
          packed: 0,
          claimed: 0,
        };

      current.total += 1;
      if (isCodeReadyToPack(code.status)) current.readyToPack += 1;
      if (isCodeNeedsFulfillmentSetup(code.status)) current.needsSetup += 1;
      if (code.status === "PACKED") current.packed += 1;
      if (code.status === "CLAIMED") current.claimed += 1;

      summaries.set(code.clinicOrderId, current);
    }

    return summaries;
  }, [codes]);

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
  const savedBundleId =
    selectedCode?.educationBundleId ?? selectedCode?.effectiveEducationBundleId ?? "";
  const savedBundle =
    libraryPayload?.bundles.find((bundle) => bundle.id === savedBundleId) ?? null;
  const savedProcedureName = (
    selectedCode?.procedureName ??
    selectedCode?.effectiveProcedureName ??
    ""
  ).trim();
  const procedureInputValue = codeEditorForm.procedureName.trim();
  const procedureHasUnsavedChange = Boolean(
    selectedCode && procedureInputValue !== savedProcedureName,
  );
  const procedureSavedForPreview = Boolean(savedProcedureName);
  const procedureSourceLabel = selectedCode?.procedureName
    ? "Saved on this code"
    : selectedCode?.batchDefaults?.procedureName
      ? "Inherited from this order"
      : savedBundle?.procedureName
        ? "Inherited from EducationBundle"
        : "Required before preview";
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
  const codeLevelBoxItemRows = codeLevelBoxItems.map((item) => {
    const catalogItem = item.key ? catalogItemByKey.get(item.key) : null;
    const label = catalogItem?.name ?? item.label;

    return {
      key: item.key ?? null,
      label,
      name: label,
      category: catalogItem?.category ?? null,
      description: catalogItem?.description ?? null,
      instructions: catalogItem?.instructions ?? null,
      defaultEducationModuleId: catalogItem?.defaultEducationModuleId ?? null,
      note: item.note ?? null,
      sourceLabel: catalogItem ? "Catalog item added to this code" : "Code-level custom item",
      sourceDetail: catalogItem
        ? `Catalog key: ${catalogItem.key}`
        : "Typed directly for this one activation code",
      sourceTone: catalogItem ? "active" : "warning",
    };
  });
  const inheritedBoxItemRows = visibleInheritedBoxItems
    .filter((item) => {
      const dedupeKey = item.key ?? item.label;
      return !codeLevelBoxItems.some((codeItem) => (codeItem.key ?? codeItem.label) === dedupeKey);
    })
    .map((item) => ({
      key: item.key ?? null,
      label: item.label,
      name: item.name || item.label,
      category: item.category ?? null,
      description: item.description ?? null,
      instructions: item.instructions ?? null,
      defaultEducationModuleId: item.defaultEducationModuleId ?? null,
      note: item.note ?? null,
      sourceLabel: selectedFormTemplate ? "From selected BoxTemplate" : "Inherited from batch/template",
      sourceDetail: selectedFormTemplate
        ? selectedFormTemplate.name
        : selectedCode?.batchDefaults?.boxTemplateId ?? "Batch default",
      sourceTone: "inactive",
    }));
  const finalPreviewBoxItems = [...codeLevelBoxItemRows, ...inheritedBoxItemRows];
  const snapshotInstructionGuideIds = snapshotPreview
    ? uniqueText([
        ...snapshotPreview.snapshot.assignedGuideIds,
        ...snapshotPreview.snapshot.recommendedGuideIds,
        ...snapshotPreview.snapshot.procedureGuideIds,
        ...snapshotPreview.snapshot.boxItemGuideIds,
      ])
    : [];
  const snapshotInstructionGuideIdSet = new Set(snapshotInstructionGuideIds);
  const snapshotPatientInstructionGuides = snapshotPreview
    ? snapshotPreview.snapshot.guides.filter((guide) => guide.id && snapshotInstructionGuideIdSet.has(guide.id))
    : [];
  const snapshotGeneralLibraryGuideCount = snapshotPreview
    ? Math.max(snapshotPreview.counts.guides - snapshotPatientInstructionGuides.length, 0)
    : 0;
  const packingInstructionGuideIds = packingList
    ? uniqueText([
        ...packingList.fulfillment.assignedGuideIds,
        ...packingList.fulfillment.recommendedGuideIds,
        ...packingList.fulfillment.procedureGuideIds,
        ...packingList.fulfillment.boxItemGuideIds,
      ])
    : [];
  const packingInstructionGuideIdSet = new Set(packingInstructionGuideIds);
  const packingPatientInstructionGuides = packingList
    ? packingList.fulfillment.guides.filter((guide) => guide.id && packingInstructionGuideIdSet.has(guide.id))
    : [];
  const packingGeneralLibraryGuideCount = packingList
    ? Math.max(packingList.fulfillment.counts.guides - packingPatientInstructionGuides.length, 0)
    : 0;
  const selectedCodeLocked = isTier1SnapshotLocked(selectedCode);
  const selectedCodeIsTier1 = selectedCode?.productMode === "kit_only";
  const selectedCodeCanFinalize =
    selectedCodeIsTier1 && isTier1FinalizableStatus(selectedCode?.status);
  const selectedCodeCanPack =
    selectedCodeIsTier1 && isTier1PackableStatus(selectedCode?.status);
  const finalizationChecklist = [
    {
      label: "Clinic selected",
      description: snapshotValidation?.preview?.activationCode.clinicTag || selectedCode?.clinicTag || "No clinic",
      passed: Boolean(snapshotValidation?.preview?.activationCode.clinicTag || selectedCode?.clinicTag),
    },
    {
      label: "Procedure selected",
      description: snapshotValidation?.preview?.snapshot.procedureName
        ? snapshotValidation.preview.snapshot.procedureName
        : savedProcedureName
          ? `${savedProcedureName} (${procedureSourceLabel})`
          : "Required before preview/finalize",
      passed: Boolean(snapshotValidation?.preview?.snapshot.procedureName || savedProcedureName),
    },
    {
      label: "Tier 1 product mode",
      description: formatProductMode(snapshotValidation?.preview?.snapshot.productMode ?? codeEditorForm.productMode),
      passed: (snapshotValidation?.preview?.snapshot.productMode ?? codeEditorForm.productMode) === "kit_only",
    },
    {
      label: "Box items confirmed",
      description: snapshotValidation?.preview
        ? `${snapshotValidation.preview.counts.boxItems} item(s) in preview`
        : "Run preview to confirm",
      passed: (snapshotValidation?.preview?.counts.boxItems ?? 0) > 0,
    },
    {
      label: "Guide or bundle assigned",
      description: snapshotValidation?.preview
        ? `${snapshotInstructionGuideIds.length} box/procedure guide(s); ${snapshotGeneralLibraryGuideCount} library article(s) frozen separately`
        : codeEditorForm.educationBundleId
          ? "Bundle selected; run preview"
          : "Run preview after assigning education",
      passed:
        snapshotInstructionGuideIds.length > 0 ||
        Boolean(snapshotValidation?.preview?.snapshot.educationBundleId),
    },
    {
      label: "Preview can render",
      description: snapshotValidation?.preview ? "Preview loaded" : "Preview not loaded yet",
      passed: Boolean(snapshotValidation?.preview),
    },
    {
      label: "Snapshot can be created",
      description: snapshotValidation
        ? snapshotValidation.valid
          ? "Ready to finalize"
          : "Resolve validation messages"
        : "Run preview validation",
      passed: snapshotValidation?.valid === true,
    },
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
            <p className="eyebrow">Tier 1 fulfillment</p>
            <h1>{detail.clinic.name || detail.clinic.clinicTag}</h1>
            <p className="muted">
              Build kit-only recovery boxes from order to packed handoff. Start with a Clinic Order,
              generate codes, configure one box at a time, preview the patient view, then finalize,
              pack, and print.
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
            <p className="eyebrow">Fulfillment flow</p>
            <h2>Build boxes in this order</h2>
            <p className="muted">
              The primary path stays on this page: create the order, generate codes, open a code,
              build the box, preview, finalize, pack, then print or export.
            </p>
          </div>
        </div>
        <nav className="workspace-nav fulfillment-stepper" aria-label="Tier 1 fulfillment steps">
          <a href="#clinic-orders"><span>1</span>Create order</a>
          <a href="#clinic-orders"><span>2</span>Generate codes</a>
          <a href="#code-assignment-editor"><span>3</span>Build one box</a>
          <a href="#snapshot-preview-panel"><span>4</span>Preview & finalize</a>
          <a href="#packing-list-panel"><span>5</span>Pack / print</a>
          <a href="#advanced-clinic-admin"><span>+</span>Advanced</a>
        </nav>
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {adminError ? <div className="alert error">{adminError}</div> : null}
      {adminSuccess ? <div className="alert success">{adminSuccess}</div> : null}
      {userActionError ? <div className="alert error">{userActionError}</div> : null}
      {userActionSuccess ? <div className="alert success">{userActionSuccess}</div> : null}
      {clinicActionError ? <div className="alert error">{clinicActionError}</div> : null}
      {clinicActionSuccess ? <div className="alert success">{clinicActionSuccess}</div> : null}
      {clinicOrdersError ? <div className="alert error">{clinicOrdersError}</div> : null}
      {clinicOrdersSuccess ? <div className="alert success">{clinicOrdersSuccess}</div> : null}
      {codesError ? <div className="alert error">{codesError}</div> : null}
      {generateCodesError ? <div className="alert error">{generateCodesError}</div> : null}
      {generateCodesSuccess ? <div className="alert success">{generateCodesSuccess}</div> : null}

      {deleteBlockedActivity ? (
        <div className="alert error">
          <strong>Delete blocked.</strong>
          <div className="owner-activity-grid">
            <span>Claimed codes: {deleteBlockedActivity.claimedCodesCount}</span>
            <span>Patient records: {deleteBlockedActivity.logEntriesCount}</span>
            <span>Plan records: {deleteBlockedActivity.recoveryPlansCount}</span>
            <span>Operational records: {deleteBlockedActivity.operationalAlertsCount}</span>
            <span>Reminder records: {deleteBlockedActivity.reminderOutboxCount}</span>
          </div>
        </div>
      ) : null}

      <details className="advanced-panel admin-collapsible" id="clinic-overview">
        <summary>Clinic profile and activity</summary>
        <div className="grid-two owner-detail-grid">
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
        </div>
      </details>

      <section className="panel" id="clinic-orders">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2>Create or open a box order</h2>
            <p className="muted">
              Set the default procedure, box template, and education bundle once, then generate the codes
              that map one-to-one with physical boxes.
            </p>
          </div>
          <button
            className="button secondary"
            type="button"
            onClick={() => void loadClinicOrders()}
            disabled={clinicOrdersLoading}
          >
            {clinicOrdersLoading ? <Loader2 size={16} className="spin" /> : <TableProperties size={16} />}
            Refresh orders
          </button>
        </div>

        <div className="info-card owner-form-card">
          <h3>New box order</h3>
          {clinicArchived ? (
            <div className="alert error">
              This clinic is archived. New Tier 1 orders cannot be created until the clinic is provisioned again.
            </div>
          ) : null}
          <form className="form-stack" onSubmit={handleCreateClinicOrder}>
            <div className="grid-two">
              <label className="field">
                <span>Requested box quantity</span>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={clinicOrderForm.requestedBoxCount}
                  onChange={(event) =>
                    setClinicOrderForm((current) => ({
                      ...current,
                      requestedBoxCount: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="field">
                <span>Product mode</span>
                <select
                  value={clinicOrderForm.productMode}
                  onChange={(event) =>
                    setClinicOrderForm((current) => ({
                      ...current,
                      productMode: event.target.value as RecoveryLibraryProductMode,
                    }))
                  }
                >
                  <option value="kit_only">Kit-only education</option>
                </select>
              </label>

              <label className="field">
                <span>Default procedure</span>
                <input
                  type="text"
                  value={clinicOrderForm.defaultProcedureName}
                  onChange={(event) =>
                    setClinicOrderForm((current) => ({
                      ...current,
                      defaultProcedureName: event.target.value,
                    }))
                  }
                  placeholder="General Surgery"
                />
              </label>

              <label className="field">
                <span>Default BoxTemplate</span>
                <select
                  value={clinicOrderForm.defaultBoxTemplateId}
                  onChange={(event) =>
                    setClinicOrderForm((current) => ({
                      ...current,
                      defaultBoxTemplateId: event.target.value,
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
                <span>Default EducationBundle</span>
                <select
                  value={clinicOrderForm.defaultEducationBundleId}
                  onChange={(event) =>
                    setClinicOrderForm((current) => ({
                      ...current,
                      defaultEducationBundleId: event.target.value,
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
                <span>Order number</span>
                <input
                  type="text"
                  value={clinicOrderForm.orderNumber}
                  onChange={(event) =>
                    setClinicOrderForm((current) => ({
                      ...current,
                      orderNumber: event.target.value,
                    }))
                  }
                  placeholder="Optional internal order number"
                />
              </label>

              <label className="field">
                <span>Requested by name</span>
                <input
                  type="text"
                  value={clinicOrderForm.requestedByName}
                  onChange={(event) =>
                    setClinicOrderForm((current) => ({
                      ...current,
                      requestedByName: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </label>

              <label className="field">
                <span>Requested by email</span>
                <input
                  type="email"
                  value={clinicOrderForm.requestedByEmail}
                  onChange={(event) =>
                    setClinicOrderForm((current) => ({
                      ...current,
                      requestedByEmail: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </label>
            </div>

            <label className="field">
              <span>Order notes</span>
              <textarea
                value={clinicOrderForm.notes}
                onChange={(event) =>
                  setClinicOrderForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Clinic notes, fulfillment reminders, special kit context"
                rows={3}
              />
            </label>

            <button
              className="button primary"
              type="submit"
              disabled={clinicOrderSubmitting || clinicArchived}
            >
              {clinicOrderSubmitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Creating order
                </>
              ) : (
                <>
                  <PlusCircle size={16} />
                  Create box order
                </>
              )}
            </button>
          </form>
        </div>

        <div className="table-wrap">
          {clinicOrdersLoading && clinicOrders.length === 0 ? (
            <p className="muted">Loading box orders...</p>
          ) : clinicOrders.length === 0 ? (
            <p className="muted">No box orders yet. Create one above to start Tier 1 fulfillment.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Defaults</th>
                  <th>Created</th>
                  <th>Codes</th>
                  <th>Generate</th>
                </tr>
              </thead>
              <tbody>
                {clinicOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <div className="cell-strong">{order.orderNumber || order.id}</div>
                      <div className="cell-muted">{order.requestedBoxCount ?? "—"} requested kit(s)</div>
                      {order.notes ? <div className="cell-muted">{order.notes}</div> : null}
                    </td>
                    <td>
                      <span className="status-pill active">{formatOrderStatus(order.status)}</span>
                      <div className="cell-muted">{formatProductMode(order.productMode)}</div>
                    </td>
                    <td>
                      <div className="cell-strong">{order.defaultProcedureName || "No procedure"}</div>
                      <div className="cell-muted">
                        {order.defaultBoxTemplateId
                          ? templateNameById.get(order.defaultBoxTemplateId) ?? "Template assigned"
                          : "No BoxTemplate"}
                      </div>
                      <div className="cell-muted">
                        {order.defaultEducationBundleId
                          ? bundleNameById.get(order.defaultEducationBundleId) ?? "Bundle assigned"
                          : "No EducationBundle"}
                      </div>
                    </td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>
                      <div className="cell-strong">{codesByOrderId.get(order.id) ?? 0} loaded code(s)</div>
                      <div className="cell-muted">{order.batchCount} batch(es)</div>
                      {(() => {
                        const summary = orderCodeSummaryById.get(order.id);
                        if (!summary) return null;

                        return (
                          <div className="fulfillment-summary">
                            <span className="status-pill active">{summary.readyToPack} ready to pack</span>
                            <span className={summary.needsSetup > 0 ? "status-pill warning" : "status-pill active"}>
                              {summary.needsSetup} need setup/finalization
                            </span>
                            {summary.packed > 0 ? <span className="status-pill active">{summary.packed} packed</span> : null}
                            {summary.claimed > 0 ? <span className="status-pill inactive">{summary.claimed} claimed</span> : null}
                          </div>
                        );
                      })()}
                      {(() => {
                        const orderCodes = codes.filter((code) => code.clinicOrderId === order.id);
                        if (orderCodes.length === 0) return null;

                        return (
                          <div className="tag-cloud mini-tag-cloud">
                            {orderCodes.slice(0, 6).map((code) => (
                              <button
                                key={code.code}
                                className="chip-button"
                                type="button"
                                onClick={() => void handleOpenCode(code.code)}
                              >
                                {code.code}
                              </button>
                            ))}
                            {orderCodes.length > 6 ? <span className="cell-muted">+{orderCodes.length - 6} more</span> : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <div className="action-stack">
                        <label className="field compact-field">
                          <span>Quantity</span>
                          <input
                            type="number"
                            min={1}
                            max={5000}
                            value={orderGenerateQuantityById[order.id] ?? String(order.requestedBoxCount ?? 1)}
                            onChange={(event) =>
                              setOrderGenerateQuantityById((current) => ({
                                ...current,
                                [order.id]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          className="button primary action-button"
                          type="button"
                          onClick={() => void handleGenerateCodesFromOrder(order)}
                          disabled={orderActionLoading === order.id || clinicArchived}
                        >
                          {orderActionLoading === order.id ? (
                            <>
                              <Loader2 size={16} className="spin" />
                              Generating
                            </>
                          ) : (
                            <>
                              <PlusCircle size={16} />
                              Generate box codes
                            </>
                          )}
                        </button>
                        <button
                          className="button secondary action-button"
                          type="button"
                          onClick={() => {
                            setActiveBatchId(null);
                            void loadCodes(null);
                            window.setTimeout(() => {
                              document
                                .getElementById("activation-codes")
                                ?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }, 0);
                          }}
                        >
                          View clinic codes
                        </button>
                        <button
                          className="button secondary action-button"
                          type="button"
                          onClick={() => void handleCopyOrderCodes(order)}
                          disabled={(codesByOrderId.get(order.id) ?? 0) === 0}
                        >
                          <Clipboard size={16} />
                          Copy order codes
                        </button>
                        <button
                          className="button secondary action-button"
                          type="button"
                          onClick={() => handleExportOrderCodes(order)}
                          disabled={(codesByOrderId.get(order.id) ?? 0) === 0}
                        >
                          <FileDown size={16} />
                          Export order CSV
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

      <section className="panel" id="code-assignment-editor">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Step 3</p>
            <h2>Build this box</h2>
            <p className="muted">
              Open one code from the order, confirm the physical contents, choose the patient instructions,
              preview what the patient will see, then finalize before packing.
            </p>
          </div>
        </div>

        {libraryError ? <div className="alert error">{libraryError}</div> : null}
        {codeEditorError ? <div className="alert error">{codeEditorError}</div> : null}
        {codeEditorSuccess ? <div className="alert success">{codeEditorSuccess}</div> : null}
        {packingListError ? <div className="alert error">{packingListError}</div> : null}
        {fulfillmentNotice ? <div className="alert success">{fulfillmentNotice}</div> : null}

        {codeEditorLoading ? (
          <div className="info-card">
            <Loader2 size={18} className="spin" />
            <p className="muted">Loading this box setup.</p>
          </div>
        ) : selectedCode ? (
          <form className="form-stack" onSubmit={handleSaveCodeAssignment}>
            {selectedCodeLocked ? (
              <div className="alert success">
                <strong>Snapshot frozen.</strong> This Tier 1 code has a finalized PatientSnapshot.
                Content edits are locked unless an explicit correction/new snapshot version workflow is used.
              </div>
            ) : null}

            <div className="grid-two">
              <div className="info-card">
                <p className="eyebrow">Box code</p>
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
                  <div>
                    <dt>Clinic order</dt>
                    <dd>{selectedCode.clinicOrderId || selectedCode.batchDefaults?.clinicOrderId || "—"}</dd>
                  </div>
                  <div>
                    <dt>Frozen patient view</dt>
                    <dd>
                      {selectedCode.currentSnapshot
                        ? `v${selectedCode.currentSnapshot.version} · ${formatDateTime(selectedCode.currentSnapshot.createdAt)}`
                        : "Not finalized"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="info-card">
                <p className="eyebrow">Current setup</p>
                <h3>Template and education</h3>
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
                {selectedCodeLocked ? (
                  <div className="inline-note compact-note">
                    <LockKeyhole size={18} />
                    <span>Finalized Tier 1 content is locked to protect box-to-patient consistency.</span>
                  </div>
                ) : null}
              </div>
            </div>

            {selectedCodeIsTier1 ? (
              <div className="info-card form-stack print-hidden">
                <div className="section-heading compact-section-heading">
                  <div>
                    <p className="eyebrow">Step 5</p>
                    <h3>Pack / print after finalizing</h3>
                    <p className="muted">
                      Packing lists unlock after finalization and come from the frozen patient view,
                      not from later template or bundle edits.
                    </p>
                  </div>
                </div>

                <div className="action-row">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void handleLoadPackingList()}
                    disabled={packingListLoading || !isCodeReadyToPack(selectedCode.status)}
                  >
                    {packingListLoading ? <Loader2 size={16} className="spin" /> : <ListChecks size={16} />}
                    Load packing list
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void handleCopyPackingList()}
                    disabled={!packingList}
                  >
                    <ClipboardCheck size={16} />
                    Copy checklist
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={handlePrintPackingList}
                    disabled={!packingList}
                  >
                    <Printer size={16} />
                    Print packing list
                  </button>
                </div>

                {!isCodeReadyToPack(selectedCode.status) ? (
                  <div className="inline-note compact-note">
                    <LockKeyhole size={18} />
                    <span>Finalize this code before packing so the physical box matches the patient’s frozen instructions.</span>
                  </div>
                ) : null}

                {["FINALIZED", "PACKED", "CLAIMED"].includes(selectedCode.status) ? (
                  <details className="advanced-panel danger-panel">
                  <summary>Reissue this code with an audit reason</summary>
                    <div className="form-stack">
                      <p className="muted">
                        Claimed or finalized codes are not casually reusable. Reset only when an owner intentionally voids the current fulfillment path and records why.
                      </p>
                      <label className="field">
                        <span>Audit reason required</span>
                        <textarea
                          value={codeReissueReason}
                          onChange={(event) => setCodeReissueReason(event.target.value)}
                          placeholder="Example: Box damaged before clinic handoff; reissue replacement code."
                          rows={3}
                        />
                      </label>
                      <button
                        className="button danger"
                        type="button"
                        onClick={() => void handleResetCodeForReissue()}
                        disabled={codeReissueLoading || !codeReissueReason.trim()}
                      >
                        {codeReissueLoading ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />}
                        Reset for reissue
                      </button>
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            <div className={procedureSavedForPreview ? "info-card form-stack" : "info-card form-stack warning-card"}>
              <div className="section-heading compact-section-heading">
                <div>
                  <p className="eyebrow">Required before preview</p>
                  <h3>Procedure</h3>
                  <p className="muted">
                    Tier 1 snapshots require a procedure so the patient view and box contents stay matched.
                    This can inherit from the box order, bundle, or saved code default.
                  </p>
                </div>
                <span className={procedureSavedForPreview ? "status-pill active" : "status-pill warning"}>
                  {procedureSavedForPreview ? procedureSourceLabel : "Procedure required"}
                </span>
              </div>

              <div className="grid-two">
                <label className="field">
                  <span>Procedure name *</span>
                  <input
                    type="text"
                    value={codeEditorForm.procedureName}
                    disabled={selectedCodeLocked}
                    required
                    aria-invalid={!procedureInputValue && !procedureSavedForPreview}
                    onChange={(event) =>
                      setCodeEditorForm((current) => ({
                        ...current,
                        procedureName: event.target.value,
                      }))
                    }
                    placeholder="General Surgery"
                  />
                </label>
                <div className="action-stack">
                  <p className="muted">
                    {procedureSavedForPreview
                      ? `Current procedure: ${savedProcedureName}`
                      : "Enter a procedure, or apply an EducationBundle/order default that includes one."}
                    {procedureHasUnsavedChange ? " Save before previewing." : ""}
                  </p>
                  <button
                    className="button primary action-button"
                    type="submit"
                    disabled={codeEditorSaving || selectedCodeLocked || !procedureInputValue}
                  >
                    {codeEditorSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                    Save procedure / box setup
                  </button>
                </div>
              </div>
            </div>

            <div className="grid-two">
              <label className="field">
                <span>Education bundle</span>
                <select
                  value={codeEditorForm.educationBundleId}
                  disabled={selectedCodeLocked}
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
                  disabled={selectedCodeLocked}
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
                <span>Product mode</span>
                <select
                  value={codeEditorForm.productMode}
                  disabled={selectedCodeLocked}
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

            <div className="action-row">
              <button
                className="button secondary"
                type="button"
                onClick={() => void handleApplyBoxTemplate()}
                disabled={!codeEditorForm.boxTemplateId || codeEditorSaving || selectedCodeLocked}
              >
                {codeEditorSaving ? <Loader2 size={16} className="spin" /> : <WandSparkles size={16} />}
                Apply BoxTemplate to this code
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => void handleApplyEducationBundle()}
                disabled={!codeEditorForm.educationBundleId || codeEditorSaving || selectedCodeLocked}
              >
                {codeEditorSaving ? <Loader2 size={16} className="spin" /> : <BookPlus size={16} />}
                Apply EducationBundle to this code
              </button>
            </div>

            <div className="inline-note">
              <span>{productModeDescription(codeEditorForm.productMode)}</span>
            </div>

            <div className="info-card form-stack">
              <h3>Physical items in this box</h3>
              <p className="muted">
                Confirm what goes into this one physical box. Each item shows where it came from and what the patient will read.
              </p>

              <div className="grid-two">
                <label className="field">
                  <span>Add item from catalog</span>
                  <select
                    value={boxItemPickKey}
                    disabled={selectedCodeLocked}
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
                    disabled={!boxItemPickKey || selectedCodeLocked}
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
                            disabled={selectedCodeLocked}
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
                  <h3>Box checklist preview</h3>
                  {finalPreviewBoxItems.length ? (
                    <div className="box-item-source-list">
                      {finalPreviewBoxItems.map((item) => (
                        <div className="box-item-source-card" key={item.key ?? item.label}>
                          <div className="library-assignment-header">
                            <div>
                              <strong>{item.name || item.label}</strong>
                              <span>
                                {item.key ? `Key: ${item.key}` : "No catalog key"}
                                {item.category ? ` · ${item.category}` : ""}
                              </span>
                            </div>
                            <span className={`status-pill ${item.sourceTone}`}>{item.sourceLabel}</span>
                          </div>
                          <p className="muted">{item.sourceDetail}</p>
                          {item.note ? <p className="muted"><strong>Box note:</strong> {item.note}</p> : null}
                          {item.description ? <p className="muted"><strong>Description:</strong> {item.description}</p> : null}
                          {item.instructions ? <p className="muted"><strong>Instructions:</strong> {item.instructions}</p> : null}
                          {item.defaultEducationModuleId ? (
                            <p className="muted">
                              <strong>Linked guide:</strong> {findGuideTitle(libraryPayload, item.defaultEducationModuleId)}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No final items configured yet.</p>
                  )}
                </div>
              </div>

              <label className="field">
                <span>Items added only to this code</span>
                <textarea
                  value={codeEditorForm.assignedBoxItemsText}
                  disabled={selectedCodeLocked}
                  onChange={(event) =>
                    setCodeEditorForm((current) => ({
                      ...current,
                      assignedBoxItemsText: event.target.value,
                    }))
                  }
                  placeholder={"ice_pack|Ice Pack|Use 20 minutes at a time\ncompression_socks|Compression Socks"}
                  rows={4}
                />
              </label>

              <label className="field">
                <span>Template item keys removed from this code</span>
                <textarea
                  value={codeEditorForm.removedBoxItemKeysText}
                  disabled={selectedCodeLocked}
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

              <details className="advanced-panel">
                <summary>Create a missing box item without leaving this box</summary>
                <div className="form-stack">
                  <div className="grid-two">
                    <label className="field">
                      <span>Item key</span>
                      <input
                        value={inlineBoxItemForm.key}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineBoxItemForm((current) => ({
                            ...current,
                            key: event.target.value,
                          }))
                        }
                        placeholder="compression_wrap"
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Item name</span>
                      <input
                        value={inlineBoxItemForm.name}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineBoxItemForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Compression Wrap"
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Category</span>
                      <input
                        value={inlineBoxItemForm.category}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineBoxItemForm((current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        }
                        placeholder="Compression"
                      />
                    </label>

                    <label className="field">
                      <span>Item note for this code</span>
                      <input
                        value={inlineBoxItemForm.note}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineBoxItemForm((current) => ({
                            ...current,
                            note: event.target.value,
                          }))
                        }
                        placeholder="Use as tolerated"
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>Instructions</span>
                    <textarea
                      value={inlineBoxItemForm.instructions}
                      disabled={selectedCodeLocked}
                      onChange={(event) =>
                        setInlineBoxItemForm((current) => ({
                          ...current,
                          instructions: event.target.value,
                        }))
                      }
                      placeholder="Patient-facing instructions for this item"
                      rows={3}
                    />
                  </label>

                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void handleCreateInlineBoxItem()}
                    disabled={inlineBoxItemSaving || selectedCodeLocked}
                  >
                    {inlineBoxItemSaving ? <Loader2 size={16} className="spin" /> : <PlusCircle size={16} />}
                    Create item and add to this box
                  </button>
                </div>
              </details>
            </div>

            <div className="info-card form-stack">
              <h3>Patient instructions for this box</h3>
              <p className="muted">
                Add only the procedure or item-specific guides that should be emphasized for this box.
                The full education library remains available separately.
              </p>
              <div className="grid-two">
                <label className="field">
                  <span>Select an existing guide</span>
                  <select
                    value={guidePickId}
                    disabled={selectedCodeLocked}
                    onChange={(event) => setGuidePickId(event.target.value)}
                  >
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
                    disabled={!guidePickId || selectedCodeLocked}
                  >
                    Add selected
                  </button>
                  <button
                    className="button secondary action-button"
                    type="button"
                    onClick={() => addGuideToCodeField("recommendedGuideIdsText")}
                    disabled={!guidePickId || selectedCodeLocked}
                  >
                    Add recommended
                  </button>
                </div>
              </div>

              <div className="grid-two">
                <label className="field">
                  <span>Guides assigned to this patient view</span>
                  <textarea
                    value={codeEditorForm.guideIdsText}
                    disabled={selectedCodeLocked}
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
                  <span>Recommended / start-here guides</span>
                  <textarea
                    value={codeEditorForm.recommendedGuideIdsText}
                    disabled={selectedCodeLocked}
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

              <details className="advanced-panel">
                <summary>Create a missing patient guide without leaving this box</summary>
                <div className="form-stack">
                  <div className="grid-two">
                    <label className="field">
                      <span>Guide title</span>
                      <input
                        value={inlineGuideForm.title}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineGuideForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Using Your Compression Wrap"
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Summary</span>
                      <input
                        value={inlineGuideForm.summary}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineGuideForm((current) => ({
                            ...current,
                            summary: event.target.value,
                          }))
                        }
                        placeholder="Short patient-facing summary"
                      />
                    </label>

                    <label className="field">
                      <span>Categories</span>
                      <input
                        value={inlineGuideForm.categories}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineGuideForm((current) => ({
                            ...current,
                            categories: event.target.value,
                          }))
                        }
                        placeholder="clinic-instructions, box-item-instructions"
                      />
                    </label>

                    <label className="field">
                      <span>Box item keys</span>
                      <input
                        value={inlineGuideForm.boxItemKeys}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineGuideForm((current) => ({
                            ...current,
                            boxItemKeys: event.target.value,
                          }))
                        }
                        placeholder="compression_wrap"
                      />
                    </label>

                    <label className="field">
                      <span>Procedure names</span>
                      <input
                        value={inlineGuideForm.procedureNames}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineGuideForm((current) => ({
                            ...current,
                            procedureNames: event.target.value,
                          }))
                        }
                        placeholder="Defaults to the code procedure if blank"
                      />
                    </label>

                    <label className="field">
                      <span>Video URL</span>
                      <input
                        value={inlineGuideForm.videoUrl}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineGuideForm((current) => ({
                            ...current,
                            videoUrl: event.target.value,
                          }))
                        }
                        placeholder="Optional"
                      />
                    </label>

                    <label className="field">
                      <span>Recommendation label</span>
                      <input
                        value={inlineGuideForm.recommendationLabel}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineGuideForm((current) => ({
                            ...current,
                            recommendationLabel: event.target.value,
                          }))
                        }
                        placeholder="Start here"
                      />
                    </label>

                    <label className="field">
                      <span>Recommendation order</span>
                      <input
                        type="number"
                        min={0}
                        value={inlineGuideForm.recommendationOrder}
                        disabled={selectedCodeLocked}
                        onChange={(event) =>
                          setInlineGuideForm((current) => ({
                            ...current,
                            recommendationOrder: event.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>Guide body</span>
                    <textarea
                      value={inlineGuideForm.body}
                      disabled={selectedCodeLocked}
                      onChange={(event) =>
                        setInlineGuideForm((current) => ({
                          ...current,
                          body: event.target.value,
                        }))
                      }
                      placeholder="Patient-facing guide content"
                      rows={5}
                      required
                    />
                  </label>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={inlineGuideForm.assignAsRecommended}
                      disabled={selectedCodeLocked}
                      onChange={(event) =>
                        setInlineGuideForm((current) => ({
                          ...current,
                          assignAsRecommended: event.target.checked,
                        }))
                      }
                    />
                    <span>Add as recommended guide for this activation code</span>
                  </label>

                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void handleCreateInlineGuide()}
                    disabled={inlineGuideSaving || selectedCodeLocked}
                  >
                    {inlineGuideSaving ? <Loader2 size={16} className="spin" /> : <BookPlus size={16} />}
                    Create guide and add to this box
                  </button>
                </div>
              </details>
            </div>

            <div className="info-card form-stack" id="snapshot-preview-panel">
              <div className="section-heading compact-section-heading">
                <div>
                  <p className="eyebrow">Step 4</p>
                  <h3>Preview patient view before finalizing</h3>
                  <p className="muted">
                    Check the exact kit-only instructions this patient will see. Finalizing freezes this view
                    so future template, bundle, item, or guide edits do not change this box.
                  </p>
                </div>
              </div>

              <div className="action-row">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void handlePreviewSnapshot()}
                  disabled={
                    snapshotPreviewLoading ||
                    !selectedCodeIsTier1 ||
                    !procedureSavedForPreview ||
                    procedureHasUnsavedChange
                  }
                >
                  {snapshotPreviewLoading ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}
                  Preview patient view
                </button>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => void handleFinalizeCode()}
                  disabled={
                    lifecycleLoading === "finalize" ||
                    selectedCodeLocked ||
                    !selectedCodeCanFinalize ||
                    !procedureSavedForPreview ||
                    procedureHasUnsavedChange ||
                    !snapshotValidation?.valid
                  }
                >
                  {lifecycleLoading === "finalize" ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <LockKeyhole size={16} />
                  )}
                  Finalize patient view
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void handlePackCode()}
                  disabled={
                    lifecycleLoading === "pack" ||
                    !selectedCodeCanPack ||
                    selectedCode?.status === "PACKED"
                  }
                >
                  {lifecycleLoading === "pack" ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <PackageCheck size={16} />
                  )}
                  {selectedCode?.status === "PACKED" ? "Packed" : "Mark packed"}
                </button>
              </div>

              {!selectedCodeIsTier1 ? (
                <div className="alert error">
                  Snapshot preview/finalize is only available for kit-only Tier 1 activation codes.
                </div>
              ) : null}

              {selectedCodeIsTier1 && !procedureSavedForPreview ? (
                <div className="alert error">
                  Procedure is required before previewing or finalizing. Enter it in the Procedure card above, then save this box setup.
                </div>
              ) : null}

              {selectedCodeIsTier1 && procedureSavedForPreview && procedureHasUnsavedChange ? (
                <div className="alert error">
                  Procedure has unsaved changes. Save this box setup before previewing so the frozen patient view uses the correct procedure.
                </div>
              ) : null}

              {selectedCodeIsTier1 ? (
                <div className="validation-check-grid">
                  {finalizationChecklist.map((item) => (
                    <div
                      className={item.passed ? "validation-check passed" : "validation-check needs-work"}
                      key={item.label}
                    >
                      {item.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {snapshotValidation ? (
                <div className={snapshotValidation.valid ? "alert success" : "alert error"}>
                  <strong>{snapshotValidation.valid ? "Validation passed." : "Validation needs attention."}</strong>
                  {snapshotValidation.issues.length ? (
                    <ul className="compact-list">
                      {snapshotValidation.issues.map((issue) => (
                        <li key={issue.code}>{issue.message}</li>
                      ))}
                    </ul>
                  ) : (
                    <span> This code is ready to finalize.</span>
                  )}
                </div>
              ) : null}

              {snapshotPreview ? (
                <div className="snapshot-preview-grid">
                  <div className="library-preview-card">
                    <h3>Snapshot summary</h3>
                    <dl className="meta-list">
                      <div>
                        <dt>Procedure</dt>
                        <dd>{snapshotPreview.snapshot.procedureName || "—"}</dd>
                      </div>
                      <div>
                        <dt>Product mode</dt>
                        <dd>{formatProductMode(snapshotPreview.snapshot.productMode)}</dd>
                      </div>
                      <div>
                        <dt>Box items</dt>
                        <dd>{snapshotPreview.counts.boxItems}</dd>
                      </div>
                      <div>
                        <dt>Guides</dt>
                        <dd>{snapshotPatientInstructionGuides.length} box-specific</dd>
                      </div>
                      <div>
                        <dt>Full library</dt>
                        <dd>{snapshotGeneralLibraryGuideCount} article(s) frozen separately</dd>
                      </div>
                      <div>
                        <dt>Videos</dt>
                        <dd>{snapshotPreview.counts.videos}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="library-preview-card">
                    <h3>Final box items</h3>
                    {snapshotPreview.snapshot.boxItems.length ? (
                      <div className="box-item-source-list">
                        {snapshotPreview.snapshot.boxItems.map((item, index) => (
                          <div className="box-item-source-card" key={`${item.key ?? item.label ?? "item"}-${index}`}>
                            <div className="library-assignment-header">
                              <div>
                                <strong>{formatSnapshotBoxItemName(item)}</strong>
                                <span>{item.key ? `Key: ${item.key}` : "No catalog key"}</span>
                              </div>
                              <span className="status-pill active">Frozen into patient view</span>
                            </div>
                            {item.note ? <p className="muted"><strong>Box note:</strong> {item.note}</p> : null}
                            {item.description ? <p className="muted"><strong>Description:</strong> {item.description}</p> : null}
                            {item.instructions ? <p className="muted"><strong>Instructions:</strong> {item.instructions}</p> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No box items in preview.</p>
                    )}
                  </div>

                  <div className="library-preview-card">
                    <h3>Box-specific patient instructions</h3>
                    {snapshotPatientInstructionGuides.length ? (
                      <div className="library-module-list compact-list-panel">
                        {snapshotPatientInstructionGuides.map((guide, index) => (
                          <div className="library-module-row" key={`${guide.id ?? guide.title ?? "guide"}-${index}`}>
                            <div className="library-module-title">{guide.title || guide.id || "Education guide"}</div>
                            {guide.summary ? <p className="muted">{guide.summary}</p> : null}
                            <div className="library-module-row-meta">
                              {guide.recommendationLabel ? <span>{guide.recommendationLabel}</span> : null}
                              {guide.id && snapshotPreview.snapshot.procedureGuideIds.includes(guide.id) ? <span>Procedure guide</span> : null}
                              {guide.id && snapshotPreview.snapshot.boxItemGuideIds.includes(guide.id) ? <span>Box item guide</span> : null}
                              {guide.videoUrl ? <span>Video included</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No box-specific guides in preview. The full library is still frozen separately if available.</p>
                    )}
                  </div>

                  <div className="library-preview-card">
                    <h3>Library, clinic notes, and videos</h3>
                    <p className="muted">
                      {snapshotGeneralLibraryGuideCount} general library article(s) are frozen for stability but are not highlighted as assigned box instructions.
                    </p>
                    <p className="muted">
                      {snapshotPreview.snapshot.videos.length
                        ? `${snapshotPreview.snapshot.videos.length} video(s) included.`
                        : "No videos included."}
                    </p>
                    {snapshotPreview.snapshot.recommendedGuideIds.length ? (
                      <div className="library-module-row-meta">
                        {snapshotPreview.snapshot.recommendedGuideIds.map((guideId) => (
                          <span key={guideId}>Recommended: {findGuideTitle(libraryPayload, guideId)}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="muted">Use Preview PatientSnapshot before finalizing this code.</p>
              )}
            </div>

            {packingList ? (
              <div className="info-card form-stack packing-list-panel" id="packing-list-panel">
                <div className="section-heading compact-section-heading print-hidden">
                  <div>
                    <p className="eyebrow">Packing checklist</p>
                    <h3>Fulfillment view from frozen snapshot</h3>
                    <p className="muted">
                      Use this checklist to prepare the physical box. It is sourced from PatientSnapshot v{packingList.snapshot.version}.
                    </p>
                  </div>
                  <div className="action-row">
                    <button className="button secondary" type="button" onClick={() => void handleCopyPackingList()}>
                      <ClipboardCheck size={16} />
                      Copy
                    </button>
                    <button className="button secondary" type="button" onClick={handlePrintPackingList}>
                      <Printer size={16} />
                      Print
                    </button>
                  </div>
                </div>

                <div className="packing-list-header">
                  <div>
                    <p className="eyebrow">Activation code</p>
                    <h2>{packingList.activationCode.code}</h2>
                    <p className="muted">
                      {formatActivationCodeStatus(packingList.activationCode.status)} · Snapshot v{packingList.snapshot.version} ({packingList.snapshot.status})
                    </p>
                  </div>
                  <span className="status-pill active">Source: frozen PatientSnapshot</span>
                </div>

                <div className="snapshot-preview-grid">
                  <div className="library-preview-card">
                    <h3>Box identity</h3>
                    <dl className="meta-list">
                      <div>
                        <dt>Clinic</dt>
                        <dd>{packingList.activationCode.clinicName || packingList.activationCode.clinicTag || "—"}</dd>
                      </div>
                      <div>
                        <dt>Clinic order</dt>
                        <dd>{packingList.clinicOrder?.orderNumber || packingList.clinicOrder?.id || packingList.activationCode.clinicOrderId || "—"}</dd>
                      </div>
                      <div>
                        <dt>Procedure</dt>
                        <dd>{packingList.snapshot.procedureName || packingList.activationCode.procedureName || "—"}</dd>
                      </div>
                      <div>
                        <dt>Product mode</dt>
                        <dd>{formatProductMode(packingList.snapshot.productMode)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="library-preview-card">
                    <h3>Assigned sources</h3>
                    <dl className="meta-list">
                      <div>
                        <dt>BoxTemplate</dt>
                        <dd>{getPackingListTemplateName(packingList)}</dd>
                      </div>
                      <div>
                        <dt>EducationBundle</dt>
                        <dd>{getPackingListBundleName(packingList)}</dd>
                      </div>
                      <div>
                        <dt>Finalized</dt>
                        <dd>{formatDateTime(packingList.activationCode.finalizedAt)}</dd>
                      </div>
                      <div>
                        <dt>Packed</dt>
                        <dd>{formatDateTime(packingList.activationCode.packedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="packing-checklist-grid">
                  <div className="library-preview-card">
                    <h3>Final box items</h3>
                    {packingList.fulfillment.boxItems.length ? (
                      <ol className="checklist-list">
                        {packingList.fulfillment.boxItems.map((item, index) => (
                          <li key={`${item.key ?? item.label ?? "item"}-${index}`}>
                            <label>
                              <input type="checkbox" />
                              <span>
                                <strong>{formatSnapshotBoxItemName(item)}</strong>
                                {item.note ? <small>Note: {item.note}</small> : null}
                                {item.instructions ? <small>Instructions: {item.instructions}</small> : null}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="muted">No box items frozen into this snapshot.</p>
                    )}
                  </div>

                  <div className="library-preview-card">
                    <h3>Box-specific patient instructions</h3>
                    {packingPatientInstructionGuides.length ? (
                      <ol className="checklist-list">
                        {packingPatientInstructionGuides.map((guide, index) => (
                          <li key={`${guide.id ?? guide.title ?? "guide"}-${index}`}>
                            <label>
                              <input type="checkbox" />
                              <span>
                                <strong>{formatSnapshotGuideTitle(guide)}</strong>
                                {guide.summary ? <small>{guide.summary}</small> : null}
                                {guide.recommendationLabel ? <small>Label: {guide.recommendationLabel}</small> : null}
                                {guide.id && packingList.fulfillment.procedureGuideIds.includes(guide.id) ? <small>Procedure guide</small> : null}
                                {guide.id && packingList.fulfillment.boxItemGuideIds.includes(guide.id) ? <small>Box item guide</small> : null}
                                {guide.videoUrl ? <small>Video included</small> : null}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="muted">No box-specific guides frozen into this snapshot.</p>
                    )}
                  </div>
                </div>

                <div className="snapshot-preview-grid">
                  <div className="library-preview-card">
                    <h3>Clinic notes</h3>
                    <p className="muted">{getPackingClinicNotes(packingList) || "No clinic notes frozen into this snapshot."}</p>
                    {getPackingItemNotes(packingList).length ? (
                      <ul className="compact-list">
                        {getPackingItemNotes(packingList).map((note, index) => (
                          <li key={`${readRecordString(note, "key") ?? "note"}-${index}`}>
                            {readRecordString(note, "label") || readRecordString(note, "key") || "Item"}: {readRecordString(note, "note") || "—"}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="library-preview-card">
                    <h3>Videos and counts</h3>
                    <dl className="meta-list">
                      <div>
                        <dt>Videos</dt>
                        <dd>{packingList.fulfillment.counts.videos}</dd>
                      </div>
                      <div>
                        <dt>Box items</dt>
                        <dd>{packingList.fulfillment.counts.boxItems}</dd>
                      </div>
                      <div>
                        <dt>Box-specific guides</dt>
                        <dd>{packingPatientInstructionGuides.length}</dd>
                      </div>
                      <div>
                        <dt>General library</dt>
                        <dd>{packingGeneralLibraryGuideCount} frozen separately</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            ) : null}

            <button className="button primary" type="submit" disabled={codeEditorSaving || selectedCodeLocked}>
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

      <details className="advanced-panel admin-collapsible" id="advanced-clinic-admin">
        <summary>Advanced clinic admin, batches, and all-code list</summary>

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
                      <div className="cell-muted">Order: {batch.clinicOrderId || "—"}</div>
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
                      <div className="cell-muted">Order: {code.clinicOrderId || "—"}</div>
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
              Hard delete is only for empty test clinics. Clinics with claimed patients or protected operational history will be blocked.
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
      </details>
    </div>
  );
}
