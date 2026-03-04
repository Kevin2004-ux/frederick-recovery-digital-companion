// app/backend/src/services/plan/rules.ts

export type RecoveryRegion = "upper_body" | "lower_body" | "core" | "extremity";
export type RecoveryDuration = "short_term_7" | "medium_term_14" | "long_term_21" | "extended_42";
export type MobilityImpact = "none" | "partial_weight_bearing" | "non_weight_bearing" | "restricted_movement";
export type IncisionStatus = "none" | "sutures_staples" | "glue_tape" | "open_packing";
export type DiscomfortPattern = "constant" | "movement_based" | "night_only" | "intermittent";
export type FollowUpExpectation = "standard_2_weeks" | "urgent_check" | "phone_check" | "none";

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

export type ScheduleTarget = number[] | "early" | "mid" | "late" | "all";

export interface ScheduledModule {
  id: ModuleId;
  schedule: ScheduleTarget;
}

function pushUnique(modules: ScheduledModule[], next: ScheduledModule[]) {
  for (const mod of next) {
    const exists = modules.some((m) => {
      if (m.id !== mod.id) return false;

      if (Array.isArray(m.schedule) && Array.isArray(mod.schedule)) {
        if (m.schedule.length !== mod.schedule.length) return false;
        return m.schedule.every((value, index) => value === mod.schedule[index]);
      }

      return m.schedule === mod.schedule;
    });

    if (!exists) {
      modules.push(mod);
    }
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

    case "glue_tape":
      return [
        { id: "education_wound_care_basic", schedule: "early" },
        { id: "task_check_incision", schedule: "all" },
        { id: "task_scar_care", schedule: "late" },
      ];

    case "open_packing":
      return [
        { id: "education_wound_care_basic", schedule: "early" },
        { id: "task_gauze_change", schedule: "all" },
        { id: "task_check_incision", schedule: "all" },
      ];

    case "none":
    default:
      return [];
  }
};

export const getMobilityModules = (impact: MobilityImpact): ScheduledModule[] => {
  switch (impact) {
    case "non_weight_bearing":
      return [{ id: "education_mobility_crutches", schedule: "early" }];

    case "restricted_movement":
      return [{ id: "education_mobility_gentle", schedule: "all" }];

    case "partial_weight_bearing":
      return [{ id: "education_mobility_gentle", schedule: "early" }];

    case "none":
    default:
      return [];
  }
};

export const getDiscomfortModules = (pattern: DiscomfortPattern): ScheduledModule[] => {
  const modules: ScheduledModule[] = [{ id: "education_ice_knee", schedule: [0, 1, 2] }];

  if (pattern === "movement_based") {
    modules.push({ id: "track_pain_movement", schedule: "all" });
  } else {
    modules.push({ id: "track_pain_daily", schedule: "all" });
  }

  return modules;
};

export const getFollowUpModules = (expectation: FollowUpExpectation): ScheduledModule[] => {
  switch (expectation) {
    case "urgent_check":
      return [{ id: "milestone_follow_up_prep", schedule: [2, 3] }];

    case "phone_check":
      return [{ id: "milestone_follow_up_prep", schedule: [6, 7] }];

    case "standard_2_weeks":
      return [{ id: "milestone_follow_up_prep", schedule: [12, 13] }];

    case "none":
    default:
      return [{ id: "milestone_follow_up_prep", schedule: [13] }];
  }
};

export const resolvePlanModules = (config: PlanConfiguration): ScheduledModule[] => {
  const modules: ScheduledModule[] = [];

  pushUnique(modules, getIncisionModules(config.incision_status));
  pushUnique(modules, getMobilityModules(config.mobility_impact));
  pushUnique(modules, getDiscomfortModules(config.discomfort_pattern));
  pushUnique(modules, getFollowUpModules(config.follow_up_expectation));

  return modules;
};