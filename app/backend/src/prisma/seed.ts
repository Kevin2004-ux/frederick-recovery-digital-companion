// app/backend/src/prisma/seed.ts
import { PrismaClient, RecoveryPlanCategory } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY = RecoveryPlanCategory.general_outpatient;
const VERSION = 2;

const DEMO_CODES = ["FR-DEMO-0001", "FR-DEMO-0002", "FR-DEMO-0003"] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidPlanJsonV2(planJson: unknown): boolean {
  if (!isPlainObject(planJson)) return false;

  const days = (planJson as any).days;
  const modules = (planJson as any).modules;

  const hasDays = Array.isArray(days);
  const hasModules = isPlainObject(modules) && Object.keys(modules).length > 0;

  return hasDays && hasModules;
}

async function main() {
  console.log(`🌱 Seeding Template: ${CATEGORY} v${VERSION}...`);

  const canonicalPlanJson = getCanonicalPlanJsonV2();
  const canonicalSourcesJson = defaultSourcesJson();
  const canonicalTitle = "General Outpatient Recovery Plan (Educational)";

  // Read existing v2 template (if any)
  const existing = await prisma.recoveryPlanTemplate.findUnique({
    where: { category_version: { category: CATEGORY, version: VERSION } },
    select: { id: true, planJson: true },
  });

  const existingValid = existing ? isValidPlanJsonV2(existing.planJson) : false;

  // If it's broken (your current bug), overwrite it. Otherwise preserve.
  const template = await prisma.recoveryPlanTemplate.upsert({
    where: { category_version: { category: CATEGORY, version: VERSION } },
    update: {
      title: canonicalTitle,
      sourcesJson: canonicalSourcesJson,

      // ✅ Fix: write planJson if existing is missing/invalid
      ...(existingValid ? {} : { planJson: canonicalPlanJson }),
    },
    create: {
      category: CATEGORY,
      version: VERSION,
      title: canonicalTitle,
      sourcesJson: canonicalSourcesJson,

      // ✅ Fix: create must never be {}
      planJson: canonicalPlanJson,
    },
  });

  // Deterministic demo activation codes (never overwrite)
  for (const code of DEMO_CODES) {
    await prisma.activationCode.upsert({
      where: { code },
      update: {},
      create: { code, clinicTag: null },
    });
  }

  // Diagnostics
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
    sourcesJsonIsNull: template.sourcesJson == null,
  });
  console.log("Demo Activation Codes:", DEMO_CODES);

  if (modulesCount === 0) {
    console.warn(
      "⚠️ WARNING: modulesCount is 0. Engine will drop rules as unknown modules."
    );
  }
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

/**
 * Canonical Template V2
 * Must include every module ID that the engine injects, otherwise they'll be dropped as “unknown”.
 * Your generatePlan.ts uses:
 * - ensure21Days default moduleIds: checkin_overall, track_pain, rf_emergency, rf_worsening
 * - applyRules adds: track_sleep, track_swelling, edu_wound, rf_infection, edu_mobility, edu_followup, edu_longterm
 */
function getCanonicalPlanJsonV2() {
  return {
    title: "General Outpatient Recovery Plan",
    schemaVersion: 2,

    disclaimer:
      "Educational information only. Not medical advice. This plan is for general recovery support and tracking. If symptoms are severe, worsening, or feel urgent, contact your clinician or seek emergency care.",

    // Minimal seed day(s) is fine — your engine ensure21Days() fills 0..20.
    days: [
      {
        day: 0,
        phase: "early",
        title: "Day 0: Welcome Home",
        moduleIds: ["checkin_overall", "track_pain", "rf_emergency", "rf_worsening"],
        boxItems: ["box_gauze", "box_tape", "box_coldpack"],
      },
    ],

    // ✅ THE MODULE LIBRARY: required for modulesResolved
    modules: {
      // --- TRACKING ---
      checkin_overall: {
        id: "checkin_overall",
        type: "survey",
        title: "Daily Check-in",
        body: "How are you feeling overall today?",
      },
      track_pain: {
        id: "track_pain",
        type: "tracker",
        title: "Pain Tracker",
        body: "Rate your pain on a 0–10 scale.",
      },
      track_sleep: {
        id: "track_sleep",
        type: "tracker",
        title: "Sleep Tracker",
        body: "About how many hours did you sleep?",
      },
      track_swelling: {
        id: "track_swelling",
        type: "tracker",
        title: "Swelling Check",
        body: "Does the area look more swollen than yesterday?",
      },

      // --- RED FLAGS (Education-only; encourage seeking care) ---
      rf_emergency: {
        id: "rf_emergency",
        type: "red_flag",
        severity: "emergency",
        title: "Emergency Symptoms",
        body: "If you have severe symptoms (e.g., chest pain, trouble breathing, uncontrolled bleeding, fainting), seek emergency care immediately.",
      },
      rf_worsening: {
        id: "rf_worsening",
        type: "red_flag",
        severity: "urgent",
        title: "Worsening Symptoms",
        body: "If symptoms are rapidly worsening or feel unmanageable, contact your clinician promptly.",
      },
      rf_infection: {
        id: "rf_infection",
        type: "red_flag",
        severity: "high",
        title: "Possible Infection Signs",
        body: "Contact your clinician if you notice fever, increasing redness, warmth, drainage, or worsening pain around the incision.",
      },

      // --- EDUCATION ---
      edu_wound: {
        id: "edu_wound",
        type: "education",
        title: "Incision Care Basics",
        body: "Follow your discharge instructions for incision care. Keep the area clean and dry unless told otherwise.",
      },
      edu_mobility: {
        id: "edu_mobility",
        type: "education",
        title: "Safe Movement",
        body: "Move gently and follow any mobility restrictions from your care team. Avoid strain or sudden increases in activity.",
      },
      edu_followup: {
        id: "edu_followup",
        type: "education",
        title: "Follow-up Planning",
        body: "Keep track of follow-up appointments and questions for your clinician.",
      },
      edu_longterm: {
        id: "edu_longterm",
        type: "education",
        title: "Long-term Recovery",
        body: "Recovery often continues after you feel better. Gradual consistency matters.",
      },

      // Optional: if these IDs appear in your audit logs elsewhere
      edu_rest: {
        id: "edu_rest",
        type: "education",
        title: "Rest and Recovery",
        body: "Sleep and rest support recovery. Aim for consistent rest habits when possible.",
      },
      edu_hydration: {
        id: "edu_hydration",
        type: "education",
        title: "Hydration",
        body: "Hydration supports overall wellness. Follow any fluid guidance from your clinician if provided.",
      },
    },

    meta: {
      seeded: true,
      canonicalVersion: "v2",
      note: "Seeded via prisma/seed.ts canonical template",
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
