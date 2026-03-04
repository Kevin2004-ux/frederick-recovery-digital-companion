import { Prisma } from "@prisma/client";
// logic imports must have .js extension for NodeNext
import { resolvePlanModules, type PlanConfiguration } from "./rules.js";
import { CONTENT_LIBRARY } from "./contentLibrary.js";
import { enforceClinicOverrides } from "./enforceClinicOverrides.js";

// --- 1. Helper Functions ---

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((s) => typeof s === "string" && s.trim().length > 0)));
}

function phaseForDay(day: number): "early" | "mid" | "late" {
  if (day <= 3) return "early";
  if (day <= 10) return "mid";
  return "late";
}

// Template v2 day shape
type DayV2 = {
  day: number; // 0..20
  phase: "early" | "mid" | "late";
  title: string;
  moduleIds: string[];
  boxItems: string[];
};

function normalizeDayV2(raw: unknown, dayIndex: number): DayV2 {
  const obj = isPlainObject(raw) ? raw : {};

  const day =
    typeof obj.day === "number" && Number.isFinite(obj.day)
      ? Math.max(0, Math.min(20, Math.floor(obj.day)))
      : dayIndex;

  const phase =
    obj.phase === "early" || obj.phase === "mid" || obj.phase === "late"
      ? (obj.phase as "early" | "mid" | "late")
      : phaseForDay(day);

  const title = typeof obj.title === "string" ? obj.title : `Day ${day + 1}`;

  const moduleIds = asArray(obj.moduleIds).filter((x) => typeof x === "string") as string[];
  const boxItems = asArray(obj.boxItems).filter((x) => typeof x === "string") as string[];

  return {
    day,
    phase,
    title,
    moduleIds,
    boxItems,
  };
}

/**
 * Ensures we always have exactly 21 days (0-20).
 */
function ensure21Days(days: DayV2[]): DayV2[] {
  const out: DayV2[] = [];
  const byDay = new Map<number, DayV2>();
  for (const d of days) byDay.set(d.day, d);

  for (let day = 0; day < 21; day++) {
    const existing = byDay.get(day);
    if (existing) {
      out.push({
        ...existing,
        day, // Force index consistency
        phase: phaseForDay(day),
      });
    } else {
      const phase = phaseForDay(day);
      let title = `Day ${day + 1}`;

      if (day === 0) title = "Day 1: Welcome & Setup";
      else if (day === 20) title = "Day 21: Graduation";

      out.push({
        day,
        phase,
        title,
        moduleIds: [],
        boxItems: [],
      });
    }
  }
  return out;
}

// --- 2. Scheduling Types + Helpers ---

type ScheduleTarget = number[] | "early" | "mid" | "late" | "all";

type ScheduledModuleLike = {
  id: string;
  schedule: ScheduleTarget;
};

type ContentModuleLike = {
  id?: string;
  type?: string;
  requiredBoxItems?: unknown;
};

function isScheduleTarget(v: unknown): v is ScheduleTarget {
  if (v === "all" || v === "early" || v === "mid" || v === "late") return true;
  if (Array.isArray(v)) {
    return v.every((n) => typeof n === "number" && Number.isFinite(n));
  }
  return false;
}

function isScheduledModuleLike(v: unknown): v is ScheduledModuleLike {
  return (
    isPlainObject(v) &&
    typeof v.id === "string" &&
    v.id.trim().length > 0 &&
    isScheduleTarget(v.schedule)
  );
}

function normalizeScheduledModule(raw: unknown): ScheduledModuleLike | null {
  // Backward-compatible path: legacy rules.ts may still return plain string IDs
  if (typeof raw === "string" && raw.trim().length > 0) {
    return { id: raw, schedule: "all" };
  }

  if (isScheduledModuleLike(raw)) {
    const normalizedSchedule: ScheduleTarget = Array.isArray(raw.schedule)
      ? raw.schedule
          .filter((n) => typeof n === "number" && Number.isFinite(n))
          .map((n) => Math.max(0, Math.min(20, Math.floor(n))))
      : raw.schedule;

    return {
      id: raw.id,
      schedule: normalizedSchedule,
    };
  }

  return null;
}

function resolveTargetDays(days: DayV2[], schedule: ScheduleTarget): DayV2[] {
  if (schedule === "all") return days;
  if (schedule === "early" || schedule === "mid" || schedule === "late") {
    return days.filter((d) => d.phase === schedule);
  }
  if (Array.isArray(schedule)) {
    const wanted = new Set(
      schedule
        .filter((n) => typeof n === "number" && Number.isFinite(n))
        .map((n) => Math.max(0, Math.min(20, Math.floor(n))))
    );
    return days.filter((d) => wanted.has(d.day));
  }
  return [];
}

function addModule(day: DayV2, id: string) {
  if (typeof id === "string" && id.trim().length > 0) {
    day.moduleIds.push(id);
  }
}

function addBoxItems(day: DayV2, items: unknown) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (typeof item === "string" && item.trim().length > 0) {
      day.boxItems.push(item);
    }
  }
}

function getLegacyScheduleForModuleType(moduleType: unknown): ScheduleTarget {
  switch (moduleType) {
    case "tracking":
    case "task":
      return "all";
    case "education":
      return [0];
    case "milestone":
      return [13]; // Day 14
    default:
      return [0];
  }
}

// --- 3. The Main Generator ---

export type GeneratePlanInput = {
  templatePlanJson?: unknown; // Optional base skeleton
  clinicOverridesJson?: unknown;
  config: unknown; // The 6 Fields from the UI
  engineVersion?: string;
  category?: string;
};

// Return type matches Prisma expectation
export type GeneratePlanOutput = {
  planJson: Prisma.InputJsonValue;
  configJson: Prisma.InputJsonValue;
};

/**
 * Main Generator Function
 */
export const generatePlan = (input: GeneratePlanInput): GeneratePlanOutput => {
  // A. Setup the Skeleton (21 Days)
  const base = isPlainObject(input.templatePlanJson)
    ? (input.templatePlanJson as Record<string, unknown>)
    : {};
  const baseDaysRaw = asArray(base.days);
  const baseDays = baseDaysRaw.map((d, idx) => normalizeDayV2(d, idx));
  const days = ensure21Days(baseDays);

  // B. Run The Brain (Rules)
  const config = input.config as any as PlanConfiguration;
  const rawActiveModules = resolvePlanModules(config) as unknown[];

  const debugRulesApplied: string[] = [];

  for (const rawModule of rawActiveModules) {
    const scheduled = normalizeScheduledModule(rawModule);
    if (!scheduled) continue;

    const moduleId = scheduled.id;
    const moduleDef = (CONTENT_LIBRARY as Record<string, ContentModuleLike>)[moduleId];

    if (!moduleDef) {
      continue;
    }

    debugRulesApplied.push(moduleId);

    // Backward compatibility:
    // If rules.ts still returns plain strings, those normalize to schedule: "all".
    // Preserve previous behavior by remapping legacy strings using module type.
    let effectiveSchedule: ScheduleTarget = scheduled.schedule;

    if (typeof rawModule === "string") {
      effectiveSchedule = getLegacyScheduleForModuleType(moduleDef.type);
    }

    const targetDays = resolveTargetDays(days, effectiveSchedule);

    for (const day of targetDays) {
      addModule(day, moduleId);
      addBoxItems(day, moduleDef.requiredBoxItems);
    }
  }

  // C. Cleanup & Deduplicate
  for (const d of days) {
    d.moduleIds = dedupe(d.moduleIds);
    d.boxItems = dedupe(d.boxItems);
  }

  // D. Construct Final JSON
  const planJson: any = {
    title: typeof base.title === "string" ? base.title : "Recovery Plan",
    disclaimer: typeof base.disclaimer === "string" ? base.disclaimer : "Not medical advice.",
    schemaVersion: 2,
    modules: CONTENT_LIBRARY, // Embed library for frontend
    clinicPolicy: {
      present: Boolean(input.clinicOverridesJson),
    },
    days,
    meta: {
      engineVersion: input.engineVersion || "1.1.0",
      category: input.category || "general",
      generatedAt: new Date().toISOString(),
      appliedRules: debugRulesApplied,
    },
  };

  // E. ENFORCE CLINIC OVERRIDES
  const enforcedPlanJson = enforceClinicOverrides({
    plan: planJson,
    overridesJson: input.clinicOverridesJson,
    auditPush: (_evt) => {
      // Intentionally preserved hook for future audit trail support
    },
  });

  return {
    planJson: enforcedPlanJson as Prisma.InputJsonValue,
    configJson: input.config as Prisma.InputJsonValue,
  };
};

export const generateRecoveryPlan = generatePlan;