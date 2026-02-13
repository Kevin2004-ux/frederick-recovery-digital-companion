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
function uniqPreserveOrder(ids) {
    const seen = new Set();
    const out = [];
    for (const id of ids) {
        if (!seen.has(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}
function removeAll(ids, toRemove) {
    return ids.filter((id) => !toRemove.has(id));
}
function addAll(ids, toAdd) {
    // required modules should appear (append order deterministic)
    return uniqPreserveOrder([...ids, ...toAdd]);
}
function stableCap(ids, max) {
    if (ids.length <= max)
        return { kept: ids, removed: [] };
    return { kept: ids.slice(0, max), removed: ids.slice(max) };
}
function isPlainObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function normalizeDayNumber(v) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n))
        return 0;
    // Keep audit + requiredByDay stable even if out of range
    return Math.max(0, Math.min(1000, Math.floor(n)));
}
function normalizePhase(v) {
    return v === "early" || v === "mid" || v === "late" ? v : "";
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
export function enforceClinicOverrides(args) {
    const { plan, overridesJson, auditPush } = args;
    // If no overrides, return original plan
    if (!overridesJson)
        return plan;
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
    const modulesDict = plan.modules;
    const schemaVersion = plan.schemaVersion;
    // Only enforce on schemaVersion 2 (your current contract)
    if (schemaVersion !== 2)
        return plan;
    const requiredGlobal = overrides.requiredModuleIds ?? [];
    const forbiddenGlobalSet = new Set(overrides.forbiddenModuleIds ?? []);
    // Pre-filter required lists to only known modules (deterministic)
    const filterKnown = (list, reason) => {
        const out = [];
        for (const id of list) {
            if (modulesDict[id])
                out.push(id);
            else
                auditPush?.({ type: "clinic_unknown_module_ignored", moduleId: id, reason });
        }
        return uniqPreserveOrder(out);
    };
    const requiredGlobalKnown = filterKnown(requiredGlobal, "requiredModuleIds");
    const requiredByPhaseKnown = {
        early: filterKnown(overrides.requiredByPhase?.early ?? [], "requiredByPhase.early"),
        mid: filterKnown(overrides.requiredByPhase?.mid ?? [], "requiredByPhase.mid"),
        late: filterKnown(overrides.requiredByPhase?.late ?? [], "requiredByPhase.late"),
    };
    const requiredByDayKnown = {};
    if (overrides.requiredByDay) {
        for (const [dayKey, list] of Object.entries(overrides.requiredByDay)) {
            requiredByDayKnown[dayKey] = filterKnown(list, `requiredByDay.${dayKey}`);
        }
    }
    const maxModulesPerDay = overrides.maxModulesPerDay;
    const days = plan.days;
    const newDays = days.map((dayObj) => {
        const dayNum = normalizeDayNumber(dayObj?.day);
        const phase = normalizePhase(dayObj?.phase);
        const original = Array.isArray(dayObj?.moduleIds) ? dayObj.moduleIds : [];
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
        const phaseReq = phase === "early"
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
        // 4) Add required by day (keyed by "0","1",... or any string)
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
        // ✅ 5.5) Fail-closed: forbidden wins even if also listed as required
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
        return {
            ...dayObj,
            day: dayNum, // keep normalized day
            phase: phase || dayObj?.phase, // keep original if it was non-standard, otherwise normalized
            moduleIds,
        };
    });
    // attach metadata
    const newPlan = {
        ...plan,
        days: newDays,
        meta: {
            ...plan.meta,
            clinicOverrides: {
                version: overrides.version ?? null,
                note: overrides.note ?? null,
            },
        },
    };
    return newPlan;
}
