import { ActivationCodeStatus, Prisma } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import {
  getBoxTemplateById,
  getEducationBundleById,
  listLibraryModules,
  resolveActivationCodeBoxItems,
  type RecoveryLibraryBoxItem,
  type RecoveryLibraryModule,
} from "./recoveryLibraryService.js";

const TIER1_PRODUCT_MODE = "kit_only";

const FINALIZABLE_STATUSES = new Set<ActivationCodeStatus>([
  ActivationCodeStatus.ISSUED,
  ActivationCodeStatus.DRAFT,
  ActivationCodeStatus.CONFIGURED,
  ActivationCodeStatus.APPROVED,
  ActivationCodeStatus.RESET_FOR_REISSUE,
]);

export class Tier1ActivationError extends Error {
  statusCode: number;
  code: string;

  constructor(code: string, statusCode = 400) {
    super(code);
    this.name = "Tier1ActivationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

type AssignedEducationOverrides = {
  guideIds: string[];
  recommendedGuideIds: string[];
};

export type Tier1SnapshotValidationIssue = {
  code: string;
  message: string;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readArray(value: unknown, key: string): unknown[] {
  const record = asRecord(value);
  const list = record[key];
  return Array.isArray(list) ? list : [];
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.map((entry) => (typeof entry === "string" ? entry : null)));
}

function parseAssignedEducationOverrides(
  value: Prisma.JsonValue | null | undefined,
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

function normalizeProductMode(value: string | null | undefined) {
  return value === TIER1_PRODUCT_MODE ? TIER1_PRODUCT_MODE : "full_platform";
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function compareModules(left: RecoveryLibraryModule, right: RecoveryLibraryModule) {
  if (left.displayOrder !== right.displayOrder) {
    return left.displayOrder - right.displayOrder;
  }

  return left.title.localeCompare(right.title);
}

function uniqueModules(modules: RecoveryLibraryModule[]) {
  const byId = new Map<string, RecoveryLibraryModule>();

  for (const module of modules) {
    if (!byId.has(module.id)) {
      byId.set(module.id, module);
    }
  }

  return Array.from(byId.values()).sort(compareModules);
}

function modulesForIds(
  moduleIds: string[],
  modulesById: Map<string, RecoveryLibraryModule>,
) {
  return uniqueModules(
    moduleIds
      .map((moduleId) => modulesById.get(moduleId))
      .filter((module): module is RecoveryLibraryModule => Boolean(module)),
  );
}

function moduleIdsForBoxItems(
  boxItems: RecoveryLibraryBoxItem[],
  modules: RecoveryLibraryModule[],
) {
  const itemKeys = new Set(
    boxItems.map((item) => item.key).filter((key): key is string => Boolean(key)),
  );
  const directGuideIds = boxItems
    .map((item) => item.defaultEducationModuleId)
    .filter((moduleId): moduleId is string => Boolean(moduleId));

  const matchedGuideIds = modules
    .filter((module) => module.boxItemKeys.some((boxItemKey) => itemKeys.has(boxItemKey)))
    .map((module) => module.id);

  return uniqueStrings([...directGuideIds, ...matchedGuideIds]);
}

async function loadActivationForSnapshot(code: string) {
  return prisma.activationCode.findUnique({
    where: { code },
    include: {
      batch: {
        select: {
          id: true,
          clinicOrderId: true,
          includedItemsJson: true,
          educationBundleId: true,
          boxTemplateId: true,
          productMode: true,
          procedureName: true,
        },
      },
      clinicConfig: {
        select: {
          clinicTag: true,
          name: true,
          notes: true,
          archivedAt: true,
        },
      },
    },
  });
}

async function buildTier1SnapshotInput(code: string, actorUserId: string | null) {
  const activation = await loadActivationForSnapshot(code);

  if (!activation) {
    throw new Tier1ActivationError("ACTIVATION_CODE_NOT_FOUND", 404);
  }

  if (activation.clinicConfig?.archivedAt) {
    throw new Tier1ActivationError("CLINIC_ARCHIVED", 409);
  }

  if (activation.claimedByUserId || activation.status === ActivationCodeStatus.CLAIMED) {
    throw new Tier1ActivationError("CODE_ALREADY_CLAIMED", 409);
  }

  if (!FINALIZABLE_STATUSES.has(activation.status)) {
    throw new Tier1ActivationError("INVALID_STATE_TRANSITION", 409);
  }

  const productMode = normalizeProductMode(
    activation.productMode ?? activation.batch?.productMode,
  );
  if (productMode !== TIER1_PRODUCT_MODE) {
    throw new Tier1ActivationError("NOT_TIER1_ACTIVATION_CODE", 409);
  }

  const educationBundleId =
    activation.educationBundleId ?? activation.batch?.educationBundleId ?? null;
  const boxTemplateId =
    activation.boxTemplateId ?? activation.batch?.boxTemplateId ?? null;

  const [libraryModules, educationBundle, boxTemplate, boxItemResolution] =
    await Promise.all([
      listLibraryModules({ includeInactive: true }),
      educationBundleId
        ? getEducationBundleById(educationBundleId, { includeInactive: true })
        : Promise.resolve(null),
      boxTemplateId
        ? getBoxTemplateById(boxTemplateId, { includeInactive: true })
        : Promise.resolve(null),
      resolveActivationCodeBoxItems({
        assignedBoxItemsJson: activation.assignedBoxItemsJson,
        boxTemplateId: activation.boxTemplateId,
        batchBoxTemplateId: activation.batch?.boxTemplateId ?? null,
        batchIncludedItemsJson: activation.batch?.includedItemsJson ?? null,
        includeInactiveTemplate: true,
      }),
    ]);
  const procedureName =
    activation.procedureName ??
    activation.batch?.procedureName ??
    educationBundle?.procedureName ??
    null;

  const modulesById = new Map(libraryModules.map((module) => [module.id, module]));
  const assignedEducation = parseAssignedEducationOverrides(
    activation.assignedEducationJson,
  );
  const assignedGuideIds = uniqueStrings([
    ...assignedEducation.recommendedGuideIds,
    ...assignedEducation.guideIds,
  ]);
  const bundleGuideIds = educationBundle
    ? educationBundle.modules
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((assignment) => assignment.moduleId)
    : [];
  const boxTemplateGuideIds = boxTemplate
    ? boxTemplate.modules
        .sort((left, right) => {
          const leftOrder = left.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
          const rightOrder = right.recommendationOrder ?? Number.MAX_SAFE_INTEGER;
          return leftOrder - rightOrder;
        })
        .map((assignment) => assignment.moduleId)
    : [];
  const boxItemGuideIds = moduleIdsForBoxItems(
    boxItemResolution.resolvedBoxItems,
    libraryModules,
  );
  const procedureGuideIds = uniqueStrings([...bundleGuideIds, ...assignedGuideIds]);
  const pinnedGuideIds = uniqueStrings([
    ...assignedGuideIds,
    ...bundleGuideIds,
    ...boxTemplateGuideIds,
    ...boxItemGuideIds,
  ]);
  const frozenLibraryModules = uniqueModules([
    ...libraryModules.filter((module) => module.active),
    ...modulesForIds(pinnedGuideIds, modulesById),
  ]);
  const videos = frozenLibraryModules.filter((module) => module.videoUrl);

  const boxItems = boxItemResolution.resolvedBoxItems.map((item) => ({
    ...item,
    educationGuide: item.defaultEducationModuleId
      ? modulesById.get(item.defaultEducationModuleId) ?? null
      : null,
  }));

  return {
    activation,
    data: {
      activationCodeId: activation.id,
      productMode,
      clinicTag: activation.clinicTag,
      procedureName,
      educationBundleId,
      boxTemplateId,
      boxItemsJson: toJsonValue({
        schemaVersion: 1,
        items: boxItems,
        removedBoxItemKeys: boxItemResolution.removedBoxItemKeys,
      }),
      guidesJson: toJsonValue({
        schemaVersion: 1,
        libraryModules: frozenLibraryModules,
        assignedGuideIds,
        recommendedGuideIds: assignedEducation.recommendedGuideIds,
        bundleGuideIds,
        boxTemplateGuideIds,
        boxItemGuideIds,
        procedureGuideIds,
      }),
      clinicNotesJson: toJsonValue({
        schemaVersion: 1,
        clinicNotes: activation.clinicConfig?.notes ?? null,
        activationConfig: activation.configJson ?? null,
        approvedConfigSnapshot: activation.approvedConfigSnapshot ?? null,
        itemNotes: boxItems
          .filter((item) => item.note)
          .map((item) => ({
            key: item.key,
            label: item.label,
            note: item.note,
          })),
      }),
      videosJson: toJsonValue({
        schemaVersion: 1,
        videos,
      }),
      sourceMetadataJson: toJsonValue({
        schemaVersion: 1,
        activationCode: activation.code,
        clinic: activation.clinicConfig
          ? {
              clinicTag: activation.clinicConfig.clinicTag,
              name: activation.clinicConfig.name,
            }
          : null,
        batch: activation.batch
          ? {
              id: activation.batch.id,
              clinicOrderId: activation.batch.clinicOrderId,
              productMode: activation.batch.productMode,
              procedureName: activation.batch.procedureName,
            }
          : null,
        educationBundle: educationBundle
          ? {
              id: educationBundle.id,
              name: educationBundle.name,
              slug: educationBundle.slug,
              procedureName: educationBundle.procedureName,
            }
          : null,
        boxTemplate: boxTemplate
          ? {
              id: boxTemplate.id,
              name: boxTemplate.name,
              slug: boxTemplate.slug,
            }
          : null,
        createdByUserId: actorUserId,
      }),
      createdByUserId: actorUserId,
    },
  };
}

function buildTier1SnapshotPreviewPayload(
  snapshotInput: Awaited<ReturnType<typeof buildTier1SnapshotInput>>,
) {
  const { activation, data } = snapshotInput;
  const boxItems = readArray(data.boxItemsJson, "items");
  const guides = readArray(data.guidesJson, "libraryModules");
  const assignedGuideIds = readArray(data.guidesJson, "assignedGuideIds");
  const recommendedGuideIds = readArray(data.guidesJson, "recommendedGuideIds");
  const procedureGuideIds = readArray(data.guidesJson, "procedureGuideIds");
  const boxItemGuideIds = readArray(data.guidesJson, "boxItemGuideIds");
  const videos = readArray(data.videosJson, "videos");

  return {
    activationCode: {
      id: activation.id,
      code: activation.code,
      status: activation.status,
      clinicTag: activation.clinicTag,
      productMode: data.productMode,
      batchId: activation.batchId,
      clinicOrderId: activation.batch?.clinicOrderId ?? null,
      claimedAt: activation.claimedAt,
      claimedByUserId: activation.claimedByUserId,
    },
    snapshot: {
      productMode: data.productMode,
      clinicTag: data.clinicTag,
      procedureName: data.procedureName,
      educationBundleId: data.educationBundleId,
      boxTemplateId: data.boxTemplateId,
      boxItems,
      guides,
      assignedGuideIds,
      recommendedGuideIds,
      procedureGuideIds,
      boxItemGuideIds,
      clinicNotes: data.clinicNotesJson,
      videos,
      sourceMetadata: data.sourceMetadataJson,
    },
    counts: {
      boxItems: boxItems.length,
      guides: guides.length,
      assignedGuides: assignedGuideIds.length,
      procedureGuides: procedureGuideIds.length,
      boxItemGuides: boxItemGuideIds.length,
      videos: videos.length,
    },
  };
}

function validateTier1SnapshotPreview(
  preview: ReturnType<typeof buildTier1SnapshotPreviewPayload>,
): Tier1SnapshotValidationIssue[] {
  const issues: Tier1SnapshotValidationIssue[] = [];
  const hasAssignedEducation =
    preview.counts.assignedGuides > 0 ||
    preview.counts.procedureGuides > 0 ||
    preview.counts.boxItemGuides > 0;

  if (preview.activationCode.productMode !== TIER1_PRODUCT_MODE) {
    issues.push({
      code: "NOT_TIER1_ACTIVATION_CODE",
      message: "Activation code must be kit_only before finalization.",
    });
  }

  if (!preview.activationCode.clinicTag) {
    issues.push({
      code: "CLINIC_REQUIRED",
      message: "Activation code must be assigned to a clinic.",
    });
  }

  if (!preview.snapshot.procedureName) {
    issues.push({
      code: "PROCEDURE_NAME_REQUIRED",
      message: "Procedure name is required before finalizing a Tier 1 patient snapshot.",
    });
  }

  if (preview.counts.boxItems === 0) {
    issues.push({
      code: "BOX_ITEMS_REQUIRED",
      message: "At least one box item should be assigned before finalization.",
    });
  }

  if (!hasAssignedEducation) {
    issues.push({
      code: "ASSIGNED_EDUCATION_REQUIRED",
      message: "At least one bundle, guide, box-template guide, or box-item guide should be assigned before finalization.",
    });
  }

  return issues;
}

export async function previewTier1ActivationSnapshot(args: {
  code: string;
}) {
  return buildTier1SnapshotPreviewPayload(
    await buildTier1SnapshotInput(args.code, null),
  );
}

export async function validateTier1ActivationSnapshot(args: {
  code: string;
}) {
  try {
    const preview = await previewTier1ActivationSnapshot(args);
    const issues = validateTier1SnapshotPreview(preview);

    return {
      valid: issues.length === 0,
      issues,
      preview,
    };
  } catch (error) {
    if (error instanceof Tier1ActivationError) {
      return {
        valid: false,
        issues: [
          {
            code: error.code,
            message: error.code,
          },
        ],
        preview: null,
      };
    }

    throw error;
  }
}

export async function finalizeTier1ActivationCode(args: {
  code: string;
  actorUserId: string;
}) {
  const snapshotInput = await buildTier1SnapshotInput(args.code, args.actorUserId);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const latestSnapshot = await tx.patientSnapshot.findFirst({
      where: { activationCodeId: snapshotInput.activation.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latestSnapshot?.version ?? 0) + 1;

    await tx.patientSnapshot.updateMany({
      where: {
        activationCodeId: snapshotInput.activation.id,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    const snapshot = await tx.patientSnapshot.create({
      data: {
        ...snapshotInput.data,
        version: nextVersion,
        isCurrent: true,
      },
    });

    const activationCode = await tx.activationCode.update({
      where: { id: snapshotInput.activation.id },
      data: {
        status: ActivationCodeStatus.FINALIZED,
        finalizedAt: now,
        packedAt: null,
        resetForReissueAt: null,
      },
      select: {
        id: true,
        code: true,
        status: true,
        clinicTag: true,
        productMode: true,
        finalizedAt: true,
        packedAt: true,
      },
    });

    return {
      activationCode,
      snapshot,
    };
  });
}

export async function markTier1ActivationCodePacked(args: {
  code: string;
}) {
  const activation = await prisma.activationCode.findUnique({
    where: { code: args.code },
    select: {
      id: true,
      code: true,
      status: true,
      clinicTag: true,
      productMode: true,
      batch: { select: { productMode: true } },
      patientSnapshots: {
        where: { isCurrent: true },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!activation) {
    throw new Tier1ActivationError("ACTIVATION_CODE_NOT_FOUND", 404);
  }

  const productMode = normalizeProductMode(
    activation.productMode ?? activation.batch?.productMode,
  );
  if (productMode !== TIER1_PRODUCT_MODE) {
    throw new Tier1ActivationError("NOT_TIER1_ACTIVATION_CODE", 409);
  }

  if (
    activation.status !== ActivationCodeStatus.FINALIZED &&
    activation.status !== ActivationCodeStatus.PACKED
  ) {
    throw new Tier1ActivationError("INVALID_STATE_TRANSITION", 409);
  }

  if (activation.patientSnapshots.length === 0) {
    throw new Tier1ActivationError("PATIENT_SNAPSHOT_REQUIRED", 409);
  }

  return prisma.activationCode.update({
    where: { id: activation.id },
    data: {
      status: ActivationCodeStatus.PACKED,
      packedAt: new Date(),
    },
    select: {
      id: true,
      code: true,
      status: true,
      clinicTag: true,
      productMode: true,
      finalizedAt: true,
      packedAt: true,
    },
  });
}

export async function resetTier1ActivationCodeForReissue(args: {
  code: string;
}) {
  const activation = await prisma.activationCode.findUnique({
    where: { code: args.code },
    select: {
      id: true,
      code: true,
      status: true,
      clinicTag: true,
      productMode: true,
      batch: { select: { productMode: true } },
    },
  });

  if (!activation) {
    throw new Tier1ActivationError("ACTIVATION_CODE_NOT_FOUND", 404);
  }

  const productMode = normalizeProductMode(
    activation.productMode ?? activation.batch?.productMode,
  );
  if (productMode !== TIER1_PRODUCT_MODE) {
    throw new Tier1ActivationError("NOT_TIER1_ACTIVATION_CODE", 409);
  }

  return prisma.$transaction(async (tx) => {
    await tx.patientSnapshot.updateMany({
      where: {
        activationCodeId: activation.id,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    return tx.activationCode.update({
      where: { id: activation.id },
      data: {
        status: ActivationCodeStatus.RESET_FOR_REISSUE,
        claimedByUserId: null,
        claimedAt: null,
        finalizedAt: null,
        packedAt: null,
        resetForReissueAt: new Date(),
      },
      select: {
        id: true,
        code: true,
        status: true,
        clinicTag: true,
        productMode: true,
        claimedAt: true,
        claimedByUserId: true,
        resetForReissueAt: true,
      },
    });
  });
}

export async function attachCurrentTier1SnapshotToPatient(args: {
  activationCodeId: string;
  patientUserId: string;
}) {
  await prisma.patientSnapshot.updateMany({
    where: {
      activationCodeId: args.activationCodeId,
      isCurrent: true,
      productMode: TIER1_PRODUCT_MODE,
    },
    data: {
      patientUserId: args.patientUserId,
    },
  });
}
