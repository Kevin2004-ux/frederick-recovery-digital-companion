// app/backend/scripts/testPlanEngine.ts

import { generatePlan } from "../src/services/plan/generatePlan.js";

type PlanDay = {
  day: number;
  phase: "early" | "mid" | "late";
  title: string;
  moduleIds: string[];
  boxItems?: string[];
};

type PlanJsonLike = {
  schemaVersion: number;
  title: string;
  disclaimer: string;
  modules: Record<string, unknown>;
  days: PlanDay[];
  meta?: Record<string, unknown>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getPlanJson(result: unknown): PlanJsonLike {
  assert(isPlainObject(result), "generatePlan did not return an object");
  assert("planJson" in result, "generatePlan result missing planJson");

  const planJson = (result as { planJson: unknown }).planJson;
  assert(isPlainObject(planJson), "planJson is not an object");

  const days = (planJson as { days?: unknown }).days;
  assert(Array.isArray(days), "planJson.days is not an array");

  return planJson as unknown as PlanJsonLike;
}

function getDay(plan: PlanJsonLike, dayNumber: number): PlanDay {
  const found = plan.days.find((d) => d.day === dayNumber);
  assert(found, `Missing day ${dayNumber}`);
  return found;
}

function includesAll(haystack: string[] | undefined, needles: string[], context: string) {
  const set = new Set(haystack ?? []);
  for (const needle of needles) {
    assert(set.has(needle), `${context}: expected "${needle}"`);
  }
}

function includesNone(haystack: string[] | undefined, needles: string[], context: string) {
  const set = new Set(haystack ?? []);
  for (const needle of needles) {
    assert(!set.has(needle), `${context}: should not include "${needle}"`);
  }
}

function logPass(name: string) {
  console.log(`PASS - ${name}`);
}

function logSection(name: string) {
  console.log(`\n=== ${name} ===`);
}

function testBasePlan() {
  logSection("Base plan generation");

  const result = generatePlan({
    config: {
      recovery_region: "lower_body",
      recovery_duration: "medium_term_14",
      mobility_impact: "non_weight_bearing",
      incision_status: "sutures_staples",
      discomfort_pattern: "movement_based",
      follow_up_expectation: "standard_2_weeks",
    },
    engineVersion: "test",
    category: "test",
  });

  const plan = getPlanJson(result);

  assert(plan.schemaVersion === 2, "schemaVersion should be 2");
  assert(plan.days.length === 21, "plan should have exactly 21 days");
  assert(isPlainObject(plan.modules), "plan.modules should exist");
  assert(typeof plan.title === "string", "plan.title should be a string");
  assert(typeof plan.disclaimer === "string", "plan.disclaimer should be a string");

  const day0 = getDay(plan, 0);
  const day12 = getDay(plan, 12);
  const day13 = getDay(plan, 13);
  const day20 = getDay(plan, 20);

  includesAll(
    day0.moduleIds,
    [
      "education_wound_care_sutures",
      "task_check_incision",
      "education_mobility_crutches",
      "education_ice_knee",
      "track_pain_movement"
    ],
    "day 0 modules"
  );

  includesAll(day12.moduleIds, ["milestone_follow_up_prep"], "day 12 modules");
  includesAll(day13.moduleIds, ["milestone_follow_up_prep"], "day 13 modules");
  includesAll(day20.moduleIds, ["task_check_incision", "track_pain_movement", "task_scar_care"], "day 20 modules");

  includesAll(day0.boxItems, ["icepack"], "day 0 box items");
  includesAll(day20.boxItems, ["scar_gel"], "day 20 box items");

  includesNone(day0.moduleIds, ["task_scar_care"], "day 0 should not have late-phase scar care");
  includesNone(day20.moduleIds, ["education_ice_knee"], "day 20 should not have early cold therapy");

  logPass("Base plan is 21 days and respects early/late scheduling");
}

function testOpenPackingPlan() {
  logSection("Open packing plan");

  const result = generatePlan({
    config: {
      recovery_region: "lower_body",
      recovery_duration: "long_term_21",
      mobility_impact: "restricted_movement",
      incision_status: "open_packing",
      discomfort_pattern: "constant",
      follow_up_expectation: "phone_check",
    },
    engineVersion: "test",
    category: "test",
  });

  const plan = getPlanJson(result);

  const day0 = getDay(plan, 0);
  const day7 = getDay(plan, 7);
  const day20 = getDay(plan, 20);

  includesAll(
    day0.moduleIds,
    [
      "education_wound_care_basic",
      "task_gauze_change",
      "task_check_incision",
      "education_mobility_gentle",
      "track_pain_daily",
      "education_ice_knee"
    ],
    "open packing day 0 modules"
  );

  includesAll(day7.moduleIds, ["milestone_follow_up_prep"], "open packing day 7 modules");
  includesAll(day20.moduleIds, ["task_gauze_change", "task_check_incision", "track_pain_daily"], "open packing day 20 modules");

  includesAll(day0.boxItems, ["gloves", "gauze", "tape", "wipes", "icepack"], "open packing day 0 box items");
  includesAll(day20.boxItems, ["gloves", "gauze", "tape", "wipes"], "open packing day 20 box items");

  logPass("Open packing plan includes dressing workflow and box items");
}

function testClinicOverrides() {
  logSection("Clinic overrides");

  const result = generatePlan({
    config: {
      recovery_region: "lower_body",
      recovery_duration: "medium_term_14",
      mobility_impact: "non_weight_bearing",
      incision_status: "sutures_staples",
      discomfort_pattern: "movement_based",
      follow_up_expectation: "standard_2_weeks",
    },
    clinicOverridesJson: {
      version: 1,
      note: "test overrides",
      forbiddenModuleIds: ["education_ice_knee"],
      requiredModuleIds: ["education_recovery_kit_overview"],
      requiredByPhase: {
        late: ["milestone_driving"]
      },
      requiredByDay: {
        "0": ["education_wound_care_basic"]
      },
      maxModulesPerDay: 6
    },
    engineVersion: "test",
    category: "test",
  });

  const plan = getPlanJson(result);

  const day0 = getDay(plan, 0);
  const day20 = getDay(plan, 20);

  includesAll(
    day0.moduleIds,
    ["education_recovery_kit_overview", "education_wound_care_basic"],
    "override day 0 required modules"
  );

  includesNone(day0.moduleIds, ["education_ice_knee"], "override day 0 forbidden module");
  includesNone(day20.moduleIds, ["education_ice_knee"], "override day 20 forbidden module");

  includesAll(day20.moduleIds, ["milestone_driving"], "override day 20 late-phase required module");

  assert(day0.moduleIds.length <= 6, "day 0 should be capped at 6 modules");
  assert(day20.moduleIds.length <= 6, "day 20 should be capped at 6 modules");

  includesAll(
    day0.boxItems,
    ["gauze", "icepack", "tape", "wipes", "gloves", "scar_gel", "thank_you_card", "recovery_flyer"],
    "override day 0 should include kit overview box items"
  );

  logPass("Clinic overrides add/remove/cap modules and re-derive box items");
}

function testTemplateCompatibility() {
  logSection("Template compatibility");

  const result = generatePlan({
    templatePlanJson: {
      title: "Custom Recovery Template",
      disclaimer: "Custom disclaimer",
      days: [
        {
          day: 0,
          phase: "early",
          title: "Day 1: Custom Start",
          moduleIds: ["education_recovery_kit_overview"],
          boxItems: ["gauze"]
        }
      ]
    },
    config: {
      recovery_region: "core",
      recovery_duration: "short_term_7",
      mobility_impact: "none",
      incision_status: "none",
      discomfort_pattern: "intermittent",
      follow_up_expectation: "none",
    },
    engineVersion: "test",
    category: "template-test",
  });

  const plan = getPlanJson(result);

  assert(plan.title === "Custom Recovery Template", "template title should be preserved");
  assert(plan.disclaimer === "Custom disclaimer", "template disclaimer should be preserved");

  const day0 = getDay(plan, 0);
  const day13 = getDay(plan, 13);

  assert(day0.title === "Day 1: Custom Start", "template day 0 title should be preserved");
  includesAll(
    day0.moduleIds,
    ["education_recovery_kit_overview", "track_pain_daily", "education_ice_knee"],
    "template day 0 merged modules"
  );
  includesAll(day13.moduleIds, ["milestone_follow_up_prep"], "default follow-up still lands on day 13");

  logPass("Template skeleton still works and merges with generated plan");
}

function main() {
  console.log("Running plan engine tests...");

  testBasePlan();
  testOpenPackingPlan();
  testClinicOverrides();
  testTemplateCompatibility();

  console.log("\nAll plan engine tests passed.");
}

main();