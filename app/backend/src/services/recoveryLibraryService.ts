import {
  ActivationCodeStatus,
  Prisma,
  type BoxTemplate as BoxTemplateRow,
  type BoxTemplateEducationModule as BoxTemplateEducationModuleRow,
  type EducationBundle as EducationBundleRow,
  type EducationBundleModule as EducationBundleModuleRow,
  type RecoveryLibraryModule as RecoveryLibraryModuleRow,
} from "@prisma/client";

import { prisma } from "../db/prisma.js";
import {
  ITEM_EDUCATION_MODULE_IDS,
  ITEM_KEY_ALIASES,
  listKnownBoxItemKeys,
  normalizeIncludedItems,
} from "./boxEducation.js";
import {
  CONTENT_LIBRARY,
  type ModuleDefinition,
} from "./plan/contentLibrary.js";

export const LIBRARY_CATEGORY_KEYS = [
  "start-here",
  "common-recovery-topics",
  "procedure-guides",
  "box-item-instructions",
  "videos",
  "clinic-instructions",
] as const;

export type LibraryCategoryKey = (typeof LIBRARY_CATEGORY_KEYS)[number];

export type LibraryModuleType = Extract<
  ModuleDefinition["type"],
  "education" | "task" | "milestone"
>;

export type RecoveryLibraryCategory = {
  key: LibraryCategoryKey;
  title: string;
  description: string;
};

export type RecoveryLibraryModule = Omit<ModuleDefinition, "type"> & {
  type: LibraryModuleType;
  categories: LibraryCategoryKey[];
  procedureNames: string[];
  boxItemKeys: string[];
  recommended: boolean;
  featured: boolean;
  recommendationLabel: string | null;
  recommendationOrder: number | null;
  active: boolean;
  displayOrder: number;
  source: "content_library" | "custom";
  isCustomized: boolean;
  summary: string;
  paragraphs: string[];
  keyPoints: string[];
};

export type RecoveryLibraryModuleSummary = Pick<
  RecoveryLibraryModule,
  | "id"
  | "title"
  | "type"
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

export const RECOVERY_LIBRARY_PRODUCT_MODES = [
  "kit_only",
  "full_platform",
] as const;

export type RecoveryLibraryProductMode =
  (typeof RECOVERY_LIBRARY_PRODUCT_MODES)[number];

export type RecoveryLibraryAssignmentSummary = {
  activationCode: string | null;
  productMode: RecoveryLibraryProductMode;
  educationBundle: {
    id: string;
    name: string;
    slug: string;
    procedureName: string | null;
  } | null;
  boxTemplate: {
    id: string;
    name: string;
    slug: string;
  } | null;
  hasCodeEducationOverrides: boolean;
  hasCodeBoxItemOverrides: boolean;
};

export type RecoveryLibraryHomePayload = {
  recommendedGuides: RecoveryLibraryModuleSummary[];
  categories: Array<
    RecoveryLibraryCategory & {
      moduleCount: number;
      featuredGuides: RecoveryLibraryModuleSummary[];
    }
  >;
  sections: Record<LibraryCategoryKey, RecoveryLibraryModuleSummary[]>;
  personalized: {
    productMode: RecoveryLibraryProductMode;
    assignment: RecoveryLibraryAssignmentSummary | null;
    procedureName: string | null;
    boxItems: Array<{ key: string | null; label: string }>;
    procedureGuides: RecoveryLibraryModuleSummary[];
    boxItemGuides: RecoveryLibraryModuleSummary[];
  };
};

export type RecoveryLibraryCategoryPayload = {
  category: RecoveryLibraryCategory;
  guides: RecoveryLibraryModuleSummary[];
};

export type RecoveryLibraryGuidePayload = {
  guide: RecoveryLibraryModule;
  relatedGuides: RecoveryLibraryModuleSummary[];
};

export type EducationBundleModuleAssignment = {
  moduleId: string;
  recommended: boolean;
  featured: boolean;
  recommendationLabel: string | null;
  recommendationOrder: number | null;
  displayOrder: number;
};

export type EducationBundle = {
  id: string;
  name: string;
  slug: string;
  description: string;
  clinicTag: string | null;
  procedureName: string | null;
  active: boolean;
  displayOrder: number;
  moduleCount: number;
  modules: EducationBundleModuleAssignment[];
  createdAt: string;
  updatedAt: string;
};

export type EducationBundlePreviewPayload = {
  bundle: EducationBundle;
  recommendedGuides: RecoveryLibraryModuleSummary[];
  guides: RecoveryLibraryModuleSummary[];
};

export type BoxTemplateModuleAssignment = {
  moduleId: string;
  recommended: boolean;
  recommendationLabel: string | null;
  recommendationOrder: number | null;
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
  recommendedGuides: RecoveryLibraryModuleSummary[];
  guides: RecoveryLibraryModuleSummary[];
};

export type RecoveryLibraryAdminPayload = {
  categories: RecoveryLibraryCategory[];
  modules: RecoveryLibraryModule[];
  bundles: EducationBundle[];
  boxTemplates: BoxTemplate[];
  suggestions: {
    procedures: string[];
    boxItems: string[];
  };
};

type LibraryModuleUpsertInput = {
  title: string;
  summary?: string | null;
  body: string;
  moduleType: LibraryModuleType;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  categories?: LibraryCategoryKey[];
  procedureNames?: string[];
  boxItemKeys?: string[];
  redFlags?: string[];
  requiredBoxItems?: string[];
  recommended?: boolean;
  featured?: boolean;
  recommendationLabel?: string | null;
  recommendationOrder?: number | null;
  active?: boolean;
  displayOrder?: number;
};

type EducationBundleModuleAssignmentInput = {
  moduleId: string;
  recommended?: boolean;
  featured?: boolean;
  recommendationLabel?: string | null;
  recommendationOrder?: number | null;
  displayOrder?: number;
};

type EducationBundleUpsertInput = {
  name: string;
  description?: string | null;
  clinicTag?: string | null;
  procedureName?: string | null;
  active?: boolean;
  displayOrder?: number;
  modules?: EducationBundleModuleAssignmentInput[];
};

type BoxTemplateModuleAssignmentInput = {
  moduleId: string;
  recommended?: boolean;
  recommendationLabel?: string | null;
  recommendationOrder?: number | null;
};

type BoxTemplateUpsertInput = {
  name: string;
  description?: string | null;
  boxItemKeys?: string[];
  active?: boolean;
  displayOrder?: number;
  modules?: BoxTemplateModuleAssignmentInput[];
};

type AssignedEducationOverrides = {
  guideIds: string[];
  recommendedGuideIds: string[];
};

type PatientLibraryContext = {
  activationCode: string | null;
  productMode: RecoveryLibraryProductMode;
  procedureName: string | null;
  boxItems: Array<{ key: string | null; label: string }>;
  educationBundle: EducationBundle | null;
  boxTemplate: BoxTemplate | null;
  assignedEducation: AssignedEducationOverrides;
  hasCodeBoxItemOverrides: boolean;
};

type StaticLibraryMetadata = {
  categories?: LibraryCategoryKey[];
  procedureNames?: string[];
  boxItemKeys?: string[];
  displayOrder?: number;
  thumbnailUrl?: string | null;
  recommended?: boolean;
  featured?: boolean;
  recommendationLabel?: string | null;
  recommendationOrder?: number | null;
};

type EducationBundleWithModulesRow = Prisma.EducationBundleGetPayload<{
  include: {
    modules: true;
  };
}>;

type BoxTemplateWithModulesRow = Prisma.BoxTemplateGetPayload<{
  include: {
    modules: true;
  };
}>;

const LIBRARY_MODULE_TYPES: LibraryModuleType[] = [
  "education",
  "task",
  "milestone",
];

const CATEGORY_DEFINITIONS: RecoveryLibraryCategory[] = [
  {
    key: "start-here",
    title: "Start Here",
    description: "Calm first-step guides for the early days after surgery.",
  },
  {
    key: "common-recovery-topics",
    title: "Common Recovery Topics",
    description: "Everyday post-op questions explained in simple language.",
  },
  {
    key: "procedure-guides",
    title: "Procedure Guides",
    description: "Procedure-specific instructions that can be reused across tiers.",
  },
  {
    key: "box-item-instructions",
    title: "Box Item Instructions",
    description: "Quick how-to guides tied to recovery kit supplies.",
  },
  {
    key: "videos",
    title: "Videos",
    description: "Visual walkthroughs and watch-first recovery education.",
  },
  {
    key: "clinic-instructions",
    title: "Clinic Instructions",
    description: "Frederick Recovery custom guidance and follow-up reminders.",
  },
];

const CATEGORY_SET = new Set<LibraryCategoryKey>(LIBRARY_CATEGORY_KEYS);
const CONTENT_LIBRARY_IDS = new Set(Object.keys(CONTENT_LIBRARY));

const DEFAULT_LIBRARY_METADATA: Record<string, StaticLibraryMetadata> = {
  education_recovery_kit_overview: {
    categories: ["start-here"],
    displayOrder: 10,
  },
  milestone_follow_up_prep: {
    categories: ["start-here", "clinic-instructions"],
    displayOrder: 20,
  },
  education_wound_care_basic: {
    categories: ["start-here", "common-recovery-topics"],
    displayOrder: 30,
  },
  task_check_incision: {
    categories: ["start-here", "common-recovery-topics"],
    displayOrder: 40,
  },
  education_elevation: {
    categories: ["start-here", "common-recovery-topics"],
    displayOrder: 50,
  },
  education_mobility_gentle: {
    categories: ["start-here", "common-recovery-topics"],
    displayOrder: 60,
  },
  education_wound_care_sutures: {
    categories: ["common-recovery-topics", "clinic-instructions"],
    displayOrder: 110,
  },
  task_gauze_change: {
    categories: ["common-recovery-topics"],
    boxItemKeys: ["gauze", "tape", "wipes", "gloves"],
    displayOrder: 120,
  },
  task_scar_care: {
    categories: ["common-recovery-topics"],
    boxItemKeys: ["scar_gel"],
    displayOrder: 130,
  },
  education_ice_knee: {
    categories: ["common-recovery-topics"],
    boxItemKeys: ["icepack"],
    displayOrder: 140,
  },
  education_mobility_crutches: {
    categories: ["common-recovery-topics"],
    displayOrder: 150,
  },
  education_mobility_walking: {
    categories: ["common-recovery-topics"],
    displayOrder: 160,
  },
  dvt_prevention_task: {
    categories: ["common-recovery-topics"],
    boxItemKeys: ["compression_socks"],
    displayOrder: 170,
  },
  milestone_suture_removal: {
    categories: ["clinic-instructions"],
    displayOrder: 180,
  },
  milestone_driving: {
    categories: ["clinic-instructions"],
    displayOrder: 190,
  },
  hip_replacement_precautions: {
    procedureNames: ["hip replacement"],
    displayOrder: 210,
  },
  hip_replacement_milestone: {
    procedureNames: ["hip replacement"],
    displayOrder: 220,
  },
  knee_replacement_task: {
    procedureNames: ["knee replacement"],
    boxItemKeys: ["compression_socks"],
    displayOrder: 230,
  },
  spine_surgery_education: {
    procedureNames: ["spine surgery"],
    displayOrder: 240,
  },
  shoulder_surgery_task: {
    procedureNames: ["shoulder surgery"],
    displayOrder: 250,
  },
  cast_care_education: {
    categories: ["common-recovery-topics"],
    displayOrder: 260,
  },
  appendectomy_education: {
    procedureNames: ["appendectomy"],
    displayOrder: 270,
  },
  hernia_repair_task: {
    procedureNames: ["hernia repair"],
    displayOrder: 280,
  },
  gallbladder_removal_education: {
    procedureNames: ["gallbladder removal"],
    displayOrder: 290,
  },
  hysterectomy_milestone: {
    procedureNames: ["hysterectomy"],
    displayOrder: 300,
  },
  prostatectomy_task: {
    procedureNames: ["prostatectomy"],
    displayOrder: 310,
  },
  c_section_education: {
    procedureNames: ["c-section"],
    displayOrder: 320,
  },
  kidney_stones_education: {
    procedureNames: ["kidney stone procedure"],
    displayOrder: 330,
  },
  pneumonia_education: {
    categories: ["common-recovery-topics"],
    displayOrder: 340,
  },
  sepsis_recovery_education: {
    categories: ["common-recovery-topics"],
    displayOrder: 350,
  },
  cataract_recovery_education: {
    procedureNames: ["cataract surgery"],
    boxItemKeys: ["tape"],
    displayOrder: 360,
  },
  gout_flare_education: {
    categories: ["common-recovery-topics"],
    displayOrder: 370,
  },
};

function isLibraryModuleType(value: string): value is LibraryModuleType {
  return LIBRARY_MODULE_TYPES.includes(value as LibraryModuleType);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProductMode(value: string | null | undefined): RecoveryLibraryProductMode {
  return value === "kit_only" ? "kit_only" : "full_platform";
}

function normalizeBody(value: string): string {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitParagraphs(value: string): string[] {
  const normalized = normalizeBody(value);
  if (!normalized) return [];

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function sentenceParts(value: string): string[] {
  return normalizeBody(value)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function deriveSummary(text: string, title: string): string {
  const firstSentence = sentenceParts(text)[0] ?? text.trim();
  if (firstSentence) return firstSentence;
  return title.trim();
}

function extractKeyPoints(text: string, summary: string): string[] {
  const points = Array.from(
    new Set(
      sentenceParts(text)
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => part !== summary)
    )
  );

  return points.slice(0, 4);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim() ?? "")
        .filter(Boolean)
    )
  );
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeBoxItemKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return ITEM_KEY_ALIASES[normalized] ?? normalized;
}

function normalizeBoxItemKeys(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (value ? normalizeBoxItemKey(value) : ""))
        .filter(Boolean)
    )
  );
}

function boxItemLabelFromKey(key: string): string {
  const normalized = key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return key;

  return normalized.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function boxItemKeysToItems(keys: string[]): Array<{ key: string | null; label: string }> {
  return normalizeBoxItemKeys(keys).map((key) => ({
    key,
    label: boxItemLabelFromKey(key),
  }));
}

function mergeBoxItems(
  ...groups: Array<Array<{ key: string | null; label: string }>>
): Array<{ key: string | null; label: string }> {
  const byKey = new Map<string, { key: string | null; label: string }>();

  for (const group of groups) {
    for (const item of group) {
      const label = item.label.trim();
      if (!label) continue;

      const normalizedKey = item.key ? normalizeBoxItemKey(item.key) : null;
      const dedupeKey = normalizedKey ?? normalizeBoxItemKey(label);
      if (!dedupeKey || byKey.has(dedupeKey)) continue;

      byKey.set(dedupeKey, {
        key: normalizedKey,
        label,
      });
    }
  }

  return Array.from(byKey.values());
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return uniqueStrings(
    value.map((entry) => (typeof entry === "string" ? entry : null))
  );
}

function parseAssignedEducationOverrides(
  value: Prisma.JsonValue | null | undefined
): AssignedEducationOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { guideIds: [], recommendedGuideIds: [] };
  }

  const record = value as Record<string, unknown>;

  return {
    guideIds: uniqueStrings([
      ...readStringList(record.guideIds),
      ...readStringList(record.selectedGuideIds),
      ...readStringList(record.moduleIds),
    ]),
    recommendedGuideIds: readStringList(record.recommendedGuideIds),
  };
}

function emptyPatientLibraryContext(): PatientLibraryContext {
  return {
    activationCode: null,
    productMode: "full_platform",
    procedureName: null,
    boxItems: [],
    educationBundle: null,
    boxTemplate: null,
    assignedEducation: {
      guideIds: [],
      recommendedGuideIds: [],
    },
    hasCodeBoxItemOverrides: false,
  };
}

function normalizeCategories(
  categories: Array<string | null | undefined>
): LibraryCategoryKey[] {
  return Array.from(
    new Set(
      categories.filter((category): category is LibraryCategoryKey =>
        Boolean(category && CATEGORY_SET.has(category as LibraryCategoryKey))
      )
    )
  );
}

function withDerivedCategories(args: {
  categories: LibraryCategoryKey[];
  procedureNames: string[];
  boxItemKeys: string[];
  videoUrl: string | null;
}): LibraryCategoryKey[] {
  const next = new Set<LibraryCategoryKey>(args.categories);

  if (args.procedureNames.length > 0) {
    next.add("procedure-guides");
  }

  if (args.boxItemKeys.length > 0) {
    next.add("box-item-instructions");
  }

  if (args.videoUrl) {
    next.add("videos");
  }

  if (next.size === 0) {
    next.add("common-recovery-topics");
  }

  return LIBRARY_CATEGORY_KEYS.filter((key) => next.has(key));
}

function defaultBoxAssignmentsForModule(moduleId: string): string[] {
  const keys = Object.entries(ITEM_EDUCATION_MODULE_IDS)
    .filter(([, moduleIds]) => moduleIds.includes(moduleId))
    .map(([boxItemKey]) => boxItemKey);

  return normalizeBoxItemKeys(keys);
}

function buildModuleFromStatic(args: {
  moduleId: string;
  moduleDef: ModuleDefinition;
  row: RecoveryLibraryModuleRow | null;
  index: number;
}): RecoveryLibraryModule {
  const { moduleId, moduleDef, row, index } = args;
  const metadata = DEFAULT_LIBRARY_METADATA[moduleId] ?? {};
  const title = (row?.title ?? moduleDef.title).trim();
  const text = normalizeBody(row?.body ?? moduleDef.text);
  const summary = normalizeBody(row?.summary ?? "") || deriveSummary(text, title);
  const procedureNames = uniqueStrings(
    row ? row.procedureNames : (metadata.procedureNames ?? [])
  );
  const boxItemKeys = normalizeBoxItemKeys(
    row ? row.boxItemKeys : [...(metadata.boxItemKeys ?? []), ...defaultBoxAssignmentsForModule(moduleId)]
  );
  const categories = withDerivedCategories({
    categories: normalizeCategories(row ? row.categories : metadata.categories ?? []),
    procedureNames,
    boxItemKeys,
    videoUrl: row?.videoUrl ?? moduleDef.videoUrl ?? null,
  });
  const requiredBoxItems = normalizeBoxItemKeys(
    row ? row.requiredBoxItems : moduleDef.requiredBoxItems ?? []
  );
  const redFlags = uniqueStrings(row ? row.redFlags : moduleDef.redFlags ?? []);
  const recommended = row?.recommended ?? metadata.recommended ?? false;
  const featured = row?.featured ?? metadata.featured ?? false;
  const recommendationLabel = normalizeOptionalText(
    row?.recommendationLabel ?? metadata.recommendationLabel ?? null
  );
  const recommendationOrder =
    row?.recommendationOrder ?? metadata.recommendationOrder ?? null;

  return {
    id: moduleId,
    type: moduleDef.type as LibraryModuleType,
    title,
    text,
    summary,
    paragraphs: splitParagraphs(text),
    keyPoints: extractKeyPoints(text, summary),
    videoUrl: row?.videoUrl ?? moduleDef.videoUrl ?? null,
    thumbnailUrl: row?.thumbnailUrl ?? metadata.thumbnailUrl ?? moduleDef.thumbnailUrl ?? null,
    frequency: moduleDef.frequency,
    redFlags,
    requiredBoxItems,
    categories,
    procedureNames,
    boxItemKeys,
    recommended,
    featured,
    recommendationLabel,
    recommendationOrder,
    active: row?.active ?? true,
    displayOrder:
      row?.displayOrder ??
      metadata.displayOrder ??
      1000 + index * 10,
    source: "content_library",
    isCustomized: Boolean(row),
  };
}

function buildModuleFromRow(row: RecoveryLibraryModuleRow): RecoveryLibraryModule {
  const title = row.title.trim();
  const text = normalizeBody(row.body);
  const summary = normalizeBody(row.summary) || deriveSummary(text, title);
  const procedureNames = uniqueStrings(row.procedureNames);
  const boxItemKeys = normalizeBoxItemKeys(row.boxItemKeys);
  const categories = withDerivedCategories({
    categories: normalizeCategories(row.categories),
    procedureNames,
    boxItemKeys,
    videoUrl: row.videoUrl ?? null,
  });
  const moduleType = isLibraryModuleType(row.moduleType)
    ? row.moduleType
    : "education";

  return {
    id: row.id,
    type: moduleType,
    title,
    text,
    summary,
    paragraphs: splitParagraphs(text),
    keyPoints: extractKeyPoints(text, summary),
    videoUrl: row.videoUrl ?? null,
    thumbnailUrl: row.thumbnailUrl ?? null,
    frequency: undefined,
    redFlags: uniqueStrings(row.redFlags),
    requiredBoxItems: normalizeBoxItemKeys(row.requiredBoxItems),
    categories,
    procedureNames,
    boxItemKeys,
    recommended: row.recommended,
    featured: row.featured,
    recommendationLabel: normalizeOptionalText(row.recommendationLabel),
    recommendationOrder: row.recommendationOrder ?? null,
    active: row.active,
    displayOrder: row.displayOrder,
    source: "custom",
    isCustomized: true,
  };
}

function compareModules(a: RecoveryLibraryModule, b: RecoveryLibraryModule): number {
  if (a.displayOrder !== b.displayOrder) {
    return a.displayOrder - b.displayOrder;
  }

  return a.title.localeCompare(b.title);
}

function isRecommendedModule(module: RecoveryLibraryModule): boolean {
  return module.recommended || module.featured;
}

function compareRecommendedModules(
  a: RecoveryLibraryModule,
  b: RecoveryLibraryModule
): number {
  const aOrder = a.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.recommendationOrder ?? Number.MAX_SAFE_INTEGER;

  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  if (a.displayOrder !== b.displayOrder) {
    return a.displayOrder - b.displayOrder;
  }

  return a.title.localeCompare(b.title);
}

function compareRecommendedSummaries(
  a: RecoveryLibraryModuleSummary,
  b: RecoveryLibraryModuleSummary
): number {
  const aOrder = a.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.recommendationOrder ?? Number.MAX_SAFE_INTEGER;

  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  if (a.displayOrder !== b.displayOrder) {
    return a.displayOrder - b.displayOrder;
  }

  return a.title.localeCompare(b.title);
}

function compareGuideSummaries(
  a: RecoveryLibraryModuleSummary,
  b: RecoveryLibraryModuleSummary
): number {
  if (a.displayOrder !== b.displayOrder) {
    return a.displayOrder - b.displayOrder;
  }

  return a.title.localeCompare(b.title);
}

function toSummary(module: RecoveryLibraryModule): RecoveryLibraryModuleSummary {
  return {
    id: module.id,
    title: module.title,
    type: module.type,
    summary: module.summary,
    videoUrl: module.videoUrl ?? null,
    thumbnailUrl: module.thumbnailUrl ?? null,
    categories: module.categories,
    procedureNames: module.procedureNames,
    boxItemKeys: module.boxItemKeys,
    recommended: module.recommended,
    featured: module.featured,
    recommendationLabel: module.recommendationLabel,
    recommendationOrder: module.recommendationOrder,
    displayOrder: module.displayOrder,
    requiredBoxItems: module.requiredBoxItems,
    frequency: module.frequency,
  };
}

function toBundleGuideSummary(
  module: RecoveryLibraryModule,
  assignment: EducationBundleModuleAssignment
): RecoveryLibraryModuleSummary {
  const summary = toSummary(module);

  return {
    ...summary,
    recommended: assignment.recommended,
    featured: assignment.featured,
    recommendationLabel: assignment.recommendationLabel,
    recommendationOrder: assignment.recommendationOrder,
    displayOrder: assignment.displayOrder,
  };
}

function toBoxTemplateGuideSummary(
  module: RecoveryLibraryModule,
  assignment: BoxTemplateModuleAssignment
): RecoveryLibraryModuleSummary {
  const summary = toSummary(module);

  return {
    ...summary,
    recommended: assignment.recommended,
    featured: false,
    recommendationLabel: assignment.recommendationLabel,
    recommendationOrder: assignment.recommendationOrder,
  };
}

function toCodeAssignedGuideSummary(
  module: RecoveryLibraryModule,
  args: {
    recommended: boolean;
    order: number;
  }
): RecoveryLibraryModuleSummary {
  return {
    ...toSummary(module),
    recommended: args.recommended,
    featured: false,
    recommendationLabel: args.recommended ? "Assigned to you" : "Selected for you",
    recommendationOrder: args.order,
    displayOrder: args.order,
  };
}

function appendUniqueGuides(
  target: RecoveryLibraryModuleSummary[],
  guides: RecoveryLibraryModuleSummary[]
) {
  const existingIds = new Set(target.map((guide) => guide.id));

  for (const guide of guides) {
    if (existingIds.has(guide.id)) continue;
    target.push(guide);
    existingIds.add(guide.id);
  }
}

function matchesProcedure(module: RecoveryLibraryModule, procedureName: string | null): boolean {
  if (!procedureName) return false;

  const normalizedProcedure = normalizeText(procedureName);
  if (!normalizedProcedure) return false;

  return module.procedureNames.some((assigned) => {
    const normalizedAssigned = normalizeText(assigned);
    return (
      normalizedProcedure === normalizedAssigned ||
      normalizedProcedure.includes(normalizedAssigned) ||
      normalizedAssigned.includes(normalizedProcedure)
    );
  });
}

function matchesBoxItems(
  module: RecoveryLibraryModule,
  boxItems: Array<{ key: string | null; label: string }>
): boolean {
  if (module.boxItemKeys.length === 0 || boxItems.length === 0) {
    return false;
  }

  const keys = new Set(
    boxItems
      .map((item) => (item.key ? normalizeBoxItemKey(item.key) : null))
      .filter((value): value is string => Boolean(value))
  );

  return module.boxItemKeys.some((key) => keys.has(key));
}

async function readModuleRows(): Promise<RecoveryLibraryModuleRow[]> {
  try {
    return await prisma.recoveryLibraryModule.findMany({
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
    });
  } catch (error) {
    console.warn(
      "[recovery-library] Falling back to static content library modules:",
      error
    );
    return [];
  }
}

function mapEducationBundleModuleAssignment(
  row: EducationBundleModuleRow
): EducationBundleModuleAssignment {
  return {
    moduleId: row.moduleId,
    recommended: row.recommended,
    featured: row.featured,
    recommendationLabel: normalizeOptionalText(row.recommendationLabel),
    recommendationOrder: row.recommendationOrder ?? null,
    displayOrder: row.displayOrder,
  };
}

function compareEducationBundleAssignments(
  a: EducationBundleModuleAssignment,
  b: EducationBundleModuleAssignment
): number {
  if (a.displayOrder !== b.displayOrder) {
    return a.displayOrder - b.displayOrder;
  }

  const aOrder = a.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  return a.moduleId.localeCompare(b.moduleId);
}

function mapEducationBundle(row: EducationBundleWithModulesRow): EducationBundle {
  const modules = row.modules
    .map(mapEducationBundleModuleAssignment)
    .sort(compareEducationBundleAssignments);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    clinicTag: row.clinicTag ?? null,
    procedureName: row.procedureName ?? null,
    active: row.active,
    displayOrder: row.displayOrder,
    moduleCount: modules.length,
    modules,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapBoxTemplateModuleAssignment(
  row: BoxTemplateEducationModuleRow
): BoxTemplateModuleAssignment {
  return {
    moduleId: row.moduleId,
    recommended: row.recommended,
    recommendationLabel: normalizeOptionalText(row.recommendationLabel),
    recommendationOrder: row.recommendationOrder ?? null,
  };
}

function compareBoxTemplateAssignments(
  a: BoxTemplateModuleAssignment,
  b: BoxTemplateModuleAssignment
): number {
  const aOrder = a.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  return a.moduleId.localeCompare(b.moduleId);
}

function mapBoxTemplate(row: BoxTemplateWithModulesRow): BoxTemplate {
  const modules = row.modules
    .map(mapBoxTemplateModuleAssignment)
    .sort(compareBoxTemplateAssignments);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    boxItemKeys: normalizeBoxItemKeys(row.boxItemKeys),
    active: row.active,
    displayOrder: row.displayOrder,
    moduleCount: modules.length,
    modules,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function readEducationBundleRows(): Promise<EducationBundleWithModulesRow[]> {
  try {
    return await prisma.educationBundle.findMany({
      include: {
        modules: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
  } catch (error) {
    console.warn(
      "[recovery-library] Falling back to empty education bundles:",
      error
    );
    return [];
  }
}

async function readBoxTemplateRows(): Promise<BoxTemplateWithModulesRow[]> {
  try {
    return await prisma.boxTemplate.findMany({
      include: {
        modules: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
  } catch (error) {
    console.warn(
      "[recovery-library] Falling back to empty box templates:",
      error
    );
    return [];
  }
}

export async function listLibraryModules(args?: {
  includeInactive?: boolean;
}): Promise<RecoveryLibraryModule[]> {
  const rows = await readModuleRows();
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const staticModules = Object.entries(CONTENT_LIBRARY)
    .filter(([, moduleDef]) => isLibraryModuleType(moduleDef.type))
    .map(([moduleId, moduleDef], index) =>
      buildModuleFromStatic({
        moduleId,
        moduleDef,
        row: rowsById.get(moduleId) ?? null,
        index,
      })
    );

  const customModules = rows
    .filter((row) => !CONTENT_LIBRARY_IDS.has(row.id))
    .map((row) => buildModuleFromRow(row));

  const modules = [...staticModules, ...customModules].sort(compareModules);

  if (args?.includeInactive) {
    return modules;
  }

  return modules.filter((module) => module.active);
}

export async function getLibraryModuleById(
  moduleId: string,
  args?: { includeInactive?: boolean }
): Promise<RecoveryLibraryModule | null> {
  const modules = await listLibraryModules({ includeInactive: args?.includeInactive });
  return modules.find((module) => module.id === moduleId) ?? null;
}

export function getLibraryCategories(): RecoveryLibraryCategory[] {
  return CATEGORY_DEFINITIONS;
}

export function getLibraryCategory(key: string): RecoveryLibraryCategory | null {
  return CATEGORY_DEFINITIONS.find((category) => category.key === key) ?? null;
}

export async function getPatientLibraryContext(userId: string): Promise<PatientLibraryContext> {
  const [user, activation] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { procedureName: true, procedureCode: true },
    }),
    prisma.activationCode.findFirst({
      where: {
        claimedByUserId: userId,
        status: ActivationCodeStatus.CLAIMED,
      },
      orderBy: { claimedAt: "desc" },
      select: {
        code: true,
        educationBundleId: true,
        boxTemplateId: true,
        productMode: true,
        procedureName: true,
        assignedBoxItemsJson: true,
        assignedEducationJson: true,
        batch: {
          select: {
            includedItemsJson: true,
            educationBundleId: true,
            boxTemplateId: true,
            productMode: true,
            procedureName: true,
          },
        },
      },
    }),
  ]);

  const educationBundleId =
    activation?.educationBundleId ?? activation?.batch?.educationBundleId ?? null;
  const boxTemplateId =
    activation?.boxTemplateId ?? activation?.batch?.boxTemplateId ?? null;
  const [educationBundle, boxTemplate] = await Promise.all([
    educationBundleId ? getEducationBundleById(educationBundleId) : Promise.resolve(null),
    boxTemplateId ? getBoxTemplateById(boxTemplateId) : Promise.resolve(null),
  ]);

  const assignedEducation = parseAssignedEducationOverrides(
    activation?.assignedEducationJson
  );
  const codeBoxItems = normalizeIncludedItems(activation?.assignedBoxItemsJson);
  const templateBoxItems = boxTemplate
    ? boxItemKeysToItems(boxTemplate.boxItemKeys)
    : [];
  const batchBoxItems = normalizeIncludedItems(activation?.batch?.includedItemsJson);
  const procedureName =
    normalizeOptionalText(activation?.procedureName) ??
    normalizeOptionalText(activation?.batch?.procedureName) ??
    educationBundle?.procedureName ??
    user?.procedureName ??
    user?.procedureCode ??
    null;

  return {
    activationCode: activation?.code ?? null,
    productMode: normalizeProductMode(
      activation?.productMode ?? activation?.batch?.productMode
    ),
    procedureName,
    boxItems: mergeBoxItems(codeBoxItems, templateBoxItems, batchBoxItems),
    educationBundle,
    boxTemplate,
    assignedEducation,
    hasCodeBoxItemOverrides: codeBoxItems.length > 0,
  };
}

export async function getLibraryHomePayload(args: {
  userId?: string;
}): Promise<RecoveryLibraryHomePayload> {
  const [modules, patientContext] = await Promise.all([
    listLibraryModules(),
    args.userId
      ? getPatientLibraryContext(args.userId)
      : Promise.resolve(emptyPatientLibraryContext()),
  ]);

  const modulesById = new Map(modules.map((module) => [module.id, module]));
  const recommendedOverrideIds = new Set(
    patientContext.assignedEducation.recommendedGuideIds
  );
  const codeAssignedGuideIds = uniqueStrings([
    ...patientContext.assignedEducation.recommendedGuideIds,
    ...patientContext.assignedEducation.guideIds,
  ]);
  const codeAssignedGuides = codeAssignedGuideIds
    .map((moduleId, index) => {
      const module = modulesById.get(moduleId);
      if (!module) return null;
      return toCodeAssignedGuideSummary(module, {
        recommended: recommendedOverrideIds.has(moduleId),
        order: index,
      });
    })
    .filter((guide): guide is RecoveryLibraryModuleSummary => Boolean(guide));
  const bundleGuides = patientContext.educationBundle
    ? patientContext.educationBundle.modules
        .map((assignment) => {
          const module = modulesById.get(assignment.moduleId);
          if (!module) return null;
          return toBundleGuideSummary(module, assignment);
        })
        .filter((guide): guide is RecoveryLibraryModuleSummary => Boolean(guide))
        .sort(compareRecommendedSummaries)
    : [];
  const boxTemplateGuides = patientContext.boxTemplate
    ? patientContext.boxTemplate.modules
        .map((assignment) => {
          const module = modulesById.get(assignment.moduleId);
          if (!module) return null;
          return toBoxTemplateGuideSummary(module, assignment);
        })
        .filter((guide): guide is RecoveryLibraryModuleSummary => Boolean(guide))
        .sort(compareRecommendedSummaries)
    : [];

  const categories = CATEGORY_DEFINITIONS.map((category) => {
    const categoryModules = modules.filter((module) =>
      module.categories.includes(category.key)
    );

    return {
      ...category,
      moduleCount: categoryModules.length,
      featuredGuides: categoryModules.slice(0, 3).map(toSummary),
    };
  });

  const sections = Object.fromEntries(
    CATEGORY_DEFINITIONS.map((category) => [
      category.key,
      modules
        .filter((module) => module.categories.includes(category.key))
        .slice(0, 8)
        .map(toSummary),
    ])
  ) as RecoveryLibraryHomePayload["sections"];

  const procedureGuides: RecoveryLibraryModuleSummary[] = [];
  appendUniqueGuides(procedureGuides, bundleGuides);
  if (patientContext.procedureName) {
    appendUniqueGuides(
      procedureGuides,
      modules
        .filter((module) => matchesProcedure(module, patientContext.procedureName))
        .sort(compareModules)
        .slice(0, 8)
        .map(toSummary)
    );
  }

  const boxItemGuides: RecoveryLibraryModuleSummary[] = [];
  appendUniqueGuides(boxItemGuides, boxTemplateGuides);
  if (patientContext.boxItems.length) {
    appendUniqueGuides(
      boxItemGuides,
      modules
        .filter((module) => matchesBoxItems(module, patientContext.boxItems))
        .sort(compareModules)
        .slice(0, 8)
        .map(toSummary)
    );
  }

  const recommendedGuides: RecoveryLibraryModuleSummary[] = [];
  appendUniqueGuides(recommendedGuides, codeAssignedGuides);
  appendUniqueGuides(recommendedGuides, bundleGuides);
  appendUniqueGuides(recommendedGuides, boxTemplateGuides);
  appendUniqueGuides(
    recommendedGuides,
    modules
      .filter(isRecommendedModule)
      .sort(compareRecommendedModules)
      .map(toSummary)
  );
  const hasCodeEducationOverrides =
    codeAssignedGuideIds.length > 0 ||
    patientContext.assignedEducation.recommendedGuideIds.length > 0;

  return {
    recommendedGuides,
    categories,
    sections,
    personalized: {
      productMode: patientContext.productMode,
      assignment: patientContext.activationCode
        ? {
            activationCode: patientContext.activationCode,
            productMode: patientContext.productMode,
            educationBundle: patientContext.educationBundle
              ? {
                  id: patientContext.educationBundle.id,
                  name: patientContext.educationBundle.name,
                  slug: patientContext.educationBundle.slug,
                  procedureName: patientContext.educationBundle.procedureName,
                }
              : null,
            boxTemplate: patientContext.boxTemplate
              ? {
                  id: patientContext.boxTemplate.id,
                  name: patientContext.boxTemplate.name,
                  slug: patientContext.boxTemplate.slug,
                }
              : null,
            hasCodeEducationOverrides,
            hasCodeBoxItemOverrides: patientContext.hasCodeBoxItemOverrides,
          }
        : null,
      procedureName: patientContext.procedureName,
      boxItems: patientContext.boxItems,
      procedureGuides,
      boxItemGuides,
    },
  };
}

export async function getLibraryCategoryPayload(args: {
  categoryKey: LibraryCategoryKey;
  userId?: string;
}): Promise<RecoveryLibraryCategoryPayload> {
  const [modules, patientContext] = await Promise.all([
    listLibraryModules(),
    args.userId
      ? getPatientLibraryContext(args.userId)
      : Promise.resolve(emptyPatientLibraryContext()),
  ]);

  const category = getLibraryCategory(args.categoryKey);
  if (!category) {
    throw new Error("UNKNOWN_LIBRARY_CATEGORY");
  }

  const guides = modules
    .filter((module) => module.categories.includes(args.categoryKey))
    .sort((a, b) => {
      const aMatchesProcedure = matchesProcedure(a, patientContext.procedureName);
      const bMatchesProcedure = matchesProcedure(b, patientContext.procedureName);
      if (aMatchesProcedure !== bMatchesProcedure) {
        return aMatchesProcedure ? -1 : 1;
      }

      const aMatchesBox = matchesBoxItems(a, patientContext.boxItems);
      const bMatchesBox = matchesBoxItems(b, patientContext.boxItems);
      if (aMatchesBox !== bMatchesBox) {
        return aMatchesBox ? -1 : 1;
      }

      return compareModules(a, b);
    })
    .map(toSummary);

  return {
    category,
    guides,
  };
}

export async function getLibraryGuidePayload(args: {
  moduleId: string;
}): Promise<RecoveryLibraryGuidePayload | null> {
  const modules = await listLibraryModules();
  const guide = modules.find((module) => module.id === args.moduleId);
  if (!guide) return null;

  const relatedGuides = modules
    .filter((module) => module.id !== guide.id)
    .map((module) => {
      const sharedCategories = module.categories.filter((category) =>
        guide.categories.includes(category)
      ).length;
      const sharedProcedures = module.procedureNames.filter((procedure) =>
        guide.procedureNames.includes(procedure)
      ).length;
      const sharedBoxItems = module.boxItemKeys.filter((key) =>
        guide.boxItemKeys.includes(key)
      ).length;

      return {
        module,
        score: sharedCategories * 3 + sharedProcedures * 4 + sharedBoxItems * 4,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || compareModules(a.module, b.module))
    .slice(0, 4)
    .map((entry) => toSummary(entry.module));

  return {
    guide,
    relatedGuides,
  };
}

export async function listEducationBundles(args?: {
  includeInactive?: boolean;
}): Promise<EducationBundle[]> {
  const bundles = (await readEducationBundleRows())
    .map(mapEducationBundle)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

  if (args?.includeInactive) {
    return bundles;
  }

  return bundles.filter((bundle) => bundle.active);
}

export async function getEducationBundleById(
  bundleId: string,
  args?: { includeInactive?: boolean }
): Promise<EducationBundle | null> {
  const bundles = await listEducationBundles({ includeInactive: args?.includeInactive });
  return bundles.find((bundle) => bundle.id === bundleId) ?? null;
}

export async function listBoxTemplates(args?: {
  includeInactive?: boolean;
}): Promise<BoxTemplate[]> {
  const boxTemplates = (await readBoxTemplateRows())
    .map(mapBoxTemplate)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

  if (args?.includeInactive) {
    return boxTemplates;
  }

  return boxTemplates.filter((boxTemplate) => boxTemplate.active);
}

export async function getBoxTemplateById(
  boxTemplateId: string,
  args?: { includeInactive?: boolean }
): Promise<BoxTemplate | null> {
  const boxTemplates = await listBoxTemplates({
    includeInactive: args?.includeInactive,
  });
  return boxTemplates.find((boxTemplate) => boxTemplate.id === boxTemplateId) ?? null;
}

export async function getEducationBundlePreviewPayload(args: {
  bundleId: string;
}): Promise<EducationBundlePreviewPayload | null> {
  const [bundle, libraryModules] = await Promise.all([
    getEducationBundleById(args.bundleId, { includeInactive: true }),
    listLibraryModules(),
  ]);

  if (!bundle) return null;

  const modulesById = new Map(libraryModules.map((module) => [module.id, module]));
  const guides = bundle.modules
    .map((assignment) => {
      const module = modulesById.get(assignment.moduleId);
      if (!module) return null;
      return toBundleGuideSummary(module, assignment);
    })
    .filter((guide): guide is RecoveryLibraryModuleSummary => Boolean(guide))
    .sort(compareGuideSummaries);

  return {
    bundle,
    recommendedGuides: guides
      .filter((guide) => guide.recommended || guide.featured)
      .sort(compareRecommendedSummaries),
    guides,
  };
}

export async function getBoxTemplatePreviewPayload(args: {
  boxTemplateId: string;
}): Promise<BoxTemplatePreviewPayload | null> {
  const [boxTemplate, libraryModules] = await Promise.all([
    getBoxTemplateById(args.boxTemplateId, { includeInactive: true }),
    listLibraryModules(),
  ]);

  if (!boxTemplate) return null;

  const modulesById = new Map(libraryModules.map((module) => [module.id, module]));
  const guides = boxTemplate.modules
    .map((assignment) => {
      const module = modulesById.get(assignment.moduleId);
      if (!module) return null;
      return toBoxTemplateGuideSummary(module, assignment);
    })
    .filter((guide): guide is RecoveryLibraryModuleSummary => Boolean(guide))
    .sort(compareGuideSummaries);

  return {
    boxTemplate,
    recommendedGuides: guides
      .filter((guide) => guide.recommended)
      .sort(compareRecommendedSummaries),
    guides,
  };
}

async function getProcedureSuggestions(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      procedureName: {
        not: null,
      },
    },
    select: {
      procedureName: true,
    },
    take: 250,
  });

  const defaults = Object.values(DEFAULT_LIBRARY_METADATA).flatMap(
    (metadata) => metadata.procedureNames ?? []
  );

  return uniqueStrings([
    ...defaults,
    ...rows.map((row) => row.procedureName ?? ""),
  ]).sort((a, b) => a.localeCompare(b));
}

export async function getLibraryAdminPayload(): Promise<RecoveryLibraryAdminPayload> {
  const [modules, procedures, bundles, boxTemplates] = await Promise.all([
    listLibraryModules({ includeInactive: true }),
    getProcedureSuggestions(),
    listEducationBundles({ includeInactive: true }),
    listBoxTemplates({ includeInactive: true }),
  ]);

  return {
    categories: CATEGORY_DEFINITIONS,
    modules,
    bundles,
    boxTemplates,
    suggestions: {
      procedures,
      boxItems: listKnownBoxItemKeys(),
    },
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sanitizeInput(input: LibraryModuleUpsertInput) {
  const title = input.title.trim();
  const body = normalizeBody(input.body);
  const summary = normalizeBody(input.summary ?? "") || deriveSummary(body, title);

  return {
    title,
    summary,
    body,
    moduleType: input.moduleType,
    videoUrl: input.videoUrl?.trim() || null,
    thumbnailUrl: input.thumbnailUrl?.trim() || null,
    categories: normalizeCategories(input.categories ?? []),
    procedureNames: uniqueStrings(input.procedureNames ?? []),
    boxItemKeys: normalizeBoxItemKeys(input.boxItemKeys ?? []),
    redFlags: uniqueStrings(input.redFlags ?? []),
    requiredBoxItems: normalizeBoxItemKeys(input.requiredBoxItems ?? []),
    recommended: input.recommended ?? false,
    featured: input.featured ?? false,
    recommendationLabel: normalizeOptionalText(input.recommendationLabel),
    recommendationOrder:
      typeof input.recommendationOrder === "number"
        ? input.recommendationOrder
        : null,
    active: input.active ?? true,
    displayOrder: input.displayOrder ?? 0,
  };
}

async function assertKnownLibraryModules(moduleIds: string[]) {
  if (moduleIds.length === 0) return;

  const modules = await listLibraryModules({ includeInactive: true });
  const knownModuleIds = new Set(modules.map((module) => module.id));
  const unknown = moduleIds.find((moduleId) => !knownModuleIds.has(moduleId));
  if (unknown) {
    throw new Error(`UNKNOWN_LIBRARY_MODULE:${unknown}`);
  }
}

function sanitizeEducationBundleAssignments(
  assignments: EducationBundleModuleAssignmentInput[]
): EducationBundleModuleAssignment[] {
  const byModuleId = new Map<string, EducationBundleModuleAssignment>();

  for (const assignment of assignments) {
    const moduleId = assignment.moduleId.trim();
    if (!moduleId) continue;

    byModuleId.set(moduleId, {
      moduleId,
      recommended: assignment.recommended ?? false,
      featured: assignment.featured ?? false,
      recommendationLabel: normalizeOptionalText(assignment.recommendationLabel),
      recommendationOrder:
        typeof assignment.recommendationOrder === "number"
          ? assignment.recommendationOrder
          : null,
      displayOrder: assignment.displayOrder ?? 0,
    });
  }

  return Array.from(byModuleId.values()).sort(compareEducationBundleAssignments);
}

async function sanitizeEducationBundleInput(input: EducationBundleUpsertInput) {
  const modules = sanitizeEducationBundleAssignments(input.modules ?? []);
  await assertKnownLibraryModules(modules.map((assignment) => assignment.moduleId));

  return {
    name: input.name.trim(),
    description: normalizeBody(input.description ?? ""),
    clinicTag: normalizeOptionalText(input.clinicTag),
    procedureName: normalizeOptionalText(input.procedureName),
    active: input.active ?? true,
    displayOrder: input.displayOrder ?? 0,
    modules,
  };
}

function sanitizeBoxTemplateAssignments(
  assignments: BoxTemplateModuleAssignmentInput[]
): BoxTemplateModuleAssignment[] {
  const byModuleId = new Map<string, BoxTemplateModuleAssignment>();

  for (const assignment of assignments) {
    const moduleId = assignment.moduleId.trim();
    if (!moduleId) continue;

    byModuleId.set(moduleId, {
      moduleId,
      recommended: assignment.recommended ?? false,
      recommendationLabel: normalizeOptionalText(assignment.recommendationLabel),
      recommendationOrder:
        typeof assignment.recommendationOrder === "number"
          ? assignment.recommendationOrder
          : null,
    });
  }

  return Array.from(byModuleId.values()).sort(compareBoxTemplateAssignments);
}

async function sanitizeBoxTemplateInput(input: BoxTemplateUpsertInput) {
  const modules = sanitizeBoxTemplateAssignments(input.modules ?? []);
  await assertKnownLibraryModules(modules.map((assignment) => assignment.moduleId));

  return {
    name: input.name.trim(),
    description: normalizeBody(input.description ?? ""),
    boxItemKeys: normalizeBoxItemKeys(input.boxItemKeys ?? []),
    active: input.active ?? true,
    displayOrder: input.displayOrder ?? 0,
    modules,
  };
}

async function ensureUniqueEducationBundleSlug(name: string): Promise<string> {
  const baseSlug = slugify(name) || "education-bundle";
  let slug = baseSlug;
  let suffix = 2;

  while (
    await prisma.educationBundle.findUnique({
      where: { slug },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

async function ensureUniqueBoxTemplateSlug(name: string): Promise<string> {
  const baseSlug = slugify(name) || "box-template";
  let slug = baseSlug;
  let suffix = 2;

  while (
    await prisma.boxTemplate.findUnique({
      where: { slug },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function upsertLibraryModule(
  moduleId: string,
  input: LibraryModuleUpsertInput
): Promise<RecoveryLibraryModule> {
  const data = sanitizeInput(input);

  await prisma.recoveryLibraryModule.upsert({
    where: { id: moduleId },
    update: data,
    create: {
      id: moduleId,
      ...data,
    },
  });

  const module = await getLibraryModuleById(moduleId, { includeInactive: true });
  if (!module) {
    throw new Error("LIBRARY_MODULE_NOT_FOUND");
  }

  return module;
}

export async function createCustomLibraryModule(
  input: LibraryModuleUpsertInput
): Promise<RecoveryLibraryModule> {
  const baseId = slugify(input.title) || "guide";
  let nextId = baseId;
  let suffix = 2;

  while (
    CONTENT_LIBRARY_IDS.has(nextId) ||
    (await prisma.recoveryLibraryModule.findUnique({
      where: { id: nextId },
      select: { id: true },
    }))
  ) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return upsertLibraryModule(nextId, input);
}

export async function createEducationBundle(
  input: EducationBundleUpsertInput
): Promise<EducationBundle> {
  const data = await sanitizeEducationBundleInput(input);
  const slug = await ensureUniqueEducationBundleSlug(data.name);

  const bundle = await prisma.educationBundle.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      clinicTag: data.clinicTag,
      procedureName: data.procedureName,
      active: data.active,
      displayOrder: data.displayOrder,
      modules: data.modules.length
        ? {
            createMany: {
              data: data.modules,
            },
          }
        : undefined,
    },
  });

  const savedBundle = await getEducationBundleById(bundle.id, {
    includeInactive: true,
  });
  if (!savedBundle) {
    throw new Error("EDUCATION_BUNDLE_NOT_FOUND");
  }

  return savedBundle;
}

export async function updateEducationBundle(
  bundleId: string,
  input: EducationBundleUpsertInput
): Promise<EducationBundle> {
  const data = await sanitizeEducationBundleInput(input);

  await prisma.$transaction(async (tx) => {
    await tx.educationBundle.update({
      where: { id: bundleId },
      data: {
        name: data.name,
        description: data.description,
        clinicTag: data.clinicTag,
        procedureName: data.procedureName,
        active: data.active,
        displayOrder: data.displayOrder,
      },
    });

    await tx.educationBundleModule.deleteMany({
      where: { bundleId },
    });

    if (data.modules.length > 0) {
      await tx.educationBundleModule.createMany({
        data: data.modules.map((assignment) => ({
          bundleId,
          ...assignment,
        })),
      });
    }
  });

  const savedBundle = await getEducationBundleById(bundleId, {
    includeInactive: true,
  });
  if (!savedBundle) {
    throw new Error("EDUCATION_BUNDLE_NOT_FOUND");
  }

  return savedBundle;
}

export async function createBoxTemplate(
  input: BoxTemplateUpsertInput
): Promise<BoxTemplate> {
  const data = await sanitizeBoxTemplateInput(input);
  const slug = await ensureUniqueBoxTemplateSlug(data.name);

  const boxTemplate = await prisma.boxTemplate.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      boxItemKeys: data.boxItemKeys,
      active: data.active,
      displayOrder: data.displayOrder,
      modules: data.modules.length
        ? {
            createMany: {
              data: data.modules,
            },
          }
        : undefined,
    },
  });

  const savedTemplate = await getBoxTemplateById(boxTemplate.id, {
    includeInactive: true,
  });
  if (!savedTemplate) {
    throw new Error("BOX_TEMPLATE_NOT_FOUND");
  }

  return savedTemplate;
}

export async function updateBoxTemplate(
  boxTemplateId: string,
  input: BoxTemplateUpsertInput
): Promise<BoxTemplate> {
  const data = await sanitizeBoxTemplateInput(input);

  await prisma.$transaction(async (tx) => {
    await tx.boxTemplate.update({
      where: { id: boxTemplateId },
      data: {
        name: data.name,
        description: data.description,
        boxItemKeys: data.boxItemKeys,
        active: data.active,
        displayOrder: data.displayOrder,
      },
    });

    await tx.boxTemplateEducationModule.deleteMany({
      where: { boxTemplateId },
    });

    if (data.modules.length > 0) {
      await tx.boxTemplateEducationModule.createMany({
        data: data.modules.map((assignment) => ({
          boxTemplateId,
          ...assignment,
        })),
      });
    }
  });

  const savedTemplate = await getBoxTemplateById(boxTemplateId, {
    includeInactive: true,
  });
  if (!savedTemplate) {
    throw new Error("BOX_TEMPLATE_NOT_FOUND");
  }

  return savedTemplate;
}
