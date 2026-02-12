// app/backend/src/prisma/seed.ts
import { PrismaClient, RecoveryPlanCategory } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1) Seed a default RecoveryPlanTemplate (general_outpatient v1)
  const template = await prisma.recoveryPlanTemplate.upsert({
    where: {
      category_version: {
        category: RecoveryPlanCategory.general_outpatient,
        version: 1,
      },
    },
    update: {
      title: "General Outpatient Recovery Plan (Educational)",
      // You can safely update planJson over time while keeping version fixed for dev,
      // but for production clinics you’ll likely bump version and keep old versions immutable.
      planJson: defaultGeneralOutpatientPlanJson(),
      sourcesJson: defaultSourcesJson(),
    },
    create: {
      category: RecoveryPlanCategory.general_outpatient,
      version: 1,
      title: "General Outpatient Recovery Plan (Educational)",
      planJson: defaultGeneralOutpatientPlanJson(),
      sourcesJson: defaultSourcesJson(),
    },
  });

  // 2) Optional: seed a few ActivationCodes for testing
  const testCodes = ["FR-DEMO-0001", "FR-DEMO-0002", "FR-DEMO-0003"];

  for (const code of testCodes) {
    await prisma.activationCode.upsert({
      where: { code },
      update: {}, // don't overwrite claimed codes
      create: {
        code,
        // status defaults to UNUSED
        clinicTag: null,
      },
    });
  }

  console.log("✅ Seed complete");
  console.log("Template:", {
    id: template.id,
    category: template.category,
    version: template.version,
    title: template.title,
  });
  console.log("Test Activation Codes:", testCodes);
}

function defaultSourcesJson() {
  return {
    source: "MedlinePlus.gov",
    links: [
      {
        title: "Surgical wound care (general information)",
        url: "https://medlineplus.gov/surgicalwoundcare.html",
      },
      {
        title: "Pain medicines (general information)",
        url: "https://medlineplus.gov/painrelievers.html",
      },
      {
        title: "Preventing infections (general information)",
        url: "https://medlineplus.gov/infectioncontrol.html",
      },
    ],
    disclaimer:
      "Educational information only. Not medical advice. If you have urgent symptoms, contact your clinician or seek emergency care.",
  };
}

function defaultGeneralOutpatientPlanJson() {
  // Template schemaVersion 2 (Brain-compatible)
  return {
    schemaVersion: 2,
    title: "General Outpatient Recovery Plan",
    disclaimer:
      "Educational information only. This is not medical advice, diagnosis, or treatment. Always follow your clinician’s instructions.",

    // Minimal vetted module library (expand over time; IDs must remain stable)
    modules: {
      checkin_overall: { id: "checkin_overall", kind: "track", title: "Daily check-in (overall)" },
      track_pain: { id: "track_pain", kind: "track", title: "Track pain" },
      track_swelling: { id: "track_swelling", kind: "track", title: "Track swelling" },
      track_sleep: { id: "track_sleep", kind: "track", title: "Track sleep/rest" },

      edu_wound: { id: "edu_wound", kind: "edu", title: "Wound care basics (education)" },
      edu_mobility: { id: "edu_mobility", kind: "edu", title: "Mobility safety (education)" },
      edu_followup: { id: "edu_followup", kind: "edu", title: "Follow-up reminders (education)" },
      edu_longterm: { id: "edu_longterm", kind: "edu", title: "Longer-term recovery habits (education)" },

      rf_emergency: { id: "rf_emergency", kind: "red_flag", title: "Emergency red flags" },
      rf_worsening: { id: "rf_worsening", kind: "red_flag", title: "Symptoms getting worse" },
      rf_infection: { id: "rf_infection", kind: "red_flag", title: "Possible infection warning signs" },
    },

    // Only a few base days are required; generator will fill to 21 days deterministically
    days: [
      {
        day: 0,
        phase: "early",
        title: "Day 0: Getting started",
        moduleIds: ["checkin_overall", "track_pain", "rf_emergency", "rf_worsening"],
        boxItems: ["box_gauze", "box_tape", "box_coldpack"],
      },
      {
        day: 1,
        phase: "early",
        title: "Day 1: Keep it simple",
        moduleIds: ["checkin_overall", "track_pain", "rf_worsening"],
        boxItems: ["box_gauze", "box_coldpack"],
      },
      {
        day: 2,
        phase: "early",
        title: "Day 2: Watch trends",
        moduleIds: ["checkin_overall", "track_pain", "rf_worsening"],
        boxItems: ["box_gauze", "box_tape"],
      },
      {
        day: 3,
        phase: "early",
        title: "Day 3: Stay consistent",
        moduleIds: ["checkin_overall", "track_pain", "rf_worsening"],
        boxItems: ["box_gauze", "box_tape"],
      },
    ],
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
