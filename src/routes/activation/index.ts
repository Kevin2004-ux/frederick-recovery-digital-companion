// app/backend/src/routes/activation/index.ts
import { Router } from "express";
import { z } from "zod";
import { Prisma, ActivationCodeStatus, UserRole } from "@prisma/client";
import { RecoveryPlanCategory as RecoveryPlanCategoryEnum } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken } from "../../utils/jwt.js";
// ✅ IMPORT CHECK: generatePlan is now correctly exported from generatePlan.ts
import { generatePlan } from "../../services/plan/generatePlan.js";
import { AuditService, AuditCategory, AuditStatus } from "../../services/AuditService.js";

export const activationRouter = Router();

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
  config: PlanConfigSchema.optional(),
  profile: z.object({
    displayName: z.string().optional(),
    recoveryCategory: z.nativeEnum(RecoveryPlanCategoryEnum).optional(),
  }).optional(),
});

activationRouter.post("/claim", async (req, res) => {
  const parsed = ClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { code, email, password, profile } = parsed.data;

  // 1. Lookup code
  const activation = await prisma.activationCode.findUnique({
    where: { code },
    include: { clinicConfig: true },
  });

  if (!activation || activation.status === ActivationCodeStatus.INVALIDATED) {
    AuditService.log({
      req, category: AuditCategory.ACCESS, type: "FAILED_CLAIM_ATTEMPT",
      status: AuditStatus.FAILURE, metadata: { code, reason: "NOT_FOUND_OR_INVALIDATED" }
    });
    return res.status(400).json({ code: "INVALID_ACTIVATION_CODE" });
  }

  // 2. Authenticate or Create Patient
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const passwordHash = await hashPassword(password);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.PATIENT,
        emailVerifiedAt: new Date(), 
      },
    });
  } else {
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ code: "INVALID_CREDENTIALS" });
  }

  // 3. Ownership Guard for existing claims
  if (activation.status === ActivationCodeStatus.CLAIMED) {
    if (activation.claimedByUserId !== user.id) {
      AuditService.log({
        req, category: AuditCategory.ACCESS, type: "CODE_HIJACK_ATTEMPT",
        userId: user.id, role: user.role, status: AuditStatus.FORBIDDEN, metadata: { code }
      });
      return res.status(409).json({ code: "CODE_ALREADY_CLAIMED" });
    }
  }

  const token = signAccessToken({ sub: user.id, email: user.email, role: user.role });

  // 4. Resolve Config
  let effectiveConfig: any = parsed.data.config;
  if (!effectiveConfig && activation.configJson) {
    const reParsed = PlanConfigSchema.safeParse(activation.configJson);
    if (reParsed.success) effectiveConfig = reParsed.data;
  }

  // 5. Atomic Claim (The "Lock Moment")
  if (activation.status !== ActivationCodeStatus.CLAIMED) {
    const updated = await prisma.activationCode.updateMany({
      where: { 
        id: activation.id, 
        status: { notIn: [ActivationCodeStatus.CLAIMED, ActivationCodeStatus.INVALIDATED] } 
      },
      data: {
        status: ActivationCodeStatus.CLAIMED,
        claimedByUserId: user.id,
        claimedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return res.status(409).json({ code: "CODE_ALREADY_CLAIMED" });
    }

    AuditService.log({
      req, category: AuditCategory.PLAN, type: "ACTIVATION_CODE_CLAIMED",
      userId: user.id, role: user.role, clinicTag: activation.clinicTag, targetId: activation.id, targetType: "ActivationCode", status: AuditStatus.SUCCESS
    });
  }

  // 6. Return NEEDS_CONFIG if patient hasn't answered the onboarding questions yet
  if (!effectiveConfig) {
    return res.status(201).json({ token, planStatus: "NEEDS_CONFIG" });
  }

  // 7. Check if plan already exists (Idempotent return)
  const existingInstance = await prisma.recoveryPlanInstance.findFirst({
    where: { activationCodeId: activation.id },
    include: { template: true },
  });

  if (existingInstance) {
    return res.status(200).json({
      token, planStatus: "READY",
      plan: { 
        id: existingInstance.id, 
        title: existingInstance.template.title, 
        startDate: existingInstance.startDate, 
        category: existingInstance.template.category 
      },
    });
  }

  // 8. Generate Immutable Plan Snapshot
  const category = activation.clinicConfig?.defaultCategory ?? profile?.recoveryCategory ?? RecoveryPlanCategoryEnum.general_outpatient;
  
  let template = await prisma.recoveryPlanTemplate.findFirst({ 
    where: { category, clinicTag: activation.clinicTag }, 
    orderBy: { version: "desc" } 
  });

  if (!template) {
    template = await prisma.recoveryPlanTemplate.findFirst({ 
      where: { category, clinicTag: null }, 
      orderBy: { version: "desc" } 
    });
  }

  if (!template) return res.status(500).json({ code: "NO_PLAN_TEMPLATE" });

  // ✅ GENERATOR CALL: Now correctly utilizes the renamed function
  const { planJson, configJson } = generatePlan({
    templatePlanJson: template.planJson,
    clinicOverridesJson: null, 
    config: effectiveConfig,
    engineVersion: "v1",
    category,
  });

  // 9. Persist the plan instance
  const planInstance = await prisma.recoveryPlanInstance.create({
    data: {
      userId: user.id,
      activationCodeId: activation.id,
      templateId: template.id,
      engineVersion: "v1",
      startDate: new Date().toISOString().slice(0, 10),
      configJson: configJson as Prisma.InputJsonValue,
      planJson: planJson as Prisma.InputJsonValue,
    },
  });

  AuditService.log({
    req, category: AuditCategory.PLAN, type: "PATIENT_PLAN_GENERATED",
    userId: user.id, role: user.role, targetId: planInstance.id, targetType: "RecoveryPlanInstance", status: AuditStatus.SUCCESS
  });

  return res.status(201).json({
    token, planStatus: "READY",
    plan: { 
      id: planInstance.id, 
      title: template.title, 
      startDate: planInstance.startDate, 
      category: template.category 
    },
  });
});