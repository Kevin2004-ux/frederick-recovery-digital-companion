// app/backend/scripts/test-brain.ts
import { generatePlan } from "../src/services/plan/generatePlan.js";

console.log("\n🧠 INITIALIZING MEDICAL BRAIN TEST SEQUENCE...\n");

// --- SCENARIO 1: The "Sutures + Crutches" Patient ---
console.log("🔹 TEST 1: Logic Verification (Sutures + Non-Weight Bearing)");

const configA = {
  recovery_region: "leg_foot",
  recovery_duration: "standard_8_14",
  mobility_impact: "non_weight_bearing", // Expect: education_mobility_crutches
  incision_status: "sutures_staples",    // Expect: education_wound_care_sutures
  discomfort_pattern: "movement_based",  // Expect: track_pain_movement
  follow_up_expectation: "within_14_days"
};

const outputA = generatePlan({
  templatePlanJson: {}, // Empty skeleton
  config: configA,
  engineVersion: "v1",
  category: "general_outpatient",
  clinicOverridesJson: null
});

const planA = outputA.planJson as any;
// Flatten all modules from all days into one list for easy checking
const allModulesA = planA.days.flatMap((d: any) => d.moduleIds);

// ASSERTIONS
const hasCrutches = allModulesA.includes("education_mobility_crutches");
const hasSutures = allModulesA.includes("education_wound_care_sutures");
const hasBasicWound = allModulesA.includes("education_wound_care_basic"); // Should NOT be there

if (hasCrutches && hasSutures && !hasBasicWound) {
  console.log("✅ PASS: Brain correctly prescribed Crutches & Suture Care.");
} else {
  console.error("❌ FAIL: Logic Error.");
  console.error(`   - Has Crutches? ${hasCrutches}`);
  console.error(`   - Has Sutures? ${hasSutures}`);
  console.error(`   - Has Basic Wound (Should be false)? ${hasBasicWound}`);
  process.exit(1);
}

// --- SCENARIO 2: The "Clinic Ban" (Safety Valve) ---
console.log("\n🔹 TEST 2: Safety Valve (Clinic Bans 'Crutches' Module)");

const clinicOverrides = {
  forbiddenModuleIds: ["education_mobility_crutches"]
};

const outputB = generatePlan({
  templatePlanJson: {},
  config: configA, // Same patient as above (needs crutches)
  engineVersion: "v1",
  category: "general_outpatient",
  clinicOverridesJson: clinicOverrides // BUT clinic forbids it
});

const planB = outputB.planJson as any;
const allModulesB = planB.days.flatMap((d: any) => d.moduleIds);

if (!allModulesB.includes("education_mobility_crutches")) {
  console.log("✅ PASS: Safety Valve worked. 'Crutches' module was stripped out.");
} else {
  console.error("❌ FAIL: Clinic Override was ignored!");
  process.exit(1);
}

// --- SCENARIO 3: The Schedule (Daily Tasks) ---
console.log("\n🔹 TEST 3: Scheduling (Daily Pain Tracking)");

// We expect 'track_pain_movement' to appear on Day 1, Day 5, Day 10, etc.
const day0 = planA.days.find((d: any) => d.day === 0);
const day5 = planA.days.find((d: any) => d.day === 5);
const day20 = planA.days.find((d: any) => d.day === 20);

const hasTrackD0 = day0.moduleIds.includes("track_pain_movement");
const hasTrackD5 = day5.moduleIds.includes("track_pain_movement");
const hasTrackD20 = day20.moduleIds.includes("track_pain_movement");

if (hasTrackD0 && hasTrackD5 && hasTrackD20) {
  console.log("✅ PASS: Daily tracking is scheduled correctly across 21 days.");
} else {
  console.error("❌ FAIL: Scheduling Error.");
  process.exit(1);
}

console.log("\n🎉 ALL MEDICAL LOGIC TESTS PASSED.\n");