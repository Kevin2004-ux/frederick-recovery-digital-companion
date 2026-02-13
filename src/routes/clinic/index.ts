import { Router } from "express";
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
// ✅ FIX: Import matches the renamed export in generatePlan.ts
import { generatePlan } from "../../services/plan/generatePlan.js";

export const clinicRouter = Router();

// Secure ALL clinic routes: Must be logged in, AND must be a CLINIC or OWNER
clinicRouter.use(requireAuth);
clinicRouter.use(requireRole([UserRole.CLINIC, UserRole.OWNER]));

/**
 * GET /clinic/batches
 * List recent activation batches for admin usability.
 */
clinicRouter.get("/batches", async (req, res) => {
  const limitRaw = String(req.query.limit ?? "");
  const limitNum = limitRaw ? Number(limitRaw) : 25;
  const limit = Number.isFinite(limitNum)
    ? Math.max(1, Math.min(200, Math.floor(limitNum)))
    : 25;

  const clinicTag =
    typeof req.query.clinicTag === "string" ? req.query.clinicTag.trim() : undefined;

  const where = clinicTag ? { clinicTag } : {};

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

clinicRouter.post("/batches", async (req, res) => {
  const userId = req.user!.id; 

  const parsed = CreateBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { clinicTag, quantity } = parsed.data;

  try {
    const batch = await prisma.$transaction(async (tx) => {
      // Create Clinic Config if not exists
      await tx.clinicPlanConfig.upsert({
        where: { clinicTag },
        update: {},
        create: { 
            clinicTag,
            overridesJson: Prisma.JsonNull // Initialize with empty overrides
        },
      });

      const createdBatch = await tx.activationBatch.create({
        data: {
          id: crypto.randomUUID(),
          clinicTag,
          quantity,
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

    return res.status(201).json({
      batch: {
        id: batch.id,
        clinicTag: batch.clinicTag ?? null,
        quantity: batch.quantity,
        createdAt: batch.createdAt,
      },
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "CODE_GEN_EXHAUSTED") {
      return res.status(500).json({ code: "CODE_GENERATION_FAILED" });
    }
    console.error(e);
    return res.status(500).json({ code: "UNKNOWN_ERROR" });
  }
});

clinicRouter.get("/batches/:id/codes", async (req, res) => {
  const batchId = req.params.id;

  const batch = await prisma.activationBatch.findUnique({
    where: { id: batchId },
    select: { id: true, quantity: true },
  });
  if (!batch) return res.status(404).json({ code: "NOT_FOUND" });

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

clinicRouter.get("/batches/:id/codes.csv", async (req, res) => {
  const batchId = req.params.id;
  
  const batch = await prisma.activationBatch.findUnique({
    where: { id: batchId },
    select: { id: true, quantity: true, clinicTag: true },
  });
  if (!batch) return res.status(404).json({ code: "NOT_FOUND" });

  const codes = await prisma.activationCode.findMany({
    where: { batchId },
    orderBy: { createdAt: "asc" },
    select: { code: true, status: true, clinicTag: true },
    take: batch.quantity,
  });

  const header = "code,clinicTag,status\n";
  const lines = codes.map((c) => `${c.code},${c.clinicTag ?? ""},${c.status}`).join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="activation-codes-${batchId}.csv"`);

  return res.status(200).send(header + lines + "\n");
});

/**
 * Hardened Clinic Config Endpoint
 * Sets the configuration for a patient BEFORE they sign up.
 */
clinicRouter.post("/activation/:code/config", async (req, res) => {
  const actorId = req.user!.id;
  const actorRole = req.user!.role;
  const requesterTag = req.user?.clinicTag ?? null;

  const code = String(req.params.code ?? "").trim();
  if (!code) return res.status(400).json({ code: "VALIDATION_ERROR" });

  const parsed = ClinicActivationConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const configJson = parsed.data.config as unknown as Prisma.InputJsonValue;

  const activation = await prisma.activationCode.findUnique({
    where: { code },
    select: { id: true, status: true, configJson: true, clinicTag: true },
  });

  if (!activation) return res.status(404).json({ code: "NOT_FOUND" });

  if (!requesterTag || (activation.clinicTag ?? null) !== requesterTag) {
    AuditService.log({
      req,
      category: AuditCategory.ACCESS,
      type: "UNAUTHORIZED_TENANT_ACCESS",
      userId: actorId,
      role: actorRole,
      clinicTag: requesterTag,
      targetId: code,
      targetType: "ActivationCode",
      status: AuditStatus.FORBIDDEN,
      metadata: { attemptedTargetTag: activation.clinicTag }
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
    req,
    category: AuditCategory.PLAN,
    type: "ACTIVATION_CONFIG_SET",
    userId: actorId,
    role: actorRole,
    clinicTag: requesterTag,
    targetId: code,
    targetType: "ActivationCode",
    status: AuditStatus.SUCCESS
  });

  return res.status(200).json({ ok: true, activation: updated });
});

/**
 * GET /clinic/activation/:code/preview
 * Clinic reviews the generated plan before approving it.
 */
clinicRouter.get("/activation/:code/preview", async (req, res) => {
  const actorId = req.user!.id;
  const actorRole = req.user!.role;
  const requesterTag = req.user?.clinicTag ?? null;
  const code = String(req.params.code ?? "").trim();

  const activation = await prisma.activationCode.findUnique({
    where: { code },
    // We need to fetch the clinic config to see if they have overrides
    include: { 
        // Note: Prisma relation is defined as 'clinic' in schema, checking availability
        // If your schema doesn't have a direct relation here, we might need a separate query.
        // Assuming loose coupling for now.
    } 
  });

  if (!activation) return res.status(404).json({ code: "NOT_FOUND" });

  if (!requesterTag || (activation.clinicTag ?? null) !== requesterTag) {
    AuditService.log({
      req, category: AuditCategory.ACCESS, type: "UNAUTHORIZED_TENANT_ACCESS",
      userId: actorId, role: actorRole, clinicTag: requesterTag,
      targetId: code, targetType: "ActivationCode", status: AuditStatus.FORBIDDEN,
    });
    return res.status(403).json({ code: "FORBIDDEN" });
  }

  if (!activation.configJson) {
    return res.status(400).json({ code: "NEEDS_CONFIG", message: "Config must be set before previewing." });
  }

  // Fetch Clinic Overrides separately if needed
  const clinicConfig = await prisma.clinicPlanConfig.findUnique({
      where: { clinicTag: requesterTag }
  });

  // Generate the plan dynamically for preview
  const category = "general"; // Default to general for now
  
  // FETCH LOGIC: Custom Template Priority
  // For now we use the generatePlan default logic which handles the fallback internally
  // or we can pass an explicit template if we implemented the Template Builder fully.

  const { planJson } = generatePlan({
    templatePlanJson: undefined, // Let generator use default rules
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
 * Locks the activation code so the config is strictly immutable.
 * This effectively "Prescribes" the plan.
 */
clinicRouter.post("/activation/:code/approve", async (req, res) => {
  const actorId = req.user!.id;
  const actorRole = req.user!.role;
  const requesterTag = req.user?.clinicTag ?? null;
  const code = String(req.params.code ?? "").trim();

  const activation = await prisma.activationCode.findUnique({
    where: { code },
  });

  if (!activation) return res.status(404).json({ code: "NOT_FOUND" });

  if (!requesterTag || (activation.clinicTag ?? null) !== requesterTag) {
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
    where: { clinicTag: requesterTag }
  });

  const { planJson } = generatePlan({
    clinicOverridesJson: clinicConfig?.overridesJson,
    config: activation.configJson,
    category: "general"
  });

  // 2. Save and Lock
  const updated = await prisma.activationCode.update({
    where: { id: activation.id },
    data: { 
        status: ActivationCodeStatus.APPROVED,
        // We save the snapshot of the plan at this exact moment
        // This ensures that if the 'Brain' changes later, the patient's plan stays consistent
        planSnapshot: planJson as Prisma.InputJsonValue
    },
    select: { code: true, status: true, clinicTag: true },
  });

  AuditService.log({
    req, category: AuditCategory.PLAN, type: "PLAN_APPROVED",
    userId: actorId, role: actorRole, clinicTag: requesterTag,
    targetId: code, targetType: "ActivationCode", status: AuditStatus.SUCCESS,
  });

  return res.status(200).json({ ok: true, activation: updated });
});

/**
 * GET /clinic/patients
 * List all patients for this clinic (those who have claimed a code).
 */
clinicRouter.get("/patients", async (req, res) => {
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
          claimedByUser: { // Relation Name: claimedByUser
              select: {
                  id: true,
                  email: true,
                  // ✅ FIX: Use plural 'recoveryPlans' (list) and take the latest
                  recoveryPlans: {
                      take: 1,
                      orderBy: { createdAt: 'desc' },
                      select: {
                          startDate: true,
                          createdAt: true 
                      }
                  }
              }
          }
      },
      orderBy: { claimedAt: 'desc' }
    });
  
    // Flatten the structure for the frontend table
    const flatPatients = patients.map(p => {
        // ✅ FIX: Extract the first (latest) plan from the array
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