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
 * - config OPTIONAL at claim-time (clinic config may be captured earlier by doctor)
 *
 * Behavior:
 * - If config provided OR activation code already has configJson => generate plan + create instance
 * - Else => return planStatus: "NEEDS_CONFIG" and do NOT create instance
 */

export const activationRouter = Router();

/**
 * Strict categorical config (no defaults).
 * Keep values stable; frontend depends on them.
 */
export const PlanConfigSchema = z.object({
  recovery_region: z.enum([
    "head_neck",
    "chest",
    "abdomen",
    "back",
    "arm_hand",
    "leg_foot",
    "general",
  ]),
  recovery_duration: z.enum([
    "short_3_7",
    "medium_8_14",
    "standard_15_21",
    "extended_22_42",
  ]),
  mobility_impact: z.enum([
    "none",
    "limited",
    "assistive_device",
    "non_weight_bearing",
  ]),
  incision_status: z.enum([
    "intact_dressings",
    "minor_drainage",
    "open_or_wet",
    "has_drains",
  ]),
  discomfort_pattern: z.enum([
    "expected_soreness",
    "sharp_with_movement",
    "throbbing",
    "burning_or_nerve",
  ]),
  follow_up_expectation: z.enum([
    "none_scheduled",
    "within_7_days",
    "within_14_days",
    "within_21_days",
    "unknown",
  ]),
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

activationRouter.post("/claim", async (req, res) => {
  const parsed = ClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: parsed.error.issues,
    });
  }

  const { code, email, password, profile } = parsed.data;

  // 1) Lookup activation code
  const activation = await prisma.activationCode.findUnique({
    where: { code },
    include: { clinicConfig: true },
  });

  if (!activation || activation.status !== "UNUSED") {
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

  // 3) Resolve plan category (clinicTag config wins)
  const fromProfile: RecoveryPlanCategory | undefined = profile?.recoveryCategory;

  const category: RecoveryPlanCategory =
    activation.clinicConfig?.defaultCategory ??
    fromProfile ??
    RecoveryPlanCategoryEnum.general_outpatient;

  // 4) Determine the effective config (request body wins; else use doctor-captured config)
  let effectiveConfig: unknown | undefined = parsed.data.config;

  if (!effectiveConfig && activation.configJson) {
    // Re-validate stored config to enforce the no-default contract
    const reParsed = PlanConfigSchema.safeParse(activation.configJson);
    if (!reParsed.success) {
      return res.status(500).json({ code: "INVALID_STORED_CONFIG" });
    }
    effectiveConfig = reParsed.data;
  }

  // Always issue JWT on successful claim
  const token = signAccessToken({ sub: user.id, email: user.email });

  // 5) If still no config, return NEEDS_CONFIG and DO NOT create a plan instance
  if (!effectiveConfig) {
    // Claim code but no plan yet
    await prisma.$transaction(async (tx) => {
      const updated = await tx.activationCode.updateMany({
        where: { id: activation.id, status: "UNUSED" },
        data: {
          status: "CLAIMED",
          claimedByUserId: user!.id,
          claimedAt: new Date(),
        },
      });

      if (updated.count !== 1) throw new Error("CODE_ALREADY_CLAIMED");
    });

    return res.status(201).json({
      token,
      planStatus: "NEEDS_CONFIG",
    });
  }

  // 6) Select latest template (only if generating a plan)
  const template = await prisma.recoveryPlanTemplate.findFirst({
    where: { category },
    orderBy: { version: "desc" },
  });

  if (!template) {
    return res.status(500).json({ code: "NO_PLAN_TEMPLATE" });
  }

  // 7) Generate plan deterministically
  const { planJson, configJson } = generatePlan({
    templatePlanJson: template.planJson,
    clinicOverridesJson: activation.clinicConfig?.overridesJson,
    config: effectiveConfig,
    engineVersion: "v1",
    category,
  });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 8) Transaction: claim code + create plan instance
  const planInstance = await prisma.$transaction(async (tx) => {
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
      id: planInstance.id,
      title: template.title,
      startDate: planInstance.startDate,
      category: template.category,
    },
  });
});
