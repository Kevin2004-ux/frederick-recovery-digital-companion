// app/backend/src/services/plan/rules.ts

export type RecoveryRegion = 'upper_body' | 'lower_body' | 'core' | 'extremity';
export type RecoveryDuration = 'short_term_7' | 'medium_term_14' | 'long_term_21' | 'extended_42';
export type MobilityImpact = 'none' | 'partial_weight_bearing' | 'non_weight_bearing' | 'restricted_movement';
export type IncisionStatus = 'none' | 'sutures_staples' | 'glue_tape' | 'open_packing';
export type DiscomfortPattern = 'constant' | 'movement_based' | 'night_only' | 'intermittent';
export type FollowUpExpectation = 'standard_2_weeks' | 'urgent_check' | 'phone_check' | 'none';

export interface PlanConfiguration {
  recovery_region: RecoveryRegion;
  recovery_duration: RecoveryDuration;
  mobility_impact: MobilityImpact;
  incision_status: IncisionStatus;
  discomfort_pattern: DiscomfortPattern;
  follow_up_expectation: FollowUpExpectation;
}

export type ModuleId = 
  | 'education_wound_care_basic'
  | 'education_wound_care_sutures'
  | 'education_mobility_crutches'
  | 'education_mobility_gentle'
  | 'track_pain_daily'
  | 'track_pain_movement'
  | 'task_check_incision'
  | 'milestone_follow_up_prep';

export const getIncisionModules = (status: string): ModuleId[] => {
  switch (status) {
    case 'sutures_staples':
      return ['education_wound_care_sutures', 'task_check_incision'];
    case 'glue_tape':
    case 'open_packing':
      return ['education_wound_care_basic', 'task_check_incision'];
    default:
      return [];
  }
};

export const getMobilityModules = (impact: string): ModuleId[] => {
  switch (impact) {
    case 'non_weight_bearing':
      return ['education_mobility_crutches'];
    case 'restricted_movement':
      return ['education_mobility_gentle'];
    default:
      return [];
  }
};

export const getDiscomfortModules = (pattern: string): ModuleId[] => {
  if (pattern === 'movement_based') {
    return ['track_pain_movement'];
  }
  return ['track_pain_daily'];
};

export const resolvePlanModules = (config: PlanConfiguration): ModuleId[] => {
  const modules: ModuleId[] = [];

  modules.push(...getIncisionModules(config.incision_status));
  modules.push(...getMobilityModules(config.mobility_impact));
  modules.push(...getDiscomfortModules(config.discomfort_pattern));
  
  modules.push('milestone_follow_up_prep');

  return Array.from(new Set(modules));
};