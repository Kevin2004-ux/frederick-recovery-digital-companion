// app/backend/src/services/plan/generatePlan.ts
import { resolvePlanModules, PlanConfiguration } from "./rules.js"; // Added .js
import { CONTENT_LIBRARY } from "./contentLibrary.js"; // Added .js
// ... rest of the file stays the same
import { Prisma } from "@prisma/client";
import { enforceClinicOverrides } from "./enforceClinicOverrides.js";
import { resolvePlanModules, PlanConfiguration } from "./rules"; // The Brain
import { CONTENT_LIBRARY } from "./contentLibrary"; // The Inventory

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
      ? obj.phase
      : phaseForDay(day);

  const title = typeof obj.title === "string" ? obj.title : `Day ${day + 1}`; // Display as Day 1, 2...

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
 * If the template is empty, it generates a skeleton.
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
      
      // Simple dynamic titles if missing
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
  templatePlanJson: unknown; // Optional base skeleton
  clinicOverridesJson?: unknown;
  config: unknown; // The 6 Fields from the UI
  engineVersion: string;
  category: string;
};

export type GeneratePlanOutput = {
  planJson: Prisma.InputJsonValue;
  configJson: Prisma.InputJsonValue;
};

export function generatePlan(input: GeneratePlanInput): GeneratePlanOutput {
  // A. Setup the Skeleton (21 Days)
  const base = isPlainObject(input.templatePlanJson) ? (input.templatePlanJson as Record<string, unknown>) : {};
  const baseDaysRaw = asArray(base.days);
  const baseDays = baseDaysRaw.map((d, idx) => normalizeDayV2(d, idx));
  const days = ensure21Days(baseDays);

  // B. Run The Brain (Rules)
  // 1. Cast the input config to our typed interface
  const config = (isPlainObject(input.config) ? input.config : {}) as PlanConfiguration;

  // 2. Get the list of IDs from rules.ts
  // This is the "Medical Logic" - it decides WHAT goes in.
  const activeModuleIds = resolvePlanModules(config);
  
  // 3. Schedule the modules based on their Type
  // This is the "Scheduling Logic" - it decides WHEN it goes in.
  const debugRulesApplied: string[] = [];

  for (const moduleId of activeModuleIds) {
    const moduleDef = CONTENT_LIBRARY[moduleId];
    
    // If module not found in library, skip (safety check)
    if (!moduleDef) {
      console.warn(`Brain suggested module '${moduleId}' but it is not in ContentLibrary.`);
      continue;
    }

    debugRulesApplied.push(moduleId);

    switch (moduleDef.type) {
      case 'tracking':
      case 'task':
        // Tracking and Tasks happen DAILY
        addModuleEvery(days, moduleId);
        break;

      case 'education':
        // Education happens primarily on Day 0 (Start)
        // Improvement: We could stagger these later based on phase
        if (days[0]) addModule(days[0], moduleId);
        break;

      case 'milestone':
        // Milestones (like Follow Up) default to Day 13 (2 weeks)
        // You can make this smarter later
        if (days[13]) addModule(days[13], moduleId);
        else if (days[0]) addModule(days[0], moduleId);
        break;
        
      default:
        // Default fallthrough: Add to Day 0
        if (days[0]) addModule(days[0], moduleId);
        break;
    }
  }

  // C. Cleanup & Deduplicate
  for (const d of days) {
    d.moduleIds = dedupe(d.moduleIds);
  }

  // D. Construct Final JSON
  const planJson = {
    title: typeof base.title === "string" ? base.title : "Recovery Plan",
    disclaimer: typeof base.disclaimer === "string" ? base.disclaimer : "Not medical advice.",
    schemaVersion: 2,
    
    // Embed the Full Library so the Frontend can render content
    // This allows the frontend to just look up `plan.modules['id']`
    modules: CONTENT_LIBRARY, 

    clinicPolicy: {
      present: Boolean(input.clinicOverridesJson),
    },

    days,

    meta: {
      engineVersion: input.engineVersion,
      category: input.category,
      schemaVersion: 2,
      config: input.config,
      appliedRules: debugRulesApplied,
      clinicOverrides: { version: null, note: null },
      clinicAuditEvents: [],
    },
  } as Prisma.InputJsonValue;

  // E. Enforce Clinic Overrides (The "Safety Valve")
  // This ensures that if a clinic banned a module, it gets removed here.
  const clinicAuditEvents: any[] = [];
  
  const enforcedPlanJson = enforceClinicOverrides({
    plan: planJson,
    overridesJson: input.clinicOverridesJson,
    auditPush: (evt) => clinicAuditEvents.push(evt),
  }) as any;

  // F. Final Polish (Resolving Modules for Frontend convenience)
  // We attach the full module objects to the day for easier frontend rendering
  const enforcedModulesLib = isPlainObject(enforcedPlanJson.modules) ? enforcedPlanJson.modules : {};
  const enforcedDays = Array.isArray(enforcedPlanJson.days) ? enforcedPlanJson.days : [];

  enforcedPlanJson.days = enforcedDays.map((d: any) => {
    const moduleIds = Array.isArray(d?.moduleIds) ? (d.moduleIds as string[]) : [];
    const modulesResolved = moduleIds
      .map((id: string) => enforcedModulesLib[id])
      .filter((m: any) => m !== undefined && m !== null);
    return { ...d, modulesResolved };
  });

  // Attach Audit Trail
  enforcedPlanJson.meta = {
    ...(isPlainObject(enforcedPlanJson.meta) ? enforcedPlanJson.meta : {}),
    clinicAuditEvents,
  };

  return { 
    planJson: enforcedPlanJson as Prisma.InputJsonValue, 
    configJson: input.config as Prisma.InputJsonValue 
  };
}