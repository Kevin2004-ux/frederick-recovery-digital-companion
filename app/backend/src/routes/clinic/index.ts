// app/backend/src/routes/clinic/index.ts
import { Router, Request, Response } from "express"; // Import types
import { z } from "zod";
import crypto from "crypto";
import {
  Prisma,
  ActivationCodeStatus,
  UserRole
} from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  AuditService,
  AuditCategory,
  AuditStatus,
  AuditSeverity,
} from "../../services/AuditService.js";
import { listEntries } from "../../repositories/logRepo.js";
import { normalizeIncludedItems } from "../../services/boxEducation.js";
import { PdfService } from "../../services/export/PdfService.js";
import {
  deriveClinicOperationalStatus,
  formatClinicStatusReasonLabel,
  getPrimaryClinicStatusReason,
  summarizeMetricTrend,
} from "../../services/clinicStatus.js";
import {
  highestOpenOperationalAlertSeverity,
  listOpenOperationalAlerts,
  syncOperationalAlertsForPatient,
  syncOperationalAlertsForPatients,
} from "../../services/operationalAlerts.js";
import { generatePlan } from "../../services/plan/generatePlan.js";

export const clinicRouter = Router();

// Secure ALL clinic routes
clinicRouter.use(requireAuth);
clinicRouter.use(requireRole([UserRole.CLINIC, UserRole.OWNER]));

// --- HELPER: Strict Tenant Enforcement ---
function getEffectiveClinicTag(req: Request): string | null {
  const user = req.user!;
  
  // 1. If user is a CLINIC admin, they are JAILBED to their own tag.
  if (user.role === UserRole.CLINIC) {
    return user.clinicTag; // Must exist per requireAuth logic, but safely handled if null
  }

  // 2. If user is OWNER (Super Admin), they *can* optionally filter by query param
  //    or see everything if they don't specify one (context dependent).
  //    For this specific helper, we return what they asked for, or null.
  if (user.role === UserRole.OWNER) {
    const queryTag = typeof req.query.clinicTag === "string" ? req.query.clinicTag.trim() : null;
    return queryTag || null; 
  }

  return null;
}

function resolveClinicRecoveryStartDate(args: {
  planStartDate?: string | null;
  profileRecoveryStartDate?: string | null;
}): string | null {
  return args.planStartDate ?? args.profileRecoveryStartDate ?? null;
}

function buildTopOpenAlertPreview(
  alerts: Awaited<ReturnType<typeof listOpenOperationalAlerts>>
) {
  const topAlert = alerts[0];
  if (!topAlert) return null;

  const primaryReason = getPrimaryClinicStatusReason(topAlert.reasons);

  return {
    severity: topAlert.severity,
    type: topAlert.type,
    summary:
      topAlert.summary ??
      formatClinicStatusReasonLabel(primaryReason) ??
      topAlert.type,
    lastTriggeredAt: topAlert.triggeredAt,
  };
}

/**
 * GET /clinic/batches
 * List recent activation batches.
 * SECURITY: Enforces tenant isolation.
 */
clinicRouter.get("/batches", async (req: Request, res: Response) => {
  const limitRaw = String(req.query.limit ?? "");
  const limitNum = limitRaw ? Number(limitRaw) : 25;
  const limit = Number.isFinite(limitNum)
    ? Math.max(1, Math.min(200, Math.floor(limitNum)))
    : 25;

  // SECURITY FIX: Use the helper.
  // Clinic users get their own tag. Owners get what they queried (or undefined for all).
  const user = req.user!;
  let where: Prisma.ActivationBatchWhereInput = {};

  if (user.role === UserRole.CLINIC) {
    if (!user.clinicTag) return res.status(403).json({ code: "NO_CLINIC_TAG" });
    where = { clinicTag: user.clinicTag };
  } else if (user.role === UserRole.OWNER) {
    // Owners can filter if they want, or see all
    const qTag = typeof req.query.clinicTag === "string" ? req.query.clinicTag.trim() : undefined;
    if (qTag) where = { clinicTag: qTag };
  }

  const batches = await prisma.activationBatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      clinicTag: true,
      quantity: true,
      boxType: true,
      includedItemsJson: true,
      createdAt: true,
      createdByUserId: true,
    },
  });

  const batchIds = batches.map((b) => b.id);

  if (batchIds.length === 0) {
    return res.status(200).json({ batches: [] });
  }

  // Aggregations (counts)
  // We must ensure these aggregations also respect the batchIds we just securely fetched.
  const totals = await prisma.activationCode.groupBy({
    by: ["batchId"],
    where: { batchId: { in: batchIds } },
    _count: { _all: true },
  });

  const byStatus = await prisma.activationCode.groupBy({
    by: ["batchId", "status"],
    where: { batchId: { in: batchIds } },
    _count: { _all: true },
  });

  const configured = await prisma.activationCode.groupBy({
    by: ["batchId"],
    where: {
      batchId: { in: batchIds },
      configJson: { not: Prisma.DbNull },
    },
    _count: { _all: true },
  });

  // Data mapping helpers
  const readCountAll = (row: any): number => {
    const v = row?._count?._all;
    return typeof v === "number" ? v : 0;
  };

  const totalByBatchId = new Map<string, number>();
  for (const row of totals as any[]) {
    if (!row.batchId) continue;
    totalByBatchId.set(row.batchId, readCountAll(row));
  }

  const unusedByBatchId = new Map<string, number>();
  const claimedByBatchId = new Map<string, number>();
  
  for (const row of byStatus as any[]) {
    if (!row.batchId) continue;
    if (row.status === ActivationCodeStatus.ISSUED) unusedByBatchId.set(row.batchId, readCountAll(row));
    if (row.status === ActivationCodeStatus.CLAIMED) claimedByBatchId.set(row.batchId, readCountAll(row));
  }

  const configuredByBatchId = new Map<string, number>();
  for (const row of configured as any[]) {
    if (!row.batchId) continue;
    configuredByBatchId.set(row.batchId, readCountAll(row));
  }

  const withCounts = batches.map((b) => {
    const total = totalByBatchId.get(b.id) ?? 0;
    const unused = unusedByBatchId.get(b.id) ?? 0;
    const claimed = claimedByBatchId.get(b.id) ?? 0;
    const configuredCount = configuredByBatchId.get(b.id) ?? 0;

    return {
      ...b,
      boxType: b.boxType ?? null,
      includedItems: Array.isArray(b.includedItemsJson) ? b.includedItemsJson : [],
      codeCounts: {
        total,
        unused,
        claimed,
        configured: configuredCount,
        quantityMismatch: total !== b.quantity,
      },
    };
  });

  return res.status(200).json({ batches: withCounts });
});

// Activation code generation helpers
const CODE_PREFIX = "FR";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChunk(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return out;
}

function makeActivationCode(): string {
  return `${CODE_PREFIX}-${randomChunk(4)}-${randomChunk(4)}`;
}

const CreateBatchSchema = z.object({
  clinicTag: z.string().min(2).max(64),
  quantity: z.number().int().min(1).max(5000),
  boxType: z.string().trim().min(1).max(120).optional(),
  includedItems: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(64).optional(),
        label: z.string().trim().min(1).max(120),
      })
    )
    .max(100)
    .optional(),
});

const PlanConfigSchema = z.object({
  recovery_region: z.enum(["leg_foot", "arm_hand", "torso", "face_neck", "general"]),
  recovery_duration: z.enum(["standard_0_7", "standard_8_14", "standard_15_21", "extended_22_plus"]),
  mobility_impact: z.enum(["none", "mild", "limited", "non_weight_bearing"]),
  incision_status: z.enum([
    "intact_dressings",
    "sutures_staples",
    "drains_present",
    "open_wound",
    "none_visible",
  ]),
  discomfort_pattern: z.enum(["expected_soreness", "sharp_intermittent", "burning_tingling", "escalating"]),
  follow_up_expectation: z.enum(["within_7_days", "within_14_days", "within_30_days", "none_scheduled"]),
});

const ClinicActivationConfigSchema = z.object({
  config: PlanConfigSchema,
});

/**
 * POST /clinic/batches
 * Generate new codes.
 */
clinicRouter.post("/batches", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const userClinicTag = req.user!.clinicTag;

  const parsed = CreateBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { clinicTag, quantity, boxType, includedItems } = parsed.data;

  // SECURITY FIX: Enforce that CLINIC users can only create batches for themselves
  if (userRole === UserRole.CLINIC) {
    if (clinicTag !== userClinicTag) {
      AuditService.log({
        req, category: AuditCategory.ACCESS, type: "CROSS_TENANT_CREATION_ATTEMPT",
        userId, role: userRole, clinicTag: userClinicTag,
        status: AuditStatus.FORBIDDEN, metadata: { attemptedTarget: clinicTag }
      });
      return res.status(403).json({ code: "FORBIDDEN", message: "Cannot create batches for another clinic." });
    }
  }

  try {
    const batch = await prisma.$transaction(async (tx) => {
      // Create Clinic Config if not exists
      await tx.clinicPlanConfig.upsert({
        where: { clinicTag },
        update: {},
        create: { 
          clinicTag, 
          defaultCategory: "general_outpatient",
          overridesJson: Prisma.JsonNull 
        },
      });

      const createdBatch = await tx.activationBatch.create({
        data: {
          id: crypto.randomUUID(),
          clinicTag,
          quantity,
          boxType,
          includedItemsJson: includedItems
            ? (includedItems as unknown as Prisma.InputJsonValue)
            : undefined,
          createdByUserId: userId,
        },
      });

      let insertedTotal = 0;
      let safety = 0;

      while (insertedTotal < quantity) {
        safety++;
        if (safety > 25) throw new Error("CODE_GEN_EXHAUSTED");

        const remaining = quantity - insertedTotal;
        const genCount = Math.min(remaining, 2000);

        const data = Array.from({ length: genCount }).map(() => ({
          code: makeActivationCode(),
          clinicTag,
          batchId: createdBatch.id,
        }));

        const created = await tx.activationCode.createMany({
          data,
          skipDuplicates: true,
        });

        insertedTotal += created.count;
      }

      return createdBatch;
    });

    // Audit the creation
    AuditService.log({
      req, category: AuditCategory.ADMIN, type: "BATCH_CREATED",
      userId, role: userRole, clinicTag,
      status: AuditStatus.SUCCESS,
      metadata: {
        batchId: batch.id,
        quantity,
        boxType: boxType ?? null,
        includedItemCount: includedItems?.length ?? 0,
      }
    });

    return res.status(201).json({
      batch: {
        id: batch.id,
        clinicTag: batch.clinicTag ?? null,
        quantity: batch.quantity,
        boxType: batch.boxType ?? null,
        includedItems: Array.isArray(batch.includedItemsJson) ? batch.includedItemsJson : [],
        createdAt: batch.createdAt,
      },
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ code: "UNKNOWN_ERROR" });
  }
});

/**
 * GET /clinic/batches/:id/codes
 */
clinicRouter.get("/batches/:id/codes", async (req: Request, res: Response) => {
  const batchId = req.params.id;
  const user = req.user!;

  const batch = await prisma.activationBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      quantity: true,
      clinicTag: true,
      boxType: true,
      includedItemsJson: true,
    },
  });

  if (!batch) return res.status(404).json({ code: "NOT_FOUND" });

  // SECURITY FIX: Tenant Check
  if (user.role === UserRole.CLINIC) {
    if (batch.clinicTag !== user.clinicTag) {
      return res.status(403).json({ code: "FORBIDDEN" });
    }
  }

  const codes = await prisma.activationCode.findMany({
    where: { batchId },
    orderBy: { createdAt: "asc" },
    select: {
      code: true,
      status: true,
      clinicTag: true,
      claimedAt: true,
      claimedByUserId: true,
    },
    take: batch.quantity,
  });

  return res.status(200).json({
    batchId,
    batch: {
      id: batch.id,
      clinicTag: batch.clinicTag ?? null,
      quantity: batch.quantity,
      boxType: batch.boxType ?? null,
      includedItems: Array.isArray(batch.includedItemsJson) ? batch.includedItemsJson : [],
    },
    codes,
  });
});

/**
 * GET /clinic/batches/:id/codes.csv
 */
clinicRouter.get("/batches/:id/codes.csv", async (req: Request, res: Response) => {
  const batchId = req.params.id;
  const user = req.user!;

  const batch = await prisma.activationBatch.findUnique({
    where: { id: batchId },
    select: { id: true, quantity: true, clinicTag: true },
  });

  if (!batch) return res.status(404).send("Not Found");

  // SECURITY FIX: Tenant Check
  if (user.role === UserRole.CLINIC) {
    if (batch.clinicTag !== user.clinicTag) {
      return res.status(403).send("Forbidden");
    }
  }

  const codes = await prisma.activationCode.findMany({
    where: { batchId },
    orderBy: { createdAt: "asc" },
  });

  const header = "code,clinicTag,status\n";
  const lines = codes.map((c) => `${c.code},${c.clinicTag ?? ""},${c.status}`).join("\n");

  // Audit export
  AuditService.log({
    req, category: AuditCategory.ADMIN, type: "BATCH_EXPORTED",
    userId: user.id, role: user.role, clinicTag: batch.clinicTag,
    status: AuditStatus.SUCCESS, metadata: { batchId, format: "CSV" }
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="activation-codes-${batchId}.csv"`);
  return res.status(200).send(header + lines + "\n");
});

/**
 * POST /clinic/activation/:code/config
 * Hardened Clinic Config Endpoint
 */
clinicRouter.post("/activation/:code/config", async (req: Request, res: Response) => {
  const actorId = req.user!.id;
  const actorRole = req.user!.role;
  const requesterTag = req.user?.clinicTag ?? null;

  const code = String(req.params.code ?? "").trim();
  if (!code) return res.status(400).json({ code: "VALIDATION_ERROR" });

  const parsed = ClinicActivationConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const configJson = parsed.data.config;

  const activation = await prisma.activationCode.findUnique({ where: { code } });
  if (!activation) return res.status(404).json({ code: "NOT_FOUND" });

  // SECURITY FIX: Ensure clinic owns this code
  if (requesterTag && activation.clinicTag !== requesterTag) {
    AuditService.log({
      req, category: AuditCategory.ACCESS, type: "UNAUTHORIZED_TENANT_ACCESS",
      userId: actorId, role: actorRole, clinicTag: requesterTag,
      targetId: code, targetType: "ActivationCode",
      status: AuditStatus.FORBIDDEN, metadata: { attemptedTargetTag: activation.clinicTag }
    });
    return res.status(403).json({ code: "FORBIDDEN" });
  }

  if (activation.status !== ActivationCodeStatus.ISSUED && activation.status !== ActivationCodeStatus.DRAFT) {
    return res.status(409).json({ code: "CODE_ALREADY_LOCKED_OR_CLAIMED" });
  }

  const updated = await prisma.activationCode.update({
    where: { id: activation.id },
    data: {
      status: ActivationCodeStatus.DRAFT,
      configJson,
      configCapturedAt: new Date(),
      configCapturedByUserId: actorId,
    },
    select: {
      code: true,
      clinicTag: true,
      status: true,
      configCapturedAt: true,
      configCapturedByUserId: true,
      configJson: true,
    },
  });

  AuditService.log({
    req, category: AuditCategory.PLAN, type: "ACTIVATION_CONFIG_SET",
    userId: actorId, role: actorRole, clinicTag: requesterTag,
    targetId: code, targetType: "ActivationCode", status: AuditStatus.SUCCESS
  });

  return res.status(200).json({ ok: true, activation: updated });
});

/**
 * GET /clinic/activation/:code/preview
 */
clinicRouter.get("/activation/:code/preview", async (req: Request, res: Response) => {
  const actorId = req.user!.id;
  const actorRole = req.user!.role;
  const requesterTag = req.user?.clinicTag ?? null;
  const code = String(req.params.code ?? "").trim();

  const activation = await prisma.activationCode.findUnique({
    where: { code },
    include: {
      // Assuming loose coupling, but we can include clinicConfig if relation exists
    }
  });

  if (!activation) return res.status(404).json({ code: "NOT_FOUND" });

  if (requesterTag && activation.clinicTag !== requesterTag) {
    return res.status(403).json({ code: "FORBIDDEN" });
  }

  // Generate the plan dynamically for preview
  const category = "general_outpatient"; 
  const clinicConfig = await prisma.clinicPlanConfig.findUnique({ where: { clinicTag: activation.clinicTag! } });

  const { planJson } = generatePlan({
    templatePlanJson: undefined, 
    clinicOverridesJson: clinicConfig?.overridesJson,
    config: activation.configJson,
    engineVersion: "v1",
    category,
  });

  AuditService.log({
    req, category: AuditCategory.PLAN, type: "PLAN_PREVIEWED_BY_CLINIC",
    userId: actorId, role: actorRole, clinicTag: requesterTag,
    targetId: code, targetType: "ActivationCode", status: AuditStatus.SUCCESS,
  });

  return res.status(200).json({
    status: activation.status,
    plan: planJson
  });
});

/**
 * POST /clinic/activation/:code/approve
 */
clinicRouter.post("/activation/:code/approve", async (req: Request, res: Response) => {
  const actorId = req.user!.id;
  const actorRole = req.user!.role;
  const requesterTag = req.user?.clinicTag ?? null;
  const code = String(req.params.code ?? "").trim();

  const activation = await prisma.activationCode.findUnique({ where: { code } });
  if (!activation) return res.status(404).json({ code: "NOT_FOUND" });

  if (requesterTag && activation.clinicTag !== requesterTag) {
    AuditService.log({
      req, category: AuditCategory.ACCESS, type: "UNAUTHORIZED_TENANT_ACCESS",
      userId: actorId, role: actorRole, clinicTag: requesterTag,
      targetId: code, targetType: "ActivationCode", status: AuditStatus.FORBIDDEN,
    });
    return res.status(403).json({ code: "FORBIDDEN" });
  }

  if (activation.status !== ActivationCodeStatus.DRAFT) {
    return res.status(409).json({ 
      code: "INVALID_STATE_TRANSITION", 
      message: `Cannot approve from state: ${activation.status}. Must be DRAFT.` 
    });
  }

  // 1. Generate the Final Plan Snapshot
  const clinicConfig = await prisma.clinicPlanConfig.findUnique({
    where: { clinicTag: activation.clinicTag! }
  });

  const { planJson } = generatePlan({
    clinicOverridesJson: clinicConfig?.overridesJson,
    config: activation.configJson,
    category: "general_outpatient"
  });

  // 2. Save and Lock
  const updated = await prisma.activationCode.update({
    where: { id: activation.id },
    data: {
      status: ActivationCodeStatus.APPROVED,
      approvedConfigSnapshot:
        activation.configJson === null
          ? Prisma.JsonNull
          : (activation.configJson as Prisma.InputJsonValue),
      planSnapshot: planJson as Prisma.InputJsonValue,
      approvedAt: new Date(),
      approvedByUserId: actorId,
    },
    select: { code: true, status: true },
  });

  AuditService.log({
    req, category: AuditCategory.PLAN, type: "ACTIVATION_APPROVED",
    userId: actorId, role: actorRole, clinicTag: requesterTag,
    targetId: code, targetType: "ActivationCode", status: AuditStatus.SUCCESS,
  });

  return res.status(200).json({ ok: true, activation: updated });
});

/**
 * GET /clinic/patients
 */
clinicRouter.get("/patients", async (req: Request, res: Response) => {
  const requesterTag = req.user?.clinicTag ?? null;
  
  if (!requesterTag) return res.status(403).json({ code: "FORBIDDEN" });

  // Find all codes claimed by this clinic that have a user attached
  const patients = await prisma.activationCode.findMany({
    where: {
      clinicTag: requesterTag,
      status: ActivationCodeStatus.CLAIMED,
      claimedByUserId: { not: null }
    },
    select: {
      code: true,
      claimedAt: true,
      claimedByUser: { 
        select: {
          id: true,
          email: true,
          recoveryStartDate: true,
          recoveryPlans: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { startDate: true }
          }
        }
      }
    },
    orderBy: { claimedAt: 'desc' }
  });

  const patientIds = patients
    .map((patient) => patient.claimedByUser?.id)
    .filter((id): id is string => Boolean(id));

  try {
    await syncOperationalAlertsForPatients(patientIds, requesterTag);
  } catch (error) {
    console.error("Operational alert refresh failed for clinic roster", error);
  }

  const recentLogs = patientIds.length
    ? await prisma.logEntry.findMany({
        where: {
          userId: { in: patientIds },
        },
        orderBy: [{ userId: "asc" }, { date: "desc" }],
        select: {
          userId: true,
          date: true,
          painLevel: true,
          swellingLevel: true,
          details: true,
        },
      })
    : [];

  const openAlerts = await listOpenOperationalAlerts({
    patientUserIds: patientIds,
    clinicTag: requesterTag,
  });

  const openAlertsByPatientUserId = new Map<
    string,
    Awaited<ReturnType<typeof listOpenOperationalAlerts>>
  >();

  for (const alert of openAlerts) {
    const existing = openAlertsByPatientUserId.get(alert.patientUserId) ?? [];
    existing.push(alert);
    openAlertsByPatientUserId.set(alert.patientUserId, existing);
  }

  const recentLogsByUserId = new Map<
    string,
    Array<{
      date: string;
      painLevel: number;
      swellingLevel: number;
      details: Prisma.JsonValue | null;
    }>
  >();

  for (const logEntry of recentLogs) {
    const existing = recentLogsByUserId.get(logEntry.userId) ?? [];

    if (existing.length < 3) {
      existing.push(logEntry);
      recentLogsByUserId.set(logEntry.userId, existing);
    }
  }

  const flatPatients = patients.map(p => {
    const patientId = p.claimedByUser?.id;
    const latestPlan = p.claimedByUser?.recoveryPlans?.[0];
    const recoveryStartDate = resolveClinicRecoveryStartDate({
      planStartDate: latestPlan?.startDate ?? null,
      profileRecoveryStartDate: p.claimedByUser?.recoveryStartDate ?? null,
    });
    const patientRecentLogs = patientId ? recentLogsByUserId.get(patientId) ?? [] : [];
    const latestLog = patientRecentLogs[0];
    const patientAlerts = patientId ? openAlertsByPatientUserId.get(patientId) ?? [] : [];
    const status = deriveClinicOperationalStatus({
      recoveryStartDate,
      recentLogs: patientRecentLogs,
    });
    const primaryStatusReason = getPrimaryClinicStatusReason(status.reasons);

    return {
      patientId: patientId ?? null,
      displayName: p.claimedByUser?.email ?? null,
      activationCode: p.code,
      recoveryStartDate,
      currentRecoveryDay: status.currentRecoveryDay,
      simpleStatus: status.simpleStatus,
      statusReasons: status.reasons,
      primaryStatusReason,
      primaryStatusReasonLabel: formatClinicStatusReasonLabel(primaryStatusReason),
      lastCheckInDate: latestLog?.date ?? null,
      lastPainLevel: latestLog?.painLevel ?? null,
      lastSwellingLevel: latestLog?.swellingLevel ?? null,
      hasRecentCheckIn: Boolean(latestLog),
      unresolvedAlertCount: patientAlerts.length,
      highestOpenAlertSeverity: highestOpenOperationalAlertSeverity(patientAlerts),
      topOpenAlert: buildTopOpenAlertPreview(patientAlerts),
      id: p.claimedByUser?.id,
      email: p.claimedByUser?.email,
      code: p.code,
      joinedAt: p.claimedAt,
      startDate: latestPlan?.startDate,
    };
  });

  AuditService.log({
    req,
    category: AuditCategory.LOG,
    type: "CLINIC_PATIENT_ROSTER_VIEWED",
    userId: req.user!.id,
    role: req.user!.role,
    clinicTag: requesterTag,
    status: AuditStatus.SUCCESS,
    metadata: {
      count: flatPatients.length,
      patientUserIds: patientIds,
      route: "/clinic/patients",
    },
  });

  return res.status(200).json({ patients: flatPatients });
});

/**
 * GET /clinic/patients/:patientId/export.pdf
 */
clinicRouter.get("/patients/:patientId/export.pdf", async (req: Request, res: Response) => {
  const requesterTag = req.user?.clinicTag ?? null;
  const patientId = String(req.params.patientId ?? "").trim();

  if (!requesterTag) return res.status(403).json({ code: "FORBIDDEN" });
  if (!patientId) return res.status(400).json({ code: "VALIDATION_ERROR" });

  const activation = await prisma.activationCode.findFirst({
    where: {
      clinicTag: requesterTag,
      claimedByUserId: patientId,
      status: ActivationCodeStatus.CLAIMED,
    },
    orderBy: { claimedAt: "desc" },
    select: {
      code: true,
      claimedByUser: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!activation || !activation.claimedByUser) {
    return res.status(404).json({ code: "NOT_FOUND" });
  }

  try {
    const entries = await listEntries(patientId);

    await AuditService.log({
      req,
      category: AuditCategory.LOG,
      type: "CLINIC_PATIENT_PHI_EXPORTED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag: requesterTag,
      patientUserId: patientId,
      targetId: patientId,
      targetType: "User",
      metadata: {
        format: "PDF",
        count: entries.length,
        activationCode: activation.code,
      },
      severity: AuditSeverity.CRITICAL,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="recovery-log.pdf"');

    await PdfService.streamLogReport(entries, res, activation.claimedByUser.email);
  } catch (error) {
    console.error("Clinic PDF export blocked due to audit failure", error);
    if (!res.headersSent) {
      return res.status(500).json({
        code: "AUDIT_FAILURE",
        message: "Security audit failed. Export blocked.",
      });
    }
  }
});

/**
 * GET /clinic/patients/:patientId/summary
 */
clinicRouter.get("/patients/:patientId/summary", async (req: Request, res: Response) => {
  const requesterTag = req.user?.clinicTag ?? null;
  const patientId = String(req.params.patientId ?? "").trim();

  if (!requesterTag) return res.status(403).json({ code: "FORBIDDEN" });
  if (!patientId) return res.status(400).json({ code: "VALIDATION_ERROR" });

  const activation = await prisma.activationCode.findFirst({
    where: {
      clinicTag: requesterTag,
      claimedByUserId: patientId,
      status: ActivationCodeStatus.CLAIMED,
    },
    orderBy: { claimedAt: "desc" },
    select: {
      id: true,
      code: true,
      status: true,
      clinicTag: true,
      claimedAt: true,
      batch: {
        select: {
          id: true,
          boxType: true,
          includedItemsJson: true,
        },
      },
      claimedByUser: {
        select: {
          id: true,
          email: true,
          recoveryStartDate: true,
        },
      },
    },
  });

  if (!activation || !activation.claimedByUser) {
    return res.status(404).json({ code: "NOT_FOUND" });
  }

  const latestPlan = await prisma.recoveryPlanInstance.findFirst({
    where: { userId: patientId },
    orderBy: { createdAt: "desc" },
    select: {
      startDate: true,
    },
  });
  const recoveryStartDate = resolveClinicRecoveryStartDate({
    planStartDate: latestPlan?.startDate ?? null,
    profileRecoveryStartDate: activation.claimedByUser.recoveryStartDate ?? null,
  });

  try {
    await syncOperationalAlertsForPatient(patientId, requesterTag);
  } catch (error) {
    console.error("Operational alert refresh failed for clinic patient summary", error);
  }

  const recentEntries = (await listEntries(patientId)).slice(-7).reverse();
  const painTrend = summarizeMetricTrend(
    recentEntries.map((entry) => entry.painLevel).reverse()
  );
  const swellingTrend = summarizeMetricTrend(
    recentEntries.map((entry) => entry.swellingLevel).reverse()
  );

  const status = deriveClinicOperationalStatus({
    recoveryStartDate,
    recentLogs: recentEntries.slice(0, 3).map((entry) => ({
      date: entry.date,
      painLevel: entry.painLevel,
      swellingLevel: entry.swellingLevel,
      details: entry.details,
    })),
  });

  const includedItems = normalizeIncludedItems(activation.batch?.includedItemsJson);
  const openAlerts = await listOpenOperationalAlerts({
    patientUserId: patientId,
    clinicTag: requesterTag,
  });

  AuditService.log({
    req,
    category: AuditCategory.LOG,
    type: "CLINIC_PATIENT_SUMMARY_VIEWED",
    userId: req.user!.id,
    role: req.user!.role,
    clinicTag: requesterTag,
    patientUserId: patientId,
    targetId: patientId,
    targetType: "User",
    status: AuditStatus.SUCCESS,
  });

  return res.status(200).json({
    patient: {
      patientId: activation.claimedByUser.id,
      displayName: activation.claimedByUser.email,
      email: activation.claimedByUser.email,
    },
    activation: {
      activationCode: activation.code,
      status: activation.status,
      claimedAt: activation.claimedAt,
      clinicTag: activation.clinicTag ?? null,
    },
    recovery: {
      recoveryStartDate,
      currentRecoveryDay: status.currentRecoveryDay,
      simpleStatus: status.simpleStatus,
      statusReasons: status.reasons,
    },
    latestCheckIn: recentEntries[0]
      ? {
          date: recentEntries[0].date,
          painLevel: recentEntries[0].painLevel,
          swellingLevel: recentEntries[0].swellingLevel,
          notes: recentEntries[0].notes ?? null,
          details: recentEntries[0].details ?? null,
        }
      : null,
    recentCheckIns: recentEntries.map((entry) => ({
      date: entry.date,
      painLevel: entry.painLevel,
      swellingLevel: entry.swellingLevel,
      notes: entry.notes ?? null,
      details: entry.details ?? null,
    })),
    recentPainTrend: painTrend,
    recentSwellingTrend: swellingTrend,
    myBox: activation.batch
      ? {
          batchId: activation.batch.id,
          boxType: activation.batch.boxType ?? null,
          includedItems,
        }
      : null,
    openAlerts: openAlerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      reasons: alert.reasons,
      summary: alert.summary,
      triggeredAt: alert.triggeredAt,
      resolvedAt: alert.resolvedAt,
    })),
  });
});
