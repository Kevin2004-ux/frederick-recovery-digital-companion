// app/backend/src/routes/clinic/index.ts
import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import { requireAuth } from "../../middleware/requireAuth.js";

export const clinicRouter = Router();

// All /clinic routes require auth
clinicRouter.use(requireAuth);

/**
 * CLINIC role guard (doctors/nurses are stored in User with role="CLINIC")
 * NOTE: requireAuth now attaches role to req.user, so no extra DB hit needed.
 */
function requireClinic(req: any, res: any): boolean {
  if (!req.user || req.user.role !== "CLINIC") {
    res.status(403).json({ code: "FORBIDDEN" });
    return false;
  }
  return true;
}

/**
 * GET /clinic/batches
 * List recent activation batches for admin usability.
 *
 * Query:
 * - limit (default 25, max 200)
 * - clinicTag (optional filter)
 */
clinicRouter.get("/batches", async (req, res) => {
  if (!requireClinic(req, res)) return;

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
    if (row.status === "UNUSED") unusedByBatchId.set(row.batchId, readCountAll(row));
    if (row.status === "CLAIMED") claimedByBatchId.set(row.batchId, readCountAll(row));
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

// -------------------------
// Activation code generation
// -------------------------

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

// -------------------------
// Schemas
// -------------------------

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

// -------------------------
// Routes
// -------------------------

clinicRouter.post("/batches", async (req, res) => {
  if (!requireClinic(req, res)) return;

  const userId = req.user.id;

  const parsed = CreateBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { clinicTag, quantity } = parsed.data;

  try {
    const batch = await prisma.$transaction(async (tx) => {
      await tx.clinicPlanConfig.upsert({
        where: { clinicTag },
        update: {},
        create: { clinicTag },
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
    return res.status(500).json({ code: "UNKNOWN_ERROR" });
  }
});

clinicRouter.get("/batches/:id/codes", async (req, res) => {
  if (!requireClinic(req, res)) return;

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
  if (!requireClinic(req, res)) return;

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

clinicRouter.post("/activation/:code/config", async (req, res) => {
  if (!requireClinic(req, res)) return;

  const userId = req.user.id;

  const code = String(req.params.code ?? "").trim();
  if (!code) return res.status(400).json({ code: "VALIDATION_ERROR" });

  const parsed = ClinicActivationConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const configJson = parsed.data.config as unknown as Prisma.InputJsonValue;

  const activation = await prisma.activationCode.findUnique({
  where: { code },
  select: {
    id: true,
    status: true,
    configJson: true,
    clinicTag: true,
  },
});


  if (!activation) return res.status(404).json({ code: "NOT_FOUND" });
  // Ownership enforcement: clinic can only configure codes for its own clinicTag
const requesterTag = req.user?.clinicTag ?? null;

// If the clinic user has no clinicTag set, fail closed
if (!requesterTag) {
  return res.status(403).json({ code: "FORBIDDEN" });
}

// If the code has a clinicTag and it doesn't match the clinic user's tag, deny
if ((activation.clinicTag ?? null) !== requesterTag) {
  return res.status(403).json({ code: "FORBIDDEN" });
}


  if (activation.status !== "UNUSED") {
    return res.status(409).json({ code: "CODE_ALREADY_CLAIMED" });
  }

  // For Json? fields, Prisma returns null when unset, so this is OK.
  if (activation.configJson !== null) {
    return res.status(409).json({ code: "CONFIG_ALREADY_SET" });
  }

  const updated = await prisma.activationCode.update({
    where: { id: activation.id },
    data: {
      configJson,
      configCapturedAt: new Date(),
      configCapturedByUserId: userId,
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

  return res.status(200).json({ ok: true, activation: updated });
});
