// backend/src/prisma/seed.ts
import { PrismaClient, RecoveryPlanCategory, ActivationCodeStatus, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY = RecoveryPlanCategory.general_outpatient;
const VERSION = 2;
const DEMO_CODES = ["FR-DEMO-0001", "FR-DEMO-0002", "FR-DEMO-0003"] as const;
const TEST_CLINIC_TAG = "local-test"; 

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidPlanJsonV2(planJson: unknown): boolean {
  if (!isPlainObject(planJson)) return false;
  const days = (planJson as any).days;
  const modules = (planJson as any).modules;
  return Array.isArray(days) && isPlainObject(modules) && Object.keys(modules).length > 0;
}

async function main() {
  console.log(`🌱 Seeding Template: ${CATEGORY} v${VERSION}...`);

  // --- STEP 1: CREATE RECOVERY TEMPLATE ---
  const canonicalPlanJson = getCanonicalPlanJsonV2();
  const canonicalSourcesJson = defaultSourcesJson();
  const canonicalTitle = "General Outpatient Recovery Plan (Educational)";

  const existing = await prisma.recoveryPlanTemplate.findFirst({
    where: {
      clinicTag: null,
      category: CATEGORY,
      version: VERSION
    },
    select: { id: true, planJson: true },
  });

  const existingValid = existing ? isValidPlanJsonV2(existing.planJson) : false;

  let template;
  if (existing) {
    template = await prisma.recoveryPlanTemplate.update({
      where: { id: existing.id },
      data: {
        title: canonicalTitle,
        sourcesJson: canonicalSourcesJson as any,
        ...(existingValid ? {} : { planJson: canonicalPlanJson as any }),
      }
    });
  } else {
    template = await prisma.recoveryPlanTemplate.create({
      data: {
        clinicTag: null,
        category: CATEGORY,
        version: VERSION,
        title: canonicalTitle,
        sourcesJson: canonicalSourcesJson as any,
        planJson: canonicalPlanJson as any,
      }
    });
  }

  // --- STEP 2: CREATE THE TEST CLINIC CONFIG ---
  // Note: Based on your migrations, the table is "clinicPlanConfig" and the key is "clinicTag"
  console.log(`🏥 Ensuring Clinic Config '${TEST_CLINIC_TAG}' exists...`);

  await prisma.clinicPlanConfig.upsert({
    where: { clinicTag: TEST_CLINIC_TAG },
    update: {}, 
    create: {
      clinicTag: TEST_CLINIC_TAG,
      defaultCategory: CATEGORY,
      overridesJson: Prisma.JsonNull, // Using Prisma-specific Null for JSON fields
    }
  });

  // --- STEP 3: CREATE ACTIVATION CODES ---
  console.log(`🔑 Generating Demo Codes linked to '${TEST_CLINIC_TAG}'...`);
  
  for (const code of DEMO_CODES) {
    await prisma.activationCode.upsert({
      where: { code },
      update: {},
      create: { 
        code, 
        clinicTag: TEST_CLINIC_TAG, 
        status: ActivationCodeStatus.ISSUED 
      },
    });
  }

  const pj: any = template.planJson;
  const modulesCount = pj?.modules ? Object.keys(pj.modules).length : 0;
  const daysCount = Array.isArray(pj?.days) ? pj.days.length : 0;

  console.log("✅ Seed complete");
  console.log("Template Status:", {
    id: template.id,
    version: template.version,
    planJsonWasPreserved: Boolean(existing && existingValid),
    modulesCount,
    daysCount,
  });
}

function defaultSourcesJson() {
  return {
    source: "MedlinePlus.gov",
    links: [
      { title: "Surgical wound care", url: "https://medlineplus.gov/surgicalwoundcare.html" },
      { title: "Pain medicines", url: "https://medlineplus.gov/painrelievers.html" },
      { title: "Preventing infections", url: "https://medlineplus.gov/infectioncontrol.html" },
    ],
    disclaimer: "Educational information only. Not medical advice.",
  };
}

function getCanonicalPlanJsonV2() {
  return {
    title: "General Outpatient Recovery Plan",
    schemaVersion: 2,
    disclaimer: "Educational information only. Not medical advice.",
    days: [
      {
        day: 0,
        phase: "early",
        title: "Day 0: Welcome Home",
        moduleIds: ["checkin_overall", "track_pain", "rf_emergency", "rf_worsening"],
        boxItems: ["box_gauze", "box_tape", "box_coldpack"],
      },
    ],
    modules: {
      checkin_overall: { id: "checkin_overall", type: "survey", title: "Daily Check-in", body: "How are you feeling overall today?" },
      track_pain: { id: "track_pain", type: "tracker", title: "Pain Tracker", body: "Rate your pain on a 0–10 scale." },
      track_sleep: { id: "track_sleep", type: "tracker", title: "Sleep Tracker", body: "About how many hours did you sleep?" },
      track_swelling: { id: "track_swelling", type: "tracker", title: "Swelling Check", body: "Does the area look more swollen?" },
      rf_emergency: { id: "rf_emergency", type: "red_flag", severity: "emergency", title: "Emergency Symptoms", body: "Seek emergency care immediately for severe symptoms." },
      rf_worsening: { id: "rf_worsening", type: "red_flag", severity: "urgent", title: "Worsening Symptoms", body: "Contact your clinician if symptoms feel unmanageable." },
      rf_infection: { id: "rf_infection", type: "red_flag", severity: "high", title: "Possible Infection", body: "Watch for fever, redness, or drainage." },
      edu_wound: { id: "edu_wound", type: "education", title: "Incision Care", body: "Keep the area clean and dry." },
      edu_mobility: { id: "edu_mobility", type: "education", title: "Safe Movement", body: "Follow mobility restrictions from your care team." },
      edu_followup: { id: "edu_followup", type: "education", title: "Follow-up Planning", body: "Keep track of your appointments." },
      edu_longterm: { id: "edu_longterm", type: "education", title: "Long-term Recovery", body: "Gradual consistency matters." },
    },
  };
}

main()
  .catch((e) => {
    console.error("❌ Seed failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });