import {
  ActivationCodeStatus,
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
  | "displayOrder"
  | "requiredBoxItems"
  | "frequency"
>;

export type RecoveryLibraryHomePayload = {
  categories: Array<
    RecoveryLibraryCategory & {
      moduleCount: number;
      featuredGuides: RecoveryLibraryModuleSummary[];
    }
  >;
  sections: Record<LibraryCategoryKey, RecoveryLibraryModuleSummary[]>;
  personalized: {
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

export type RecoveryLibraryAdminPayload = {
  categories: RecoveryLibraryCategory[];
  modules: RecoveryLibraryModule[];
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
  active?: boolean;
  displayOrder?: number;
};

type StaticLibraryMetadata = {
  categories?: LibraryCategoryKey[];
  procedureNames?: string[];
  boxItemKeys?: string[];
  displayOrder?: number;
  thumbnailUrl?: string | null;
};

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
    displayOrder: module.displayOrder,
    requiredBoxItems: module.requiredBoxItems,
    frequency: module.frequency,
  };
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

export async function getPatientLibraryContext(userId: string): Promise<{
  procedureName: string | null;
  boxItems: Array<{ key: string | null; label: string }>;
}> {
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
        batch: {
          select: {
            includedItemsJson: true,
          },
        },
      },
    }),
  ]);

  return {
    procedureName: user?.procedureName ?? user?.procedureCode ?? null,
    boxItems: normalizeIncludedItems(activation?.batch?.includedItemsJson),
  };
}

export async function getLibraryHomePayload(args: {
  userId?: string;
}): Promise<RecoveryLibraryHomePayload> {
  const [modules, patientContext] = await Promise.all([
    listLibraryModules(),
    args.userId ? getPatientLibraryContext(args.userId) : Promise.resolve({
      procedureName: null,
      boxItems: [] as Array<{ key: string | null; label: string }>,
    }),
  ]);

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

  const procedureGuides = patientContext.procedureName
    ? modules
        .filter((module) => matchesProcedure(module, patientContext.procedureName))
        .slice(0, 8)
        .map(toSummary)
    : [];

  const boxItemGuides = patientContext.boxItems.length
    ? modules
        .filter((module) => matchesBoxItems(module, patientContext.boxItems))
        .slice(0, 8)
        .map(toSummary)
    : [];

  return {
    categories,
    sections,
    personalized: {
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
    args.userId ? getPatientLibraryContext(args.userId) : Promise.resolve({
      procedureName: null,
      boxItems: [] as Array<{ key: string | null; label: string }>,
    }),
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
  const [modules, procedures] = await Promise.all([
    listLibraryModules({ includeInactive: true }),
    getProcedureSuggestions(),
  ]);

  return {
    categories: CATEGORY_DEFINITIONS,
    modules,
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
    active: input.active ?? true,
    displayOrder: input.displayOrder ?? 0,
  };
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
