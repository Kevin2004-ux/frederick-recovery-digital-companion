import crypto from "crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma.js";

const CODE_PREFIX = "FR";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type CreateActivationBatchWithCodesInput = {
  clinicTag: string;
  quantity: number;
  boxType?: string | null;
  includedItems?: unknown[] | null;
  educationBundleId?: string | null;
  boxTemplateId?: string | null;
  clinicOrderId?: string | null;
  productMode: string;
  procedureName?: string | null;
  createdByUserId?: string | null;
};

function randomChunk(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = "";

  for (let i = 0; i < len; i++) {
    out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }

  return out;
}

export function makeActivationCode(): string {
  return `${CODE_PREFIX}-${randomChunk(4)}-${randomChunk(4)}`;
}

export async function createActivationBatchWithCodes(
  input: CreateActivationBatchWithCodesInput,
) {
  return prisma.$transaction(async (tx) => {
    await tx.clinicPlanConfig.upsert({
      where: { clinicTag: input.clinicTag },
      update: {},
      create: {
        clinicTag: input.clinicTag,
        defaultCategory: "general_outpatient",
        overridesJson: Prisma.JsonNull,
      },
    });

    const createdBatch = await tx.activationBatch.create({
      data: {
        id: crypto.randomUUID(),
        clinicTag: input.clinicTag,
        quantity: input.quantity,
        boxType: input.boxType ?? null,
        includedItemsJson: input.includedItems
          ? (input.includedItems as unknown as Prisma.InputJsonValue)
          : undefined,
        educationBundleId: input.educationBundleId ?? null,
        boxTemplateId: input.boxTemplateId ?? null,
        clinicOrderId: input.clinicOrderId ?? null,
        productMode: input.productMode,
        procedureName: input.procedureName ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
    });

    let insertedTotal = 0;
    let safety = 0;

    while (insertedTotal < input.quantity) {
      safety += 1;
      if (safety > 25) throw new Error("CODE_GEN_EXHAUSTED");

      const remaining = input.quantity - insertedTotal;
      const genCount = Math.min(remaining, 2000);
      const data = Array.from({ length: genCount }).map(() => ({
        code: makeActivationCode(),
        clinicTag: input.clinicTag,
        batchId: createdBatch.id,
        educationBundleId: input.educationBundleId ?? null,
        boxTemplateId: input.boxTemplateId ?? null,
        productMode: input.productMode,
        procedureName: input.procedureName ?? null,
      }));

      const created = await tx.activationCode.createMany({
        data,
        skipDuplicates: true,
      });

      insertedTotal += created.count;
    }

    return createdBatch;
  });
}
