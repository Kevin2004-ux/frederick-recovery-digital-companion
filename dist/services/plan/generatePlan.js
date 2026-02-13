import { enforceClinicOverrides } from "./enforceClinicOverrides.js";
import { resolvePlanModules } from "./rules"; // The Brain
import { CONTENT_LIBRARY } from "./contentLibrary"; // The Inventory
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
    const title = typeof obj.title === "string" ? obj.title : `Day ${day + 1}`; // Display as Day 1, 2...
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
 * If the template is empty, it generates a skeleton.
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
            // Simple dynamic titles if missing
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
export function generatePlan(input) {
    // A. Setup the Skeleton (21 Days)
    const base = isPlainObject(input.templatePlanJson) ? input.templatePlanJson : {};
    const baseDaysRaw = asArray(base.days);
    const baseDays = baseDaysRaw.map((d, idx) => normalizeDayV2(d, idx));
    const days = ensure21Days(baseDays);
    // B. Run The Brain (Rules)
    // 1. Cast the input config to our typed interface
    const config = (isPlainObject(input.config) ? input.config : {});
    // 2. Get the list of IDs from rules.ts
    // This is the "Medical Logic" - it decides WHAT goes in.
    const activeModuleIds = resolvePlanModules(config);
    // 3. Schedule the modules based on their Type
    // This is the "Scheduling Logic" - it decides WHEN it goes in.
    const debugRulesApplied = [];
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
                if (days[0])
                    addModule(days[0], moduleId);
                break;
            case 'milestone':
                // Milestones (like Follow Up) default to Day 13 (2 weeks)
                // You can make this smarter later
                if (days[13])
                    addModule(days[13], moduleId);
                else if (days[0])
                    addModule(days[0], moduleId);
                break;
            default:
                // Default fallthrough: Add to Day 0
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
    };
    // E. Enforce Clinic Overrides (The "Safety Valve")
    // This ensures that if a clinic banned a module, it gets removed here.
    const clinicAuditEvents = [];
    const enforcedPlanJson = enforceClinicOverrides({
        plan: planJson,
        overridesJson: input.clinicOverridesJson,
        auditPush: (evt) => clinicAuditEvents.push(evt),
    });
    // F. Final Polish (Resolving Modules for Frontend convenience)
    // We attach the full module objects to the day for easier frontend rendering
    const enforcedModulesLib = isPlainObject(enforcedPlanJson.modules) ? enforcedPlanJson.modules : {};
    const enforcedDays = Array.isArray(enforcedPlanJson.days) ? enforcedPlanJson.days : [];
    enforcedPlanJson.days = enforcedDays.map((d) => {
        const moduleIds = Array.isArray(d?.moduleIds) ? d.moduleIds : [];
        const modulesResolved = moduleIds
            .map((id) => enforcedModulesLib[id])
            .filter((m) => m !== undefined && m !== null);
        return { ...d, modulesResolved };
    });
    // Attach Audit Trail
    enforcedPlanJson.meta = {
        ...(isPlainObject(enforcedPlanJson.meta) ? enforcedPlanJson.meta : {}),
        clinicAuditEvents,
    };
    return {
        planJson: enforcedPlanJson,
        configJson: input.config
    };
}
