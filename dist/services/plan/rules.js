// app/backend/src/services/plan/rules.ts
export const getIncisionModules = (status) => {
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
export const getMobilityModules = (impact) => {
    switch (impact) {
        case 'non_weight_bearing':
            return ['education_mobility_crutches'];
        case 'restricted_movement':
            return ['education_mobility_gentle'];
        default:
            return [];
    }
};
export const getDiscomfortModules = (pattern) => {
    if (pattern === 'movement_based') {
        return ['track_pain_movement'];
    }
    return ['track_pain_daily'];
};
export const resolvePlanModules = (config) => {
    const modules = [];
    modules.push(...getIncisionModules(config.incision_status));
    modules.push(...getMobilityModules(config.mobility_impact));
    modules.push(...getDiscomfortModules(config.discomfort_pattern));
    modules.push('milestone_follow_up_prep');
    return Array.from(new Set(modules));
};
