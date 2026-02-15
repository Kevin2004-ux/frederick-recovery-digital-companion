import { Prisma } from "@prisma/client";
// logic imports must have .js extension for NodeNext
import { resolvePlanModules, type PlanConfiguration } from "./rules.js"; 
import { CONTENT_LIBRARY } from "./contentLibrary.js"; 
import { enforceClinicOverrides } from "./enforceClinicOverrides.js"; // ✅ Import this!

// --- 1. Helper Functions ---

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(s => typeof s === "string" && s.trim().length > 0)));
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
    (obj.phase === "early" || obj.phase === "mid" || obj.phase === "late")
      ? obj.phase as "early" | "mid" | "late"
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

// --- 2. Scheduling Helpers ---

function addModule(day: DayV2, id: string) {
  day.moduleIds.push(id);
}

function addModuleEvery(days: DayV2[], id: string) {
  for (const d of days) addModule(d, id);
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
  const base = isPlainObject(input.templatePlanJson) ? (input.templatePlanJson as Record<string, unknown>) : {};
  const baseDaysRaw = asArray(base.days);
  const baseDays = baseDaysRaw.map((d, idx) => normalizeDayV2(d, idx));
  const days = ensure21Days(baseDays);

  // B. Run The Brain (Rules)
  const config = input.config as any as PlanConfiguration;
  const activeModuleIds = resolvePlanModules(config);
  
  const debugRulesApplied: string[] = [];

  for (const moduleId of activeModuleIds) {
    const moduleDef = (CONTENT_LIBRARY as Record<string, any>)[moduleId];
    
    if (!moduleDef) {
      continue;
    }

    debugRulesApplied.push(moduleId);

    // Simple scheduling logic
    switch (moduleDef.type) {
      case 'tracking':
      case 'task':
        addModuleEvery(days, moduleId);
        break;

      case 'education':
        if (days[0]) addModule(days[0], moduleId);
        break;

      case 'milestone':
        // Default milestones to day 14 (index 13)
        if (days[13]) addModule(days[13], moduleId);
        else if (days[0]) addModule(days[0], moduleId);
        break;
        
      default:
        if (days[0]) addModule(days[0], moduleId);
        break;
    }
  }

  // C. Cleanup & Deduplicate
  for (const d of days) {
    d.moduleIds = dedupe(d.moduleIds);
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
      engineVersion: input.engineVersion || "1.0.0",
      category: input.category || "general",
      generatedAt: new Date().toISOString(),
      appliedRules: debugRulesApplied,
    },
  };

  // E. ✅ FIX: ENFORCE CLINIC OVERRIDES
  // This step was missing/bypassed in the previous version.
  const enforcedPlanJson = enforceClinicOverrides({
    plan: planJson,
    overridesJson: input.clinicOverridesJson,
    // Optional: could log to a variable if we wanted to save the audit trail inside the JSON meta
    auditPush: (evt) => { 
        // We could push these to planJson.meta.clinicAuditEvents if desired
    }
  });
  
  return { 
    planJson: enforcedPlanJson as Prisma.InputJsonValue, 
    configJson: input.config as Prisma.InputJsonValue 
  };
};

export const generateRecoveryPlan = generatePlan;