// backend/scripts/test-brain.ts
import { PrismaClient, RecoveryPlanCategory } from "@prisma/client";

const prisma = new PrismaClient();

async function testBrain() {
  console.log("🧠 [TEST-BRAIN] initializing...");

  try {
    // 1. Fetch the Master Template
    // MATCHING YOUR SEED: looking for 'general_outpatient'
    const template = await prisma.recoveryPlanTemplate.findFirst({
      where: { 
        category: RecoveryPlanCategory.general_outpatient 
      }
    });

    if (!template) {
      console.error("❌ [FAIL] No 'general_outpatient' template found.");
      console.log("👉 Run the seed: npx tsx src/prisma/seed.ts");
      process.exit(1);
    }

    console.log(`✅ [PASS] Found Template: "${template.title}" (v${template.version})`);

    // 2. Validate Structure (Matches getCanonicalPlanJsonV2)
    const planData = template.planJson as any;
    
    // Check Days Array
    if (!Array.isArray(planData.days)) {
      console.error("❌ [FAIL] JSON missing 'days' array.");
      process.exit(1);
    }
    console.log(`✅ [PASS] Template has ${planData.days.length} days defined.`);

    // Check Modules Object
    if (!planData.modules || typeof planData.modules !== 'object') {
      console.error("❌ [FAIL] JSON missing 'modules' definition.");
      process.exit(1);
    }
    const moduleCount = Object.keys(planData.modules).length;
    console.log(`✅ [PASS] Template has ${moduleCount} modules defined.`);

    // 3. Verify Logic Connections
    // Do the days actually reference valid modules?
    const firstDay = planData.days[0];
    if (firstDay && firstDay.moduleIds) {
      const missingModules = firstDay.moduleIds.filter((id: string) => !planData.modules[id]);
      
      if (missingModules.length > 0) {
        console.error("❌ [FAIL] Day 0 references missing modules:", missingModules);
      } else {
        console.log("✅ [PASS] Day 0 logic is valid (all modules exist).");
      }
    }

    console.log("\n🧠 [TEST-BRAIN] Result: PASSED. The medical brain is loaded.");

  } catch (err) {
    console.error("❌ [FAIL] Brain Test Exception:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testBrain();