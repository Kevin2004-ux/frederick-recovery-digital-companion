// app/backend/src/services/plan/enforceClinicOverrides.ts
import { z } from "zod";

/**
 * Clinic override policy schema (lightweight + enforceable).
 * Stored in ClinicPlanConfig.overridesJson (Json?).
 *
 * IMPORTANT: This does NOT allow medical instructions. It's only about
 * requiring/forbidding existing vetted modules + simple scheduling constraints.
 */
export const ClinicOverridesSchema = z
  .object({
    version: z.number().int().positive().optional(),
    note: z.string().optional(),

    requiredModuleIds: z.array(z.string()).optional(),
    forbiddenModuleIds: z.array(z.string()).optional(),

    requiredByPhase: z
      .object({
        early: z.array(z.string()).optional(),
        mid: z.array(z.string()).optional(),
        late: z.array(z.string()).optional(),
      })
      .optional(),

    requiredByDay: z.record(z.array(z.string())).optional(),

    // UX guardrail only; deterministic trimming
    maxModulesPerDay: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export type ClinicOverrides = z.infer<typeof ClinicOverridesSchema>;

type AuditEvent =
  | {
      type: "clinic_overrides_invalid";
      message: string;
      issues?: unknown;
    }
  | {
      type: "clinic_require_added";
      day: number;
      moduleId: string;
      reason: string;
    }
  | {
      type: "clinic_forbid_removed";
      day: number;
      moduleId: string;
      reason: string;
    }
  | {
      type: "clinic_cap_trimmed";
      day: number;
      removed: string[];
      max: number;
      reason: string;
    }
  | {
      type: "clinic_unknown_module_ignored";
      moduleId: string;
      reason: string;
    };

type ModuleMeta = {
  requiredBoxItems?: unknown;
};

function uniqPreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function removeAll(ids: string[], toRemove: Set<string>): string[] {
  return ids.filter((id) => !toRemove.has(id));
}

function addAll(ids: string[], toAdd: string[]): string[] {
  return uniqPreserveOrder([...ids, ...toAdd]);
}

function stableCap(ids: string[], max: number): { kept: string[]; removed: string[] } {
  if (ids.length <= max) return { kept: ids, removed: [] };
  return { kept: ids.slice(0, max), removed: ids.slice(max) };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeDayNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1000, Math.floor(n)));
}

function normalizePhase(v: unknown): "early" | "mid" | "late" | "" {
  return v === "early" || v === "mid" || v === "late" ? v : "";
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return uniqPreserveOrder(v.filter((x): x is string => typeof x === "string" && x.trim().length > 0));
}

function deriveBoxItemsFromModules(
  moduleIds: string[],
  modulesDict: Record<string, unknown>,
  existingBoxItems: unknown
): string[] {
  const fromExisting = normalizeStringArray(existingBoxItems);
  const derived: string[] = [];

  for (const moduleId of moduleIds) {
    const moduleMeta = modulesDict[moduleId] as ModuleMeta | undefined;
    if (!moduleMeta || !Array.isArray(moduleMeta.requiredBoxItems)) continue;

    for (const item of moduleMeta.requiredBoxItems) {
      if (typeof item === "string" && item.trim().length > 0) {
        derived.push(item);
      }
    }
  }

  return uniqPreserveOrder([...fromExisting, ...derived]);
}

/**
 * Enforce clinic overrides on a planJson that already includes:
 * - schemaVersion 2
 * - meta
 * - modules dictionary
 * - days array with moduleIds
 *
 * Returns a NEW plan object (does not mutate input).
 */
export function enforceClinicOverrides(args: {
  plan: any; // planJson
  overridesJson: unknown; // ClinicPlanConfig.overridesJson
  auditPush?: (evt: AuditEvent) => void;
}) {
  const { plan, overridesJson, auditPush } = args;

  // If no overrides, return original plan
  if (!overridesJson) return plan;

  const parsed = ClinicOverridesSchema.safeParse(overridesJson);
  if (!parsed.success) {
    auditPush?.({
      type: "clinic_overrides_invalid",
      message: "Clinic overridesJson failed validation; ignoring overrides.",
      issues: parsed.error.issues,
    });
    return plan;
  }

  const overrides = parsed.data;

  // Validate plan shape (fail closed -> return plan)
  if (!isPlainObject(plan) || !Array.isArray(plan.days) || !isPlainObject(plan.modules)) {
    auditPush?.({
      type: "clinic_overrides_invalid",
      message: "Plan shape is not compatible with enforcement; ignoring overrides.",
    });
    return plan;
  }

  const modulesDict = plan.modules as Record<string, unknown>;
  const schemaVersion = plan.schemaVersion;

  // Only enforce on schemaVersion 2 (current contract)
  if (schemaVersion !== 2) return plan;

  const requiredGlobal = overrides.requiredModuleIds ?? [];
  const forbiddenGlobalSet = new Set(overrides.forbiddenModuleIds ?? []);

  const filterKnown = (list: string[], reason: string) => {
    const out: string[] = [];
    for (const id of list) {
      if (modulesDict[id]) out.push(id);
      else auditPush?.({ type: "clinic_unknown_module_ignored", moduleId: id, reason });
    }
    return uniqPreserveOrder(out);
  };

  const requiredGlobalKnown = filterKnown(requiredGlobal, "requiredModuleIds");
  const requiredByPhaseKnown = {
    early: filterKnown(overrides.requiredByPhase?.early ?? [], "requiredByPhase.early"),
    mid: filterKnown(overrides.requiredByPhase?.mid ?? [], "requiredByPhase.mid"),
    late: filterKnown(overrides.requiredByPhase?.late ?? [], "requiredByPhase.late"),
  };

  const requiredByDayKnown: Record<string, string[]> = {};
  if (overrides.requiredByDay) {
    for (const [dayKey, list] of Object.entries(overrides.requiredByDay)) {
      requiredByDayKnown[dayKey] = filterKnown(list, `requiredByDay.${dayKey}`);
    }
  }

  const maxModulesPerDay = overrides.maxModulesPerDay;
  const days = plan.days as any[];

  const newDays = days.map((dayObj) => {
    const dayNum = normalizeDayNumber(dayObj?.day);
    const phase = normalizePhase(dayObj?.phase);

    const original = Array.isArray(dayObj?.moduleIds) ? (dayObj.moduleIds as string[]) : [];
    let moduleIds = uniqPreserveOrder(original);

    // 1) Remove forbidden modules first
    if (forbiddenGlobalSet.size > 0) {
      const before = moduleIds;
      moduleIds = removeAll(moduleIds, forbiddenGlobalSet);
      const removed = before.filter((id) => !moduleIds.includes(id));
      for (const id of removed) {
        auditPush?.({
          type: "clinic_forbid_removed",
          day: dayNum,
          moduleId: id,
          reason: "forbiddenModuleIds",
        });
      }
    }

    // 2) Add required globals
    if (requiredGlobalKnown.length > 0) {
      const beforeSet = new Set(moduleIds);
      moduleIds = addAll(moduleIds, requiredGlobalKnown);
      for (const id of requiredGlobalKnown) {
        if (!beforeSet.has(id)) {
          auditPush?.({
            type: "clinic_require_added",
            day: dayNum,
            moduleId: id,
            reason: "requiredModuleIds",
          });
        }
      }
    }

    // 3) Add required by phase
    const phaseReq =
      phase === "early"
        ? requiredByPhaseKnown.early
        : phase === "mid"
          ? requiredByPhaseKnown.mid
          : phase === "late"
            ? requiredByPhaseKnown.late
            : [];

    if (phaseReq.length > 0) {
      const beforeSet = new Set(moduleIds);
      moduleIds = addAll(moduleIds, phaseReq);
      for (const id of phaseReq) {
        if (!beforeSet.has(id)) {
          auditPush?.({
            type: "clinic_require_added",
            day: dayNum,
            moduleId: id,
            reason: `requiredByPhase.${phase}`,
          });
        }
      }
    }

    // 4) Add required by day
    const dayReq = requiredByDayKnown[String(dayNum)] ?? [];
    if (dayReq.length > 0) {
      const beforeSet = new Set(moduleIds);
      moduleIds = addAll(moduleIds, dayReq);
      for (const id of dayReq) {
        if (!beforeSet.has(id)) {
          auditPush?.({
            type: "clinic_require_added",
            day: dayNum,
            moduleId: id,
            reason: `requiredByDay.${dayNum}`,
          });
        }
      }
    }

    // 5) Defensive: ensure only known module ids are output
    moduleIds = moduleIds.filter((id) => Boolean(modulesDict[id]));

    // 5.5) Fail-closed: forbidden wins even if also listed as required
    if (forbiddenGlobalSet.size > 0) {
      moduleIds = removeAll(moduleIds, forbiddenGlobalSet);
    }

    // 6) Cap per-day modules (deterministic: trim from end)
    if (typeof maxModulesPerDay === "number" && maxModulesPerDay > 0) {
      const capped = stableCap(moduleIds, maxModulesPerDay);
      if (capped.removed.length > 0) {
        auditPush?.({
          type: "clinic_cap_trimmed",
          day: dayNum,
          removed: capped.removed,
          max: maxModulesPerDay,
          reason: "maxModulesPerDay",
        });
      }
      moduleIds = capped.kept;
    }

    // 7) Re-derive box items after final module list
    const boxItems = deriveBoxItemsFromModules(moduleIds, modulesDict, dayObj?.boxItems);

    return {
      ...dayObj,
      day: dayNum,
      phase: phase || dayObj?.phase,
      moduleIds,
      boxItems,
    };
  });

  const safeMeta = isPlainObject(plan.meta) ? plan.meta : {};

  const newPlan = {
    ...plan,
    days: newDays,
    meta: {
      ...safeMeta,
      clinicOverrides: {
        version: overrides.version ?? null,
        note: overrides.note ?? null,
      },
    },
  };

  return newPlan;
}