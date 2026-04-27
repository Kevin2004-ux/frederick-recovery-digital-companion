import bcrypt from "bcryptjs";
import { Prisma, ActivationCodeStatus, UserRole } from "@prisma/client";
import { Request, Response, Router } from "express";
import { z } from "zod";

import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  AuditCategory,
  AuditService,
  AuditStatus,
} from "../../services/AuditService.js";
import { toCsv } from "../../utils/csv.js";

export const ownerRouter = Router();

ownerRouter.use(requireAuth);
ownerRouter.use(requireRole([UserRole.OWNER]));

const ClinicTagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9_-]+$/, "clinicTag must use only lowercase letters, numbers, hyphen, or underscore");

const CreateOwnerClinicSchema = z.object({
  clinicTag: ClinicTagSchema,
  clinicName: z.string().trim().min(1).max(120),
  adminEmail: z.string().trim().toLowerCase().email(),
  temporaryPassword: z.string().min(8),
  requireMfa: z.boolean().optional(),
});

const CreateClinicUserSchema = z.object({
  clinicTag: ClinicTagSchema,
  email: z.string().trim().toLowerCase().email(),
  temporaryPassword: z.string().min(8),
  requireMfa: z.boolean().optional(),
});

const ResetClinicUserPasswordSchema = z.object({
  temporaryPassword: z.string().min(8),
});

const UserIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

const ListClinicCodesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  status: z.nativeEnum(ActivationCodeStatus).optional(),
});

type ClinicSummaryCounts = {
  adminUserCount: number;
  batchCount: number;
  totalCodes: number;
  issuedCodes: number;
  draftCodes: number;
  approvedCodes: number;
  claimedCodes: number;
  invalidatedCodes: number;
  patientCount: number;
};

type BatchCodeCounts = Omit<ClinicSummaryCounts, "adminUserCount" | "batchCount" | "patientCount">;

class OwnerClinicConflictError extends Error {
  statusCode: number;
  code: string;

  constructor(code: string, statusCode = 409) {
    super(code);
    this.name = "OwnerClinicConflictError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

class OwnerClinicUserError extends Error {
  statusCode: number;
  code: string;

  constructor(code: string, statusCode: number) {
    super(code);
    this.name = "OwnerClinicUserError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function makeClinicSummaryCounts(): ClinicSummaryCounts {
  return {
    adminUserCount: 0,
    batchCount: 0,
    totalCodes: 0,
    issuedCodes: 0,
    draftCodes: 0,
    approvedCodes: 0,
    claimedCodes: 0,
    invalidatedCodes: 0,
    patientCount: 0,
  };
}

function makeBatchCodeCounts(): BatchCodeCounts {
  return {
    totalCodes: 0,
    issuedCodes: 0,
    draftCodes: 0,
    approvedCodes: 0,
    claimedCodes: 0,
    invalidatedCodes: 0,
  };
}

function readCountAll(row: { _count: { _all: number } }) {
  return typeof row?._count?._all === "number" ? row._count._all : 0;
}

function applyActivationStatusCounts(
  target: {
    totalCodes: number;
    issuedCodes: number;
    draftCodes: number;
    approvedCodes: number;
    claimedCodes: number;
    invalidatedCodes: number;
  },
  status: ActivationCodeStatus,
  count: number,
) {
  target.totalCodes += count;

  if (status === ActivationCodeStatus.ISSUED) target.issuedCodes += count;
  if (status === ActivationCodeStatus.DRAFT) target.draftCodes += count;
  if (status === ActivationCodeStatus.APPROVED) target.approvedCodes += count;
  if (status === ActivationCodeStatus.CLAIMED) target.claimedCodes += count;
  if (status === ActivationCodeStatus.INVALIDATED) target.invalidatedCodes += count;
}

async function buildClinicSummaryByTag(clinicTags: string[]) {
  const uniqueClinicTags = [...new Set(clinicTags.filter(Boolean))];
  const summaryByTag = new Map<string, ClinicSummaryCounts>();

  for (const clinicTag of uniqueClinicTags) {
    summaryByTag.set(clinicTag, makeClinicSummaryCounts());
  }

  if (uniqueClinicTags.length === 0) {
    return summaryByTag;
  }

  const [adminCounts, batchCounts, codeStatusCounts, patientCounts] = await Promise.all([
    prisma.user.groupBy({
      by: ["clinicTag"],
      where: {
        role: UserRole.CLINIC,
        clinicTag: { in: uniqueClinicTags },
      },
      _count: { _all: true },
    }),
    prisma.activationBatch.groupBy({
      by: ["clinicTag"],
      where: {
        clinicTag: { in: uniqueClinicTags },
      },
      _count: { _all: true },
    }),
    prisma.activationCode.groupBy({
      by: ["clinicTag", "status"],
      where: {
        clinicTag: { in: uniqueClinicTags },
      },
      _count: { _all: true },
    }),
    prisma.activationCode.groupBy({
      by: ["clinicTag"],
      where: {
        clinicTag: { in: uniqueClinicTags },
        claimedByUserId: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  for (const row of adminCounts) {
    if (!row.clinicTag) continue;
    const current = summaryByTag.get(row.clinicTag) ?? makeClinicSummaryCounts();
    current.adminUserCount = readCountAll(row);
    summaryByTag.set(row.clinicTag, current);
  }

  for (const row of batchCounts) {
    if (!row.clinicTag) continue;
    const current = summaryByTag.get(row.clinicTag) ?? makeClinicSummaryCounts();
    current.batchCount = readCountAll(row);
    summaryByTag.set(row.clinicTag, current);
  }

  for (const row of codeStatusCounts) {
    if (!row.clinicTag) continue;
    const current = summaryByTag.get(row.clinicTag) ?? makeClinicSummaryCounts();
    applyActivationStatusCounts(current, row.status, readCountAll(row));
    summaryByTag.set(row.clinicTag, current);
  }

  for (const row of patientCounts) {
    if (!row.clinicTag) continue;
    const current = summaryByTag.get(row.clinicTag) ?? makeClinicSummaryCounts();
    current.patientCount = readCountAll(row);
    summaryByTag.set(row.clinicTag, current);
  }

  return summaryByTag;
}

async function buildBatchCountsByBatchId(batchIds: string[]) {
  const countsByBatchId = new Map<string, BatchCodeCounts>();

  if (batchIds.length === 0) {
    return countsByBatchId;
  }

  const rows = await prisma.activationCode.groupBy({
    by: ["batchId", "status"],
    where: {
      batchId: { in: batchIds },
    },
    _count: { _all: true },
  });

  for (const row of rows) {
    if (!row.batchId) continue;
    const current = countsByBatchId.get(row.batchId) ?? makeBatchCodeCounts();
    applyActivationStatusCounts(current, row.status, readCountAll(row));
    countsByBatchId.set(row.batchId, current);
  }

  return countsByBatchId;
}

function toIncludedItems(value: Prisma.JsonValue | null) {
  return Array.isArray(value) ? value : [];
}

const clinicUserSelect = {
  id: true,
  email: true,
  role: true,
  clinicTag: true,
  mfaEnabled: true,
  isBanned: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type SafeClinicUser = Prisma.UserGetPayload<{
  select: typeof clinicUserSelect;
}>;

type SafeCodeRecord = {
  code: string;
  status: ActivationCodeStatus;
  clinicTag: string | null;
  batchId: string | null;
  createdAt: Date;
  claimedAt: Date | null;
  claimedByUserId: string | null;
  batch: {
    boxType: string | null;
    createdAt: Date;
  } | null;
};

function sortCodeRecords(records: SafeCodeRecord[]) {
  return [...records].sort((left, right) => {
    const leftBatchCreatedAt = left.batch?.createdAt?.getTime() ?? 0;
    const rightBatchCreatedAt = right.batch?.createdAt?.getTime() ?? 0;

    if (leftBatchCreatedAt !== rightBatchCreatedAt) {
      return rightBatchCreatedAt - leftBatchCreatedAt;
    }

    const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return left.code.localeCompare(right.code);
  });
}

async function getClinicOr404(clinicTag: string) {
  return prisma.clinicPlanConfig.findUnique({
    where: { clinicTag },
    select: {
      clinicTag: true,
      name: true,
      defaultCategory: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

function toSafeClinicUserResponse(user: SafeClinicUser) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    clinicTag: user.clinicTag,
    mfaEnabled: user.mfaEnabled,
    isBanned: user.isBanned,
    lockedUntil: user.lockedUntil,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function getClinicUserOrThrow(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: clinicUserSelect,
  });

  if (!user) {
    throw new OwnerClinicUserError("NOT_FOUND", 404);
  }

  if (user.role !== UserRole.CLINIC) {
    throw new OwnerClinicUserError("TARGET_NOT_CLINIC_USER", 400);
  }

  return user;
}

async function getClinicCodes(args: {
  clinicTag: string;
  limit?: number;
  status?: ActivationCodeStatus;
}) {
  const codes = await prisma.activationCode.findMany({
    where: {
      clinicTag: args.clinicTag,
      ...(args.status ? { status: args.status } : {}),
    },
    take: args.limit,
    select: {
      code: true,
      status: true,
      clinicTag: true,
      batchId: true,
      createdAt: true,
      claimedAt: true,
      claimedByUserId: true,
      batch: {
        select: {
          boxType: true,
          createdAt: true,
        },
      },
    },
  });

  return sortCodeRecords(codes);
}

async function getClinicActivitySummary(clinicTag: string) {
  const claimedCodesWhere: Prisma.ActivationCodeWhereInput = {
    clinicTag,
    OR: [
      { status: ActivationCodeStatus.CLAIMED },
      { claimedByUserId: { not: null } },
    ],
  };

  const [claimedCodesCount, claimedByUsers, recoveryPlansCount, operationalAlertsCount, reminderOutboxCount] =
    await Promise.all([
      prisma.activationCode.count({
        where: claimedCodesWhere,
      }),
      prisma.activationCode.findMany({
        where: {
          clinicTag,
          claimedByUserId: { not: null },
        },
        select: {
          claimedByUserId: true,
        },
        distinct: ["claimedByUserId"],
      }),
      prisma.recoveryPlanInstance.count({
        where: {
          activationCode: {
            clinicTag,
          },
        },
      }),
      prisma.operationalAlert.count({
        where: { clinicTag },
      }),
      prisma.reminderOutbox.count({
        where: { clinicTag },
      }),
    ]);

  const patientUserIds = claimedByUsers
    .map((entry) => entry.claimedByUserId)
    .filter((value): value is string => Boolean(value));

  const logEntriesCount =
    patientUserIds.length > 0
      ? await prisma.logEntry.count({
          where: {
            userId: { in: patientUserIds },
          },
        })
      : 0;

  return {
    claimedCodesCount,
    patientUserIds,
    logEntriesCount,
    recoveryPlansCount,
    operationalAlertsCount,
    reminderOutboxCount,
  };
}

ownerRouter.post("/clinics", async (req: Request, res: Response) => {
  const parsed = CreateOwnerClinicSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const {
    clinicTag,
    clinicName,
    adminEmail,
    temporaryPassword,
    requireMfa = false,
  } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: adminEmail },
        select: {
          id: true,
          email: true,
          role: true,
          clinicTag: true,
        },
      });

      if (existingUser) {
        if (
          existingUser.role === UserRole.CLINIC &&
          existingUser.clinicTag === clinicTag
        ) {
          throw new OwnerClinicConflictError("CLINIC_ADMIN_ALREADY_EXISTS");
        }

        throw new OwnerClinicConflictError("EMAIL_ALREADY_EXISTS");
      }

      const clinic = await tx.clinicPlanConfig.upsert({
        where: { clinicTag },
        update: {
          name: clinicName,
        },
        create: {
          clinicTag,
          name: clinicName,
          defaultCategory: "general_outpatient",
        },
        select: {
          clinicTag: true,
          name: true,
        },
      });

      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          role: UserRole.CLINIC,
          clinicTag,
          failedLoginAttempts: 0,
          isBanned: false,
          mfaEnabled: false,
          emailVerifiedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          role: true,
          clinicTag: true,
          mfaEnabled: true,
        },
      });

      return { clinic, adminUser };
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_CLINIC_CREATED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag: result.clinic.clinicTag,
      targetId: result.clinic.clinicTag,
      targetType: "ClinicPlanConfig",
      metadata: {
        adminUserId: result.adminUser.id,
        adminEmail: result.adminUser.email,
        requireMfa,
      },
    });

    return res.status(201).json({
      clinic: {
        clinicTag: result.clinic.clinicTag,
        name: result.clinic.name,
      },
      adminUser: {
        ...result.adminUser,
        mfaRequired: requireMfa,
      },
    });
  } catch (err) {
    if (err instanceof OwnerClinicConflictError) {
      return res.status(err.statusCode).json({ code: err.code });
    }

    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({ code: "EMAIL_ALREADY_EXISTS" });
    }

    console.error("[OWNER_CLINIC_CREATE_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.post("/clinic-users", async (req: Request, res: Response) => {
  const parsed = CreateClinicUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { clinicTag, email, temporaryPassword, requireMfa = false } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinicPlanConfig.findUnique({
        where: { clinicTag },
        select: { clinicTag: true },
      });

      if (!clinic) {
        throw new OwnerClinicUserError("CLINIC_NOT_FOUND", 404);
      }

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        throw new OwnerClinicUserError("EMAIL_ALREADY_EXISTS", 409);
      }

      return tx.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.CLINIC,
          clinicTag,
          mfaEnabled: false,
          isBanned: false,
          failedLoginAttempts: 0,
          emailVerifiedAt: new Date(),
        },
        select: clinicUserSelect,
      });
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_CLINIC_USER_CREATED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag: user.clinicTag,
      targetId: user.id,
      targetType: "User",
      metadata: {
        clinicTag: user.clinicTag,
        createdUserId: user.id,
        email: user.email,
        requireMfa,
      },
    });

    return res.status(201).json({ user: toSafeClinicUserResponse(user) });
  } catch (err) {
    if (err instanceof OwnerClinicUserError) {
      return res.status(err.statusCode).json({ code: err.code });
    }

    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({ code: "EMAIL_ALREADY_EXISTS" });
    }

    console.error("[OWNER_CLINIC_USER_CREATE_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.post("/clinic-users/:userId/reset-password", async (req: Request, res: Response) => {
  const parsedParams = UserIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });
  }

  const parsedBody = ResetClinicUserPasswordSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedBody.error.issues });
  }

  try {
    const existingUser = await getClinicUserOrThrow(parsedParams.data.userId);
    const passwordHash = await bcrypt.hash(parsedBody.data.temporaryPassword, 10);

    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: clinicUserSelect,
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_CLINIC_USER_PASSWORD_RESET",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag: user.clinicTag,
      targetId: user.id,
      targetType: "User",
      metadata: {
        targetUserId: user.id,
        clinicTag: user.clinicTag,
        email: user.email,
      },
    });

    return res.status(200).json({ user: toSafeClinicUserResponse(user) });
  } catch (err) {
    if (err instanceof OwnerClinicUserError) {
      return res.status(err.statusCode).json({ code: err.code });
    }

    console.error("[OWNER_CLINIC_USER_PASSWORD_RESET_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.post("/clinic-users/:userId/disable", async (req: Request, res: Response) => {
  const parsedParams = UserIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });
  }

  try {
    const existingUser = await getClinicUserOrThrow(parsedParams.data.userId);

    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        isBanned: true,
        tokenVersion: { increment: 1 },
      },
      select: clinicUserSelect,
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_CLINIC_USER_DISABLED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag: user.clinicTag,
      targetId: user.id,
      targetType: "User",
      metadata: {
        targetUserId: user.id,
        clinicTag: user.clinicTag,
        email: user.email,
      },
    });

    return res.status(200).json({ user: toSafeClinicUserResponse(user) });
  } catch (err) {
    if (err instanceof OwnerClinicUserError) {
      return res.status(err.statusCode).json({ code: err.code });
    }

    console.error("[OWNER_CLINIC_USER_DISABLE_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.post("/clinic-users/:userId/enable", async (req: Request, res: Response) => {
  const parsedParams = UserIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });
  }

  try {
    const existingUser = await getClinicUserOrThrow(parsedParams.data.userId);

    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        isBanned: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 },
      },
      select: clinicUserSelect,
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_CLINIC_USER_ENABLED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag: user.clinicTag,
      targetId: user.id,
      targetType: "User",
      metadata: {
        targetUserId: user.id,
        clinicTag: user.clinicTag,
        email: user.email,
      },
    });

    return res.status(200).json({ user: toSafeClinicUserResponse(user) });
  } catch (err) {
    if (err instanceof OwnerClinicUserError) {
      return res.status(err.statusCode).json({ code: err.code });
    }

    console.error("[OWNER_CLINIC_USER_ENABLE_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.get("/clinics", async (req: Request, res: Response) => {
  try {
    const clinics = await prisma.clinicPlanConfig.findMany({
      orderBy: [
        { updatedAt: "desc" },
        { clinicTag: "asc" },
      ],
      select: {
        clinicTag: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const clinicTags = clinics.map((clinic) => clinic.clinicTag);
    const summaryByTag = await buildClinicSummaryByTag(clinicTags);

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_CLINICS_LISTED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      metadata: {
        count: clinics.length,
      },
    });

    return res.status(200).json({
      clinics: clinics.map((clinic) => {
        const summary = summaryByTag.get(clinic.clinicTag) ?? makeClinicSummaryCounts();

        return {
          clinicTag: clinic.clinicTag,
          name: clinic.name,
          createdAt: clinic.createdAt,
          updatedAt: clinic.updatedAt,
          adminUserCount: summary.adminUserCount,
          batchCount: summary.batchCount,
          totalCodes: summary.totalCodes,
          issuedCodes: summary.issuedCodes,
          draftCodes: summary.draftCodes,
          approvedCodes: summary.approvedCodes,
          claimedCodes: summary.claimedCodes,
          invalidatedCodes: summary.invalidatedCodes,
          patientCount: summary.patientCount,
        };
      }),
    });
  } catch (err) {
    console.error("[OWNER_CLINICS_LIST_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.post("/clinics/:clinicTag/deactivate", async (req: Request, res: Response) => {
  const parsedTag = ClinicTagSchema.safeParse(req.params.clinicTag);
  if (!parsedTag.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedTag.error.issues });
  }

  const clinicTag = parsedTag.data;

  try {
    const clinic = await getClinicOr404(clinicTag);
    if (!clinic) {
      return res.status(404).json({ code: "NOT_FOUND" });
    }

    const claimedCodesPreservedCount = await prisma.activationCode.count({
      where: {
        clinicTag,
        OR: [
          { status: ActivationCodeStatus.CLAIMED },
          { claimedByUserId: { not: null } },
        ],
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      const disabledClinicUsers = await tx.user.updateMany({
        where: {
          role: UserRole.CLINIC,
          clinicTag,
        },
        data: {
          isBanned: true,
          tokenVersion: { increment: 1 },
        },
      });

      const invalidatedCodes = await tx.activationCode.updateMany({
        where: {
          clinicTag,
          status: {
            in: [
              ActivationCodeStatus.ISSUED,
              ActivationCodeStatus.DRAFT,
              ActivationCodeStatus.APPROVED,
            ],
          },
        },
        data: {
          status: ActivationCodeStatus.INVALIDATED,
        },
      });

      return {
        disabledClinicUsersCount: disabledClinicUsers.count,
        invalidatedCodesCount: invalidatedCodes.count,
      };
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_CLINIC_DEACTIVATED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag,
      targetId: clinicTag,
      targetType: "ClinicPlanConfig",
      metadata: {
        clinicTag,
        disabledClinicUsersCount: result.disabledClinicUsersCount,
        invalidatedCodesCount: result.invalidatedCodesCount,
        claimedCodesPreservedCount,
      },
    });

    return res.status(200).json({
      ok: true,
      clinicTag,
      disabledClinicUsersCount: result.disabledClinicUsersCount,
      invalidatedCodesCount: result.invalidatedCodesCount,
      claimedCodesPreservedCount,
    });
  } catch (err) {
    console.error("[OWNER_CLINIC_DEACTIVATE_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.delete("/clinics/:clinicTag", async (req: Request, res: Response) => {
  const parsedTag = ClinicTagSchema.safeParse(req.params.clinicTag);
  if (!parsedTag.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedTag.error.issues });
  }

  const clinicTag = parsedTag.data;

  try {
    const clinic = await getClinicOr404(clinicTag);
    if (!clinic) {
      return res.status(404).json({ code: "NOT_FOUND" });
    }

    const activity = await getClinicActivitySummary(clinicTag);

    if (
      activity.claimedCodesCount > 0 ||
      activity.logEntriesCount > 0 ||
      activity.recoveryPlansCount > 0 ||
      activity.operationalAlertsCount > 0 ||
      activity.reminderOutboxCount > 0
    ) {
      const activityPayload = {
        claimedCodesCount: activity.claimedCodesCount,
        logEntriesCount: activity.logEntriesCount,
        recoveryPlansCount: activity.recoveryPlansCount,
        operationalAlertsCount: activity.operationalAlertsCount,
        reminderOutboxCount: activity.reminderOutboxCount,
      };

      return res.status(409).json({
        code: "CLINIC_HAS_ACTIVITY",
        message: "Clinic has patient activity. Use deactivate instead.",
        activity: activityPayload,
        issues: activityPayload,
      });
    }

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_TEST_CLINIC_DELETE_APPROVED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag,
      targetId: clinicTag,
      targetType: "ClinicPlanConfig",
      metadata: {
        clinicTag,
        activity: {
          claimedCodesCount: activity.claimedCodesCount,
          logEntriesCount: activity.logEntriesCount,
          recoveryPlansCount: activity.recoveryPlansCount,
          operationalAlertsCount: activity.operationalAlertsCount,
          reminderOutboxCount: activity.reminderOutboxCount,
        },
      },
    });

    const deleted = await prisma.$transaction(async (tx) => {
      const activationCodes = await tx.activationCode.deleteMany({
        where: { clinicTag },
      });
      const activationBatches = await tx.activationBatch.deleteMany({
        where: { clinicTag },
      });
      const recoveryTemplates = await tx.recoveryPlanTemplate.deleteMany({
        where: { clinicTag },
      });
      const clinicUsers = await tx.user.deleteMany({
        where: {
          role: UserRole.CLINIC,
          clinicTag,
        },
      });
      await tx.clinicPlanConfig.delete({
        where: { clinicTag },
      });

      return {
        clinicUsers: clinicUsers.count,
        activationCodes: activationCodes.count,
        activationBatches: activationBatches.count,
        recoveryTemplates: recoveryTemplates.count,
        clinicPlanConfig: 1,
      };
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_TEST_CLINIC_DELETED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag,
      targetId: clinicTag,
      targetType: "ClinicPlanConfig",
      metadata: {
        clinicTag,
        deleted,
      },
    });

    return res.status(200).json({
      ok: true,
      clinicTag,
      deleted,
    });
  } catch (err) {
    console.error("[OWNER_TEST_CLINIC_DELETE_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.get("/clinics/:clinicTag", async (req: Request, res: Response) => {
  const parsedTag = ClinicTagSchema.safeParse(req.params.clinicTag);
  if (!parsedTag.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedTag.error.issues });
  }

  const clinicTag = parsedTag.data;

  try {
    const clinic = await prisma.clinicPlanConfig.findUnique({
      where: { clinicTag },
      select: {
        clinicTag: true,
        name: true,
        defaultCategory: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!clinic) {
      return res.status(404).json({ code: "NOT_FOUND" });
    }

    const [adminUsers, batches, summaryByTag] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: UserRole.CLINIC,
          clinicTag,
        },
        orderBy: [
          { createdAt: "asc" },
          { email: "asc" },
        ],
        select: {
          id: true,
          email: true,
          role: true,
          clinicTag: true,
          mfaEnabled: true,
          lastLoginAt: true,
          isBanned: true,
          lockedUntil: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.activationBatch.findMany({
        where: { clinicTag },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          clinicTag: true,
          quantity: true,
          boxType: true,
          includedItemsJson: true,
          createdAt: true,
          createdByUserId: true,
        },
      }),
      buildClinicSummaryByTag([clinicTag]),
    ]);

    const batchCountsByBatchId = await buildBatchCountsByBatchId(
      batches.map((batch) => batch.id),
    );
    const summary = summaryByTag.get(clinicTag) ?? makeClinicSummaryCounts();

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_CLINIC_VIEWED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag,
      targetId: clinicTag,
      targetType: "ClinicPlanConfig",
      metadata: {
        adminUserCount: adminUsers.length,
        batchCount: batches.length,
      },
    });

    return res.status(200).json({
      clinic,
      adminUsers,
      batches: batches.map((batch) => {
        const codeCounts = batchCountsByBatchId.get(batch.id) ?? makeBatchCodeCounts();

        return {
          id: batch.id,
          clinicTag: batch.clinicTag,
          quantity: batch.quantity,
          boxType: batch.boxType,
          includedItems: toIncludedItems(batch.includedItemsJson),
          createdAt: batch.createdAt,
          createdByUserId: batch.createdByUserId,
          codeCounts: {
            total: codeCounts.totalCodes,
            issued: codeCounts.issuedCodes,
            draft: codeCounts.draftCodes,
            approved: codeCounts.approvedCodes,
            claimed: codeCounts.claimedCodes,
            invalidated: codeCounts.invalidatedCodes,
          },
        };
      }),
      summary: {
        patientCount: summary.patientCount,
        batchCount: summary.batchCount,
        totalCodes: summary.totalCodes,
        issuedCodes: summary.issuedCodes,
        draftCodes: summary.draftCodes,
        approvedCodes: summary.approvedCodes,
        claimedCodes: summary.claimedCodes,
        invalidatedCodes: summary.invalidatedCodes,
      },
    });
  } catch (err) {
    console.error("[OWNER_CLINIC_DETAIL_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.get("/clinics/:clinicTag/codes", async (req: Request, res: Response) => {
  const parsedTag = ClinicTagSchema.safeParse(req.params.clinicTag);
  if (!parsedTag.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedTag.error.issues });
  }

  const parsedQuery = ListClinicCodesQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedQuery.error.issues });
  }

  const clinicTag = parsedTag.data;
  const limit = parsedQuery.data.limit ?? 500;

  try {
    const clinic = await getClinicOr404(clinicTag);
    if (!clinic) {
      return res.status(404).json({ code: "NOT_FOUND" });
    }

    const codes = await getClinicCodes({
      clinicTag,
      limit,
      status: parsedQuery.data.status,
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_CLINIC_CODES_VIEWED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag,
      targetId: clinicTag,
      targetType: "ClinicPlanConfig",
      metadata: {
        exportedCount: codes.length,
        limit,
        status: parsedQuery.data.status ?? null,
      },
    });

    return res.status(200).json({
      clinicTag,
      codes: codes.map((code) => ({
        code: code.code,
        status: code.status,
        clinicTag: code.clinicTag,
        batchId: code.batchId,
        boxType: code.batch?.boxType ?? null,
        createdAt: code.createdAt,
        claimedAt: code.claimedAt,
        claimedByUserId: code.claimedByUserId,
      })),
    });
  } catch (err) {
    console.error("[OWNER_CLINIC_CODES_LIST_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.get("/clinics/:clinicTag/codes.csv", async (req: Request, res: Response) => {
  const parsedTag = ClinicTagSchema.safeParse(req.params.clinicTag);
  if (!parsedTag.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedTag.error.issues });
  }

  const clinicTag = parsedTag.data;

  try {
    const clinic = await getClinicOr404(clinicTag);
    if (!clinic) {
      return res.status(404).json({ code: "NOT_FOUND" });
    }

    const codes = await getClinicCodes({ clinicTag });
    const csv = toCsv(
      ["code", "clinicTag", "status", "batchId", "boxType", "batchCreatedAt", "codeCreatedAt", "claimedAt", "claimedByUserId"],
      codes.map((code) => [
        code.code,
        code.clinicTag,
        code.status,
        code.batchId,
        code.batch?.boxType ?? null,
        code.batch?.createdAt ?? null,
        code.createdAt,
        code.claimedAt,
        code.claimedByUserId,
      ]),
    );

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_CLINIC_CODES_EXPORTED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag,
      targetId: clinicTag,
      targetType: "ClinicPlanConfig",
      metadata: {
        clinicTag,
        exportedCount: codes.length,
        format: "CSV",
      },
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="activation-codes-${clinicTag}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error("[OWNER_CLINIC_CODES_EXPORT_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

ownerRouter.get("/batches/:batchId/codes.csv", async (req: Request, res: Response) => {
  const batchId = String(req.params.batchId || "").trim();

  if (!batchId) {
    return res.status(400).json({ code: "VALIDATION_ERROR" });
  }

  try {
    const batch = await prisma.activationBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        clinicTag: true,
        boxType: true,
      },
    });

    if (!batch) {
      return res.status(404).json({ code: "NOT_FOUND" });
    }

    const codes = await prisma.activationCode.findMany({
      where: { batchId },
      orderBy: { createdAt: "asc" },
      select: {
        code: true,
        clinicTag: true,
        status: true,
        batchId: true,
        createdAt: true,
        claimedAt: true,
        claimedByUserId: true,
      },
    });
    const csv = toCsv(
      ["code", "clinicTag", "status", "batchId", "boxType", "createdAt", "claimedAt", "claimedByUserId"],
      codes.map((code) => [
        code.code,
        code.clinicTag,
        code.status,
        code.batchId,
        batch.boxType,
        code.createdAt,
        code.claimedAt,
        code.claimedByUserId,
      ]),
    );

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "OWNER_BATCH_CODES_EXPORTED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag: batch.clinicTag,
      targetId: batchId,
      targetType: "ActivationBatch",
      metadata: {
        batchId,
        exportedCount: codes.length,
        format: "CSV",
      },
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="activation-codes-batch-${batchId}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error("[OWNER_BATCH_CODES_EXPORT_FAILED]", {
      message: err instanceof Error ? err.message : "UNKNOWN_ERROR",
      path: req.path,
      method: req.method,
    });
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});
