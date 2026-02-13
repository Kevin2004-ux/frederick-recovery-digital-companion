// logic imports must have .js extension for NodeNext
import { resolvePlanModules } from "./rules.js";
import { CONTENT_LIBRARY } from "./contentLibrary.js";
// --- 1. Helper Functions ---
function isPlainObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asArray(v) {
    return Array.isArray(v) ? v : [];
}
function dedupe(arr) {
    return Array.from(new Set(arr.filter(s => typeof s === "string" && s.trim().length > 0)));
}
function phaseForDay(day) {
    if (day <= 3)
        return "early";
    if (day <= 10)
        return "mid";
    return "late";
}
function normalizeDayV2(raw, dayIndex) {
    const obj = isPlainObject(raw) ? raw : {};
    const day = typeof obj.day === "number" && Number.isFinite(obj.day)
        ? Math.max(0, Math.min(20, Math.floor(obj.day)))
        : dayIndex;
    const phase = (obj.phase === "early" || obj.phase === "mid" || obj.phase === "late")
        ? obj.phase
        : phaseForDay(day);
    const title = typeof obj.title === "string" ? obj.title : `Day ${day + 1}`;
    const moduleIds = asArray(obj.moduleIds).filter((x) => typeof x === "string");
    const boxItems = asArray(obj.boxItems).filter((x) => typeof x === "string");
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
function ensure21Days(days) {
    const out = [];
    const byDay = new Map();
    for (const d of days)
        byDay.set(d.day, d);
    for (let day = 0; day < 21; day++) {
        const existing = byDay.get(day);
        if (existing) {
            out.push({
                ...existing,
                day, // Force index consistency
                phase: phaseForDay(day),
            });
        }
        else {
            const phase = phaseForDay(day);
            let title = `Day ${day + 1}`;
            if (day === 0)
                title = "Day 1: Welcome & Setup";
            else if (day === 20)
                title = "Day 21: Graduation";
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
function addModule(day, id) {
    day.moduleIds.push(id);
}
function addModuleEvery(days, id) {
    for (const d of days)
        addModule(d, id);
}
/**
 * ✅ FIX: Rename to generatePlan to match route imports
 */
export const generatePlan = (input) => {
    // A. Setup the Skeleton (21 Days)
    const base = isPlainObject(input.templatePlanJson) ? input.templatePlanJson : {};
    const baseDaysRaw = asArray(base.days);
    const baseDays = baseDaysRaw.map((d, idx) => normalizeDayV2(d, idx));
    const days = ensure21Days(baseDays);
    // B. Run The Brain (Rules)
    /**
     * ✅ FIX: Use a forced cast to avoid TS2352.
     * Since this comes from a validated Zod schema in the routes,
     * we can safely assume it matches PlanConfiguration.
     */
    const config = input.config;
    // This calls the imported rule engine
    const activeModuleIds = resolvePlanModules(config);
    const debugRulesApplied = [];
    for (const moduleId of activeModuleIds) {
        const moduleDef = CONTENT_LIBRARY[moduleId];
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
                if (days[0])
                    addModule(days[0], moduleId);
                break;
            case 'milestone':
                // Default milestones to day 14 (index 13)
                if (days[13])
                    addModule(days[13], moduleId);
                else if (days[0])
                    addModule(days[0], moduleId);
                break;
            default:
                if (days[0])
                    addModule(days[0], moduleId);
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
    return {
        planJson: planJson,
        configJson: input.config
    };
};
/**
 * ✅ FIX: Export an alias so older code doesn't break
 */
export const generateRecoveryPlan = generatePlan;
