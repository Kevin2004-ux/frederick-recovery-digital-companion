// app/backend/src/services/plan/generatePlan.ts
import { Prisma } from "@prisma/client";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type GeneratePlanInput = {
  templatePlanJson: unknown; // from RecoveryPlanTemplate.planJson
  clinicOverridesJson?: unknown; // from ClinicPlanConfig.overridesJson
  config: unknown; // validated categorical config (non-PHI)
  engineVersion: string; // e.g., "v1"
  category: string; // template.category
};

export type GeneratePlanOutput = {
  planJson: Prisma.InputJsonValue;
  // configJson stored separately on the instance; returned here for convenience
  configJson: Prisma.InputJsonValue;
};

/**
 * Deterministic plan generator stub (v1)
 *
 * For now:
 * - Uses template.planJson as base
 * - Adds clinic overrides under `overrides`
 * - Adds safe metadata under `meta` (engineVersion/category/config)
 *
 * No randomization, no time dependence.
 */
export function generatePlan(input: GeneratePlanInput): GeneratePlanOutput {
  const base = isPlainObject(input.templatePlanJson) ? input.templatePlanJson : {};
  const overrides = isPlainObject(input.clinicOverridesJson) ? input.clinicOverridesJson : {};

  const configJson = input.config as Prisma.InputJsonValue;

  const planJson = {
    ...(base as Record<string, unknown>),
    overrides: overrides as Record<string, unknown>,
    meta: {
      engineVersion: input.engineVersion,
      category: input.category,
      config: input.config,
    },
  } as Prisma.InputJsonValue;

  return { planJson, configJson };
}
