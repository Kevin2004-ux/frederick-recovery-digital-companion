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

export type ActivationBatch = {
  id: string;
  clinicTag: string | null;
  quantity: number;
  boxType: string | null;
  includedItems?: Array<{ key?: string; label?: string }>;
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
  recommendedGuides: RecoveryLibraryAdminGuideSummary[];
  guides: RecoveryLibraryAdminGuideSummary[];
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
  suggestions: {
    procedures: string[];
    boxItems: string[];
  };
};
