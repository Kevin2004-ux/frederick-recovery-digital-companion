// app/backend/prisma/seed.ts
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
      // you can safely update planJson over time while keeping version fixed if you want,
      // but long-term you'll likely bump version and keep old versions immutable.
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
  // If you don't want this, delete this block.
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
  // Keep this schema stable for the frontend:
  // - days: array of day objects
  // - each day: title, goals, redFlags, checkInPrompt, boxItems, learnMore
  return {
    schemaVersion: 1,
    title: "General Outpatient Recovery Plan",
    disclaimer:
      "Educational information only. This is not medical advice, diagnosis, or treatment. Always follow your surgeon/clinician’s instructions.",
    days: [
      {
        day: 0,
        title: "Day 0: The day you activate your box",
        goals: [
          "Rest and focus on comfort",
          "Review your recovery box items",
          "Complete today’s check-in",
        ],
        redFlags: [
          "Trouble breathing",
          "Chest pain",
          "Uncontrolled bleeding",
          "Fever with worsening symptoms",
        ],
        checkInPrompt: "How are your pain, swelling, and overall comfort today?",
        boxItems: ["gauze", "tape", "cold_pack"],
        learnMore: ["wound_care", "pain_management"],
      },
      {
        day: 1,
        title: "Day 1: Support healing with basic routines",
        goals: [
          "Keep the area clean and dry as directed",
          "Use cold packs if appropriate",
          "Hydrate and prioritize sleep",
        ],
        redFlags: [
          "Rapidly increasing redness",
          "Pus-like drainage",
          "Worsening pain despite rest",
        ],
        checkInPrompt: "Any new symptoms since yesterday?",
        boxItems: ["gauze", "cold_pack"],
        learnMore: ["wound_care", "infection_prevention"],
      },
      {
        day: 2,
        title: "Day 2: Monitor progress and reduce strain",
        goals: [
          "Continue gentle movement as tolerated",
          "Avoid heavy lifting",
          "Track pain and swelling trends",
        ],
        redFlags: ["New dizziness or fainting", "Severe nausea/vomiting"],
        checkInPrompt: "Are you improving, stable, or worse than yesterday?",
        boxItems: ["gauze", "tape"],
        learnMore: ["pain_management"],
      },
      {
        day: 3,
        title: "Day 3: Reassess and plan the week",
        goals: [
          "Stick to your routine",
          "Confirm you understand your post-op instructions",
          "Keep logs consistent",
        ],
        redFlags: ["Symptoms that are getting worse day-to-day"],
        checkInPrompt: "What is one thing that improved since Day 0?",
        boxItems: ["gauze", "tape"],
        learnMore: ["wound_care"],
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
