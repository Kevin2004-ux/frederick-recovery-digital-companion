// app/backend/src/routes/clinic/index.ts
import { Router, Request, Response } from "express"; // Import types
import { z } from "zod";
import crypto from "crypto";
import {
  Prisma,
  ActivationCodeStatus,
  UserRole
} from "@prisma/client";
import { prisma } from "../../prisma/client.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { AuditService, AuditCategory, AuditStatus } from "../../services/AuditService.js";
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

  const { clinicTag, quantity } = parsed.data;

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
        data: { id: crypto.randomUUID(), clinicTag, quantity, createdByUserId: userId },
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
      status: AuditStatus.SUCCESS, metadata: { batchId: batch.id, quantity }
    });

    return res.status(201).json({
      batch: {
        id: batch.id,
        clinicTag: batch.clinicTag ?? null,
        quantity: batch.quantity,
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
    select: { id: true, quantity: true, clinicTag: true },
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

  return res.status(200).json({ batchId, codes });
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
      // planSnapshot field not in schema yet, assuming strictly logical lock for now
      // If you added it to schema, add: planSnapshot: planJson as Prisma.InputJsonValue
    },
    select: { code: true, status: true },
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

  const flatPatients = patients.map(p => {
    const latestPlan = p.claimedByUser?.recoveryPlans?.[0];
    return {
      id: p.claimedByUser?.id,
      email: p.claimedByUser?.email,
      code: p.code,
      joinedAt: p.claimedAt,
      startDate: latestPlan?.startDate
    };
  });

  return res.status(200).json({ patients: flatPatients });
});