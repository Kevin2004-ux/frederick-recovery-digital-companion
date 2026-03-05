// app/backend/src/services/plan/rules.ts

// EXACT TYPES matching the Zod schema in plan/index.ts and the frontend
export type RecoveryRegion = "leg_foot" | "arm_hand" | "torso" | "face_neck" | "general";
export type RecoveryDuration = "standard_0_7" | "standard_8_14" | "standard_15_21" | "extended_22_plus";
export type MobilityImpact = "none" | "mild" | "limited" | "non_weight_bearing";
export type IncisionStatus = "intact_dressings" | "sutures_staples" | "drains_present" | "open_wound" | "none_visible";
export type DiscomfortPattern = "expected_soreness" | "sharp_intermittent" | "burning_tingling" | "escalating";
export type FollowUpExpectation = "within_7_days" | "within_14_days" | "within_30_days" | "none_scheduled";

export interface PlanConfiguration {
  recovery_region: RecoveryRegion;
  recovery_duration: RecoveryDuration;
  mobility_impact: MobilityImpact;
  incision_status: IncisionStatus;
  discomfort_pattern: DiscomfortPattern;
  follow_up_expectation: FollowUpExpectation;
}

export type ModuleId =
  | "education_wound_care_basic"
  | "education_wound_care_sutures"
  | "education_mobility_crutches"
  | "education_mobility_gentle"
  | "track_pain_daily"
  | "track_pain_movement"
  | "task_check_incision"
  | "milestone_follow_up_prep"
  | "task_gauze_change"
  | "education_ice_knee"
  | "task_scar_care";

/**
 * Strict scheduling shape (NO legacy strings).
 * The generator should only receive ScheduledModule objects.
 */
export type ScheduleTarget = number[] | "early" | "mid" | "late" | "all";

export interface ScheduledModule {
  id: ModuleId | string; // Allow string fallback for dynamically loaded content library
  schedule: ScheduleTarget;
}

function normalizeScheduleTarget(target: ScheduleTarget): ScheduleTarget {
  if (Array.isArray(target)) {
    // Clamp to valid 0..20 indices and sort/dedupe
    const clamped = target
      .filter((n) => typeof n === "number" && Number.isFinite(n))
      .map((n) => Math.max(0, Math.min(20, Math.floor(n))));
    const uniq = Array.from(new Set(clamped));
    uniq.sort((a, b) => a - b);
    return uniq;
  }
  return target;
}

function sameSchedule(a: ScheduleTarget, b: ScheduleTarget): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  return a === b;
}

/**
 * Push scheduled modules without duplicates.
 * Dedup rule: same id + same schedule.
 */
function pushUnique(modules: ScheduledModule[], next: ScheduledModule[]) {
  for (const mod of next) {
    const normalized: ScheduledModule = {
      id: mod.id,
      schedule: normalizeScheduleTarget(mod.schedule),
    };

    const exists = modules.some((m) => m.id === normalized.id && sameSchedule(m.schedule, normalized.schedule));
    if (!exists) modules.push(normalized);
  }
}

export const getIncisionModules = (status: IncisionStatus): ScheduledModule[] => {
  switch (status) {
    case "sutures_staples":
      return [
        { id: "education_wound_care_sutures", schedule: "early" },
        { id: "task_check_incision", schedule: "all" },
        { id: "task_scar_care", schedule: "late" },
      ];

    case "intact_dressings":
    case "drains_present":
      return [
        { id: "education_wound_care_basic", schedule: "early" },
        { id: "task_check_incision", schedule: "all" },
      ];

    case "open_wound":
      return [
        { id: "education_wound_care_basic", schedule: "early" },
        { id: "task_gauze_change", schedule: "all" },
        { id: "task_check_incision", schedule: "all" },
      ];

    case "none_visible":
    default:
      return [];
  }
};

export const getMobilityModules = (impact: MobilityImpact): ScheduledModule[] => {
  switch (impact) {
    case "non_weight_bearing":
      return [{ id: "education_mobility_crutches", schedule: "early" }];

    case "limited":
      return [{ id: "education_mobility_gentle", schedule: "all" }];

    case "mild":
      return [{ id: "education_mobility_gentle", schedule: "early" }];

    case "none":
    default:
      return [];
  }
};

export const getDiscomfortModules = (pattern: DiscomfortPattern): ScheduledModule[] => {
  const modules: ScheduledModule[] = [{ id: "education_ice_knee", schedule: [0, 1, 2] }];

  // Updated to use the new valid Zod schema values
  if (pattern === "sharp_intermittent" || pattern === "escalating") {
    modules.push({ id: "track_pain_movement", schedule: "all" });
  } else {
    modules.push({ id: "track_pain_daily", schedule: "all" });
  }

  return modules;
};
export const getFollowUpModules = (expectation: FollowUpExpectation): ScheduledModule[] => {
  switch (expectation) {
    case "within_7_days":
      return [{ id: "milestone_follow_up_prep", schedule: [5, 6] }];

    case "within_14_days":
      return [{ id: "milestone_follow_up_prep", schedule: [12, 13] }];

    case "within_30_days":
      return [{ id: "milestone_follow_up_prep", schedule: [19, 20] }];

    case "none_scheduled":
    default:
      return [];
  }
};

export const resolvePlanModules = (config: PlanConfiguration): ScheduledModule[] => {
  const modules: ScheduledModule[] = [];

  // Strict outputs only (ScheduledModule objects)
  pushUnique(modules, getIncisionModules(config.incision_status));
  pushUnique(modules, getMobilityModules(config.mobility_impact));
  pushUnique(modules, getDiscomfortModules(config.discomfort_pattern));
  pushUnique(modules, getFollowUpModules(config.follow_up_expectation));

  // Normalize schedules (arrays get clamped/sorted/deduped)
  return modules.map((m) => ({ ...m, schedule: normalizeScheduleTarget(m.schedule) }));
};