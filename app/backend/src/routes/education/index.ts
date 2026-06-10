import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  AuditCategory,
  AuditService,
  AuditStatus,
} from "../../services/AuditService.js";
import { EducationService } from "../../services/educationService.js";
import { RecoveryHelperService } from "../../services/recoveryHelperService.js";
import {
  createBoxTemplate,
  createCustomLibraryModule,
  createEducationBundle,
  getBoxTemplateById,
  getBoxTemplatePreviewPayload,
  getEducationBundleById,
  getEducationBundlePreviewPayload,
  getLibraryAdminPayload,
  getLibraryCategoryPayload,
  getLibraryGuidePayload,
  getLibraryHomePayload,
  getLibraryModuleById,
  LIBRARY_CATEGORY_KEYS,
  updateBoxTemplate,
  updateEducationBundle,
  upsertLibraryModule,
} from "../../services/recoveryLibraryService.js";

export const educationRouter = Router();

educationRouter.use(requireAuth);
educationRouter.use(
  requireRole([UserRole.PATIENT, UserRole.CLINIC, UserRole.OWNER])
);

const educationSearchQuerySchema = z.object({
  q: z.string().trim().min(2, "Query must be at least 2 characters"),
});

const libraryCategoryParamsSchema = z.object({
  categoryKey: z.enum(LIBRARY_CATEGORY_KEYS),
});

const libraryGuideParamsSchema = z.object({
  guideId: z.string().trim().min(1),
});

const libraryBundleParamsSchema = z.object({
  bundleId: z.string().trim().min(1),
});

const libraryBoxTemplateParamsSchema = z.object({
  boxTemplateId: z.string().trim().min(1),
});

const optionalUrlSchema = z.union([
  z.string().trim().url(),
  z.literal(""),
  z.undefined(),
]);

const optionalShortTextSchema = z.union([
  z.string().trim().max(80),
  z.literal(""),
  z.undefined(),
]);

const libraryAdminModuleSchema = z.object({
  title: z.string().trim().min(1).max(140),
  summary: z.string().trim().max(600).optional(),
  body: z.string().trim().min(1).max(12000),
  moduleType: z.enum(["education", "task", "milestone"]),
  videoUrl: optionalUrlSchema,
  thumbnailUrl: optionalUrlSchema,
  categories: z.array(z.enum(LIBRARY_CATEGORY_KEYS)).max(12).optional(),
  procedureNames: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  boxItemKeys: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  redFlags: z.array(z.string().trim().min(1).max(160)).max(25).optional(),
  requiredBoxItems: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  recommended: z.boolean().optional(),
  featured: z.boolean().optional(),
  recommendationLabel: optionalShortTextSchema,
  recommendationOrder: z.number().int().min(0).max(10000).nullable().optional(),
  active: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
});

const bundleModuleAssignmentSchema = z.object({
  moduleId: z.string().trim().min(1).max(160),
  recommended: z.boolean().optional(),
  featured: z.boolean().optional(),
  recommendationLabel: optionalShortTextSchema,
  recommendationOrder: z.number().int().min(0).max(10000).nullable().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
});

const boxTemplateModuleAssignmentSchema = z.object({
  moduleId: z.string().trim().min(1).max(160),
  recommended: z.boolean().optional(),
  recommendationLabel: optionalShortTextSchema,
  recommendationOrder: z.number().int().min(0).max(10000).nullable().optional(),
});

const libraryAdminBundleSchema = z.object({
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1200).optional(),
  clinicTag: z.string().trim().max(120).optional(),
  procedureName: z.string().trim().max(120).optional(),
  active: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
  modules: z.array(bundleModuleAssignmentSchema).max(200).optional(),
});

const libraryAdminBoxTemplateSchema = z.object({
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1200).optional(),
  boxItemKeys: z.array(z.string().trim().min(1).max(64)).max(100).optional(),
  active: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
  modules: z.array(boxTemplateModuleAssignmentSchema).max(200).optional(),
});

const RECOVERY_LIBRARY_STORAGE_NOT_READY_CODES = new Set(["P2021", "P2022"]);
const RECOVERY_LIBRARY_DATABASE_UNAVAILABLE_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
]);

function classifyRecoveryLibraryStorageError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (RECOVERY_LIBRARY_STORAGE_NOT_READY_CODES.has(error.code)) {
      return {
        status: 503,
        code: "RECOVERY_LIBRARY_STORAGE_NOT_READY",
        message:
          "Recovery library storage is not ready on this server yet. Apply Prisma migrations and restart the backend.",
      };
    }

    if (RECOVERY_LIBRARY_DATABASE_UNAVAILABLE_CODES.has(error.code)) {
      return {
        status: 503,
        code: "RECOVERY_LIBRARY_DATABASE_UNAVAILABLE",
        message:
          "Recovery library storage is temporarily unavailable. Please try again shortly.",
      };
    }
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return {
      status: 503,
      code: "RECOVERY_LIBRARY_DATABASE_UNAVAILABLE",
      message:
        "Recovery library storage is temporarily unavailable. Please try again shortly.",
    };
  }

  return null;
}

function getRecoveryLibraryPrismaDetails(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      prismaCode: error.code,
      prismaMeta: error.meta,
      prismaClientVersion: error.clientVersion,
    };
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return {
      prismaClientVersion: error.clientVersion,
    };
  }

  return {};
}

function logRecoveryLibraryAdminError(args: {
  action: "create" | "update";
  targetType: string;
  req: Parameters<typeof requireAuth>[0];
  input: Record<string, unknown>;
  targetId?: string;
  error: unknown;
}) {
  const { action, req, input, targetId, targetType, error } = args;

  console.error(`[recovery-library-admin] ${targetType} ${action} failed`, {
    method: req.method,
    path: req.originalUrl,
    targetId: targetId ?? null,
    targetType,
    actorUserId: req.user?.id ?? null,
    actorRole: req.user?.role ?? null,
    input,
    ...getRecoveryLibraryPrismaDetails(error),
    error,
  });
}

function buildModuleLogInput(input: z.infer<typeof libraryAdminModuleSchema>) {
  return {
    title: input.title,
    moduleType: input.moduleType,
    active: input.active ?? true,
    displayOrder: input.displayOrder ?? 0,
    categories: input.categories ?? [],
    procedureNames: input.procedureNames ?? [],
    boxItemKeys: input.boxItemKeys ?? [],
    recommended: input.recommended ?? false,
    featured: input.featured ?? false,
    recommendationLabel: input.recommendationLabel?.trim() || null,
    recommendationOrder: input.recommendationOrder ?? null,
    hasVideoUrl: Boolean(input.videoUrl?.trim()),
    hasThumbnailUrl: Boolean(input.thumbnailUrl?.trim()),
    bodyLength: input.body.length,
    summaryLength: input.summary?.length ?? 0,
  };
}

educationRouter.get("/library", async (req, res) => {
  const user = req.user!;

  try {
    const payload = await getLibraryHomePayload({
      userId: user.role === UserRole.PATIENT ? user.id : undefined,
    });

    await AuditService.log({
      req,
      category: AuditCategory.ACCESS,
      type: "RECOVERY_LIBRARY_VIEWED",
      status: AuditStatus.SUCCESS,
      userId: user.id,
      role: user.role,
      clinicTag: user.clinicTag,
      metadata: {
        categories: payload.categories.length,
      },
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Recovery library home failed", error);
    return res.status(500).json({
      code: "RECOVERY_LIBRARY_FAILED",
      message: "Failed to load the recovery library",
    });
  }
});

educationRouter.get("/library/categories/:categoryKey", async (req, res) => {
  const parsedParams = libraryCategoryParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res
      .status(400)
      .json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });
  }

  const user = req.user!;

  try {
    const payload = await getLibraryCategoryPayload({
      categoryKey: parsedParams.data.categoryKey,
      userId: user.role === UserRole.PATIENT ? user.id : undefined,
    });

    await AuditService.log({
      req,
      category: AuditCategory.ACCESS,
      type: "RECOVERY_LIBRARY_CATEGORY_VIEWED",
      status: AuditStatus.SUCCESS,
      userId: user.id,
      role: user.role,
      clinicTag: user.clinicTag,
      metadata: {
        categoryKey: parsedParams.data.categoryKey,
        resultCount: payload.guides.length,
      },
    });

    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "UNKNOWN_LIBRARY_CATEGORY") {
      return res.status(404).json({
        code: "RECOVERY_LIBRARY_CATEGORY_NOT_FOUND",
      });
    }

    console.error("Recovery library category failed", error);
    return res.status(500).json({
      code: "RECOVERY_LIBRARY_CATEGORY_FAILED",
      message: "Failed to load library category",
    });
  }
});

educationRouter.get("/library/guides/:guideId", async (req, res) => {
  const parsedParams = libraryGuideParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res
      .status(400)
      .json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });
  }

  const user = req.user!;

  try {
    const payload = await getLibraryGuidePayload({
      moduleId: parsedParams.data.guideId,
    });

    if (!payload) {
      return res.status(404).json({
        code: "RECOVERY_LIBRARY_GUIDE_NOT_FOUND",
      });
    }

    await AuditService.log({
      req,
      category: AuditCategory.ACCESS,
      type: "RECOVERY_LIBRARY_GUIDE_VIEWED",
      status: AuditStatus.SUCCESS,
      userId: user.id,
      role: user.role,
      clinicTag: user.clinicTag,
      metadata: {
        guideId: parsedParams.data.guideId,
      },
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Recovery library guide failed", error);
    return res.status(500).json({
      code: "RECOVERY_LIBRARY_GUIDE_FAILED",
      message: "Failed to load guide details",
    });
  }
});

educationRouter.get(
  "/library/admin",
  requireRole([UserRole.OWNER]),
  async (req, res) => {
    try {
      const payload = await getLibraryAdminPayload();
      return res.status(200).json(payload);
    } catch (error) {
      console.error("Recovery library admin load failed", error);
      return res.status(500).json({
        code: "RECOVERY_LIBRARY_ADMIN_FAILED",
        message: "Failed to load library admin data",
      });
    }
  }
);

educationRouter.post(
  "/library/admin/modules",
  requireRole([UserRole.OWNER]),
  async (req, res) => {
    const parsedBody = libraryAdminModuleSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedBody.error.issues });
    }

    const user = req.user!;

    try {
      const module = await createCustomLibraryModule(parsedBody.data);

      await AuditService.log({
        req,
        category: AuditCategory.ADMIN,
        type: "RECOVERY_LIBRARY_MODULE_CREATED",
        status: AuditStatus.SUCCESS,
        userId: user.id,
        role: user.role,
        clinicTag: user.clinicTag,
        targetId: module.id,
        targetType: "RecoveryLibraryModule",
      });

      return res.status(201).json({ module });
    } catch (error) {
      logRecoveryLibraryAdminError({
        action: "create",
        targetType: "RecoveryLibraryModule",
        req,
        input: buildModuleLogInput(parsedBody.data),
        error,
      });
      const storageResponse = classifyRecoveryLibraryStorageError(error);
      if (storageResponse) {
        return res.status(storageResponse.status).json(storageResponse);
      }
      return res.status(500).json({
        code: "RECOVERY_LIBRARY_MODULE_CREATE_FAILED",
        message: "Failed to create guide",
      });
    }
  }
);

educationRouter.put(
  "/library/admin/modules/:guideId",
  requireRole([UserRole.OWNER]),
  async (req, res) => {
    const parsedParams = libraryGuideParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });
    }

    const parsedBody = libraryAdminModuleSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedBody.error.issues });
    }

    const existingModule = await getLibraryModuleById(parsedParams.data.guideId, {
      includeInactive: true,
    });

    if (!existingModule) {
      return res.status(404).json({
        code: "RECOVERY_LIBRARY_GUIDE_NOT_FOUND",
      });
    }

    const user = req.user!;

    try {
      const module = await upsertLibraryModule(
        parsedParams.data.guideId,
        parsedBody.data
      );

      await AuditService.log({
        req,
        category: AuditCategory.ADMIN,
        type: "RECOVERY_LIBRARY_MODULE_UPDATED",
        status: AuditStatus.SUCCESS,
        userId: user.id,
        role: user.role,
        clinicTag: user.clinicTag,
        targetId: module.id,
        targetType: "RecoveryLibraryModule",
      });

      return res.status(200).json({ module });
    } catch (error) {
      logRecoveryLibraryAdminError({
        action: "update",
        targetType: "RecoveryLibraryModule",
        req,
        targetId: parsedParams.data.guideId,
        input: buildModuleLogInput(parsedBody.data),
        error,
      });
      const storageResponse = classifyRecoveryLibraryStorageError(error);
      if (storageResponse) {
        return res.status(storageResponse.status).json(storageResponse);
      }
      return res.status(500).json({
        code: "RECOVERY_LIBRARY_MODULE_UPDATE_FAILED",
        message: "Failed to save guide",
      });
    }
  }
);

educationRouter.post(
  "/library/admin/bundles",
  requireRole([UserRole.OWNER]),
  async (req, res) => {
    const parsedBody = libraryAdminBundleSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedBody.error.issues });
    }

    const user = req.user!;

    try {
      const bundle = await createEducationBundle(parsedBody.data);

      await AuditService.log({
        req,
        category: AuditCategory.ADMIN,
        type: "RECOVERY_LIBRARY_BUNDLE_CREATED",
        status: AuditStatus.SUCCESS,
        userId: user.id,
        role: user.role,
        clinicTag: user.clinicTag,
        targetId: bundle.id,
        targetType: "EducationBundle",
      });

      return res.status(201).json({ bundle });
    } catch (error) {
      logRecoveryLibraryAdminError({
        action: "create",
        targetType: "EducationBundle",
        req,
        input: {
          name: parsedBody.data.name,
          procedureName: parsedBody.data.procedureName ?? null,
          active: parsedBody.data.active ?? true,
          displayOrder: parsedBody.data.displayOrder ?? 0,
          moduleCount: parsedBody.data.modules?.length ?? 0,
        },
        error,
      });

      if (
        error instanceof Error &&
        error.message.startsWith("UNKNOWN_LIBRARY_MODULE:")
      ) {
        return res.status(400).json({
          code: "RECOVERY_LIBRARY_UNKNOWN_MODULE",
          message: "One or more selected guides are not available in the library.",
        });
      }

      const storageResponse = classifyRecoveryLibraryStorageError(error);
      if (storageResponse) {
        return res.status(storageResponse.status).json(storageResponse);
      }

      return res.status(500).json({
        code: "RECOVERY_LIBRARY_BUNDLE_CREATE_FAILED",
        message: "Failed to create education bundle",
      });
    }
  }
);

educationRouter.put(
  "/library/admin/bundles/:bundleId",
  requireRole([UserRole.OWNER]),
  async (req, res) => {
    const parsedParams = libraryBundleParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });
    }

    const parsedBody = libraryAdminBundleSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedBody.error.issues });
    }

    const existingBundle = await getEducationBundleById(parsedParams.data.bundleId, {
      includeInactive: true,
    });

    if (!existingBundle) {
      return res.status(404).json({
        code: "RECOVERY_LIBRARY_BUNDLE_NOT_FOUND",
      });
    }

    const user = req.user!;

    try {
      const bundle = await updateEducationBundle(
        parsedParams.data.bundleId,
        parsedBody.data
      );

      await AuditService.log({
        req,
        category: AuditCategory.ADMIN,
        type: "RECOVERY_LIBRARY_BUNDLE_UPDATED",
        status: AuditStatus.SUCCESS,
        userId: user.id,
        role: user.role,
        clinicTag: user.clinicTag,
        targetId: bundle.id,
        targetType: "EducationBundle",
      });

      return res.status(200).json({ bundle });
    } catch (error) {
      logRecoveryLibraryAdminError({
        action: "update",
        targetType: "EducationBundle",
        req,
        targetId: parsedParams.data.bundleId,
        input: {
          name: parsedBody.data.name,
          procedureName: parsedBody.data.procedureName ?? null,
          active: parsedBody.data.active ?? true,
          displayOrder: parsedBody.data.displayOrder ?? 0,
          moduleCount: parsedBody.data.modules?.length ?? 0,
        },
        error,
      });

      if (
        error instanceof Error &&
        error.message.startsWith("UNKNOWN_LIBRARY_MODULE:")
      ) {
        return res.status(400).json({
          code: "RECOVERY_LIBRARY_UNKNOWN_MODULE",
          message: "One or more selected guides are not available in the library.",
        });
      }

      const storageResponse = classifyRecoveryLibraryStorageError(error);
      if (storageResponse) {
        return res.status(storageResponse.status).json(storageResponse);
      }

      return res.status(500).json({
        code: "RECOVERY_LIBRARY_BUNDLE_UPDATE_FAILED",
        message: "Failed to save education bundle",
      });
    }
  }
);

educationRouter.get(
  "/library/admin/bundles/:bundleId/preview",
  requireRole([UserRole.OWNER]),
  async (req, res) => {
    const parsedParams = libraryBundleParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });
    }

    try {
      const payload = await getEducationBundlePreviewPayload({
        bundleId: parsedParams.data.bundleId,
      });

      if (!payload) {
        return res.status(404).json({
          code: "RECOVERY_LIBRARY_BUNDLE_NOT_FOUND",
        });
      }

      return res.status(200).json(payload);
    } catch (error) {
      console.error("Recovery library bundle preview failed", error);
      return res.status(500).json({
        code: "RECOVERY_LIBRARY_BUNDLE_PREVIEW_FAILED",
        message: "Failed to load education bundle preview",
      });
    }
  }
);

educationRouter.post(
  "/library/admin/box-templates",
  requireRole([UserRole.OWNER]),
  async (req, res) => {
    const parsedBody = libraryAdminBoxTemplateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedBody.error.issues });
    }

    const user = req.user!;

    try {
      const boxTemplate = await createBoxTemplate(parsedBody.data);

      await AuditService.log({
        req,
        category: AuditCategory.ADMIN,
        type: "RECOVERY_LIBRARY_BOX_TEMPLATE_CREATED",
        status: AuditStatus.SUCCESS,
        userId: user.id,
        role: user.role,
        clinicTag: user.clinicTag,
        targetId: boxTemplate.id,
        targetType: "BoxTemplate",
      });

      return res.status(201).json({ boxTemplate });
    } catch (error) {
      logRecoveryLibraryAdminError({
        action: "create",
        targetType: "BoxTemplate",
        req,
        input: {
          name: parsedBody.data.name,
          active: parsedBody.data.active ?? true,
          displayOrder: parsedBody.data.displayOrder ?? 0,
          boxItemKeys: parsedBody.data.boxItemKeys ?? [],
          moduleCount: parsedBody.data.modules?.length ?? 0,
        },
        error,
      });

      if (
        error instanceof Error &&
        error.message.startsWith("UNKNOWN_LIBRARY_MODULE:")
      ) {
        return res.status(400).json({
          code: "RECOVERY_LIBRARY_UNKNOWN_MODULE",
          message: "One or more selected guides are not available in the library.",
        });
      }

      const storageResponse = classifyRecoveryLibraryStorageError(error);
      if (storageResponse) {
        return res.status(storageResponse.status).json(storageResponse);
      }

      return res.status(500).json({
        code: "RECOVERY_LIBRARY_BOX_TEMPLATE_CREATE_FAILED",
        message: "Failed to create box template",
      });
    }
  }
);

educationRouter.put(
  "/library/admin/box-templates/:boxTemplateId",
  requireRole([UserRole.OWNER]),
  async (req, res) => {
    const parsedParams = libraryBoxTemplateParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });
    }

    const parsedBody = libraryAdminBoxTemplateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedBody.error.issues });
    }

    const existingTemplate = await getBoxTemplateById(
      parsedParams.data.boxTemplateId,
      {
        includeInactive: true,
      }
    );

    if (!existingTemplate) {
      return res.status(404).json({
        code: "RECOVERY_LIBRARY_BOX_TEMPLATE_NOT_FOUND",
      });
    }

    const user = req.user!;

    try {
      const boxTemplate = await updateBoxTemplate(
        parsedParams.data.boxTemplateId,
        parsedBody.data
      );

      await AuditService.log({
        req,
        category: AuditCategory.ADMIN,
        type: "RECOVERY_LIBRARY_BOX_TEMPLATE_UPDATED",
        status: AuditStatus.SUCCESS,
        userId: user.id,
        role: user.role,
        clinicTag: user.clinicTag,
        targetId: boxTemplate.id,
        targetType: "BoxTemplate",
      });

      return res.status(200).json({ boxTemplate });
    } catch (error) {
      logRecoveryLibraryAdminError({
        action: "update",
        targetType: "BoxTemplate",
        req,
        targetId: parsedParams.data.boxTemplateId,
        input: {
          name: parsedBody.data.name,
          active: parsedBody.data.active ?? true,
          displayOrder: parsedBody.data.displayOrder ?? 0,
          boxItemKeys: parsedBody.data.boxItemKeys ?? [],
          moduleCount: parsedBody.data.modules?.length ?? 0,
        },
        error,
      });

      if (
        error instanceof Error &&
        error.message.startsWith("UNKNOWN_LIBRARY_MODULE:")
      ) {
        return res.status(400).json({
          code: "RECOVERY_LIBRARY_UNKNOWN_MODULE",
          message: "One or more selected guides are not available in the library.",
        });
      }

      const storageResponse = classifyRecoveryLibraryStorageError(error);
      if (storageResponse) {
        return res.status(storageResponse.status).json(storageResponse);
      }

      return res.status(500).json({
        code: "RECOVERY_LIBRARY_BOX_TEMPLATE_UPDATE_FAILED",
        message: "Failed to save box template",
      });
    }
  }
);

educationRouter.get(
  "/library/admin/box-templates/:boxTemplateId/preview",
  requireRole([UserRole.OWNER]),
  async (req, res) => {
    const parsedParams = libraryBoxTemplateParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res
        .status(400)
        .json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });
    }

    try {
      const payload = await getBoxTemplatePreviewPayload({
        boxTemplateId: parsedParams.data.boxTemplateId,
      });

      if (!payload) {
        return res.status(404).json({
          code: "RECOVERY_LIBRARY_BOX_TEMPLATE_NOT_FOUND",
        });
      }

      return res.status(200).json(payload);
    } catch (error) {
      console.error("Recovery library box template preview failed", error);
      return res.status(500).json({
        code: "RECOVERY_LIBRARY_BOX_TEMPLATE_PREVIEW_FAILED",
        message: "Failed to load box template preview",
      });
    }
  }
);

educationRouter.get("/search", async (req, res) => {
  const parsedQuery = educationSearchQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res
      .status(400)
      .json({ code: "VALIDATION_ERROR", issues: parsedQuery.error.issues });
  }

  const query = parsedQuery.data.q;
  const user = req.user!;

  try {
    const result = await EducationService.search(query);

    AuditService.log({
      req,
      category: AuditCategory.ACCESS,
      type: "EDUCATION_SEARCHED",
      status: AuditStatus.SUCCESS,
      userId: user.id,
      role: user.role,
      clinicTag: user.clinicTag,
      metadata: {
        query,
        resultCount: result.articles.length,
        cached: result.cached,
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Education search failed", error);

    AuditService.log({
      req,
      category: AuditCategory.ACCESS,
      type: "EDUCATION_SEARCH_FAILED",
      status: AuditStatus.FAILURE,
      userId: user.id,
      role: user.role,
      clinicTag: user.clinicTag,
      metadata: {
        query,
      },
    });

    return res.status(500).json({
      code: "EDUCATION_SEARCH_FAILED",
      message: "Failed to load education articles",
    });
  }
});

educationRouter.get("/helper/search", async (req, res) => {
  const parsedQuery = educationSearchQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res
      .status(400)
      .json({ code: "VALIDATION_ERROR", issues: parsedQuery.error.issues });
  }

  const query = parsedQuery.data.q;
  const user = req.user!;

  try {
    const result = await RecoveryHelperService.search(query);

    AuditService.log({
      req,
      category: AuditCategory.ACCESS,
      type: "RECOVERY_HELPER_SEARCHED",
      status: AuditStatus.SUCCESS,
      userId: user.id,
      role: user.role,
      clinicTag: user.clinicTag,
      metadata: {
        query,
        resultCount: result.results.length,
        blocked: result.blocked,
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Recovery helper search failed", error);

    AuditService.log({
      req,
      category: AuditCategory.ACCESS,
      type: "RECOVERY_HELPER_SEARCH_FAILED",
      status: AuditStatus.FAILURE,
      userId: user.id,
      role: user.role,
      clinicTag: user.clinicTag,
      metadata: {
        query,
      },
    });

    return res.status(500).json({
      code: "RECOVERY_HELPER_SEARCH_FAILED",
      message: "Failed to load recovery helper content",
    });
  }
});
