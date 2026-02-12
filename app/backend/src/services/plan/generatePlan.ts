// app/backend/src/services/plan/generatePlan.ts
import { Prisma } from "@prisma/client";
import { enforceClinicOverrides } from "./enforceClinicOverrides.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (typeof s !== "string") continue;
    const key = s.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function phaseForDay(day: number): "early" | "mid" | "late" {
  if (day <= 3) return "early";
  if (day <= 10) return "mid";
  return "late";
}

type PlanConfig = Record<string, unknown>;
function getStr(config: PlanConfig, key: string): string | null {
  const v = config[key];
  return typeof v === "string" ? v : null;
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
      ? obj.phase
      : phaseForDay(day);

  const title = typeof obj.title === "string" ? obj.title : `Day ${day}`;

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

function ensure21Days(days: DayV2[]): DayV2[] {
  const out: DayV2[] = [];
  const byDay = new Map<number, DayV2>();
  for (const d of days) byDay.set(d.day, d);

  for (let day = 0; day < 21; day++) {
    const existing = byDay.get(day);
    if (existing) {
      out.push({
        ...existing,
        day,
        phase: phaseForDay(day),
      });
    } else {
      const phase = phaseForDay(day);
      out.push({
        day,
        phase,
        title:
          day <= 3
            ? `Day ${day}: Getting organized`
            : phase === "mid"
              ? `Day ${day}: Build consistency`
              : `Day ${day}: Maintain progress`,
        moduleIds: ["checkin_overall", "track_pain", "rf_emergency", "rf_worsening"],
        boxItems: day <= 3 ? ["box_gauze", "box_tape", "box_coldpack"] : [],
      });
    }
  }
  return out;
}

function addModule(day: DayV2, id: string) {
  day.moduleIds.push(id);
}

function addModuleEvery(days: DayV2[], id: string) {
  for (const d of days) addModule(d, id);
}

function addModuleOnDays(days: DayV2[], id: string, dayNumbers: number[]) {
  const set = new Set(dayNumbers);
  for (const d of days) if (set.has(d.day)) addModule(d, id);
}

function addModuleInPhase(days: DayV2[], id: string, phase: "early" | "mid" | "late") {
  for (const d of days) if (d.phase === phase) addModule(d, id);
}

function applyRules(days: DayV2[], config: PlanConfig, appliedRules: string[]) {
  const recovery_region = getStr(config, "recovery_region");
  const recovery_duration = getStr(config, "recovery_duration");
  const mobility_impact = getStr(config, "mobility_impact");
  const incision_status = getStr(config, "incision_status");
  const discomfort_pattern = getStr(config, "discomfort_pattern");
  const follow_up_expectation = getStr(config, "follow_up_expectation");

  // 1) Global: add sleep tracker daily
  addModuleEvery(days, "track_sleep");
  appliedRules.push("global:add_track_sleep_daily");

  // 2) Region: swelling tracker frequency
  if (recovery_region) {
    appliedRules.push(`region:${recovery_region}`);

    if (recovery_region === "leg_foot" || recovery_region === "face_neck") {
      addModuleEvery(days, "track_swelling");
      appliedRules.push("region:add_track_swelling_daily");
    } else if (recovery_region === "arm_hand") {
      addModuleInPhase(days, "track_swelling", "early");
      appliedRules.push("region:add_track_swelling_early");
    } else if (recovery_region === "torso") {
      addModuleInPhase(days, "track_swelling", "early");
      appliedRules.push("region:add_track_swelling_early");
    }
  }

  // 3) Incision status: wound awareness + infection red flags frequency
  if (incision_status) {
    appliedRules.push(`incision:${incision_status}`);
    addModuleInPhase(days, "edu_wound", "early");
    addModuleInPhase(days, "edu_wound", "mid");

    addModuleInPhase(days, "rf_infection", "early");
    if (incision_status === "open_wound" || incision_status === "drains_present") {
      addModuleInPhase(days, "rf_infection", "mid");
      appliedRules.push("incision:rf_infection_early_mid");
    } else {
      appliedRules.push("incision:rf_infection_early");
    }
  }

  // 4) Mobility impact: mobility education emphasis
  if (mobility_impact) {
    appliedRules.push(`mobility:${mobility_impact}`);

    if (mobility_impact === "limited" || mobility_impact === "non_weight_bearing") {
      addModuleInPhase(days, "edu_mobility", "mid");
      appliedRules.push("mobility:add_edu_mobility_mid");
    }
  }

  // 5) Discomfort pattern: escalating -> increase red flag emphasis
  if (discomfort_pattern) {
    appliedRules.push(`discomfort:${discomfort_pattern}`);

    if (discomfort_pattern === "escalating") {
      addModuleInPhase(days, "rf_worsening", "early");
      addModuleInPhase(days, "rf_worsening", "mid");
      appliedRules.push("discomfort:rf_worsening_early_mid");
    }
  }

  // 6) Follow-up expectation: schedule follow-up education on reminder days
  if (follow_up_expectation) {
    appliedRules.push(`followup:${follow_up_expectation}`);

    if (follow_up_expectation === "within_7_days") addModuleOnDays(days, "edu_followup", [5, 6]);
    if (follow_up_expectation === "within_14_days") addModuleOnDays(days, "edu_followup", [12, 13]);
    if (follow_up_expectation === "within_30_days") addModuleOnDays(days, "edu_followup", [19, 20]);

    appliedRules.push("followup:add_edu_followup_reminder_days");
  }

  // 7) Duration: adjust late-phase emphasis (still 21-day output)
  if (recovery_duration) {
    appliedRules.push(`duration:${recovery_duration}`);

    if (recovery_duration === "extended_22_plus") {
      addModuleInPhase(days, "edu_longterm", "late");
      appliedRules.push("duration:add_edu_longterm_late");
    }
  }
}

export type GeneratePlanInput = {
  templatePlanJson: unknown; // from RecoveryPlanTemplate.planJson
  clinicOverridesJson?: unknown; // from ClinicPlanConfig.overridesJson
  config: unknown; // validated categorical config (non-PHI)
  engineVersion: string; // e.g., "v1"
  category: string; // template.category
};

export type GeneratePlanOutput = {
  planJson: Prisma.InputJsonValue;
  configJson: Prisma.InputJsonValue;
};

export function generatePlan(input: GeneratePlanInput): GeneratePlanOutput {
  const base = isPlainObject(input.templatePlanJson) ? (input.templatePlanJson as Record<string, unknown>) : {};
  const hasClinicOverrides = Boolean(input.clinicOverridesJson);

  // Build days from template, then ensure 0..20 exist
  const baseDaysRaw = asArray(base.days);
  const baseDays = baseDaysRaw.map((d, idx) => normalizeDayV2(d, idx));
  const days = ensure21Days(baseDays);

  const appliedRules: string[] = [];
  const cfg = (isPlainObject(input.config) ? (input.config as Record<string, unknown>) : {}) as PlanConfig;

  // Apply deterministic config rules
  applyRules(days, cfg, appliedRules);

  // Clean up moduleIds per day before enforcement
  for (const d of days) d.moduleIds = dedupe(d.moduleIds);

  // Compose planJson (schema v2 contract)
  const planJson = {
    title: typeof base.title === "string" ? base.title : "Recovery Plan",
    disclaimer: typeof base.disclaimer === "string" ? base.disclaimer : "",
    schemaVersion: 2,

    // keep module library
    modules: base.modules ?? {},

        // Do not embed raw clinic policy; expose only audit + version/note via meta
    clinicPolicy: {
      present: hasClinicOverrides,
    },


    // IMPORTANT: moduleIds only here (resolve later)
    days,

        meta: {
      engineVersion: input.engineVersion,
      category: input.category,
      schemaVersion: 2,
      config: input.config,
      appliedRules: dedupe(appliedRules),

      // Always present for sellability/auditability
      clinicOverrides: {
        version: null,
        note: null,
      },
      clinicAuditEvents: [],
    },

  } as Prisma.InputJsonValue;

  const configJson = input.config as Prisma.InputJsonValue;

  // ✅ Enforce clinic overrides (Layer 3)
  const clinicAuditEvents: any[] = [];

  const enforcedPlanJson = enforceClinicOverrides({
    plan: planJson,
    overridesJson: input.clinicOverridesJson,
    auditPush: (evt) => clinicAuditEvents.push(evt),
  }) as any;

  // ✅ Resolve modules AFTER enforcement (moduleIds may have changed)
  const enforcedModulesLib =
    isPlainObject(enforcedPlanJson.modules)
      ? (enforcedPlanJson.modules as Record<string, unknown>)
      : {};

  const enforcedDays = Array.isArray(enforcedPlanJson.days) ? enforcedPlanJson.days : [];

  enforcedPlanJson.days = enforcedDays.map((d: any) => {
    const moduleIds = Array.isArray(d?.moduleIds) ? (d.moduleIds as string[]) : [];
    const modulesResolved = moduleIds
      .map((id) => enforcedModulesLib[id])
      .filter((m) => m !== undefined && m !== null);
    return { ...d, modulesResolved };
  });

    // Attach audit events for debugging + proof
  enforcedPlanJson.meta = {
    ...(isPlainObject(enforcedPlanJson.meta) ? enforcedPlanJson.meta : {}),
    clinicAuditEvents,
  };

  // Ensure meta contract always holds
  if (!isPlainObject((enforcedPlanJson as any).meta?.clinicOverrides)) {
    (enforcedPlanJson as any).meta = {
      ...(enforcedPlanJson as any).meta,
      clinicOverrides: { version: null, note: null },
    };
  }
  if (!Array.isArray((enforcedPlanJson as any).meta?.clinicAuditEvents)) {
    (enforcedPlanJson as any).meta = {
      ...(enforcedPlanJson as any).meta,
      clinicAuditEvents: [],
    };
  }


  return { planJson: enforcedPlanJson as Prisma.InputJsonValue, configJson };
}
