// app/backend/src/routes/plan/index.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  type RecoveryPlanCategory,
  RecoveryPlanCategory as RecoveryPlanCategoryEnum,
} from "@prisma/client";

import { requireAuth } from "../../middleware/requireAuth.js";
import { getUserIdOrRespond } from "../../utils/requireUser.js";
import { prisma } from "../../prisma/client.js";
import { generatePlan } from "../../services/plan/generatePlan.js";

export const planRouter = Router();

// Auth required for all /plan endpoints
planRouter.use(requireAuth);

/**
 * Canonical 6-field categorical config (NO DEFAULTS).
 * Must match Feb 11, 2026 backend handoff.
 */
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

const GeneratePlanSchema = z.object({
  config: PlanConfigSchema,
});

function toUtcDateFromYmd(ymd: string): Date | null {
  // Expect YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymdTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractDays(planJson: unknown): any[] | null {
  // We expect planJson like: { days: [...] } but we must be resilient.
  if (!isPlainObject(planJson)) return null;
  const days = (planJson as Record<string, unknown>)["days"];
  return Array.isArray(days) ? (days as any[]) : null;
}

async function getLatestPlanInstanceForUser(userId: string) {
  // If you later support multiple instances, this chooses the newest
  return prisma.recoveryPlanInstance.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      template: true,
      activationCode: true,
    },
  });
}

async function regenInstanceIfRequested(args: {
  instance: any;
  regen: boolean;
}) {
  const { instance, regen } = args;

  // DEV-only regen (ignored in prod)
  if (!regen || process.env.NODE_ENV === "production") {
    return instance;
  }

  const category: RecoveryPlanCategory = instance.template.category;

  // Always regen from latest template version for this category
  const template = await prisma.recoveryPlanTemplate.findFirst({
    where: { category },
    orderBy: { version: "desc" },
  });

  if (!template) {
    throw Object.assign(new Error("NO_PLAN_TEMPLATE"), { code: "NO_PLAN_TEMPLATE" });
  }

  const { planJson, configJson } = generatePlan({
    templatePlanJson: template.planJson,
    clinicOverridesJson: instance.activationCode?.clinicConfig?.overridesJson,
    config: instance.configJson,
    engineVersion: "v1",
    category,
  });

  // Persist regen to DB
  const updated = await prisma.recoveryPlanInstance.update({
    where: { id: instance.id },
    data: {
      templateId: template.id,
      engineVersion: "v1",
      configJson: configJson as unknown as Prisma.InputJsonValue,
      planJson: planJson as unknown as Prisma.InputJsonValue,
    },
    include: {
      template: true,
      activationCode: {
        include: { clinicConfig: true },
      },
    },
  });

  return updated;
}

function shapePlanInstance(instance: any) {
  return {
    id: instance.id,
    startDate: instance.startDate,
    engineVersion: instance.engineVersion,
    configJson: instance.configJson,
    activationCode: {
      id: instance.activationCode.id,
      clinicTag: instance.activationCode.clinicTag ?? null,
      claimedAt: instance.activationCode.claimedAt ?? null,
    },
    template: {
      id: instance.template.id,
      title: instance.template.title,
      category: instance.template.category,
      version: instance.template.version,
      sourcesJson: instance.template.sourcesJson ?? null,
    },
    planJson: instance.planJson,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
  };
}

function resolvePlanForFrontend(shaped: any) {
  const planJson = shaped?.planJson;

  if (!isPlainObject(planJson)) return shaped;

  const schemaVersion = (planJson as any).schemaVersion;
  const modulesDict = (planJson as any).modules;
  const days = (planJson as any).days;

  // Only resolve for schemaVersion 2 with modules + days present
  if (schemaVersion !== 2) return shaped;
  if (!isPlainObject(modulesDict)) return shaped;
  if (!Array.isArray(days)) return shaped;

  const resolvedDays = days.map((day: any) => {
    const moduleIds: string[] = Array.isArray(day?.moduleIds) ? day.moduleIds : [];
    const modulesResolved = moduleIds.map((id) => (modulesDict as any)[id]).filter(Boolean);
    return { ...day, modulesResolved };
  });

  return {
    ...shaped,
    planJson: {
      ...planJson,
      days: resolvedDays,
    },
  };
}

function resolveDayBlock(planJson: any, dayBlock: any) {
  // Resolve a single dayBlock using planJson.modules dict (schemaVersion 2)
  if (!isPlainObject(planJson)) return dayBlock;

  const schemaVersion = (planJson as any).schemaVersion;
  const modulesDict = (planJson as any).modules;

  if (schemaVersion !== 2) return dayBlock;
  if (!isPlainObject(modulesDict)) return dayBlock;
  if (!isPlainObject(dayBlock)) return dayBlock;

  const moduleIds: string[] = Array.isArray((dayBlock as any).moduleIds)
    ? (dayBlock as any).moduleIds
    : [];
  const modulesResolved = moduleIds.map((id) => (modulesDict as any)[id]).filter(Boolean);

  return { ...dayBlock, modulesResolved };
}

/**
 * POST /plan/generate
 * Patient submits the 6-field categorical config AFTER claiming activation code
 */
planRouter.post("/generate", async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = getUserIdOrRespond(req, res);
    if (!userId) return;

    const parsed = GeneratePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    // Find the user's claimed activation code (most recent)
    const activation = await prisma.activationCode.findFirst({
      where: {
        claimedByUserId: userId,
        status: "CLAIMED",
      },
      orderBy: { claimedAt: "desc" },
      include: { clinicConfig: true },
    });

    if (!activation) {
      return res.status(400).json({ code: "NO_CLAIMED_ACTIVATION_CODE", message: "No activation code found for this user." });
    }

    // Enforce one instance per activation code
    const existing = await prisma.recoveryPlanInstance.findFirst({
      where: { activationCodeId: activation.id },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ code: "PLAN_ALREADY_EXISTS", message: "A plan has already been generated." });
    }

    const category: RecoveryPlanCategory =
      activation.clinicConfig?.defaultCategory ?? RecoveryPlanCategoryEnum.general_outpatient;

    const template = await prisma.recoveryPlanTemplate.findFirst({
      where: { category },
      orderBy: { version: "desc" },
    });

    if (!template) {
      console.error(`[Plan Generate] NO_PLAN_TEMPLATE found for category: ${category}`);
      return res.status(500).json({ code: "NO_PLAN_TEMPLATE", message: "No recovery plan template exists in the database for this category." });
    }

    const { planJson, configJson } = generatePlan({
      templatePlanJson: template.planJson,
      clinicOverridesJson: activation.clinicConfig?.overridesJson,
      config: parsed.data.config,
      engineVersion: "v1",
      category,
    });

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const instance = await prisma.recoveryPlanInstance.create({
      data: {
        userId,
        activationCodeId: activation.id,
        templateId: template.id,
        engineVersion: "v1",
        startDate: today,
        configJson: configJson as unknown as Prisma.InputJsonValue,
        planJson: planJson as unknown as Prisma.InputJsonValue,
      },
      include: {
        template: true,
        activationCode: true,
      },
    });

    return res.status(201).json({
      planStatus: "READY",
      plan: {
        id: instance.id,
        title: instance.template.title,
        startDate: instance.startDate,
        category: instance.template.category,
      },
    });
  } catch (error) {
    console.error("Plan Generation CRITICAL Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /plan/current
 * Returns the latest plan instance for this user.
 * DEV: add ?regen=1 to rebuild plan (ignored in production).
 */
planRouter.get("/current", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const regen = String(req.query.regen ?? "") === "1";

  // If regen requested, include clinicConfig for overridesJson
  const instance = regen
    ? await prisma.recoveryPlanInstance.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          template: true,
          activationCode: { include: { clinicConfig: true } },
        },
      })
    : await getLatestPlanInstanceForUser(userId);

  if (!instance) {
    return res.status(404).json({ code: "NO_PLAN" });
  }

  try {
    const maybeUpdated = await regenInstanceIfRequested({ instance, regen });
    return res.status(200).json(shapePlanInstance(maybeUpdated));
  } catch (e: any) {
    if (e?.code === "NO_PLAN_TEMPLATE") {
      return res.status(500).json({ code: "NO_PLAN_TEMPLATE" });
    }
    throw e;
  }
});

/**
 * GET /plan/current/resolved
 * Same as /plan/current but resolves modulesResolved into each day (schemaVersion 2).
 * DEV: add ?regen=1 to rebuild plan (ignored in production).
 */
planRouter.get("/current/resolved", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const regen = String(req.query.regen ?? "") === "1";

  const instance = await prisma.recoveryPlanInstance.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      template: true,
      activationCode: {
        include: { clinicConfig: true },
      },
    },
  });

  if (!instance) {
    return res.status(404).json({ code: "NO_PLAN" });
  }

  try {
    const maybeUpdated = await regenInstanceIfRequested({ instance, regen });
    const shaped = shapePlanInstance(maybeUpdated);
    const resolved = resolvePlanForFrontend(shaped);
    return res.status(200).json(resolved);
  } catch (e: any) {
    if (e?.code === "NO_PLAN_TEMPLATE") {
      return res.status(500).json({ code: "NO_PLAN_TEMPLATE" });
    }
    throw e;
  }
});

/**
 * GET /plan/today/resolved
 * Returns today's dayBlock + next 3 days, resolved with modulesResolved.
 * DEV: add ?regen=1 to rebuild plan (ignored in production).
 *
 * IMPORTANT: must be declared BEFORE "/:id" to avoid route shadowing.
 */
planRouter.get("/today/resolved", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const regen = String(req.query.regen ?? "") === "1";

  // Need clinicConfig only for regen, but easiest is to always include it here
  const instance = await prisma.recoveryPlanInstance.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      template: true,
      activationCode: { include: { clinicConfig: true } },
    },
  });

  if (!instance) {
    return res.status(404).json({ code: "NO_PLAN" });
  }

  let finalInstance = instance;

  try {
    finalInstance = await regenInstanceIfRequested({ instance, regen });
  } catch (e: any) {
    if (e?.code === "NO_PLAN_TEMPLATE") {
      return res.status(500).json({ code: "NO_PLAN_TEMPLATE" });
    }
    throw e;
  }

  const start = toUtcDateFromYmd(finalInstance.startDate);
  if (!start) {
    return res.status(500).json({ code: "INVALID_PLAN_START_DATE" });
  }

  const todayYmd = ymdTodayUtc();
  const today = toUtcDateFromYmd(todayYmd)!;

  const msPerDay = 24 * 60 * 60 * 1000;
  let dayIndex = Math.floor((today.getTime() - start.getTime()) / msPerDay);
  if (dayIndex < 0) dayIndex = 0;

  const days = extractDays(finalInstance.planJson);
  const dayBlockRaw = days ? days[dayIndex] ?? null : null;
  const next3Raw = days ? days.slice(dayIndex + 1, dayIndex + 4) : [];

  const planJson = finalInstance.planJson as any;
  const dayBlock = dayBlockRaw ? resolveDayBlock(planJson, dayBlockRaw) : null;
  const nextDays = next3Raw.map((d) => resolveDayBlock(planJson, d));

  return res.status(200).json({
    startDate: finalInstance.startDate,
    today: todayYmd,
    dayIndex,
    dayBlock,
    nextDays,
  });
});

/**
 * GET /plan/:id
 * Returns a specific plan instance by id, must belong to user.
 */
planRouter.get("/:id", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const id = req.params.id;

  const instance = await prisma.recoveryPlanInstance.findFirst({
    where: { id, userId },
    include: {
      template: true,
      activationCode: true,
    },
  });

  if (!instance) {
    return res.status(404).json({ code: "NOT_FOUND" });
  }

  return res.status(200).json(shapePlanInstance(instance));
});

/**
 * GET /plan
 * Returns the user’s latest full plan instance + template metadata.
 * (Kept for backward compatibility.)
 */
planRouter.get("/", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const instance = await getLatestPlanInstanceForUser(userId);

  if (!instance) {
    return res.status(404).json({ code: "NO_PLAN" });
  }

  return res.status(200).json(shapePlanInstance(instance));
});