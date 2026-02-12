import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  type RecoveryPlanCategory,
  RecoveryPlanCategory as RecoveryPlanCategoryEnum,
} from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken } from "../../utils/jwt.js";
import { generatePlan } from "../../services/plan/generatePlan.js";

/**
 * POST /activation/claim
 *
 * Patient claim flow:
 * - Activation code REQUIRED to create account
 * - config OPTIONAL at claim-time (clinic config may be captured earlier by clinic user)
 *
 * Precedence (per handoff):
 * 1) req.body.config (if present + valid)
 * 2) ActivationCode.configJson (if present + valid)
 * 3) else => return planStatus: "NEEDS_CONFIG"
 *
 * Idempotency (per handoff):
 * - If activation already claimed by another user => error
 * - If same user re-claims => return consistent response (existing plan if present)
 * - Ensure only one RecoveryPlanInstance per activation code (guard in code)
 */

export const activationRouter = Router();

/**
 * Canonical 6-field categorical config (NO DEFAULTS).
 * These enum values must match the Feb 11, 2026 backend handoff.
 */
export const PlanConfigSchema = z.object({
  recovery_region: z.enum(["leg_foot", "arm_hand", "torso", "face_neck", "general"]),
  recovery_duration: z.enum(["standard_0_7", "standard_8_14", "standard_15_21", "extended_22_plus"]),
  mobility_impact: z.enum(["none", "mild", "limited", "non_weight_bearing"]),
  incision_status: z.enum(["intact_dressings", "sutures_staples", "drains_present", "open_wound", "none_visible"]),
  discomfort_pattern: z.enum(["expected_soreness", "sharp_intermittent", "burning_tingling", "escalating"]),
  follow_up_expectation: z.enum(["within_7_days", "within_14_days", "within_30_days", "none_scheduled"]),
});

const ClaimSchema = z.object({
  code: z.string().min(4),
  email: z.string().email(),
  password: z.string().min(8),

  // OPTIONAL now (clinic config can be captured earlier; patient may do it in onboarding)
  config: PlanConfigSchema.optional(),

  profile: z
    .object({
      displayName: z.string().optional(),
      recoveryCategory: z.nativeEnum(RecoveryPlanCategoryEnum).optional(),
    })
    .optional(),
});

activationRouter.post("/claim", async (req, res) => {
  const parsed = ClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: parsed.error.issues,
    });
  }

  const { code, email, password, profile } = parsed.data;

  // 1) Lookup activation code (allow UNUSED or CLAIMED for idempotency)
  const activation = await prisma.activationCode.findUnique({
    where: { code },
    include: { clinicConfig: true },
  });

  if (!activation) {
    return res.status(400).json({ code: "INVALID_ACTIVATION_CODE" });
  }

  if (activation.status !== "UNUSED" && activation.status !== "CLAIMED") {
    // Defensive: if other statuses exist later
    return res.status(400).json({ code: "INVALID_ACTIVATION_CODE" });
  }

  // 2) Create or authenticate user (patients only)
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const passwordHash = await hashPassword(password);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "PATIENT",
        emailVerifiedAt: new Date(),
      },
    });
  } else {
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ code: "INVALID_CREDENTIALS" });
  }

  // 3) If activation is already claimed, enforce ownership
  if (activation.status === "CLAIMED") {
    if (activation.claimedByUserId && activation.claimedByUserId !== user.id) {
      return res.status(409).json({ code: "CODE_ALREADY_CLAIMED" });
    }
  }

  // Always issue JWT on successful authentication
  const token = signAccessToken({ sub: user.id, email: user.email });

  // 4) If there is already a plan instance for this activation code, return it (idempotent)
  const existingInstance = await prisma.recoveryPlanInstance.findFirst({
    where: { activationCodeId: activation.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      startDate: true,
      templateId: true,
    },
  });

  if (existingInstance) {
    const template = await prisma.recoveryPlanTemplate.findUnique({
      where: { id: existingInstance.templateId },
      select: { title: true, category: true },
    });

    return res.status(200).json({
      token,
      planStatus: "READY",
      plan: {
        id: existingInstance.id,
        title: template?.title ?? "Recovery Plan",
        startDate: existingInstance.startDate,
        category: template?.category ?? RecoveryPlanCategoryEnum.general_outpatient,
      },
    });
  }

  // 5) Resolve plan category (clinicTag defaultCategory wins; else profile; else fallback)
  const fromProfile: RecoveryPlanCategory | undefined = profile?.recoveryCategory;

  const category: RecoveryPlanCategory =
    activation.clinicConfig?.defaultCategory ??
    fromProfile ??
    RecoveryPlanCategoryEnum.general_outpatient;

  // 6) Determine the effective config (request body wins; else use clinic-captured configJson)
  let effectiveConfig: unknown | undefined = parsed.data.config;

  if (!effectiveConfig && activation.configJson) {
    // Re-validate stored config to enforce the no-default contract
    const reParsed = PlanConfigSchema.safeParse(activation.configJson);
    if (!reParsed.success) {
      return res.status(500).json({ code: "INVALID_STORED_CONFIG" });
    }
    effectiveConfig = reParsed.data;
  }

  // 7) If still no config, claim code (if needed) and return NEEDS_CONFIG, no plan instance created
  if (!effectiveConfig) {
    // Claim the code if it is still UNUSED. If already CLAIMED by this user, this is still fine.
    await prisma.$transaction(async (tx) => {
      if (activation.status === "UNUSED") {
        const updated = await tx.activationCode.updateMany({
          where: { id: activation.id, status: "UNUSED" },
          data: {
            status: "CLAIMED",
            claimedByUserId: user!.id,
            claimedAt: new Date(),
          },
        });

        if (updated.count !== 1) throw new Error("CODE_ALREADY_CLAIMED");
      }
    });

    return res.status(201).json({
      token,
      planStatus: "NEEDS_CONFIG",
    });
  }

  // 8) Select latest template (only if generating a plan)
  const template = await prisma.recoveryPlanTemplate.findFirst({
    where: { category },
    orderBy: { version: "desc" },
  });

  if (!template) {
    return res.status(500).json({ code: "NO_PLAN_TEMPLATE" });
  }

  // 9) Generate plan deterministically
  const { planJson, configJson } = generatePlan({
    templatePlanJson: template.planJson,
    clinicOverridesJson: activation.clinicConfig?.overridesJson,
    config: effectiveConfig,
    engineVersion: "v1",
    category,
  });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 10) Transaction: claim code (if needed) + create plan instance once
  const planInstance = await prisma.$transaction(async (tx) => {
    // If still UNUSED, claim now (race-safe)
    if (activation.status === "UNUSED") {
      const updated = await tx.activationCode.updateMany({
        where: { id: activation.id, status: "UNUSED" },
        data: {
          status: "CLAIMED",
          claimedByUserId: user!.id,
          claimedAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw new Error("CODE_ALREADY_CLAIMED");
      }
    }

    // Guard: ensure no instance exists (race-safe)
    const already = await tx.recoveryPlanInstance.findFirst({
      where: { activationCodeId: activation.id },
      select: { id: true, startDate: true, templateId: true },
    });

    if (already) return already;

    return tx.recoveryPlanInstance.create({
      data: {
        userId: user!.id,
        activationCodeId: activation.id,
        templateId: template.id,
        engineVersion: "v1",
        startDate: today,
        configJson: configJson as unknown as Prisma.InputJsonValue,
        planJson: planJson as unknown as Prisma.InputJsonValue,
      },
    });
  });

  return res.status(201).json({
    token,
    planStatus: "READY",
    plan: {
      id: (planInstance as any).id,
      title: template.title,
      startDate: (planInstance as any).startDate,
      category: template.category,
    },
  });
});
