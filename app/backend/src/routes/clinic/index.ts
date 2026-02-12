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
 */
async function requireClinicRole(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return u?.role === "CLINIC";
}

// -------------------------
// Activation code generation
// -------------------------

const CODE_PREFIX = "FR";
// Exclude ambiguous characters (I, O, 0, 1) to reduce transcription errors
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
  // Example: FR-QQYJ-3HDH
  return `${CODE_PREFIX}-${randomChunk(4)}-${randomChunk(4)}`;
}

// -------------------------
// Schemas
// -------------------------

const CreateBatchSchema = z.object({
  clinicTag: z.string().min(2).max(64),
  quantity: z.number().int().min(1).max(5000),
});

// Strict 6-field config schema (NO DEFAULTS)
const PlanConfigSchema = z.object({
  recovery_region: z.enum(["leg_foot", "arm_hand", "torso", "face_neck", "general"]),
  recovery_duration: z.enum(["standard_0_7", "standard_8_14", "standard_15_21", "extended_22_plus"]),
  mobility_impact: z.enum(["none", "mild", "limited", "non_weight_bearing"]),
  incision_status: z.enum(["intact_dressings", "sutures_staples", "drains_present", "open_wound", "none_visible"]),
  discomfort_pattern: z.enum(["expected_soreness", "sharp_intermittent", "burning_tingling", "escalating"]),
  follow_up_expectation: z.enum(["within_7_days", "within_14_days", "within_30_days", "none_scheduled"]),
});

const ClinicActivationConfigSchema = z.object({
  config: PlanConfigSchema,
});

// -------------------------
// Routes
// -------------------------

/**
 * POST /clinic/batches
 * Create a batch and generate activation codes (printer-friendly later via CSV endpoint)
 *
 * IMPORTANT:
 * - Ensures ClinicPlanConfig exists for clinicTag (to satisfy ActivationCode.clinicTag FK)
 * - Generates exactly `quantity` UNIQUE codes for the batch (retries if collisions occur)
 */
clinicRouter.post("/batches", async (req, res) => {
  const userId = req.user!.id;

  const ok = await requireClinicRole(userId);
  if (!ok) return res.status(403).json({ code: "FORBIDDEN" });

  const parsed = CreateBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { clinicTag, quantity } = parsed.data;

  try {
    const batch = await prisma.$transaction(async (tx) => {
      // Ensure FK target exists
      await tx.clinicPlanConfig.upsert({
        where: { clinicTag },
        update: {},
        create: {
          clinicTag,
          // defaultCategory already has a default in schema; keep overrides empty
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

      // Insert codes; retry on collisions until we reach quantity
      let insertedTotal = 0;
      let safety = 0;

      while (insertedTotal < quantity) {
        safety++;
        if (safety > 25) {
          throw new Error("CODE_GEN_EXHAUSTED");
        }

        const remaining = quantity - insertedTotal;

        // Generate a little extra to compensate for rare collisions
        const genCount = Math.min(remaining + 5, 2000);

        const data = Array.from({ length: genCount }).map(() => ({
          code: makeActivationCode(),
          clinicTag,
          batchId: createdBatch.id,
          // status defaults to UNUSED
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

/**
 * GET /clinic/batches/:id/codes
 * Returns codes in JSON for printing / debugging
 */
clinicRouter.get("/batches/:id/codes", async (req, res) => {
  const userId = req.user!.id;

  const ok = await requireClinicRole(userId);
  if (!ok) return res.status(403).json({ code: "FORBIDDEN" });

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

/**
 * GET /clinic/batches/:id/codes.csv
 * Printer-friendly CSV export.
 */
clinicRouter.get("/batches/:id/codes.csv", async (req, res) => {
  const userId = req.user!.id;

  const ok = await requireClinicRole(userId);
  if (!ok) return res.status(403).json({ code: "FORBIDDEN" });

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
  const lines = codes
    .map((c) => `${c.code},${c.clinicTag ?? ""},${c.status}`)
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="activation-codes-${batchId}.csv"`);

  return res.status(200).send(header + lines + "\n");
});

/**
 * POST /clinic/activation/:code/config
 * Clinic submits the 6-field categorical config BEFORE patient exists.
 *
 * Rules:
 * - CLINIC role required
 * - ActivationCode must exist and be UNUSED (not claimed yet)
 * - No defaults; all 6 fields required
 * - Stores configJson + captured metadata on ActivationCode
 * - Prevents overwriting once set (simple audit story)
 */
clinicRouter.post("/activation/:code/config", async (req, res) => {
  const userId = req.user!.id;

  const ok = await requireClinicRole(userId);
  if (!ok) return res.status(403).json({ code: "FORBIDDEN" });

  const code = String(req.params.code ?? "").trim();
  if (!code) return res.status(400).json({ code: "VALIDATION_ERROR" });

  const parsed = ClinicActivationConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: parsed.error.issues,
    });
  }

  const configJson = parsed.data.config as unknown as Prisma.InputJsonValue;

  const activation = await prisma.activationCode.findUnique({
    where: { code },
    select: {
      id: true,
      status: true,
      configJson: true,
    },
  });

  if (!activation) return res.status(404).json({ code: "NOT_FOUND" });

  if (activation.status !== "UNUSED") {
    return res.status(409).json({ code: "CODE_ALREADY_CLAIMED" });
  }

  if (activation.configJson) {
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
