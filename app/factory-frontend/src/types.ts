export type OwnerUser = {
  id: string;
  email: string;
  role: "OWNER";
};

export type LoginSuccessResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
};

export type MfaRequiredResponse = {
  mfaRequired: true;
  mfaToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
};

export type AuthMeResponse = {
  id: string;
  email: string;
  role?: string;
};

export type RecoveryLibraryProductMode = "kit_only" | "full_platform";

export type ActivationBatch = {
  id: string;
  clinicTag: string | null;
  quantity: number;
  boxType: string | null;
  clinicOrderId?: string | null;
  includedItems?: Array<{ key?: string; label?: string }>;
  educationBundleId?: string | null;
  boxTemplateId?: string | null;
  productMode?: RecoveryLibraryProductMode;
  procedureName?: string | null;
  createdAt: string;
  createdByUserId?: string | null;
  codeCounts?: {
    total: number;
    unused: number;
    claimed: number;
    configured: number;
    quantityMismatch: boolean;
  };
};

export type CreateBatchResponse = {
  batch: ActivationBatch;
};

export type ActivationCodeEducationOverrides = {
  guideIds: string[];
  recommendedGuideIds: string[];
};

export type RecoveryLibraryBoxItem = {
  key: string | null;
  label: string;
  name: string;
  category?: string | null;
  description?: string | null;
  instructions?: string | null;
  defaultEducationModuleId?: string | null;
  imageUrl?: string | null;
  note?: string | null;
  educationGuide?: RecoveryLibraryAdminGuideSummary | null;
};

export type ClinicOrder = {
  id: string;
  clinicTag: string;
  orderNumber?: string | null;
  externalRef?: string | null;
  status: string;
  requestedBoxCount?: number | null;
  productMode: RecoveryLibraryProductMode;
  defaultEducationBundleId?: string | null;
  defaultBoxTemplateId?: string | null;
  defaultProcedureName?: string | null;
  requestedByName?: string | null;
  requestedByEmail?: string | null;
  notes?: string | null;
  archivedAt?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  batchCount: number;
};

export type ClinicOrdersResponse = {
  orders: ClinicOrder[];
};

export type ClinicOrderResponse = {
  order: ClinicOrder;
};

export type ActivationCodeDetail = {
  id: string;
  code: string;
  status: string;
  clinicTag?: string | null;
  batchId?: string | null;
  clinicOrderId?: string | null;
  boxType?: string | null;
  educationBundleId?: string | null;
  boxTemplateId?: string | null;
  productMode: RecoveryLibraryProductMode;
  procedureName?: string | null;
  effectiveEducationBundleId?: string | null;
  effectiveBoxTemplateId?: string | null;
  effectiveProductMode?: RecoveryLibraryProductMode;
  effectiveProcedureName?: string | null;
  batchDefaults?: {
    educationBundleId?: string | null;
    boxTemplateId?: string | null;
    clinicOrderId?: string | null;
    productMode?: RecoveryLibraryProductMode;
    procedureName?: string | null;
  } | null;
  assignedBoxItems: RecoveryLibraryBoxItem[];
  removedBoxItemKeys?: string[];
  inheritedBoxItems?: RecoveryLibraryBoxItem[];
  resolvedBoxItems?: RecoveryLibraryBoxItem[];
  assignedEducation: ActivationCodeEducationOverrides;
  currentSnapshot?: {
    id: string;
    version: number;
    productMode: RecoveryLibraryProductMode;
    createdAt: string;
  } | null;
  createdAt?: string;
  claimedAt?: string | null;
  claimedByUserId?: string | null;
};

export type ActivationCodeDetailResponse = {
  activationCode: ActivationCodeDetail;
};

export type Tier1SnapshotPreview = {
  activationCode: {
    id: string;
    code: string;
    status: string;
    clinicTag?: string | null;
    productMode: RecoveryLibraryProductMode;
    batchId?: string | null;
    clinicOrderId?: string | null;
    claimedAt?: string | null;
    claimedByUserId?: string | null;
  };
  snapshot: {
    productMode: RecoveryLibraryProductMode;
    clinicTag?: string | null;
    procedureName?: string | null;
    educationBundleId?: string | null;
    boxTemplateId?: string | null;
    boxItems: Array<{
      key?: string | null;
      label?: string | null;
      name?: string | null;
      note?: string | null;
      instructions?: string | null;
      description?: string | null;
    }>;
    guides: Array<{
      id?: string;
      title?: string;
      summary?: string;
      moduleType?: string;
      videoUrl?: string | null;
      recommendationLabel?: string | null;
      recommendationOrder?: number | null;
    }>;
    assignedGuideIds: string[];
    recommendedGuideIds: string[];
    procedureGuideIds: string[];
    boxItemGuideIds: string[];
    clinicNotes?: unknown;
    videos: Array<{
      id?: string;
      title?: string;
      videoUrl?: string | null;
      thumbnailUrl?: string | null;
    }>;
    sourceMetadata?: unknown;
  };
  counts: {
    boxItems: number;
    guides: number;
    assignedGuides: number;
    procedureGuides: number;
    boxItemGuides: number;
    videos: number;
  };
};

export type Tier1SnapshotValidationIssue = {
  code: string;
  message: string;
};

export type Tier1SnapshotValidationResponse = {
  valid: boolean;
  issues: Tier1SnapshotValidationIssue[];
  preview: Tier1SnapshotPreview | null;
};

export type Tier1FinalizeResponse = {
  activationCode: {
    id: string;
    code: string;
    status: string;
    clinicTag?: string | null;
    productMode: RecoveryLibraryProductMode;
    finalizedAt?: string | null;
    packedAt?: string | null;
  };
  snapshot: {
    id: string;
    version: number;
    isCurrent: boolean;
    productMode: RecoveryLibraryProductMode;
    clinicTag?: string | null;
    procedureName?: string | null;
    educationBundleId?: string | null;
    boxTemplateId?: string | null;
    createdAt: string;
  };
};

export type Tier1PackingListResponse = {
  source: "patient_snapshot";
  activationCode: {
    id: string;
    code: string;
    status: string;
    clinicTag?: string | null;
    clinicName?: string | null;
    batchId?: string | null;
    clinicOrderId?: string | null;
    productMode: RecoveryLibraryProductMode;
    procedureName?: string | null;
    educationBundleId?: string | null;
    boxTemplateId?: string | null;
    finalizedAt?: string | null;
    packedAt?: string | null;
    claimedAt?: string | null;
    claimedByUserId?: string | null;
    createdAt?: string;
  };
  clinicOrder?: {
    id: string;
    orderNumber?: string | null;
    externalRef?: string | null;
    status: string;
    requestedBoxCount?: number | null;
    createdAt: string;
  } | null;
  batch?: {
    id: string;
    boxType?: string | null;
    clinicOrderId?: string | null;
    educationBundleId?: string | null;
    boxTemplateId?: string | null;
    productMode?: RecoveryLibraryProductMode | string;
    procedureName?: string | null;
    createdAt: string;
  } | null;
  snapshot: {
    id: string;
    version: number;
    isCurrent: boolean;
    status: string;
    productMode: RecoveryLibraryProductMode;
    clinicTag?: string | null;
    procedureName?: string | null;
    educationBundleId?: string | null;
    boxTemplateId?: string | null;
    createdAt: string;
  };
  fulfillment: {
    boxItems: Tier1SnapshotPreview["snapshot"]["boxItems"];
    guides: Tier1SnapshotPreview["snapshot"]["guides"];
    assignedGuideIds: string[];
    recommendedGuideIds: string[];
    procedureGuideIds: string[];
    boxItemGuideIds: string[];
    clinicNotes?: unknown;
    videos: Tier1SnapshotPreview["snapshot"]["videos"];
    sourceMetadata?: unknown;
    counts: Tier1SnapshotPreview["counts"];
  };
};

export type RecoveryLibraryCategoryKey =
  | "start-here"
  | "common-recovery-topics"
  | "procedure-guides"
  | "box-item-instructions"
  | "videos"
  | "clinic-instructions";

export type RecoveryLibraryAdminModule = {
  id: string;
  type: "education" | "task" | "milestone";
  title: string;
  text: string;
  summary: string;
  paragraphs: string[];
  keyPoints: string[];
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  frequency?: string | null;
  redFlags: string[];
  requiredBoxItems: string[];
  categories: RecoveryLibraryCategoryKey[];
  procedureNames: string[];
  boxItemKeys: string[];
  recommended: boolean;
  featured: boolean;
  recommendationLabel?: string | null;
  recommendationOrder?: number | null;
  active: boolean;
  displayOrder: number;
  source: "content_library" | "custom";
  isCustomized: boolean;
};

export type RecoveryLibraryAdminGuideSummary = Pick<
  RecoveryLibraryAdminModule,
  | "id"
  | "type"
  | "title"
  | "summary"
  | "videoUrl"
  | "thumbnailUrl"
  | "categories"
  | "procedureNames"
  | "boxItemKeys"
  | "recommended"
  | "featured"
  | "recommendationLabel"
  | "recommendationOrder"
  | "displayOrder"
  | "requiredBoxItems"
  | "frequency"
>;

export type EducationBundleModuleAssignment = {
  moduleId: string;
  recommended: boolean;
  featured: boolean;
  recommendationLabel?: string | null;
  recommendationOrder?: number | null;
  displayOrder: number;
};

export type EducationBundle = {
  id: string;
  name: string;
  slug: string;
  description: string;
  clinicTag?: string | null;
  procedureName?: string | null;
  active: boolean;
  displayOrder: number;
  moduleCount: number;
  modules: EducationBundleModuleAssignment[];
  createdAt: string;
  updatedAt: string;
};

export type EducationBundlePreviewPayload = {
  bundle: EducationBundle;
  recommendedGuides: RecoveryLibraryAdminGuideSummary[];
  guides: RecoveryLibraryAdminGuideSummary[];
};

export type BoxTemplateModuleAssignment = {
  moduleId: string;
  recommended: boolean;
  recommendationLabel?: string | null;
  recommendationOrder?: number | null;
};

export type BoxTemplate = {
  id: string;
  name: string;
  slug: string;
  description: string;
  boxItemKeys: string[];
  active: boolean;
  displayOrder: number;
  moduleCount: number;
  modules: BoxTemplateModuleAssignment[];
  createdAt: string;
  updatedAt: string;
};

export type BoxTemplatePreviewPayload = {
  boxTemplate: BoxTemplate;
  boxItems: RecoveryLibraryBoxItem[];
  recommendedGuides: RecoveryLibraryAdminGuideSummary[];
  guides: RecoveryLibraryAdminGuideSummary[];
};

export type BoxItemCatalogItem = {
  id: string;
  key: string;
  name: string;
  category?: string | null;
  description?: string | null;
  instructions?: string | null;
  defaultEducationModuleId?: string | null;
  imageUrl?: string | null;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type RecoveryLibraryAdminPayload = {
  categories: Array<{
    key: RecoveryLibraryCategoryKey;
    title: string;
    description: string;
  }>;
  modules: RecoveryLibraryAdminModule[];
  bundles: EducationBundle[];
  boxTemplates: BoxTemplate[];
  boxItems: BoxItemCatalogItem[];
  suggestions: {
    procedures: string[];
    boxItems: string[];
  };
};
