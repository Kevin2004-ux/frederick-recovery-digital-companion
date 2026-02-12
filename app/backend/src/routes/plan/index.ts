// app/backend/src/routes/plan/index.ts
import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { getUserIdOrRespond } from "../../utils/requireUser.js";
import { prisma } from "../../prisma/client.js";

export const planRouter = Router();

// Auth required for all /plan endpoints
planRouter.use(requireAuth);

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

function extractDays(planJson: unknown): unknown[] | null {
  // We expect planJson like: { days: [...] } but we must be resilient.
  if (!isPlainObject(planJson)) return null;
  const days = (planJson as Record<string, unknown>)["days"];
  return Array.isArray(days) ? days : null;
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

function shapePlanInstance(instance: any) {
  return {
    id: instance.id,
    startDate: instance.startDate,
    engineVersion: instance.engineVersion,
    configJson: instance.configJson, // ✅ NEW
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

/**
 * GET /plan/current
 * Returns the latest plan instance for this user.
 * (Alias of GET /plan, but matches your new spec.)
 */
planRouter.get("/current", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const instance = await getLatestPlanInstanceForUser(userId);

  if (!instance) {
    return res.status(404).json({ code: "NO_PLAN" });
  }

  return res.status(200).json(shapePlanInstance(instance));
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

/**
 * GET /plan/today
 * Returns “Day X” info + today’s day block (if planJson.days exists)
 * plus a 3-day preview.
 */
planRouter.get("/today", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const instance = await getLatestPlanInstanceForUser(userId);

  if (!instance) {
    return res.status(404).json({ code: "NO_PLAN" });
  }

  const start = toUtcDateFromYmd(instance.startDate);
  if (!start) {
    return res.status(500).json({ code: "INVALID_PLAN_START_DATE" });
  }

  const todayYmd = ymdTodayUtc();
  const today = toUtcDateFromYmd(todayYmd)!;

  const msPerDay = 24 * 60 * 60 * 1000;
  let dayIndex = Math.floor((today.getTime() - start.getTime()) / msPerDay);
  if (dayIndex < 0) dayIndex = 0;

  const days = extractDays(instance.planJson);
  const dayBlock = days ? days[dayIndex] ?? null : null;
  const next3 = days ? days.slice(dayIndex + 1, dayIndex + 4) : [];

  return res.status(200).json({
    startDate: instance.startDate,
    today: todayYmd,
    dayIndex,
    dayBlock,
    nextDays: next3,
  });
});
